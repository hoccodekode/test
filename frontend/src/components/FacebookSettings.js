import React, { useState } from 'react';
import { Facebook, Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../config/api';

const FacebookSettings = ({ facebookTokens, onTokenAdded }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    access_token: '',
    page_id: '',
    page_name: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.access_token || !formData.page_id || !formData.page_name) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/facebook-tokens/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newToken = await response.json();
        onTokenAdded(newToken);
        toast.success('Facebook token đã được thêm thành công!');
        setFormData({ access_token: '', page_id: '', page_name: '' });
        setShowAddForm(false);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Có lỗi xảy ra khi thêm token');
      }
    } catch (error) {
      toast.error('Có lỗi xảy ra khi thêm token');
      console.error('Error adding token:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('vi-VN');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cài đặt Facebook</h1>
          <p className="text-gray-600 mt-1">Quản lý kết nối với Facebook Pages</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Thêm Page
        </button>
      </div>

      {/* Add Token Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow border">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Thêm Facebook Page</h2>
            <p className="text-gray-600 mt-1">Kết nối với Facebook Page để đăng bài tự động</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Access Token *
              </label>
              <input
                type="text"
                value={formData.access_token}
                onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Nhập Facebook Access Token"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Lấy token từ Facebook Developer Console
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Page ID *
              </label>
              <input
                type="text"
                value={formData.page_id}
                onChange={(e) => setFormData({ ...formData, page_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Nhập Facebook Page ID"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Page Name *
              </label>
              <input
                type="text"
                value={formData.page_name}
                onChange={(e) => setFormData({ ...formData, page_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Nhập tên Facebook Page"
                required
              />
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Đang thêm...' : 'Thêm Page'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Hướng dẫn lấy Facebook Token</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>1. Truy cập <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="underline">Facebook Developers</a></p>
          <p>2. Tạo một App mới hoặc sử dụng App có sẵn</p>
          <p>3. Vào Graph API Explorer</p>
          <p>4. Chọn Page Access Token</p>
          <p>5. Copy token và Page ID</p>
        </div>
      </div>

      {/* Token List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Facebook Pages đã kết nối</h2>
        </div>

        <div className="p-6">
          {facebookTokens.length === 0 ? (
            <div className="text-center py-8">
              <Facebook className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có Page nào được kết nối</h3>
              <p className="text-gray-500 mb-4">Hãy thêm Facebook Page đầu tiên</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Thêm Page
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {facebookTokens.map((token) => (
                <div key={token.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Facebook className="h-8 w-8 text-blue-600" />
                      <div>
                        <h3 className="font-semibold text-gray-900">{token.page_name}</h3>
                        <p className="text-sm text-gray-500">ID: {token.page_id}</p>
                        <p className="text-sm text-gray-500">
                          Thêm lúc: {formatDate(token.created_at)}
                        </p>
                        {token.expires_at && (
                          <p className="text-sm text-gray-500">
                            Hết hạn: {formatDate(token.expires_at)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        <span className="text-sm">Đã kết nối</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">Lưu ý bảo mật</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Access Token chứa thông tin nhạy cảm. Hãy đảm bảo không chia sẻ token với người khác 
              và thay đổi token định kỳ để bảo mật tài khoản Facebook.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacebookSettings;

