import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { getApiUrl } from '../api/client';

interface User {
  id: string;
  name: string;
  email: string;
}

interface Project {
  id: string;
  name: string;
}

export default function TaskCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    requirements: '',
    projectId: '',
    assigneeId: '',
    priority: 'MEDIUM',
    expectedCompletion: '',
    autoUploadEnabled: false,
    autoUploadInterval: 'DAILY',
    autoUploadTime: '18:00',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      const [usersRes, projectsRes] = await Promise.all([
        axios.get(`${apiUrl}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${apiUrl}/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setUsers(usersRes.data.data);
      setProjects(projectsRes.data.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      const response = await axios.post(
        `${apiUrl}/tasks`,
        {
          name: formData.name,
          description: formData.description || undefined,
          requirements: formData.requirements || undefined,
          projectId: formData.projectId || undefined,
          assigneeId: formData.assigneeId || undefined,
          priority: formData.priority,
          expectedCompletion: formData.expectedCompletion || undefined,
          autoUploadEnabled: formData.autoUploadEnabled,
          autoUploadInterval: formData.autoUploadEnabled ? formData.autoUploadInterval : undefined,
          autoUploadTime: formData.autoUploadEnabled ? formData.autoUploadTime : undefined,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      navigate(`/tasks/${response.data.data.id}`);
    } catch (error: any) {
      setError(error.response?.data?.error || '创建任务失败');
    } finally {
      setSubmitting(false);
    }
  };

  const canCreate = user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER';

  if (loading) {
    return <div className="p-8">加载中...</div>;
  }

  if (!canCreate) {
    return <div className="p-8">无权限创建任务</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">创建任务</h1>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="card">
        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">任务名称 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input w-full"
              required
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input w-full"
              rows={2}
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">具体需求</label>
            <textarea
              value={formData.requirements}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              className="input w-full"
              rows={4}
              placeholder="详细描述任务需求、规格、参考等..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">所属项目</label>
            <select
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              className="input w-full"
            >
              <option value="">无</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">负责人 *</label>
            <select
              value={formData.assigneeId}
              onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
              className="input w-full"
              required
            >
              <option value="">请选择负责人</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">优先级</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="input w-full"
            >
              <option value="LOW">低</option>
              <option value="MEDIUM">中</option>
              <option value="HIGH">高</option>
              <option value="URGENT">紧急</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">预期完成时间</label>
            <input
              type="date"
              value={formData.expectedCompletion}
              onChange={(e) => setFormData({ ...formData, expectedCompletion: e.target.value })}
              className="input w-full"
            />
          </div>

          <div className="col-span-2 border-t pt-4 mt-2">
            <h3 className="text-lg font-semibold mb-3">自动上传设置</h3>
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="autoUpload"
                checked={formData.autoUploadEnabled}
                onChange={(e) => setFormData({ ...formData, autoUploadEnabled: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="autoUpload" className="text-sm">启用自动上传</label>
            </div>

            {formData.autoUploadEnabled && (
              <div className="grid grid-cols-2 gap-4 pl-6">
                <div>
                  <label className="block text-sm font-medium mb-1">上传频率</label>
                  <select
                    value={formData.autoUploadInterval}
                    onChange={(e) => setFormData({ ...formData, autoUploadInterval: e.target.value })}
                    className="input w-full"
                  >
                    <option value="DAILY">每天</option>
                    <option value="WEEKLY">每周</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">上传时间</label>
                  <input
                    type="time"
                    value={formData.autoUploadTime}
                    onChange={(e) => setFormData({ ...formData, autoUploadTime: e.target.value })}
                    className="input w-full"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? '创建中...' : '创建任务'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/tasks')}
            className="btn btn-secondary"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}