import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { getApiUrl } from '../api/client';

interface Task {
  id: string;
  name: string;
  status: string;
  priority: string;
  assignee?: { id: string; name: string };
  creator?: { name: string };
  created_at: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    inProgress: 0,
    completed: 0,
  });
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      const response = await axios.get(`${apiUrl}/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const tasks = response.data.tasks;
      setRecentTasks(tasks.slice(0, 5));
      setStats({
        total: response.data.total,
        new: tasks.filter((t: Task) => t.status === 'NEW').length,
        inProgress: tasks.filter((t: Task) => t.status === 'IN_PROGRESS').length,
        completed: tasks.filter((t: Task) => t.status === 'COMPLETED').length,
      });

      const pending = tasks.filter(
        (t: Task) => t.status === 'NEW' && t.assignee?.id === user?.id
      );
      setPendingTasks(pending);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTask = async (taskId: string) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      await axios.post(`${apiUrl}/tasks/${taskId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchData();
    } catch (error) {
      console.error('Failed to accept task:', error);
      alert('接受任务失败');
    }
  };

  const getPriorityBadge = (priority: string) => {
    const classes: Record<string, string> = {
      LOW: 'bg-gray-100 text-gray-800',
      MEDIUM: 'bg-blue-100 text-blue-800',
      HIGH: 'bg-orange-100 text-orange-800',
      URGENT: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      LOW: '低',
      MEDIUM: '中',
      HIGH: '高',
      URGENT: '紧急',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${classes[priority] || classes.MEDIUM}`}>
        {labels[priority] || priority}
      </span>
    );
  };

  if (loading) {
    return <div className="p-8">加载中...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">欢迎回来，{user?.name}</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-gray-500">总任务数</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-green-600">{stats.new}</div>
          <div className="text-gray-500">新建任务</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-yellow-600">{stats.inProgress}</div>
          <div className="text-gray-500">进行中</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-gray-600">{stats.completed}</div>
          <div className="text-gray-500">已完成</div>
        </div>
      </div>

      {pendingTasks.length > 0 && (
        <div className="card mb-6 bg-yellow-50 border border-yellow-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-yellow-800">
              我的待办（{pendingTasks.length}个任务需要接受）
            </h2>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-yellow-300">
                <th className="text-left py-2 text-yellow-800">任务名称</th>
                <th className="text-left py-2 text-yellow-800">优先级</th>
                <th className="text-left py-2 text-yellow-800">创建者</th>
                <th className="text-left py-2 text-yellow-800">创建时间</th>
                <th className="text-left py-2 text-yellow-800">操作</th>
              </tr>
            </thead>
            <tbody>
              {pendingTasks.map((task) => (
                <tr key={task.id} className="border-b border-yellow-200">
                  <td className="py-2">
                    <Link to={`/tasks/${task.id}`} className="text-blue-600 hover:underline font-medium">
                      {task.name}
                    </Link>
                  </td>
                  <td className="py-2">{getPriorityBadge(task.priority)}</td>
                  <td className="py-2">{task.creator?.name || '-'}</td>
                  <td className="py-2">{new Date(task.created_at).toLocaleDateString()}</td>
                  <td className="py-2">
                    <button
                      onClick={() => handleAcceptTask(task.id)}
                      className="btn btn-primary text-sm py-1 px-3"
                    >
                      接受任务
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">最近任务</h2>
          <Link to="/tasks" className="text-blue-600 hover:underline">
            查看全部
          </Link>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">任务名称</th>
              <th className="text-left py-2">状态</th>
              <th className="text-left py-2">优先级</th>
              <th className="text-left py-2">负责人</th>
              <th className="text-left py-2">创建时间</th>
            </tr>
          </thead>
          <tbody>
            {recentTasks.map((task) => (
              <tr key={task.id} className="border-b hover:bg-gray-50">
                <td className="py-2">
                  <Link to={`/tasks/${task.id}`} className="text-blue-600 hover:underline">
                    {task.name}
                  </Link>
                </td>
                <td className="py-2">
                  <span className={`badge badge-${task.status.toLowerCase().replace('_', '-')}`}>
                    {task.status}
                  </span>
                </td>
                <td className="py-2">{task.priority}</td>
                <td className="py-2">{task.assignee?.name || '-'}</td>
                <td className="py-2">{new Date(task.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}