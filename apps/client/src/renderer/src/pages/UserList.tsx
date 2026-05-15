import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { getApiUrl } from '../api/client';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
  created_at: string;
}

export default function UserList() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'DESIGNER',
  });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      const response = await axios.get(`${apiUrl}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      await axios.post(`${apiUrl}/users`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFormData({ email: '', password: '', name: '', role: 'DESIGNER' });
      setShowCreateForm(false);
      fetchUsers();
    } catch (error: any) {
      setError(error.response?.data?.error || '创建用户失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`确定要删除用户"${userName}"吗？`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      await axios.delete(`${apiUrl}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchUsers();
    } catch (error: any) {
      alert(error.response?.data?.error || '删除失败');
    }
  };

  const getRoleBadge = (role: string) => {
    const classes: Record<string, string> = {
      ADMIN: 'bg-red-100 text-red-800',
      PROJECT_MANAGER: 'bg-blue-100 text-blue-800',
      DESIGNER: 'bg-gray-100 text-gray-800',
    };
    const labels: Record<string, string> = {
      ADMIN: '管理员',
      PROJECT_MANAGER: '项目总管',
      DESIGNER: '设计师',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${classes[role] || classes.DESIGNER}`}>
        {labels[role] || role}
      </span>
    );
  };

  if (loading) {
    return <div className="p-8">加载中...</div>;
  }

  if (currentUser?.role !== 'ADMIN') {
    return <div className="p-8">无权限访问此页面</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn btn-primary"
        >
          {showCreateForm ? '取消' : '创建用户'}
        </button>
      </div>

      {showCreateForm && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">创建新用户</h2>
          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4">{error}</div>
          )}
          <form onSubmit={handleCreateUser}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">邮箱 *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">密码 *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">姓名 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">角色</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="input"
                >
                  <option value="DESIGNER">设计师</option>
                  <option value="PROJECT_MANAGER">项目总管</option>
                  <option value="ADMIN">管理员</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <button type="submit" disabled={creating} className="btn btn-primary">
                {creating ? '创建中...' : '创建用户'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3">姓名</th>
              <th className="text-left py-3">邮箱</th>
              <th className="text-left py-3">角色</th>
              <th className="text-left py-3">创建时间</th>
              <th className="text-left py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b hover:bg-gray-50">
                <td className="py-3 font-medium">{user.name}</td>
                <td className="py-3">{user.email}</td>
                <td className="py-3">{getRoleBadge(user.role)}</td>
                <td className="py-3">{new Date(user.created_at).toLocaleDateString()}</td>
                <td className="py-3">
                  {user.id !== currentUser?.id && (
                    <button
                      onClick={() => handleDeleteUser(user.id, user.name)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      删除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-8 text-gray-500">暂无用户</div>
        )}
      </div>
    </div>
  );
}