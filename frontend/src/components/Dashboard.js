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

// Thêm Recharts cho biểu đồ
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';

// FIX: Cung cấp giá trị mặc định là mảng rỗng [] cho posts và facebookTokens
const Dashboard = ({ posts = [], facebookTokens = [], onRefresh }) => {
  const now = new Date();
  
  // =================================================================
  // HÀM HELPER XỬ LÝ MÚI GIỜ (Phải định nghĩa trước khi dùng trong stats)
  // =================================================================
  // Hàm Helper: Đảm bảo chuỗi thời gian từ Backend được coi là UTC để so sánh
  const parseScheduledTime = (dateString) => {
    if (!dateString) return null;
    let dateToParse = dateString;
    // Thêm 'Z' để buộc JS hiểu đây là thời gian UTC
    if (!dateString.includes('T')) {
        dateToParse = dateString.replace(' ', 'T') + 'Z'; 
    } else if (!dateString.endsWith('Z') && !dateString.includes('+')) {
        dateToParse = dateToParse + 'Z';
    }
    return new Date(dateToParse);
  };

  // Hàm Helper để chuyển đổi và định dạng sang Giờ Việt Nam (UTC+7)
  const formatDateTimeToVietnam = (dateString) => {
    const dateObj = parseScheduledTime(dateString);

    if (!dateObj) return 'N/A';
    
    // Chuyển đổi và định dạng sang múi giờ Việt Nam
    return dateObj.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh', // Bắt buộc chuyển sang UTC+7
      hour12: false
    });
  };
  
  // =================================================================
  // LOGIC THỐNG KÊ (Sử dụng hàm parseScheduledTime)
  // =================================================================
  const stats = {
    total: posts.length,
    // Sửa lỗi thống kê: Dùng parseScheduledTime để so sánh múi giờ chính xác
    scheduled: posts.filter(post => {
      if (post.posted) return false;
      const scheduledTimeUTC = parseScheduledTime(post.scheduled_time);
      // So sánh thời gian lên lịch (UTC) với thời gian hiện tại (UTC)
      return scheduledTimeUTC && scheduledTimeUTC > now;
    }).length,
    
    posted: posts.filter(post => post.posted).length,
    
    // Sửa logic thống kê Hôm nay: Cần chuyển scheduled_time sang Giờ VN trước khi so sánh ngày
    today: posts.filter(post => {
      const scheduledTime = parseScheduledTime(post.scheduled_time);
      if (!scheduledTime) return false;
      
      // Chuyển scheduled_time sang múi giờ Việt Nam để lấy ngày chính xác
      const scheduledDateVN = new Date(scheduledTime.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
      
      // Lấy ngày hôm nay theo múi giờ Việt Nam để so sánh
      const nowVN = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));

      return scheduledDateVN.toDateString() === nowVN.toDateString();
    }).length
  };

  // =================================================================
  // LOGIC LỌC BÀI VIẾT SẮP TỚI
  // =================================================================
  const upcomingPosts = posts
    .filter(post => {
        // 1. Chỉ lấy bài chưa đăng
        if (post.posted) {
            return false;
        }

        // 2. Chuyển đổi scheduled_time thành đối tượng Date được xem là UTC
        const scheduledTimeUTC = parseScheduledTime(post.scheduled_time);
        
        // 3. So sánh với thời gian hiện tại (cũng là UTC)
        return scheduledTimeUTC > now; 
    })
    // Sắp xếp bài viết bằng hàm parseScheduledTime
    .sort((a, b) => {
      const timeA = parseScheduledTime(a.scheduled_time);
      const timeB = parseScheduledTime(b.scheduled_time);
      if (!timeA || !timeB) return 0;
      return timeA - timeB;
    })
    .slice(0, 5);

  const recentPosts = posts
    .filter(post => post.posted)
    // Sắp xếp bài viết đã đăng bằng hàm parseScheduledTime
    .sort((a, b) => {
      const timeA = parseScheduledTime(b.posted_at);
      const timeB = parseScheduledTime(a.posted_at);
      if (!timeA || !timeB) return 0;
      return timeA - timeB;
    })
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
  
  // =================================================================
  // LOGIC VÀ COMPONENT BIỂU ĐỒ MỚI
  // =================================================================

  // 1. Chuẩn bị dữ liệu cho Biểu đồ tròn
  const nonScheduledOrMissed = stats.total - stats.posted - stats.scheduled;

  const chartData = [
    { name: 'Đã Đăng (Posted)', value: stats.posted, color: '#10B981' }, // Green
    { name: 'Đang Chờ (Scheduled)', value: stats.scheduled, color: '#F59E0B' }, // Yellow
    { name: 'Chưa Hoàn Thành (Draft/Missed)', value: nonScheduledOrMissed > 0 ? nonScheduledOrMissed : 0, color: '#EF4444' }, // Red
  ];
  
  // Màu sắc tương ứng cho Biểu đồ tròn
  const COLORS = chartData.map(item => item.color);
  
  // Hàm render nhãn cho Pie Chart
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
  
    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };
  
  const PostStatusChart = () => (
    <div className="bg-white rounded-lg shadow col-span-1 lg:col-span-2">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-primary-600" />
          Phân tích trạng thái bài viết
        </h2>
      </div>
      <div className="p-6">
        {stats.total === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Chưa có dữ liệu bài viết để hiển thị biểu đồ.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData.filter(d => d.value > 0)} // Chỉ hiển thị các slice có giá trị > 0
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
                labelLine={false}
                label={renderCustomizedLabel}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend 
                layout="horizontal" 
                verticalAlign="bottom" 
                align="center" 
                wrapperStyle={{ paddingTop: '20px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
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
      
      {/* Biểu đồ trạng thái bài viết (MỚI) */}
      <div className="grid grid-cols-1 gap-6">
        <PostStatusChart />
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
                              // Đã sửa 'ssrc' thành 'src'
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
                     <Clock className="h-4 w-4 mr-1" />
                     {formatDateTimeToVietnam(post.scheduled_time)}
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
                      Đã đăng lúc: {formatDateTimeToVietnam(post.posted_at)}
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