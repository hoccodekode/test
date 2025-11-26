import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  Trash2, 
  Send,
  Edit,
  Eye
} from 'lucide-react';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../config/api';

const PostList = ({ posts, onPostUpdated, onPostDeleted }) => {
  const [loading, setLoading] = useState({});

  const handleDelete = async (postId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài viết này?')) {
      return;
    }

    setLoading(prev => ({ ...prev, [postId]: true }));

    try {
      const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onPostDeleted(postId);
        toast.success('Bài viết đã được xóa');
      } else {
        toast.error('Có lỗi khi xóa bài viết');
      }
    } catch (error) {
      toast.error('Có lỗi khi xóa bài viết');
      console.error('Error deleting post:', error);
    } finally {
      setLoading(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handlePostNow = async (postId) => {
    setLoading(prev => ({ ...prev, [postId]: true }));

    try {
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/post-now`, {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        toast.success('Bài viết đã được đăng ngay!');
        // Refresh the post data
        window.location.reload();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Có lỗi khi đăng bài viết');
      }
    } catch (error) {
      toast.error('Có lỗi khi đăng bài viết');
      console.error('Error posting now:', error);
    } finally {
      setLoading(prev => ({ ...prev, [postId]: false }));
    }
  };

  const getStatusBadge = (post) => {
    const now = new Date();
    const scheduledTime = new Date(post.scheduled_time);

    if (post.posted) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Đã đăng
        </span>
      );
    } else if (scheduledTime > now) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Clock className="h-3 w-3 mr-1" />
          Đã lên lịch
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <Calendar className="h-3 w-3 mr-1" />
          Quá hạn
        </span>
      );
    }
  };

  const formatDateTime = (dateString) => {
    // Nếu dateString là null hoặc undefined, trả về chuỗi rỗng
    if (!dateString) return 'N/A';
    
    // Sử dụng múi giờ 'Asia/Ho_Chi_Minh' (UTC+7) để đảm bảo hiển thị đúng giờ Việt Nam cho mọi người dùng
    return new Date(dateString).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      // THÊM CẤU HÌNH MÚI GIỜ BẮT BUỘC:
      timeZone: 'Asia/Ho_Chi_Minh'
      // Tùy chọn thêm: hour12: false để hiển thị 24h
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Danh sách bài viết</h1>
        <div className="text-sm text-gray-500">
          Tổng cộng: {posts.length} bài viết
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có bài viết nào</h3>
          <p className="text-gray-500 mb-4">Hãy tạo bài viết đầu tiên của bạn</p>
          <a
            href="/create-post"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Tạo bài viết mới
          </a>
        </div>
      ) : (
        <div className="grid gap-6">
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-lg shadow border">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {getStatusBadge(post)}
                      <span className="text-sm text-gray-500">
                        ID: {post.id}
                      </span>
                    </div>
                    <p className="text-gray-900 font-medium line-clamp-3">
                      {post.content}
                    </p>
                    {post.images && post.images.length > 0 && (
                      <div className="mt-2">
                        <span className="text-sm text-gray-500">
                          Hình ảnh ({post.images.length} ảnh):
                        </span>
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          {post.images.map((image, index) => (
                            <div key={index} className="relative">
                              {image.image_path ? (
                                <img 
                                  src={`/uploads/${image.image_path.split('/').pop()}`}
                                  alt={`Post image ${index + 1}`}
                                  className="w-full h-20 object-cover rounded-lg"
                                />
                              ) : (
                                <div className="w-full h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                                  <a 
                                    href={image.image_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary-600 hover:text-primary-700 text-center"
                                  >
                                    Link ảnh
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span>Lên lịch: {formatDateTime(post.scheduled_time)}</span>
                  </div>
                  {post.posted_at && (
                    <div className="flex items-center text-sm text-gray-500">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      <span>Đã đăng: {formatDateTime(post.posted_at)}</span>
                    </div>
                  )}
                </div>

                {post.facebook_post_id && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      <strong>Facebook Post ID:</strong> {post.facebook_post_id}
                    </p>
                  </div>
                )}

                <div className="flex space-x-2">
                  {!post.posted && (
                    <button
                      onClick={() => handlePostNow(post.id)}
                      disabled={loading[post.id]}
                      className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      {loading[post.id] ? 'Đang đăng...' : 'Đăng ngay'}
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(post.id)}
                    disabled={loading[post.id]}
                    className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {loading[post.id] ? 'Đang xóa...' : 'Xóa'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PostList;

