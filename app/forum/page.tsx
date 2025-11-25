'use client';

import { useState, useEffect } from 'react';
import { 
  LikeOutlined, 
  CommentOutlined, 
  UserOutlined,
  PlusOutlined,
  SendOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface ForumComment {
  id: number | string;
  content: string;
  created_at: string | Date;
  author: { id?: number; name: string } | null;
  user_id?: number;
}

interface ForumPost {
  id: number | string;
  title: string;
  content: string;
  created_at: string | Date;
  author: { id?: number; name: string } | null;
  comments: ForumComment[];
  user_id?: number;
}

export default function ForumPage() {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [showNewPostForm, setShowNewPostForm] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [commentInputs, setCommentInputs] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: number; role: string } | null>(null);
  const [editingPost, setEditingPost] = useState<{ id: number | string; title: string; content: string } | null>(null);
  const [editingComment, setEditingComment] = useState<{ id: number | string; content: string } | null>(null);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/forum/posts');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      // map created_at strings to Date when needed
      const mapped: ForumPost[] = data.map((p: any) => ({
        ...p,
        created_at: p.created_at,
        comments: (p.comments || []).map((c: any) => ({ ...c, created_at: c.created_at })),
      }));
      setPosts(mapped);
    } catch (error) {
      console.error('Fetch posts error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const canEditPost = (post: ForumPost) => {
    if (!currentUser) return false;
    return currentUser.id === post.user_id || currentUser.role === 'admin';
  };

  const canEditComment = (comment: ForumComment) => {
    if (!currentUser) return false;
    return currentUser.id === comment.author?.id || currentUser.role === 'admin';
  };

  const handleCreatePost = async () => {
    if (!newPost.title || !newPost.content) return;
    try {
      const res = await fetch('/api/forum/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPost),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Không thể tạo bài viết');
        return;
      }
      setNewPost({ title: '', content: '' });
      setShowNewPostForm(false);
      await fetchPosts();
    } catch (error) {
      console.error('Create post error', error);
    }
  };

  const handleLikePost = (postId: number | string) => {
    // optimistic UI only (no server side like implemented)
    setPosts(posts.map((post) => (post.id === postId ? { ...post } : post)));
  };

  const handleAddComment = async (postId: number | string) => {
    const commentContent = commentInputs[String(postId)];
    if (!commentContent) return;
    try {
      const res = await fetch(`/api/forum/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentContent }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Không thể thêm bình luận');
        return;
      }
      setCommentInputs({ ...commentInputs, [String(postId)]: '' });
      await fetchPosts();
    } catch (error) {
      console.error('Add comment error', error);
    }
  };

  const handleEditPost = (postId: number | string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    setEditingPost({ id: postId, title: post.title, content: post.content });
  };

  const handleSaveEditPost = async () => {
    if (!editingPost) return;
    try {
      const res = await fetch(`/api/forum/posts/${editingPost.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingPost.title, content: editingPost.content }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Không thể cập nhật bài viết');
        return;
      }
      setEditingPost(null);
      await fetchPosts();
    } catch (error) {
      console.error('Edit post error', error);
    }
  };

  const handleDeletePost = async (postId: number | string) => {
    if (!confirm('Bạn có chắc muốn xóa bài viết này?')) return;
    try {
      const res = await fetch(`/api/forum/posts/${postId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Không thể xóa bài viết');
        return;
      }
      await fetchPosts();
    } catch (error) {
      console.error('Delete post error', error);
    }
  };

  const handleEditComment = (commentId: number | string, currentContent: string) => {
    setEditingComment({ id: commentId, content: currentContent });
  };

  const handleSaveEditComment = async () => {
    if (!editingComment) return;
    try {
      const res = await fetch(`/api/forum/comments/${editingComment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingComment.content }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Không thể cập nhật bình luận');
        return;
      }
      setEditingComment(null);
      await fetchPosts();
    } catch (error) {
      console.error('Edit comment error', error);
    }
  };

  const handleDeleteComment = async (commentId: number | string) => {
    if (!confirm('Bạn có chắc muốn xóa bình luận này?')) return;
    try {
      const res = await fetch(`/api/forum/comments/${commentId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Không thể xóa bình luận');
        return;
      }
      await fetchPosts();
    } catch (error) {
      console.error('Delete comment error', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Forum Thời Tiết</h1>
          <p className="text-gray-600 mt-2">Chia sẻ và thảo luận về thời tiết</p>
        </div>
        <button
          onClick={() => setShowNewPostForm(!showNewPostForm)}
          className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors shadow-md"
        >
          <PlusOutlined />
          <span>Đăng bài mới</span>
        </button>
      </div>

      {/* New Post Form */}
      {showNewPostForm && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Tạo bài viết mới</h3>
          <input
            type="text"
            placeholder="Tiêu đề..."
            value={newPost.title}
            onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            placeholder="Nội dung bài viết..."
            value={newPost.content}
            onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex space-x-3">
            <button
              onClick={handleCreatePost}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Đăng bài
            </button>
            <button
              onClick={() => setShowNewPostForm(false)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg transition-colors"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Edit Post Form */}
      {editingPost && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-2 border-blue-500">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Chỉnh sửa bài viết</h3>
          <input
            type="text"
            placeholder="Tiêu đề..."
            value={editingPost.title}
            onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            placeholder="Nội dung bài viết..."
            value={editingPost.content}
            onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex space-x-3">
            <button
              onClick={handleSaveEditPost}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Lưu thay đổi
            </button>
            <button
              onClick={() => setEditingPost(null)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg transition-colors"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Posts List */}
      <div className="space-y-6">
        {posts.map((post) => (
          <div key={post.id} className="bg-white rounded-xl shadow-md p-6">
            {/* Post Header */}
            <div className="flex items-start space-x-4 mb-4">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl">
                <UserOutlined />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800">{post.author?.name || 'Người dùng'}</h3>
                <p className="text-sm text-gray-500">
                  {format(new Date(post.created_at), 'dd MMMM yyyy, HH:mm', { locale: vi })}
                </p>
              </div>
              {canEditPost(post) && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditPost(post.id)}
                    className="text-blue-500 hover:text-blue-700 p-2"
                    title="Chỉnh sửa"
                  >
                    <EditOutlined />
                  </button>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="text-red-500 hover:text-red-700 p-2"
                    title="Xóa"
                  >
                    <DeleteOutlined />
                  </button>
                </div>
              )}
            </div>

            {/* Post Content */}
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{post.title}</h2>
            <p className="text-gray-700 mb-4 leading-relaxed">{post.content}</p>

            {/* Post Actions */}
              <div className="flex items-center space-x-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => handleLikePost(post.id)}
                className="flex items-center space-x-2 text-gray-600 hover:text-blue-500 transition-colors"
              >
                <LikeOutlined className="text-xl" />
                <span>{post.comments.length}</span>
              </button>
              <div className="flex items-center space-x-2 text-gray-600">
                <CommentOutlined className="text-xl" />
                <span>{post.comments.length}</span>
              </div>
            </div>

            {/* Comments Section */}
            {post.comments.length > 0 && (
              <div className="mt-6 space-y-4 pl-4 border-l-2 border-gray-200">
                {post.comments.map((comment) => (
                  <div key={comment.id} className="flex space-x-3">
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-white">
                      <UserOutlined />
                    </div>
                    <div className="flex-1">
                      {editingComment?.id === comment.id ? (
                        <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-3">
                          <textarea
                            value={editingComment.content}
                            onChange={(e) => setEditingComment({ ...editingComment, content: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            rows={3}
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={handleSaveEditComment}
                              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded text-sm"
                            >
                              Lưu
                            </button>
                            <button
                              onClick={() => setEditingComment(null)}
                              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-1 rounded text-sm"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-sm text-gray-800">
                              {comment.author?.name || 'Người dùng'}
                            </span>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">
                                {format(new Date(comment.created_at), 'dd/MM/yyyy HH:mm')}
                              </span>
                              {canEditComment(comment) && (
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() => handleEditComment(comment.id, comment.content)}
                                    className="text-blue-500 hover:text-blue-700 text-xs p-1"
                                    title="Chỉnh sửa"
                                  >
                                    <EditOutlined />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteComment(comment.id)}
                                    className="text-red-500 hover:text-red-700 text-xs p-1"
                                    title="Xóa"
                                  >
                                    <DeleteOutlined />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="text-gray-700 text-sm">{comment.content}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Comment */}
            <div className="mt-4 flex space-x-3">
              <input
                type="text"
                placeholder="Viết bình luận..."
                value={commentInputs[post.id] || ''}
                onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post.id)}
              />
              <button
                onClick={() => handleAddComment(post.id)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <SendOutlined />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
