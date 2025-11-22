import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'react-datepicker/dist/react-datepicker.css';

import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import CreatePost from './components/CreatePost';
import PostList from './components/PostList';
import FacebookSettings from './components/FacebookSettings';
import { API_BASE_URL } from './config/api';

function App() {
  const [posts, setPosts] = useState([]);
  const [facebookTokens, setFacebookTokens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [postsResponse, tokensResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/posts/`),
        fetch(`${API_BASE_URL}/facebook-tokens/`)
      ]);

      const postsData = await postsResponse.json();
      const tokensData = await tokensResponse.json();

      setPosts(postsData);
      setFacebookTokens(tokensData);
    } catch (error) {
      toast.error('Lỗi khi tải dữ liệu');
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addPost = (newPost) => {
    setPosts(prevPosts => [newPost, ...prevPosts]);
  };

  const updatePost = (updatedPost) => {
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === updatedPost.id ? updatedPost : post
      )
    );
  };

  const deletePost = (postId) => {
    setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
  };

  const addFacebookToken = (newToken) => {
    setFacebookTokens(prevTokens => [...prevTokens, newToken]);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route 
              path="/" 
              element={
                <Dashboard 
                  posts={posts} 
                  facebookTokens={facebookTokens}
                  onRefresh={fetchData}
                />
              } 
            />
            <Route 
              path="/create-post" 
              element={
                <CreatePost 
                  onPostCreated={addPost}
                  facebookTokens={facebookTokens}
                />
              } 
            />
            <Route 
              path="/posts" 
              element={
                <PostList 
                  posts={posts}
                  onPostUpdated={updatePost}
                  onPostDeleted={deletePost}
                />
              } 
            />
            <Route 
              path="/facebook-settings" 
              element={
                <FacebookSettings 
                  facebookTokens={facebookTokens}
                  onTokenAdded={addFacebookToken}
                />
              } 
            />
          </Routes>
        </main>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </div>
    </Router>
  );
}

export default App;
