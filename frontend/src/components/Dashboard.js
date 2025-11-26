import React from 'react';
// Đã loại bỏ 'import { Link } from 'react-router-dom';' để khắc phục lỗi: 
// TypeError: Cannot destructure property 'basename' of 'React10.useContext(...)' as it is null.

// Thêm các thành phần biểu đồ từ Recharts
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Facebook,
  TrendingUp,
  Plus,
  Loader2
} from 'lucide-react';

// FIX: Cung cấp giá trị mặc định là mảng rỗng [] cho posts và facebookTokens để tránh lỗi
const Dashboard = ({ posts = [], facebookTokens = [], onRefresh, isLoading }) => {
  const now = new Date();
  
  // =================================================================
  // HÀM HELPER XỬ LÝ MÚI GIỜ
  // =================================================================
  // Hàm Helper: Đảm bảo chuỗi thời gian từ Backend được coi là UTC để so sánh
  const parseScheduledTime = (dateString) => {
    if (!dateString) return null;
    let dateToParse = dateString;
    // Thêm 'Z' để buộc JS hiểu đây là thời gian UTC
    if (!dateString.includes('T')) {
        dateToParse = dateString.replace(' ', 'T') + 'Z'; 
    } else if (!dateString.endsWith('Z') && !dateToParse.includes('+')) {
        dateToParse = dateToParse + 'Z';
    }
    // Sử dụng new Date() sẽ tự động chuyển UTC về Local Timezone của người dùng.
    // Dữ liệu từ API nên được xử lý cẩn thận về múi giờ.
    return new Date(dateToParse); 
  };

  // Hàm Helper để chuyển đổi và định dạng sang Giờ Việt Nam (UTC+7)
  const formatDateTimeToVietnam = (dateString) => {
    const dateObj = parseScheduledTime(dateString);

    if (!dateObj) return 'N/A';
    
    // Chuyển đổi và định dạng sang múi giờ Việt Nam (Asia/Ho_Chi_Minh là UTC+7)
    return dateObj.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh', 
      hour12: false
    });
  };
  
  // =================================================================
  // LOGIC THỐNG KÊ
  // =================================================================
  const stats = {
    total: posts.length,
    scheduled: posts.filter(post => {
      if (post.posted) return false;
      const scheduledTimeUTC = parseScheduledTime(post.scheduled_time);
      // Bài viết được tính là "Đã Lên Lịch" nếu thời gian lên lịch > thời gian hiện tại
      return scheduledTimeUTC && scheduledTimeUTC > now;
    }).length,
    posted: posts.filter(post => post.posted).length,
    today: posts.filter(post => {
      const scheduledTime = parseScheduledTime(post.scheduled_time);
      if (!scheduledTime) return false;
      
      // So sánh ngày trong cùng múi giờ VN (UTC+7)
      const scheduledDateVN = new Date(scheduledTime.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
      const nowVN = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));

      // Bài viết đã được lên lịch cho ngày hôm nay (theo múi giờ VN)
      return scheduledDateVN.toDateString() === nowVN.toDateString();
    }).length
  };
  
  // =================================================================
  // LOGIC TIỀN XỬ LÝ DỮ LIỆU CHO BIỂU ĐỒ
  // =================================================================

  // 1. Dữ liệu cho Bar Chart (Tóm tắt Trạng thái)
  const barChartData = [
    { name: 'Đã Lên Lịch', value: stats.scheduled, color: '#f59e0b' },
    { name: 'Đã Đăng', value: stats.posted, color: '#10b981' },
    { name: 'Hôm Nay', value: stats.today, color: '#8b5cf6' },
  ];
  
  // 2. Dữ liệu cho Line Chart (Xu hướng 7 ngày gần nhất)
  const getDailyPostTrend = (numDays = 7) => {
    const dailyData = {};
    const todayVN = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    
    // Khởi tạo 7 ngày gần nhất (từ hôm nay lùi lại)
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(todayVN);
      d.setDate(todayVN.getDate() - i);
      const dayKey = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      dailyData[dayKey] = 0;
    }

    // Đếm bài viết đã đăng (sử dụng post.posted_at)
    posts.filter(post => post.posted).forEach(post => {
      const postedTimeUTC = parseScheduledTime(post.posted_at);
      if (!postedTimeUTC) return;

      // Chuyển sang Giờ Việt Nam để lấy ngày đăng
      const postedTimeVN = new Date(postedTimeUTC.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
      const dayKey = postedTimeVN.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      
      if (dailyData.hasOwnProperty(dayKey)) {
        dailyData[dayKey] += 1;
      }
    });

    // Chuyển đổi thành mảng cho Recharts
    return Object.keys(dailyData).map(key => ({
      date: key,
      posts_posted: dailyData[key], // Lượng đăng bài hàng ngày
    }));
  };

  const lineChartData = getDailyPostTrend(7);

  // =================================================================
  // LOGIC LỌC BÀI VIẾT
  // =================================================================
  const upcomingPosts = posts
    .filter(post => {
        if (post.posted) { return false; }
        const scheduledTimeUTC = parseScheduledTime(post.scheduled_time);
        return scheduledTimeUTC > now; 
    })
    .sort((a, b) => {
      const timeA = parseScheduledTime(a.scheduled_time);
      const timeB = parseScheduledTime(b.scheduled_time);
      if (!timeA || !timeB) return 0;
      return timeA - timeB; // Sắp xếp Tăng dần (sắp tới trước)
    })
    .slice(0, 5);

  const recentPosts = posts
    .filter(post => post.posted)
    .sort((a, b) => {
      const timeA = parseScheduledTime(b.posted_at);
      const timeB = parseScheduledTime(a.posted_at);
      if (!timeA || !timeB) return 0;
      return timeB - timeA; // Sắp xếp Giảm dần (gần đây nhất trước)
    })
    .slice(0, 5);

  // =================================================================
  // COMPONENT CON
  // =================================================================
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
  
  const ChartPlaceholder = ({ title }) => {
    return (
      <div className="bg-white rounded-lg shadow h-96 flex items-center justify-center flex-col">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mb-3" />
          <p className="text-gray-500">{title} đang tải...</p>
      </div>
    );
  };

  // =================================================================
  // RENDER CHÍNH
  // =================================================================
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <button
          onClick={onRefresh}
          className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400 font-medium shadow-md"
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Làm mới dữ liệu
        </button>
      </div>

      {/* Stats Cards */}
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
          title="Lịch đăng Hôm nay"
          value={stats.today}
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Biểu đồ 1: Tổng quan trạng thái bài viết */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Tóm tắt Trạng thái Bài viết
          </h2>
          {isLoading ? <ChartPlaceholder title="Biểu đồ trạng thái" /> : 
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#374151" />
                <YAxis allowDecimals={false} stroke="#374151" />
                <Tooltip 
                    cursor={{ fill: '#f3f4f6' }} 
                    formatter={(value) => [`${value} bài`, 'Số lượng']}
                />
                <Bar dataKey="value" name="Số lượng bài viết" radius={[4, 4, 0, 0]}>
                  {barChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          }
        </div>

        {/* Biểu đồ 2: Xu hướng đăng bài 7 ngày (Lượng đăng bài hàng ngày) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Xu hướng Đăng bài (7 Ngày gần nhất)
          </h2>
          {isLoading ? <ChartPlaceholder title="Biểu đồ xu hướng" /> : 
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineChartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#374151" />
                <YAxis allowDecimals={false} stroke="#374151" />
                <Tooltip 
                    formatter={(value) => [`${value} bài`, 'Bài đã đăng']}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="posts_posted" 
                  name="Bài đã đăng" 
                  stroke="#ef4444" 
                  activeDot={{ r: 8 }}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          }
        </div>
      </div>
      
      {/* POSTS LISTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Posts */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">5 Bài viết sắp tới</h2>
          </div>
          <div className="p-6">
            {upcomingPosts.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Không có bài viết nào được lên lịch</p>
                {/* FIX: Thay Link bằng button/span để tránh lỗi */}
                <button
                  onClick={() => console.log('Tạo bài viết mới clicked')}
                  className="inline-flex items-center mt-4 text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Tạo bài viết mới
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingPosts.map((post) => (
                  <div key={post.id} className="border border-gray-200 rounded-lg p-4 transition duration-150 hover:bg-gray-50 cursor-pointer">
                    <p className="text-gray-900 font-medium line-clamp-2">
                      {post.content}
                    </p>
                    {post.images && post.images.length > 0 && (
                      <div className="mt-2">
                        <div className="flex space-x-1 overflow-x-auto">
                          {post.images.slice(0, 3).map((image, index) => (
                            <img 
                              key={index}
                              // Sử dụng URL mô phỏng hoặc đường dẫn tương đối (tùy thuộc vào backend)
                              src={image.image_path ? 
                                `https://windshop.site/api/uploads/${image.image_path.split('/').pop()}` : 
                                image.image_url || `https://placehold.co/48x48/5B6C8C/FFFFFF?text=IMG${index+1}`
                            }
                              alt={`Post image ${index + 1}`}
                              className="w-12 h-12 object-cover rounded-md"
                            />
                          ))}
                          {post.images.length > 3 && (
                            <div className="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center flex-shrink-0">
                              <span className="text-xs text-gray-600">+{post.images.length - 3}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                   <div className="flex items-center mt-2 text-sm text-gray-500">
                     <Clock className="h-4 w-4 mr-1 text-yellow-600" />
                     {formatDateTimeToVietnam(post.scheduled_time)}
                    </div>
                  </div>
                ))}
                {/* FIX: Thay Link bằng span/button */}
                <span
                  onClick={() => console.log('Xem tất cả bài viết sắp tới clicked')}
                  className="block text-center text-indigo-600 hover:text-indigo-700 font-medium mt-4 cursor-pointer transition-colors"
                >
                  Xem tất cả
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Posts */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">5 Bài viết gần đây</h2>
          </div>
          <div className="p-6">
            {recentPosts.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Chưa có bài viết nào được đăng gần đây</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentPosts.map((post) => (
                  <div key={post.id} className="border border-gray-200 rounded-lg p-4 transition duration-150 hover:bg-gray-50 cursor-pointer">
                    <p className="text-gray-900 font-medium line-clamp-2">
                      {post.content}
                    </p>
                    {post.images && post.images.length > 0 && (
                      <div className="mt-2">
                        <div className="flex space-x-1 overflow-x-auto">
                          {post.images.slice(0, 3).map((image, index) => (
                            <img 
                              key={index}
                              // Sử dụng URL mô phỏng hoặc đường dẫn tương đối (tùy thuộc vào backend)
                              src={image.image_path ? 
                                `https://windshop.site/api/uploads/${image.image_path.split('/').pop()}` : 
                                image.image_url || `https://placehold.co/48x48/5B6C8C/FFFFFF?text=IMG${index+1}`
                              }
                              alt={`Post image ${index + 1}`}
                              className="w-12 h-12 object-cover rounded-md"
                            />
                          ))}
                          {post.images.length > 3 && (
                            <div className="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center flex-shrink-0">
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
                {/* FIX: Thay Link bằng span/button */}
                <span
                  onClick={() => console.log('Xem tất cả bài viết đã đăng clicked')}
                  className="block text-center text-indigo-600 hover:text-indigo-700 font-medium mt-4 cursor-pointer transition-colors"
                >
                  Xem tất cả
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Facebook Status */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Trạng thái Kết nối Facebook</h2>
        </div>
        <div className="p-6">
          {facebookTokens.length === 0 ? (
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0" />
                <span className="text-gray-700">Chưa kết nối với bất kỳ Page nào.</span>
              </div>  
              {/* FIX: Thay Link bằng button */}
              <button
                onClick={() => console.log('Kết nối Facebook clicked')}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
              >
                Kết nối Facebook
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {facebookTokens.map((token) => (
                <div key={token.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-4 transition duration-150 hover:bg-gray-50">
                  <div className="flex items-center min-w-0 flex-1">
                    <Facebook className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" />
                    <div className="truncate">
                      <p className="font-medium text-gray-900 truncate">{token.page_name}</p>
                      <p className="text-sm text-gray-500 truncate">ID: {token.page_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center text-green-600 flex-shrink-0 ml-4">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    <span className="text-sm font-medium">Đã kết nối</span>
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