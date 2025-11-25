'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  UserOutlined,
  MailOutlined,
  EnvironmentOutlined,
  EditOutlined,
  LogoutOutlined,
  BellOutlined,
  HeartOutlined,
} from '@ant-design/icons';

interface UserData {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  created_at: string;
  location?: string;
  bio?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('id');
  
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const url = userId ? `/api/users/${userId}` : '/api/auth/me';
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }
        
        const data = await response.json();
        setUserData(data);
      } catch (error) {
        console.error('Error fetching user:', error);
        // Redirect to login if unauthorized
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId, router]);

  const handleSave = () => {
    setIsEditing(false);
    // Save logic here
    console.log('Saved:', userData);
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });
      
      if (response.ok) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-600">Không tìm thấy thông tin người dùng</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-8 text-white mb-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-blue-500 text-4xl">
                <UserOutlined />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">{userData.name || 'User'}</h1>
                <div className="flex items-center space-x-4 text-blue-100">
                  <div className="flex items-center">
                    <MailOutlined className="mr-2" />
                    {userData.email}
                  </div>
                  {userData.location && (
                    <div className="flex items-center">
                      <EnvironmentOutlined className="mr-2" />
                      {userData.location}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="bg-white/20 hover:bg-white/30 px-6 py-2 rounded-lg transition-colors"
            >
              <EditOutlined className="mr-2" />
              {isEditing ? 'Hủy' : 'Chỉnh sửa'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Profile Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Edit Form */}
            {isEditing ? (
              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Chỉnh sửa thông tin</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Họ và tên
                    </label>
                    <input
                      type="text"
                      value={userData.name || ''}
                      onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={userData.email || ''}
                      onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Địa điểm
                    </label>
                    <input
                      type="text"
                      value={userData.location || ''}
                      onChange={(e) => setUserData({ ...userData, location: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Giới thiệu
                    </label>
                    <textarea
                      value={userData.bio || ''}
                      onChange={(e) => setUserData({ ...userData, bio: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleSave}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg transition-colors font-semibold"
                  >
                    Lưu thay đổi
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Giới thiệu</h2>
                <p className="text-gray-700 leading-relaxed">{userData.bio || 'Chưa có thông tin giới thiệu'}</p>
              </div>
            )}

            {/* Activity */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Hoạt động gần đây</h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <CommentOutlined className="text-blue-500 text-xl mt-1" />
                  <div>
                    <p className="font-medium text-gray-800">Đã bình luận trong forum</p>
                    <p className="text-sm text-gray-600">Thời tiết Sài Gòn hôm nay nóng quá!</p>
                    <p className="text-xs text-gray-500 mt-1">2 giờ trước</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <HeartOutlined className="text-red-500 text-xl mt-1" />
                  <div>
                    <p className="font-medium text-gray-800">Đã thích bài viết</p>
                    <p className="text-sm text-gray-600">Cách phòng tránh nắng nóng hiệu quả</p>
                    <p className="text-xs text-gray-500 mt-1">5 giờ trước</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Stats & Settings */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Thống kê</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Bài viết</span>
                  <span className="text-2xl font-bold text-blue-600">12</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Bình luận</span>
                  <span className="text-2xl font-bold text-blue-600">45</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Lượt thích</span>
                  <span className="text-2xl font-bold text-blue-600">89</span>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Cài đặt</h3>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors text-left">
                  <div className="flex items-center">
                    <BellOutlined className="text-xl text-gray-600 mr-3" />
                    <span className="text-gray-700">Thông báo</span>
                  </div>
                  <span className="text-blue-600">Bật</span>
                </button>
                <button className="w-full flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors text-left">
                  <EnvironmentOutlined className="text-xl text-gray-600 mr-3" />
                  <span className="text-gray-700">Vị trí mặc định</span>
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center p-3 hover:bg-red-50 rounded-lg transition-colors text-left text-red-600"
                >
                  <LogoutOutlined className="text-xl mr-3" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentOutlined(props: any) {
  return <span {...props}>💬</span>;
}
