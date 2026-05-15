import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { getApiUrl } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface Task {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority: string;
  assignee?: { id: string; name: string };
  project?: { id: string; name: string };
  created_at: string;
  _count?: { sub_tasks: number; versions: number };
}

interface User {
  id: string;
  name: string;
  email: string;
}

export default function TaskList() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    assigneeId: '',
    search: '',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [filters]);

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
    }
  };

  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.assigneeId) params.append('assigneeId', filters.assigneeId);
      if (filters.search) params.append('search', filters.search);

      const response = await axios.get(`${apiUrl}/tasks?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTasks(response.data.tasks);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (taskId: string, taskName: string) => {
    if (!confirm(`确定要删除任务"${taskName}"吗？\n\n注意：删除后子任务也会被删除。`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      await axios.delete(`${apiUrl}/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchTasks();
    } catch (error: any) {
      alert(error.response?.data?.error || '删除失败');
    }
  };

  const canDelete = user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER';
  const canFilterByAssignee = user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER';

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      NEW: 'badge-new',
      ACCEPTED: 'badge-accepted',
      IN_PROGRESS: 'badge-in-progress',
      COMPLETED: 'badge-completed',
    };
    return classes[status] || 'badge-new';
  };

  if (loading) {
    return <div className="p-8">加载中...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">任务列表</h1>
        <Link to="/tasks/new" className="btn btn-primary">
          新建任务
        </Link>
      </div>

      <div className="card mb-4">
        <div className="space-y-3">
          <input
            type="text"
            placeholder="搜索任务名称..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="input w-full"
          />
          <div className="flex gap-4">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input w-40"
            >
              <option value="">全部状态</option>
              <option value="NEW">新建</option>
              <option value="ACCEPTED">已接受</option>
              <option value="IN_PROGRESS">进行中</option>
              <option value="COMPLETED">已完成</option>
            </select>
            {canFilterByAssignee && (
              <select
                value={filters.assigneeId}
                onChange={(e) => setFilters({ ...filters, assigneeId: e.target.value })}
                className="input w-40"
              >
                <option value="">全部负责人</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3">任务名称</th>
              <th className="text-left py-3">状态</th>
              <th className="text-left py-3">优先级</th>
              <th className="text-left py-3">负责人</th>
              <th className="text-left py-3">项目</th>
              <th className="text-left py-3">版本</th>
              <th className="text-left py-3">创建时间</th>
              {canDelete && <th className="text-left py-3">操作</th>}
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-b hover:bg-gray-50">
                <td className="py-3">
                  <Link to={`/tasks/${task.id}`} className="text-blue-600 hover:underline font-medium">
                    {task.name}
                  </Link>
                </td>
                <td className="py-3">
                  <span className={`badge ${getStatusBadge(task.status)}`}>
                    {task.status}
                  </span>
                </td>
                <td className="py-3">{task.priority}</td>
                <td className="py-3">{task.assignee?.name || '-'}</td>
                <td className="py-3">{task.project?.name || '-'}</td>
                <td className="py-3">{task._count?.versions || 0}</td>
                <td className="py-3">{new Date(task.created_at).toLocaleDateString()}</td>
                {canDelete && (
                  <td className="py-3">
                    <button
                      onClick={() => handleDelete(task.id, task.name)}
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

        {tasks.length === 0 && (
          <div className="text-center py-8 text-gray-500">暂无任务</div>
        )}
      </div>
    </div>
  );
}