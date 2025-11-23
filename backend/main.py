# main.py
# AutoFB backend - FastAPI
#
# Mục đích file:
# - Lưu bài + ảnh vào SQLite
# - Cho phép upload ảnh lên server
# - Lên lịch đăng bài bằng APScheduler
# - Gọi Facebook Graph API để đăng bài / upload ảnh lên page
# - Quản lý token Facebook
#
# Mình giữ nguyên logic của file gốc bạn gửi, chỉ thêm comment tiếng Việt chi tiết
# để bạn dễ theo dõi và sửa.

# ------------------------------
# IMPORTS
# ------------------------------
# FastAPI + utilities
from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles

# SQLAlchemy ORM
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

# Pydantic schema
from pydantic import BaseModel

# Standard / 3rd-party libs
from datetime import datetime, timedelta, timezone
from typing import List, Optional
import requests
import json
import os
import uuid
import shutil
import re
# Scheduler
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger

# Server runner
import uvicorn

# ------------------------------
# DATABASE SETUP
# ------------------------------
# Database URL: dùng SQLite file local tên autofb.db
# Nếu bạn muốn dùng PostgreSQL / MySQL production thì thay cái URL này.
SQLALCHEMY_DATABASE_URL = "sqlite:///./autofb.db"

# create_engine tạo engine kết nối DB.
# connect_args={"check_same_thread": False} là cần thiết với SQLite khi dùng trong multithread (FastAPI + uvicorn).
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

# SessionLocal - factory để tạo session (khi cần truy vấn DB trong request)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class cho các model SQLAlchemy
Base = declarative_base()

# ------------------------------
# UPLOADS FOLDER
# ------------------------------
# Thư mục lưu file upload (ảnh). Tạo nếu chưa có.
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ------------------------------
# DATABASE MODELS (SQLAlchemy)
# ------------------------------
# Đây là 4 bảng chính: User, FacebookToken, Post, PostImage
# Mỗi class tương ứng 1 bảng trong SQLite.
from dotenv import load_dotenv
from google import genai
from google.genai.errors import APIError # Thêm thư viện xử lý lỗi
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Load environment variables (Khóa API)
load_dotenv()

# ------------------------------
# KHỞI TẠO CLIENT GEMINI
# ------------------------------
gemini_key = os.getenv("GEMINI_API_KEY") # Đổi tên biến môi trường thành GEMINI_API_KEY
if not gemini_key:
    print("CẢNH BÁO: GEMINI_API_KEY không được tìm thấy trong .env hoặc ENV.")
    # Khởi tạo Client không có key, nó sẽ tìm trong môi trường
    client = genai.Client()
else:
    # Key có, khởi tạo Client
    client = genai.Client(api_key=gemini_key)
# ------------------------------

 


# --- Thêm Pydantic Model cho Request ---
class GenerateContentRequest(BaseModel):
    prompt: str

class User(Base):
    """
    Bảng users:
    - id: khóa chính
    - username, email, hashed_password: thông tin người dùng (demo, chưa dùng auth thực sự)
    - created_at: thời gian tạo
    """
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class FacebookToken(Base):
    """
    Bảng lưu token của Facebook Page:
    - user_id: id user trong hệ thống (demo dùng user_id = 1)
    - access_token: token page dùng để gọi Graph API
    - page_id, page_name: thông tin page
    - expires_at: khi token hết hạn (ước lượng)
    """
    __tablename__ = "facebook_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    access_token = Column(String)
    page_id = Column(String)
    page_name = Column(String)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class Post(Base):
    """
    Bảng posts:
    - user_id: id người tạo
    - content: nội dung bài
    - scheduled_time: thời gian dự định đăng (datetime)
    - posted: boolean (đã được đăng chưa)
    - facebook_post_id: id trả về từ Facebook sau khi đăng
    - created_at, posted_at
    """
    __tablename__ = "posts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    content = Column(Text)
    scheduled_time = Column(DateTime)
    posted = Column(Boolean, default=False)
    facebook_post_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    posted_at = Column(DateTime, nullable=True)


class PostImage(Base):
    """
    Bảng post_images:
    - mỗi record liên quan tới 1 ảnh kèm bài đăng
    - image_url: nếu ảnh là URL ngoài (không upload)
    - image_path: nếu ảnh được upload và lưu ở UPLOAD_DIR
    - facebook_photo_id: ID ảnh sau khi upload lên Facebook (nếu có)
    """
    __tablename__ = "post_images"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, index=True)
    image_url = Column(String, nullable=True)  # External URL
    image_path = Column(String, nullable=True)  # Local file path
    facebook_photo_id = Column(String, nullable=True)  # Facebook photo ID after upload
    created_at = Column(DateTime, default=datetime.utcnow)

# Tạo bảng nếu chưa có (chỉ tạo cấu trúc DB)
Base.metadata.create_all(bind=engine)

# ------------------------------
# Pydantic models (request/response)
# ------------------------------
# Các schema này giúp FastAPI validate và tự động sinh tài liệu / docs

class PostImageCreate(BaseModel):
    """
    Schema khi client gửi thông tin ảnh kèm post:
    - image_url hoặc image_path (1 trong 2)
    """
    image_url: Optional[str] = None
    image_path: Optional[str] = None

class PostImageResponse(BaseModel):
    """
    Schema trả về thông tin ảnh (response)
    - Mình không bật orm_mode ở đây để giữ cấu trúc giống file gốc,
      nhưng nếu bạn gặp lỗi kiểu "Object of type X is not JSON serializable",
      có thể thêm `class Config: orm_mode = True`.
    """
    id: int
    post_id: int
    image_url: Optional[str]
    image_path: Optional[str]
    facebook_photo_id: Optional[str]
    created_at: datetime

class PostCreate(BaseModel):
    """
    Schema khi tạo bài:
    - content: nội dung bài
    - scheduled_time: thời gian dự định đăng (datetime)
    - images: danh sách ảnh (PostImageCreate)
    """
    content: str
    scheduled_time: datetime
    images: List[PostImageCreate] = []

class PostResponse(BaseModel):
    """
    Schema trả về thông tin bài:
    - images: List[PostImageResponse]
    """
    id: int
    content: str
    scheduled_time: datetime
    posted: bool
    facebook_post_id: Optional[str]
    created_at: datetime
    posted_at: Optional[datetime]
    images: List[PostImageResponse] = []

class FacebookTokenCreate(BaseModel):
    """
    Schema tạo token Facebook:
    - access_token: token page
    - page_id: id của page
    - page_name: tên page (tùy chọn)
    """
    access_token: str
    page_id: str
    page_name: str

class FacebookTokenResponse(BaseModel):
    """
    Schema trả về token:
    - expires_at: ngày hết hạn ước lượng
    """
    id: int
    page_id: str
    page_name: str
    expires_at: Optional[datetime]
    created_at: datetime

# ------------------------------
# FASTAPI APP SETUP
# ------------------------------
app = FastAPI(title="AutoFB API", version="1.0.0")

# Mount static files: cho phép truy cập trực tiếp ảnh đã upload qua URL /uploads/<filename>
# Ví dụ: http://localhost:8000/uploads/abcd.jpg
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# CORS middleware: cho phép frontend (ví dụ React dev server) gọi API
# Nếu deploy production, hãy chỉnh allow_origins phù hợp hoặc dùng env var
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # mặc định dev React
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security placeholder (file gốc khai báo nhưng chưa dùng)
security = HTTPBearer()

# ------------------------------
# Dependency: lấy DB session cho mỗi request
# ------------------------------
def get_db():
    """
    Dependency để tạo/đóng session DB cho từng request.
    FastAPI sẽ gọi get_db và yield session; sau request xong thì finally chạy để close().
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ------------------------------
# Facebook Graph API helper
# ------------------------------
class FacebookAPI:
    """
    Lớp helper chứa các static methods gọi Facebook Graph API:
    - upload_photo: upload 1 ảnh (published hoặc unpublished tuỳ param)
    - post_to_facebook_with_images: logic đăng text / 1 ảnh / nhiều ảnh
    - get_page_info: verify token + lấy tên page
    """

    @staticmethod
    def upload_photo(access_token: str, page_id: str, image_path: str, message: str = None):
        """
        Upload 1 ảnh lên /{page_id}/photos
        Trả về JSON nếu ok, ngược lại raise HTTPException.
        """
        url = f"https://graph.facebook.com/v18.0/{page_id}/photos"
        
        with open(image_path, 'rb') as image_file:
            files = {'source': image_file}
            data = {'access_token': access_token}
            if message:
                data['message'] = message
            
            response = requests.post(url, files=files, data=data)
        
        if response.status_code == 200:
            return response.json()
        else:
            # Trả lỗi về client dưới dạng HTTPException để frontend biết
            raise HTTPException(status_code=400, detail=f"Facebook photo upload error: {response.text}")
    
    @staticmethod
    def post_to_facebook_with_images(access_token: str, page_id: str, content: str, images: List[dict]):
        """
        Hàm này xử lý 3 trường hợp:
        1) Không có images => đăng text-only lên /{page_id}/feed
        2) 1 ảnh => dùng /{page_id}/photos với published=true (ảnh có kèm message)
        3) Nhiều ảnh => từng ảnh upload với published=false (để lấy media_fbid),
           sau đó gọi /{page_id}/feed với attached_media=[{"media_fbid":id}, ...]
        images: list of dict { 'image_path': <local path> OR 'image_url': <external url> }
        """
        # ---------- case: text only ----------
        if not images:
            url = f"https://graph.facebook.com/v18.0/{page_id}/feed"
            data = {
                "message": content,
                "access_token": access_token
            }
            response = requests.post(url, data=data)
            
            if response.status_code == 200:
                return {
                    "post_id": response.json().get("id"),
                    "uploaded_media": [],
                    "facebook_response": response.json()
                }
            else:
                # Log và trả lỗi
                print(f"Facebook API Error: {response.text}")
                raise HTTPException(status_code=400, detail=f"Facebook API error: {response.text}")
        
        # ---------- case: single image ----------
        elif len(images) == 1:
            image = images[0]
            # Nếu có file local -> upload file kèm message
            if image.get('image_path') and os.path.exists(image['image_path']):
                url = f"https://graph.facebook.com/v18.0/{page_id}/photos"
                with open(image['image_path'], 'rb') as image_file:
                    files = {'source': image_file}
                    data = {
                        'message': content,
                        'published': 'true',
                        'access_token': access_token
                    }
                    response = requests.post(url, files=files, data=data)
            # Nếu client cung cấp image_url (external) -> gửi URL cho FB tải
            elif image.get('image_url'):
                url = f"https://graph.facebook.com/v18.0/{page_id}/photos"
                data = {
                    "url": image['image_url'],
                    "message": content,
                    "published": "true",
                    "access_token": access_token
                }
                response = requests.post(url, data=data)
            else:
                # Không có image hợp lệ
                raise HTTPException(status_code=400, detail="No valid image provided")
            
            if response.status_code == 200:
                result = response.json()
                # Trường hợp 1 ảnh FB trả về id ảnh (đôi khi id này cũng chính là post id)
                return {
                    "post_id": result.get("id"),
                    "uploaded_media": [{"media_fbid": result.get("id")}],
                    "facebook_response": result
                }
            else:
                print(f"Facebook Single Photo Error: {response.text}")
                raise HTTPException(status_code=400, detail=f"Facebook photo upload error: {response.text}")
        
        # ---------- case: multiple images ----------
        else:
            uploaded_media = []
            
            # Step 1: upload each photo as unpublished để chỉ lấy media_fbid
            for image in images:
                if image.get('image_path') and os.path.exists(image['image_path']):
                    url = f"https://graph.facebook.com/v18.0/{page_id}/photos"
                    with open(image['image_path'], 'rb') as image_file:
                        files = {'source': image_file}
                        data = {
                            'published': 'false',  # unpublished: FB sẽ trả media id nhưng không hiển thị riêng lẻ
                            'access_token': access_token
                        }
                        response = requests.post(url, files=files, data=data)
                elif image.get('image_url'):
                    url = f"https://graph.facebook.com/v18.0/{page_id}/photos"
                    data = {
                        "url": image['image_url'],
                        "published": "false",  # unpublished
                        "access_token": access_token
                    }
                    response = requests.post(url, data=data)
                else:
                    # Nếu entry không hợp lệ, bỏ qua
                    print(f"Skipping invalid image: {image}")
                    continue
                
                if response.status_code == 200:
                    photo_id = response.json().get("id")
                    if photo_id:
                        uploaded_media.append({"media_fbid": photo_id})
                        print(f"Successfully uploaded photo: {photo_id}")
                    else:
                        # FB không trả id? log để debug
                        print(f"No photo ID in response: {response.json()}")
                else:
                    # Nếu 1 ảnh fail -> throw lỗi tổng thể
                    print(f"Failed to upload photo: {response.text}")
                    raise HTTPException(status_code=400, detail=f"Facebook photo upload error: {response.text}")
            
            # Step 2: nếu có uploaded_media -> tạo post trên /feed attach media
            if uploaded_media:
                url = f"https://graph.facebook.com/v18.0/{page_id}/feed"
                data = {
                    "message": content,
                    "attached_media": json.dumps(uploaded_media),  # phải là JSON string
                    "access_token": access_token
                }
                response = requests.post(url, data=data)
                
                if response.status_code == 200:
                    result = response.json()
                    return {
                        "post_id": result.get("id"),
                        "uploaded_media": uploaded_media,
                        "facebook_response": result
                    }
                else:
                    print(f"Facebook Feed Post Error: {response.text}")
                    raise HTTPException(status_code=400, detail=f"Facebook feed post error: {response.text}")
            else:
                # Không upload được ảnh nào
                raise HTTPException(status_code=400, detail="No photos uploaded successfully")
    
    @staticmethod
    def get_page_info(access_token: str, page_id: str):
        """
        Lấy thông tin cơ bản của page để verify token + page_id.
        Sử dụng khi client thêm token vào hệ thống.
        """
        url = f"https://graph.facebook.com/v18.0/{page_id}"
        params = {
            "fields": "name,access_token",
            "access_token": access_token
        }
        
        response = requests.get(url, params=params)
        
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(status_code=400, detail=f"Facebook API error: {response.text}")

# ------------------------------
# APSCHEDULER setup
# ------------------------------
# Dùng BackgroundScheduler để schedule các job chạy ở background
# Lưu ý: BackgroundScheduler mặc định lưu job ở memory -> nếu server restart, job mất.
# Để bền hơn, cần dùng jobstore (ví dụ SQLite jobstore hoặc Redis).
scheduler = BackgroundScheduler()
scheduler.start()

def post_scheduled_content(post_id: int):
    """
    Hàm worker do APScheduler gọi khi tới thời gian scheduled_time.
    Nó:
      - load post, images, token từ DB
      - gọi FacebookAPI.post_to_facebook_with_images(...)
      - cập nhật trạng thái post trong DB (posted, facebook_post_id, posted_at)
    """
    db = SessionLocal()  # khởi tạo session mới cho background job
    try:
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post or post.posted:
            # Nếu không tồn tại hoặc đã đăng rồi thì exit im lặng
            return
        
        # Lấy token FB của user (demo: 1 token lấy đầu tiên)
        token = db.query(FacebookToken).filter(FacebookToken.user_id == post.user_id).first()
        if not token:
            # Không có token -> không thể đăng
            return
        
        # Lấy ảnh kèm post
        images = db.query(PostImage).filter(PostImage.post_id == post_id).all()
        image_data = []
        for img in images:
            image_data.append({
                'image_url': img.image_url,
                'image_path': img.image_path
            })
        
        # Gọi FB API để đăng
        try:
            result = FacebookAPI.post_to_facebook_with_images(
                token.access_token,
                token.page_id,
                post.content,
                image_data
            )
            
            # Cập nhật trạng thái sau khi đăng thành công
            post.posted = True
            post.facebook_post_id = result.get("post_id")
            post.posted_at = datetime.now(timezone.utc)
            db.commit()
            
            print(f"Successfully posted to Facebook: {result}")
            
        except Exception as e:
            # Log lỗi, job không crash scheduler
            print(f"Error posting to Facebook: {e}")
    
    finally:
        db.close()

# ------------------------------
# API ROUTES
# ------------------------------
@app.get("/")
async def root():
    """Root endpoint - kiểm tra API đang chạy"""
    return {"message": "AutoFB API is running"}

# ------------------------------
# Upload single image
# ------------------------------
@app.post("/upload-image/")
async def upload_image(file: UploadFile = File(...)):
    """
    Endpoint upload 1 ảnh:
    - validate content_type (phải là image/)
    - lưu file vào UPLOAD_DIR với tên unique
    - trả về filename, file_path, url relative (/uploads/...), size
    """
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Tạo tên file duy nhất tránh trùng
    file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    try:
        # Lưu file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Trả thông tin file cho frontend
        return {
            "filename": unique_filename,
            "file_path": file_path,
            "url": f"/uploads/{unique_filename}",
            "size": os.path.getsize(file_path)
        }
    except Exception as e:
        # Bắt lỗi lưu file
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")
# ------------------------------
# AI Content Generation (Đã sửa lỗi logic và tối ưu cho Gemini)
# ------------------------------
@app.post("/generate-content/")
async def generate_content(request: GenerateContentRequest):
    # 1. Kiểm tra client đã được khởi tạo thành công chưa
    if client is None:
        raise HTTPException(
            status_code=500,
            detail={"error": "Dịch vụ AI (Gemini) chưa được khởi tạo. Vui lòng kiểm tra GEMINI_API_KEY."}
        )
        
    try:
        prompt = request.prompt
        
        # System Instruction: Giúp Gemini tạo nội dung chất lượng cao, chuyên nghiệp
        system_instruction = (
            "Bạn là một Copywriter và Content Creator chuyên nghiệp, thân thiện, và sáng tạo. "
            "Nhiệm vụ của bạn là nhận một mô tả cơ bản từ người dùng (ví dụ: 'Giới thiệu sản phẩm áo thun mới'), "
            "và mở rộng nó thành một bài đăng trên Facebook hấp dẫn, chuyên nghiệp và có tính kêu gọi hành động cao. "
            "Hãy đảm bảo nội dung có cấu trúc tốt (gồm tiêu đề, mô tả sản phẩm/dịch vụ, và lời kêu gọi hành động."
            "Trả về nội dung để đăng lên Facebook luôn. - Không có dấu * và ** , và không quá 2000 chữ)"
        )

        # --- Logic gọi Gemini API ---
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt],
            config={"system_instruction": system_instruction}
        )
        
        generated_text = response.text
        
        # 2. Kiểm tra nếu nội dung bị chặn (Safety filter)
        if not generated_text:
             raise HTTPException(
                status_code=400,
                detail={"error": "Nội dung bị chặn do vi phạm chính sách an toàn của Gemini. Vui lòng thử lại với prompt khác."}
            )

        # 3. Làm sạch text: Loại bỏ các Markdown bao quanh (ví dụ: ** hoặc ```) để bài đăng gọn gàng
        generated_text = re.sub(r'```[\s\S]*?```', '', generated_text).strip()
        generated_text = generated_text.replace('**', '').strip()
        generated_text = generated_text.replace('*', '').strip() # Loại bỏ các dấu * còn sót

        return {"content": generated_text}

    except APIError as e:
        # 4. Xử lý lỗi API cụ thể của Gemini (401, 429, 500)
        error_message = str(e)
        status_code = 500
        
        if "API_KEY_INVALID" in error_message or "Invalid API Key" in error_message:
            status_code = 401
            detail = "Lỗi xác thực: GEMINI_API_KEY không hợp lệ. Vui lòng kiểm tra lại Key."
        elif "RESOURCE_EXHAUSTED" in error_message or "Quota exceeded" in error_message:
            status_code = 429
            detail = "Hạn mức sử dụng (Quota) đã hết. Vui lòng kiểm tra tài khoản Gemini của bạn."
        else:
            # Lỗi API 500 hoặc các lỗi khác không thuộc 401/429
            detail = f"Lỗi API Gemini không xác định (Có thể là lỗi máy chủ Gemini): {error_message}"

        print(f"LỖI XỬ LÝ API GEMINI: {error_message}") 
        raise HTTPException(
            status_code=status_code, 
            detail={"error": detail}
        )
    except Exception as e:
        # 5. XỬ LÝ LỖI CHUNG (Internal Server Error)
        error_type = type(e).__name__
        error_detail = str(e)
        
        # IN LOG CHỦ YẾU Ở ĐÂY ĐỂ CHẨN ĐOÁN
        print("="*50)
        print(f"LỖI PYTHON NGHIÊM TRỌNG TRONG ENDPOINT AI (500 Internal):")
        # In traceback đầy đủ để chẩn đoán nguyên nhân
        traceback.print_exc()
        print(f"Loại lỗi: {error_type}")
        print(f"Chi tiết lỗi: {error_detail}")
        print("="*50)

        # Trả về loại lỗi cụ thể cho frontend
        raise HTTPException(
            status_code=500, 
            detail={"error": f"Lỗi máy chủ nội bộ: {error_type}. Vui lòng kiểm tra logs server để xem chi tiết."}
        )
# ------------------------------


# ------------------------------
# Upload multiple images
# ------------------------------
@app.post("/upload-multiple-images/")
async def upload_multiple_images(files: List[UploadFile] = File(...)):
    """
    Upload nhiều file:
    - lặp qua files, validate và lưu
    - trả danh sách file đã upload
    """
    uploaded_files = []
    
    for file in files:
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail=f"File {file.filename} must be an image")
        
        # Tạo tên file unique
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        try:
            # Save file
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            uploaded_files.append({
                "filename": unique_filename,
                "file_path": file_path,
                "url": f"/uploads/{unique_filename}",
                "size": os.path.getsize(file_path)
            })
        except Exception as e:
            # Nếu 1 file lỗi, trả lỗi kèm tên file để debug
            raise HTTPException(status_code=500, detail=f"Error uploading file {file.filename}: {str(e)}")
    
    return {"uploaded_files": uploaded_files}

# ------------------------------
# Create a new post (and schedule if needed)
# ------------------------------
@app.post("/posts/", response_model=PostResponse)
async def create_post(post: PostCreate, db: Session = Depends(get_db)):
    """
    Tạo 1 post mới:
    - Lưu Post vào DB
    - Lưu PostImage (nếu có)
    - Nếu scheduled_time > now thì thêm job vào APScheduler
    - Trả về Post (kèm images)
    """
    # Demo: dùng mặc định user_id = 1 (phải thay bằng auth sau này)
    user_id = 1
    
    db_post = Post(
        user_id=user_id,
        content=post.content,
        scheduled_time=post.scheduled_time
    )
    
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    
    # Lưu ảnh kèm bài
    for image_data in post.images:
        db_image = PostImage(
            post_id=db_post.id,
            image_url=image_data.image_url,
            image_path=image_data.image_path
        )
        db.add(db_image)
    
    db.commit()
    
    # Schedule bài nếu scheduled_time trong tương lai
    # CHÚ Ý: cần đảm bảo datetime được so sánh cùng timezone.
    # File gốc coi scheduled_time như timezone-aware nếu client gửi kèm tz.
    if post.scheduled_time > datetime.now(timezone.utc):
        scheduler.add_job(
            post_scheduled_content,
            DateTrigger(run_date=post.scheduled_time),
            args=[db_post.id],
            id=f"post_{db_post.id}"
        )
    
    # Lấy lại images để attach vào response (PostResponse)
    images = db.query(PostImage).filter(PostImage.post_id == db_post.id).all()
    db_post.images = images
    
    return db_post

# ------------------------------
# Get all posts
# ------------------------------
@app.get("/posts/", response_model=List[PostResponse])
async def get_posts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Lấy danh sách posts (có hỗ trợ pagination bằng skip/limit)
    - đối với mỗi post attach list images để client dễ hiện thị
    """
    posts = db.query(Post).offset(skip).limit(limit).all()
    
    # Attach images
    for post in posts:
        images = db.query(PostImage).filter(PostImage.post_id == post.id).all()
        post.images = images
    
    return posts

# ------------------------------
# Get single post
# ------------------------------
@app.get("/posts/{post_id}", response_model=PostResponse)
async def get_post(post_id: int, db: Session = Depends(get_db)):
    """
    Lấy chi tiết 1 post theo id (kèm images)
    """
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    images = db.query(PostImage).filter(PostImage.post_id == post.id).all()
    post.images = images
    
    return post

# ------------------------------
# Delete a post
# ------------------------------
@app.delete("/posts/{post_id}")
async def delete_post(post_id: int, db: Session = Depends(get_db)):
    """
    Xóa post:
    - Nếu post chưa đăng, cố gắng remove job scheduler
    - Xóa luôn bản ghi PostImage (và không xóa file ảnh trên disk ở đây,
      tuy nhiên bạn có thể thêm xóa file nếu muốn)
    """
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Remove scheduled job nếu chưa posted
    if not post.posted:
        try:
            scheduler.remove_job(f"post_{post_id}")
        except:
            # job có thể không tồn tại -> ignore
            pass
    
    # XÓA PostImage records (và nếu bạn muốn xóa cả file actual, thêm os.remove ở đây)
    images = db.query(PostImage).filter(PostImage.post_id == post_id).all()
    for img in images:
        # Nếu bạn muốn xóa file local: uncomment 2 dòng dưới
        # if img.image_path and os.path.exists(img.image_path):
        #     os.remove(img.image_path)
        db.delete(img)
    
    db.delete(post)
    db.commit()
    return {"message": "Post deleted successfully"}

# ------------------------------
# Facebook tokens endpoints
# ------------------------------
@app.post("/facebook-tokens/", response_model=FacebookTokenResponse)
async def create_facebook_token(token: FacebookTokenCreate, db: Session = Depends(get_db)):
    """
    Thêm token Facebook cho user:
    - Verify token bằng get_page_info
    - Lưu token + page_id vào DB
    """
    # Demo: user_id = 1
    user_id = 1
    
    # Verify token + page id trực tiếp với Facebook
    try:
        page_info = FacebookAPI.get_page_info(token.access_token, token.page_id)
    except:
        # Nếu verify thất bại -> trả lỗi
        raise HTTPException(status_code=400, detail="Invalid Facebook token or page ID")
    
    db_token = FacebookToken(
        user_id=user_id,
        access_token=token.access_token,
        page_id=token.page_id,
        page_name=token.page_name,
        expires_at=datetime.utcnow() + timedelta(days=60)  # chỉ ước lượng
    )
    
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    
    return db_token

@app.get("/facebook-tokens/", response_model=List[FacebookTokenResponse])
async def get_facebook_tokens(db: Session = Depends(get_db)):
    """
    Lấy danh sách token đã lưu (thực tế có thể cần filter theo user)
    """
    tokens = db.query(FacebookToken).all()
    return tokens

# ------------------------------
# Post immediately (bypass scheduler)
# ------------------------------
@app.post("/posts/{post_id}/post-now")
async def post_now(post_id: int, db: Session = Depends(get_db)):
    """
    Đăng bài ngay lập tức:
    - kiểm tra post tồn tại và chưa đăng
    - lấy token page
    - gọi FacebookAPI.post_to_facebook_with_images
    - cập nhật trạng thái post
    """
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post.posted:
        raise HTTPException(status_code=400, detail="Post already posted")
    
    # Lấy token FB của user
    token = db.query(FacebookToken).filter(FacebookToken.user_id == post.user_id).first()
    if not token:
        raise HTTPException(status_code=400, detail="No Facebook token found")
    
    # Lấy ảnh kèm post
    images = db.query(PostImage).filter(PostImage.post_id == post_id).all()
    image_data = []
    for img in images:
        image_data.append({
            'image_url': img.image_url,
            'image_path': img.image_path
        })
    
    try:
        result = FacebookAPI.post_to_facebook_with_images(
            token.access_token,
            token.page_id,
            post.content,
            image_data
        )
        
        # Nếu thành công -> update DB
        post.posted = True
        post.facebook_post_id = result.get("post_id")
        post.posted_at = datetime.now(timezone.utc)
        db.commit()
        
        return {
            "message": "Post published successfully", 
            "facebook_post_id": result.get("post_id"),
            "uploaded_media": result.get("uploaded_media", []),
            "facebook_response": result.get("facebook_response", {})
        }
    
    except Exception as e:
        # Log lỗi trên server và trả lỗi cho client
        print(f"Error posting to Facebook: {e}")
        raise HTTPException(status_code=400, detail=f"Error posting to Facebook: {str(e)}")

# ------------------------------
# MAIN: chạy server khi chạy python main.py
# ------------------------------
if __name__ == "__main__":
    # uvicorn.run sẽ chạy ứng dụng trên host 0.0.0.0 port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
