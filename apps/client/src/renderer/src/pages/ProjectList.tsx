import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { getApiUrl } from '../api/client';

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  _count?: { tasks: number };
}

export default function ProjectList() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      const response = await axios.get(`${apiUrl}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProjects(response.data.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      await axios.post(`${apiUrl}/projects`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFormData({ name: '', description: '' });
      setShowCreateForm(false);
      fetchProjects();
    } catch (error: any) {
      setError(error.response?.data?.error || '创建项目失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('确定要删除此项目吗？')) return;

    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      await axios.delete(`${apiUrl}/projects/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchProjects();
    } catch (error: any) {
      alert(error.response?.data?.error || '删除项目失败');
    }
  };

  const canCreate = user?.role === 'ADMIN';
  const canDelete = user?.role === 'ADMIN';

  if (loading) {
    return <div className="p-8">加载中...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">项目管理</h1>
        {canCreate && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn btn-primary"
          >
            {showCreateForm ? '取消' : '创建项目'}
          </button>
        )}
      </div>

      {showCreateForm && canCreate && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">创建新项目</h2>
          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4">{error}</div>
          )}
          <form onSubmit={handleCreateProject}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">项目名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input w-full"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">项目描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input w-full"
                rows={3}
              />
            </div>
            <button type="submit" disabled={creating} className="btn btn-primary">
              {creating ? '创建中...' : '创建项目'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3">项目名称</th>
              <th className="text-left py-3">描述</th>
              <th className="text-left py-3">任务数</th>
              <th className="text-left py-3">创建时间</th>
              {canDelete && <th className="text-left py-3">操作</th>}
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} className="border-b hover:bg-gray-50">
                <td className="py-3 font-medium">{project.name}</td>
                <td className="py-3 text-gray-600">{project.description || '-'}</td>
                <td className="py-3">{project._count?.tasks || 0}</td>
                <td className="py-3">{new Date(project.created_at).toLocaleDateString()}</td>
                {canDelete && (
                  <td className="py-3">
                    <button
                      onClick={() => handleDeleteProject(project.id)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      删除
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {projects.length === 0 && (
          <div className="text-center py-8 text-gray-500">暂无项目</div>
        )}
      </div>
    </div>
  );
}