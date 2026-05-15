import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TaskList from './pages/TaskList';
import TaskCreate from './pages/TaskCreate';
import TaskDetail from './pages/TaskDetail';
import ProjectList from './pages/ProjectList';
import UserList from './pages/UserList';
import Settings from './pages/Settings';
import SharePage from './pages/SharePage';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function AppRoutes() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">加载中...</div>
      </div>
    );
  }

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/share/:shareId" element={<SharePage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tasks" element={<TaskList />} />
        <Route path="/tasks/new" element={<TaskCreate />} />
        <Route path="/tasks/:id" element={<TaskDetail />} />
        <Route path="/projects" element={<ProjectList />} />
        <Route path="/users" element={<UserList />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/share/:shareId" element={<SharePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}