import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import { Calendar, Image, Save, Send, Upload, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../config/api';

const CreatePost = ({ onPostCreated, facebookTokens }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    content: '',
    scheduled_time: new Date(),
    images: []
  });
  const [loading, setLoading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (files) => {
    if (!files || files.length === 0) return;

    // Validate all files
    for (let file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`File ${file.name} không phải là ảnh`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} quá lớn (tối đa 10MB)`);
        return;
      }
    }

    setUploading(true);

    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch(`${API_BASE_URL}/upload-multiple-images/`, {
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
            image_path: img.file_path
          }))]
        }));
        toast.success(`${newImages.length} ảnh đã được tải lên thành công!`);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Có lỗi khi tải ảnh');
      }
    } catch (error) {
      toast.error('Có lỗi khi tải ảnh');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.content.trim()) {
      toast.error('Vui lòng nhập nội dung bài viết');
      return;
    }

    if (facebookTokens.length === 0) {
      toast.error('Vui lòng kết nối Facebook trước');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/posts/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newPost = await response.json();
        onPostCreated(newPost);
        toast.success('Bài viết đã được tạo thành công!');
        navigate('/posts');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Có lỗi xảy ra khi tạo bài viết');
      }
    } catch (error) {
      toast.error('Có lỗi xảy ra khi tạo bài viết');
      console.error('Error creating post:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePostNow = async () => {
    if (!formData.content.trim()) {
      toast.error('Vui lòng nhập nội dung bài viết');
      return;
    }

    if (facebookTokens.length === 0) {
      toast.error('Vui lòng kết nối Facebook trước');
      return;
    }

    setLoading(true);

    try {
      // First create the post
      const createResponse = await fetch(`${API_BASE_URL}/posts/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          scheduled_time: new Date()
        }),
      });

      if (createResponse.ok) {
        const newPost = await createResponse.json();
        
        // Then post it immediately
        const postNowResponse = await fetch(`${API_BASE_URL}/posts/${newPost.id}/post-now`, {
          method: 'POST',
        });

        if (postNowResponse.ok) {
          const result = await postNowResponse.json();
          onPostCreated(newPost);
          toast.success('Bài viết đã được đăng ngay!');
          navigate('/posts');
        } else {
          toast.error('Có lỗi khi đăng bài viết');
        }
      } else {
        const error = await createResponse.json();
        toast.error(error.detail || 'Có lỗi xảy ra khi tạo bài viết');
      }
    } catch (error) {
      toast.error('Có lỗi xảy ra khi đăng bài viết');
      console.error('Error posting now:', error);
    } finally {
      setLoading(false);
    }
  };
  const [aiLoading, setAiLoading] = useState(false);

  const handleGenerateContent = async () => {
    const prompt = formData.content.trim();
    if (!prompt) {
      toast.error('Vui lòng nhập mô tả cơ bản vào ô nội dung trước.');
      return;
    }

    setAiLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/generate-content/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: prompt }),
      });

      if (response.ok) {
        const result = await response.json();
        // Cập nhật nội dung bài viết với nội dung được tạo bởi AI
        setFormData(prev => ({
          ...prev,
          content: result.content
        }));
        toast.success('Bài viết đã được AI hoàn thiện!');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Lỗi khi gọi AI');
      }
    } catch (error) {
      toast.error('Lỗi kết nối đến dịch vụ AI');
      console.error('Error calling AI API:', error);
    } finally {
      setAiLoading(false);
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold text-gray-900">Tạo bài viết mới</h1>
          <p className="text-gray-600 mt-1">Tạo và lên lịch bài viết cho Facebook</p>
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Nhập nội dung bài viết..."
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              {formData.content.length}/2000 ký tự
            </p>
          </div>

          {/* Multiple Images Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Image className="inline h-4 w-4 mr-1" />
              Hình ảnh (tùy chọn) - Có thể chọn nhiều ảnh
            </label>
            
            {/* Upload Area */}
            <div className="space-y-4">
              {/* File Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors">
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
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
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
                    <div key={index} className="relative">
                      <img
                        src={`${API_BASE_URL}${image.url}`}
                        alt={`Uploaded ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* KHỐI NÀY ĐÃ BỊ XÓA: Image URL Input 
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hoặc nhập link ảnh (sẽ thêm vào danh sách ảnh)
                </label>
                <div className="flex space-x-2">
                  <input
                    type="url"
                    id="imageUrlInput"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="https://example.com/image.jpg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url = document.getElementById('imageUrlInput').value;
                      if (url) {
                        const newImage = {
                          image_url: url,
                          url: url,
                          filename: url.split('/').pop()
                        };
                        setUploadedImages(prev => [...prev, newImage]);
                        setFormData(prev => ({
                          ...prev,
                          images: [...prev.images, { image_url: url }]
                        }));
                        document.getElementById('imageUrlInput').value = '';
                        toast.success('Đã thêm link ảnh!');
                      }
                    }}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Thêm
                  </button>
                </div>
              </div>
              */}
            </div>
          </div>

          {/* Scheduled Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Thời gian đăng bài
            </label>
            <DatePicker
              selected={formData.scheduled_time}
              onChange={(date) => setFormData({ ...formData, scheduled_time: date })}
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              dateFormat="dd/MM/yyyy HH:mm"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              minDate={new Date()}
            />
          </div>

          {/* Facebook Status */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Trạng thái Facebook</h3>
            {facebookTokens.length === 0 ? (
              <div className="flex items-center text-yellow-600">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                <span className="text-sm">Chưa kết nối Facebook</span>
              </div>
            ) : (
              <div className="space-y-2">
                {facebookTokens.map((token) => (
                  <div key={token.id} className="flex items-center text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-sm">Đã kết nối: {token.page_name}</span>
                  </div>
                ))}
              </div>
            )}
            {uploadedImages.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  📸 Đã chọn {uploadedImages.length} ảnh
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-4">
            <button
              type="submit"
              disabled={loading || facebookTokens.length === 0}
              className="flex-1 flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Đang lưu...' : 'Lên lịch đăng'}
            </button>

            <button
              type="button"
              onClick={handlePostNow}
              disabled={loading || facebookTokens.length === 0}
              className="flex-1 flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

export default CreatePost;