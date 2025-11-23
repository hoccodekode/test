import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Facebook,
  TrendingUp,
  Plus
} from 'lucide-react';

const Dashboard = ({ posts, facebookTokens, onRefresh }) => {
  const now = new Date();
  
  const stats = {
    total: posts.length,
    scheduled: posts.filter(post => !post.posted && new Date(post.scheduled_time) > now).length,
    posted: posts.filter(post => post.posted).length,
    today: posts.filter(post => {
      const postDate = new Date(post.scheduled_time);
      return postDate.toDateString() === now.toDateString();
    }).length
  };

  const upcomingPosts = posts
    .filter(post => !post.posted && new Date(post.scheduled_time) > now)
    .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time))
    .slice(0, 5);

  const recentPosts = posts
    .filter(post => post.posted)
    .sort((a, b) => new Date(b.posted_at) - new Date(a.posted_at))
    .slice(0, 5);

  const StatCard = ({ title, value, icon: Icon, color = "blue" }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-full bg-${color}-100`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <button
          onClick={onRefresh}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Làm mới
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Tổng bài viết"
          value={stats.total}
          icon={Calendar}
          color="blue"
        />
        <StatCard
          title="Đã lên lịch"
          value={stats.scheduled}
          icon={Clock}
          color="yellow"
        />
        <StatCard
          title="Đã đăng"
          value={stats.posted}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Hôm nay"
          value={stats.today}
          icon={TrendingUp}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Posts */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Bài viết sắp tới</h2>
          </div>
          <div className="p-6">
            {upcomingPosts.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Không có bài viết nào được lên lịch</p>
                <Link
                  to="/create-post"
                  className="inline-flex items-center mt-4 text-primary-600 hover:text-primary-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Tạo bài viết mới
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingPosts.map((post) => (
                  <div key={post.id} className="border rounded-lg p-4">
                    <p className="text-gray-900 font-medium line-clamp-2">
                      {post.content}
                    </p>
                    {post.images && post.images.length > 0 && (
                      <div className="mt-2">
                        <div className="flex space-x-1">
                          {post.images.slice(0, 3).map((image, index) => (
                            <img 
                              key={index}
                              ssrc={image.image_path ? 
                                `https://windshop.site/api/uploads/${image.image_path.split('/').pop()}` : 
                                image.image_url
                            }
                              alt={`Post image ${index + 1}`}
                              className="w-12 h-12 object-cover rounded"
                            />
                          ))}
                          {post.images.length > 3 && (
                            <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                              <span className="text-xs text-gray-600">+{post.images.length - 3}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center mt-2 text-sm text-gray-500">
                      <Clock className="h-4 w-4 mr-1" />
                      {new Date(post.scheduled_time).toLocaleString('vi-VN')}
                    </div>
                  </div>
                ))}
                <Link
                  to="/posts"
                  className="block text-center text-primary-600 hover:text-primary-700 font-medium"
                >
                  Xem tất cả
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Posts */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Bài viết gần đây</h2>
          </div>
          <div className="p-6">
            {recentPosts.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Chưa có bài viết nào được đăng</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentPosts.map((post) => (
                  <div key={post.id} className="border rounded-lg p-4">
                    <p className="text-gray-900 font-medium line-clamp-2">
                      {post.content}
                    </p>
                    {post.images && post.images.length > 0 && (
                      <div className="mt-2">
                        <div className="flex space-x-1">
                          {post.images.slice(0, 3).map((image, index) => (
                            <img 
                              key={index}
                              // Thay đổi này sẽ buộc tải ảnh qua Base URL của API (ví dụ: https://windshop.site/api)
                              src={image.image_path ? 
                                `https://windshop.site/api/uploads/${image.image_path.split('/').pop()}` : 
                                image.image_url
                              }
                              alt={`Post image ${index + 1}`}
                              className="w-12 h-12 object-cover rounded"
                            />
                          ))}
                          {post.images.length > 3 && (
                            <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                              <span className="text-xs text-gray-600">+{post.images.length - 3}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center mt-2 text-sm text-gray-500">
                      <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                      Đã đăng lúc {new Date(post.posted_at).toLocaleString('vi-VN')}
                    </div>
                  </div>
                ))}
                <Link
                  to="/posts"
                  className="block text-center text-primary-600 hover:text-primary-700 font-medium"
                >
                  Xem tất cả
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Facebook Status */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Trạng thái Facebook</h2>
        </div>
        <div className="p-6">
          {facebookTokens.length === 0 ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                <span className="text-gray-700">Chưa kết nối với Facebook</span>
              </div>  
              <Link
                to="/facebook-settings"
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Kết nối Facebook
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {facebookTokens.map((token) => (
                <div key={token.id} className="flex items-center justify-between border rounded-lg p-4">
                  <div className="flex items-center">
                    <Facebook className="h-5 w-5 text-blue-600 mr-2" />
                    <div>
                      <p className="font-medium text-gray-900">{token.page_name}</p>
                      <p className="text-sm text-gray-500">ID: {token.page_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    <span className="text-sm">Đã kết nối</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
