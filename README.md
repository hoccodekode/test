# WindShop - AutoFB Project

Dự án tự động đăng bài lên Facebook Page với tính năng lên lịch đăng bài.

## Cấu trúc dự án

```
windshop/
├── backend/          # Backend API (FastAPI + Python)
│   ├── main.py      # File chính của backend
│   ├── requirements.txt  # Dependencies Python
│   ├── autofb.db    # Database SQLite
│   └── uploads/     # Thư mục lưu ảnh upload
└── frontend/        # Frontend (React + Tailwind CSS)
    ├── src/         # Source code React
    └── package.json # Dependencies Node.js
```

## Yêu cầu hệ thống

### Backend
- Python 3.8 trở lên
- pip (Python package manager)

### Frontend
- Node.js 16 trở lên
- npm hoặc yarn

## Cài đặt và chạy dự án

### 1. Cài đặt Backend

#### Bước 1: Di chuyển vào thư mục backend
```bash
cd backend
```

#### Bước 2: Tạo môi trường ảo Python (khuyến nghị)
```bash
# Tạo virtual environment
python3 -m venv venv

# Kích hoạt virtual environment
# Trên Linux/Mac:
source venv/bin/activate
# Trên Windows:
# venv\Scripts\activate
```

#### Bước 3: Cài đặt dependencies
```bash
pip install -r requirements.txt
```

#### Bước 4: Chạy backend server
```bash
python main.py
```

Backend sẽ chạy tại: `http://localhost:8000`

API Documentation: `http://localhost:8000/docs` (Swagger UI)

### 2. Cài đặt Frontend

#### Bước 1: Di chuyển vào thư mục frontend
```bash
cd frontend
```

#### Bước 2: Cài đặt dependencies
```bash
npm install
```

#### Bước 3: Chạy frontend development server
```bash
npm start
```

Frontend sẽ chạy tại: `http://localhost:3000`

## Chạy cả Backend và Frontend

Mở 2 terminal riêng biệt:

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate  # Nếu dùng virtual environment
python main.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

## Cấu hình

### Backend
- Port mặc định: `8000`
- Database: SQLite (`autofb.db`)
- Upload folder: `backend/uploads/`

### Frontend
- Port mặc định: `3000`
- API endpoint: `http://localhost:8000` (cấu hình trong `src/config/api.js`)

## Tính năng chính

1. **Quản lý Facebook Token**: Thêm và quản lý token Facebook Page
2. **Tạo bài đăng**: Tạo bài đăng với nội dung và ảnh
3. **Lên lịch đăng bài**: Tự động đăng bài vào thời gian đã lên lịch
4. **Upload ảnh**: Upload một hoặc nhiều ảnh kèm bài đăng
5. **Dashboard**: Xem danh sách tất cả bài đăng đã tạo

## API Endpoints chính

- `GET /` - Kiểm tra API đang chạy
- `POST /upload-image/` - Upload một ảnh
- `POST /upload-multiple-images/` - Upload nhiều ảnh
- `POST /posts/` - Tạo bài đăng mới
- `GET /posts/` - Lấy danh sách bài đăng
- `GET /posts/{post_id}` - Lấy chi tiết bài đăng
- `DELETE /posts/{post_id}` - Xóa bài đăng
- `POST /posts/{post_id}/post-now` - Đăng bài ngay lập tức
- `POST /facebook-tokens/` - Thêm Facebook token
- `GET /facebook-tokens/` - Lấy danh sách token

## Lưu ý

1. **Facebook Token**: Bạn cần có Facebook Page Access Token để sử dụng tính năng đăng bài
2. **Database**: Database SQLite sẽ tự động được tạo khi chạy lần đầu
3. **CORS**: Backend đã cấu hình CORS cho `http://localhost:3000`, nếu thay đổi port frontend cần cập nhật trong `main.py`

## Troubleshooting

### Lỗi khi cài đặt Python packages
```bash
# Thử nâng cấp pip
pip install --upgrade pip
```

### Lỗi khi cài đặt Node packages
```bash
# Xóa node_modules và cài lại
rm -rf node_modules package-lock.json
npm install
```

### Backend không kết nối được với Frontend
- Kiểm tra backend đang chạy tại `http://localhost:8000`
- Kiểm tra CORS settings trong `backend/main.py`
- Kiểm tra API endpoint trong `frontend/src/config/api.js`

## Phát triển thêm

- Thêm authentication/authorization
- Hỗ trợ nhiều user
- Thêm tính năng chỉnh sửa bài đăng
- Thêm thống kê và báo cáo
