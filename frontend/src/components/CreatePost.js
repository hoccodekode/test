import React, { useState, useCallback, useMemo, useEffect } from 'react';
// Đã loại bỏ useNavigate
import { Calendar, Image, Save, Send, Upload, X, Bot, List } from 'lucide-react'; 

// --- Helper: Toast/Message Box Placeholder (Do không có react-toastify) ---
const useToast = () => {
  const showToast = (message, type = 'success') => {
    // Sử dụng console.log và UI đơn giản để thay thế toast
    console.log(`[${type.toUpperCase()}] ${message}`);
    // Có thể thêm logic hiển thị tạm thời trên UI nếu cần
  };
  return { showToast };
};
// ----------------------------------------------------

// --- ĐỊA CHỈ API CẦN KIỂM TRA ---
// Nếu bạn nhận lỗi "Not Found", hãy kiểm tra xem URL này có đúng không
// và các đường dẫn con (/generate-content/, /generate-image-prompt/) có được định nghĩa trên server không.
const API_BASE_URL = 'https://windshop.site/api'; 
// ---------------------------------

// --- Debounce Utility (Để tránh gọi API liên tục) ---
const debounce = (func, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
};
// ----------------------------------------------------

// --- Helper function để định dạng Date object sang định dạng string cho input type="datetime-local" (YYYY-MM-DDThh:mm) ---
const formatDateForInput = (date) => {
    if (!(date instanceof Date) || isNaN(date)) {
        date = new Date(); // Fallback to current date if invalid
    }
    // Điều chỉnh múi giờ cho phù hợp với input type="datetime-local"
    const d = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)); 
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};


// --- Placeholder Component: Danh sách bài viết ---
const PostsList = ({ posts, onNavigateToCreate }) => {
    return (
        <div className="max-w-2xl mx-auto p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4 flex justify-between items-center">
                Danh sách bài viết đã lên lịch/đăng ({posts.length})
                <button 
                    onClick={onNavigateToCreate}
                    className="flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
                >
                    <Save className="h-4 w-4 mr-1" /> Tạo bài mới
                </button>
            </h1>
            <div className="space-y-4">
                {posts.length === 0 ? (
                    <div className="p-4 bg-yellow-100 text-yellow-800 rounded-lg text-center">
                        Chưa có bài viết nào được tạo.
                    </div>
                ) : (
                    posts.map((post, index) => (
                        <div key={index} className="p-4 bg-white shadow-md rounded-lg border border-gray-200">
                            <p className="text-sm text-gray-500 mb-1">
                                Lên lịch: {new Date(post.scheduled_time).toLocaleString('vi-VN')}
                            </p>
                            <p className="font-semibold text-gray-800 line-clamp-2">{post.content}</p>
                            {post.images.length > 0 && (
                                <p className="text-xs text-indigo-500 mt-1">({post.images.length} ảnh đính kèm)</p>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
// ----------------------------------------------------


// --- Component chính (Tên được đổi thành CreatePost để khớp với lỗi ESLint của bạn) ---
const CreatePostForm = ({ onPostCreated, facebookTokens, onNavigateToPosts }) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    content: '',
    scheduled_time: new Date(), 
    images: []
  });
  const [loading, setLoading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  
  const [aiLoading, setAiLoading] = useState(false);
  const [imageDescription, setImageDescription] = useState(''); 
  const [generatedImagePrompt, setGeneratedImagePrompt] = useState(''); 
  const [isGeneratingImagePrompt, setIsGeneratingImagePrompt] = useState(false);
  const [aiError, setAiError] = useState(''); 

  const handleAiError = (errorDetail, is404 = false) => {
    let message = errorDetail;
    if (is404) {
        message = `Lỗi 404: Không tìm thấy đường dẫn API này trên máy chủ. Vui lòng kiểm tra lại cấu hình backend. Chi tiết lỗi: ${errorDetail}`;
    }
    setAiError(message);
    showToast('Có lỗi xảy ra với dịch vụ AI. Xem chi tiết bên dưới.', 'error');
  };
  
  const handleDateChange = (e) => {
    const date = new Date(e.target.value);
    if (!isNaN(date)) {
        setFormData({ ...formData, scheduled_time: date });
    }
  };


  const handleImageUpload = async (files) => {
    if (!files || files.length === 0) return;

    for (let file of files) {
      if (!file.type.startsWith('image/')) {
        showToast(`File ${file.name} không phải là ảnh`, 'error');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast(`File ${file.name} quá lớn (tối đa 10MB)`, 'error');
        return;
      }
    }

    setUploading(true);

    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      const fullUrl = `${API_BASE_URL}/upload-multiple-images/`;
      console.log("DEBUG: Calling Image Upload API at:", fullUrl); // DEBUG LOG

      const response = await fetch(fullUrl, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        const newImages = result.uploaded_files;
        setUploadedImages(prev => [...prev, ...newImages]);
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, ...newImages.map(img => ({
            image_path: img.file_path, 
            url: img.url 
          }))]
        }));
        showToast(`${newImages.length} ảnh đã được tải lên thành công!`);
      } else {
        const error = await response.json();
        showToast(error.detail || 'Có lỗi khi tải ảnh', 'error');
      }
    } catch (error) {
      showToast('Có lỗi khi tải ảnh', 'error');
      console.error('Error uploading images:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (index) => {
    const newImages = uploadedImages.filter((_, i) => i !== index);
    setUploadedImages(newImages);
    setFormData(prev => ({
      ...prev,
      images: newImages.map(img => ({
        image_path: img.file_path
      }))
    }));
  };

  const handleGenerateContent = async () => {
    const prompt = formData.content.trim();
    if (!prompt) {
      showToast('Vui lòng nhập mô tả cơ bản vào ô nội dung trước.', 'error');
      return;
    }

    setAiLoading(true);
    setAiError(''); 

    try {
      const fullUrl = `${API_BASE_URL}/generate-content/`;
      console.log("DEBUG: Calling AI Content API at:", fullUrl); // DEBUG LOG
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: prompt }),
      });

      if (response.status === 404) {
          handleAiError(response.statusText, true); // Bắt lỗi 404 rõ ràng
          return;
      }

      const result = await response.json();

      if (response.ok) {
        setFormData(prev => ({
          ...prev,
          content: result.content
        }));
        showToast('Bài viết đã được AI hoàn thiện!');
      } else {
        const errorDetail = result.detail.error || result.detail || result.message || 'Lỗi không xác định khi tạo nội dung.';
        handleAiError(errorDetail);
      }
    } catch (error) {
      handleAiError('Lỗi kết nối đến dịch vụ AI (Text)');
      console.error('Error calling AI API:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateImagePromptBase = async (description) => {
    if (!description.trim()) {
      showToast('Vui lòng nhập mô tả ý tưởng hình ảnh.', 'error');
      return;
    }
    
    setIsGeneratingImagePrompt(true);
    setAiError(''); 
    setGeneratedImagePrompt(''); 
    
    try {
        const fullUrl = `${API_BASE_URL}/generate-image-prompt/`;
        console.log("DEBUG: Calling AI Image Prompt API at:", fullUrl); // DEBUG LOG

        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: description }),
        });
        
        if (response.status === 404) {
            handleAiError(response.statusText, true); // Bắt lỗi 404 rõ ràng
            return;
        }

        const data = await response.json();

        if (response.ok) {
            setGeneratedImagePrompt(data.image_prompt);
            showToast("Đã tạo Prompt hình ảnh. Vui lòng sao chép!");
        } else {
            const errorDetail = data.detail.error || data.detail || data.message || 'Lỗi không xác định khi tạo Prompt ảnh.';
            handleAiError(errorDetail);
        }
    } catch (error) {
        handleAiError('Không thể kết nối đến máy chủ AI để tạo Prompt ảnh.');
        console.error('Lỗi khi gọi API AI tạo Prompt ảnh:', error);
    } finally {
        setIsGeneratingImagePrompt(false);
    }
  };

  const debouncedGenerateImagePrompt = useMemo(
    () => debounce(handleGenerateImagePromptBase, 1500),
    []
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.content.trim()) {
      showToast('Vui lòng nhập nội dung bài viết', 'error');
      return;
    }

    if (facebookTokens.length === 0) {
      showToast('Vui lòng kết nối Facebook trước', 'error');
      return;
    }

    setLoading(true);

    try {
      const fullUrl = `${API_BASE_URL}/posts/`;
      console.log("DEBUG: Calling Post Scheduling API at:", fullUrl); // DEBUG LOG

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            ...formData,
            scheduled_time: formData.scheduled_time.toISOString()
        }),
      });

      if (response.ok) {
        const newPost = await response.json();
        onPostCreated(newPost);
        showToast('Bài viết đã được lên lịch thành công!');
        onNavigateToPosts();
      } else {
        const error = await response.json();
        showToast(error.detail || 'Có lỗi xảy ra khi lên lịch bài viết', 'error');
      }
    } catch (error) {
      showToast('Có lỗi xảy ra khi lên lịch bài viết', 'error');
      console.error('Error creating post:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePostNow = async () => {
    if (!formData.content.trim()) {
      showToast('Vui lòng nhập nội dung bài viết', 'error');
      return;
    }

    if (facebookTokens.length === 0) {
      showToast('Vui lòng kết nối Facebook trước', 'error');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Create post (Scheduled time is now)
      const createResponse = await fetch(`${API_BASE_URL}/posts/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          scheduled_time: new Date().toISOString()
        }),
      });

      if (createResponse.ok) {
        const newPost = await createResponse.json();
        
        // Step 2: Post immediately
        const fullUrl = `${API_BASE_URL}/posts/${newPost.id}/post-now`;
        console.log("DEBUG: Calling Post Now API at:", fullUrl); // DEBUG LOG

        const postNowResponse = await fetch(fullUrl, {
          method: 'POST',
        });

        if (postNowResponse.ok) {
          onPostCreated(newPost);
          showToast('Bài viết đã được đăng ngay!');
          onNavigateToPosts();
        } else {
          const error = await postNowResponse.json();
          showToast(error.detail || 'Có lỗi khi đăng bài viết', 'error');
        }
      } else {
        const error = await createResponse.json();
        showToast(error.detail || 'Có lỗi xảy ra khi tạo bài viết', 'error');
      }
    } catch (error) {
      showToast('Có lỗi xảy ra khi đăng bài viết', 'error');
      console.error('Error posting now:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-xl">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Tạo bài viết mới</h1>
          <button 
            onClick={onNavigateToPosts}
            className="flex items-center px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors shadow-sm"
            type="button"
          >
            <List className="h-4 w-4 mr-1" /> Xem danh sách
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">        
          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nội dung bài viết *
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
              placeholder="Nhập mô tả cơ bản để AI hoàn thiện hoặc viết nội dung hoàn chỉnh..."
              required
            />
            {/* NÚT AI TEXT */}
            <button
              type="button"
              onClick={handleGenerateContent}
              disabled={aiLoading}
              className="mt-2 flex items-center px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {aiLoading ? (
                // Spinner Tailwind CSS
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Đang tạo nội dung...
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4 mr-1" /> Tạo nội dung bằng AI
                </>
              )}
            </button>
            {/* Hết Nút AI TEXT */}
            <p className="text-sm text-gray-500 mt-1">
              {formData.content.length}/2000 ký tự
            </p>
          </div>

          {/* --- KHỐI TẠO PROMPT HÌNH ẢNH BẰNG AI --- */}
          <div className="p-4 border border-teal-300 rounded-lg bg-teal-50 shadow-inner">
            <h2 className="flex items-center text-xl font-semibold text-teal-700 mb-3">
              <Image className="h-5 w-5 mr-2" />
              AI Hỗ Trợ Tạo Mô Tả Ảnh
            </h2>
            <p className="text-sm text-teal-600 mb-3">
              Nhập ý tưởng cơ bản (tiếng Việt), AI sẽ mở rộng thành Prompt chi tiết (tiếng Anh) để bạn sử dụng với các công cụ tạo ảnh khác (Midjourney, DALL-E, v.v.).
            </p>
            <label htmlFor="imageDescription" className="block text-sm font-medium text-teal-700 mb-2">
                Mô tả ý tưởng hình ảnh
            </label>
            <textarea
                id="imageDescription"
                rows="2"
                value={imageDescription}
                onChange={(e) => setImageDescription(e.target.value)}
                placeholder="Ví dụ: Cảnh hoàng hôn trên bãi biển, phong cách vẽ tranh sơn dầu."
                className="w-full p-3 border border-teal-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 transition duration-150"
            />
            <button
                type="button"
                onClick={() => debouncedGenerateImagePrompt(imageDescription)}
                disabled={!imageDescription.trim() || isGeneratingImagePrompt}
                className="mt-3 w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 transition duration-150 shadow-md"
            >
                {isGeneratingImagePrompt ? (
                    // Spinner Tailwind CSS
                    <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Đang tạo Prompt ảnh...
                    </>
                ) : (
                    "Tạo Prompt (English)"
                )}
            </button>
            
            {generatedImagePrompt && (
                <div className="mt-4 p-3 bg-teal-100 border border-teal-400 text-teal-800 rounded-lg text-sm">
                    <strong>✅ Prompt đã tạo (Sao chép):</strong>
                    {/* Sử dụng select-all để người dùng dễ dàng copy toàn bộ prompt */}
                    <pre className="whitespace-pre-wrap font-mono text-xs bg-teal-50 p-2 rounded mt-1 select-all border border-teal-300">{generatedImagePrompt}</pre>
                </div>
            )}
          </div>
          {/* HẾT KHỐI TẠO PROMPT HÌNH ẢNH */}
          
          {/* AI Error Display */}
          {aiError && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm shadow-md">
                  ⚠️ **Lỗi Dịch vụ AI:** {aiError}
              </div>
          )}


          {/* Multiple Images Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Image className="inline h-4 w-4 mr-1" />
              Hình ảnh (tùy chọn) - Có thể chọn nhiều ảnh
            </label>
            
            {/* Upload Area */}
            <div className="space-y-4">
              {/* File Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors shadow-sm">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleImageUpload(e.target.files)}
                  className="hidden"
                  id="image-upload"
                  disabled={uploading}
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  {uploading ? (
                    // Spinner Tailwind CSS
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                  ) : (
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  )}
                  <span className="text-sm text-gray-600">
                    {uploading ? 'Đang tải lên...' : 'Nhấp để chọn nhiều ảnh hoặc kéo thả vào đây'}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    PNG, JPG, GIF tối đa 10MB mỗi ảnh
                  </span>
                </label>
              </div>

              {/* Uploaded Images Preview */}
              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  {uploadedImages.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={`${API_BASE_URL}${image.url}`} 
                        alt={`Uploaded ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-gray-200 shadow-md"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg hover:bg-red-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Scheduled Time - Đã thay thế DatePicker bằng input type="datetime-local" */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Thời gian đăng bài
            </label>
            <input
              type="datetime-local"
              value={formatDateForInput(formData.scheduled_time)}
              onChange={handleDateChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
              required
              min={formatDateForInput(new Date())} // Đảm bảo không chọn ngày trong quá khứ
            />
          </div>

          {/* Facebook Status */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 shadow-inner">
            <h3 className="font-medium text-gray-900 mb-2">Trạng thái Facebook</h3>
            {facebookTokens.length === 0 ? (
              <div className="flex items-center text-red-600">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                <span className="text-sm font-medium">Chưa kết nối Facebook hoặc chưa chọn trang</span>
              </div>
            ) : (
              <div className="space-y-2">
                
                {facebookTokens.map((token) => (
                  <div key={token.id} className="flex items-center text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-sm font-medium">Đã kết nối: **{token.page_name}**</span>
                  </div>
                ))}
              </div>
            )}
            {uploadedImages.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  📸 Đã chọn **{uploadedImages.length}** ảnh
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-4 pt-2">
            <button
              type="submit"
              disabled={loading || facebookTokens.length === 0}
              className="flex-1 flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold shadow-lg shadow-indigo-200"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Đang lưu...' : 'Lên lịch đăng'}
            </button>

            <button
              type="button"
              onClick={handlePostNow}
              disabled={loading || facebookTokens.length === 0}
              className="flex-1 flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold shadow-lg shadow-green-200"
            >
              <Send className="h-4 w-4 mr-2" />
              {loading ? 'Đang đăng...' : 'Đăng ngay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// --- Component chính (Tên được đổi thành CreatePost để khớp với lỗi ESLint của bạn) ---
const CreatePost = () => {
    /* * PHẦN NÀY LÀ MOCK DATA (DỮ LIỆU GIẢ ĐỊNH)
    * Khi bạn tích hợp với Facebook Login, bạn sẽ cần thay thế phần này bằng cách
    * lấy dữ liệu từ API backend (windshop.site) và lưu vào state.
    */
    const [facebookTokens, setFacebookTokens] = useState([]);
    
    // BẠN CÓ THỂ THAY THẾ 'mockFacebookTokens' BẰNG STATE DỮ LIỆU THẬT Ở ĐÂY:
    // const [facebookTokens, setFacebookTokens] = useState([]);
    
    // Nếu bạn muốn dùng dữ liệu thật, hãy dùng:
    // <CreatePostForm facebookTokens={facebookTokens} ... />
    
    const [currentPage, setCurrentPage] = useState('create');
    const [posts, setPosts] = useState([]);
    
    const handlePostCreated = useCallback((newPost) => {
        setPosts(prev => [newPost, ...prev]);
    }, []);
    
    const navigateToPosts = useCallback(() => setCurrentPage('posts'), []);
    const navigateToCreate = useCallback(() => setCurrentPage('create'), []);

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8">
            {currentPage === 'create' ? (
                // SỬ DỤNG mockFacebookTokens TẠM THỜI ĐỂ CÓ THỂ CHẠY CÁC CHỨC NĂNG KHÁC
                <CreatePostForm 
                    onPostCreated={handlePostCreated}
                    facebookTokens={mockFacebookTokens}
                    onNavigateToPosts={navigateToPosts}
                />
            ) : (
                <PostsList
                    posts={posts}
                    onNavigateToCreate={navigateToCreate}
                />
            )}
        </div>
    );
};

export default CreatePost;