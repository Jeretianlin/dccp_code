import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';

export default function Settings() {
  const { user } = useAuth();
  const [serverUrl, setServerUrl] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await api.getConfig();
      setServerUrl(config.serverUrl);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const handleTestConnection = async () => {
    if (!serverUrl.trim()) {
      setConnectionStatus('error');
      setConnectionMessage('请输入服务器地址');
      return;
    }

    setConnectionStatus('testing');
    setConnectionMessage('正在测试连接...');

    try {
      const result = await api.testConnection(serverUrl);
      if (result.success) {
        setConnectionStatus('connected');
        setConnectionMessage(result.message);
      } else {
        setConnectionStatus('error');
        setConnectionMessage(result.message);
      }
    } catch (error) {
      setConnectionStatus('error');
      setConnectionMessage('连接测试失败');
    }
  };

  const handleSaveConfig = async () => {
    if (!serverUrl.trim()) {
      setSaveMessage('请输入服务器地址');
      return;
    }

    setSaving(true);
    setSaveMessage('');

    try {
      const result = await api.updateConfig({ serverUrl });
      if (result.success) {
        setSaveMessage('保存成功！请重启应用以使配置生效。');
        setConnectionStatus('idle');
      } else {
        setSaveMessage(result.error || '保存失败');
      }
    } catch (error) {
      setSaveMessage('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('新密码与确认密码不匹配');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = await api.getApiUrl();
      
      const response = await fetch(`${apiUrl}/users/me/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          oldPassword: passwordData.oldPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setPasswordMessage('密码修改成功！');
        setPasswordError('');
        setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => {
          setPasswordMessage('');
          setShowChangePassword(false);
        }, 2000);
      } else {
        setPasswordError(result.error || '修改失败');
        setPasswordMessage('');
      }
    } catch (error) {
      setPasswordError('网络错误，请重试');
      setPasswordMessage('');
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">设置</h1>

      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">服务器配置</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">服务器地址</label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => {
                setServerUrl(e.target.value);
                setConnectionStatus('idle');
                setSaveMessage('');
              }}
              className="input w-full"
              placeholder="http://your-server:3000"
            />
            <p className="text-sm text-gray-500 mt-1">
              例如: http://192.168.1.100:3000 或 https://server.example.com
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleTestConnection}
              disabled={connectionStatus === 'testing'}
              className="btn btn-secondary"
            >
              {connectionStatus === 'testing' ? '测试中...' : '测试连接'}
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>

          {connectionStatus !== 'idle' && (
            <div className={`p-3 rounded-md ${
              connectionStatus === 'testing' ? 'bg-blue-50 text-blue-700' :
              connectionStatus === 'connected' ? 'bg-green-50 text-green-700' :
              'bg-red-50 text-red-700'
            }`}>
              <div className="flex items-center gap-2">
                {connectionStatus === 'connected' && <span>✓</span>}
                {connectionStatus === 'error' && <span>✗</span>}
                <span>{connectionMessage}</span>
              </div>
            </div>
          )}

          {saveMessage && (
            <div className={`p-3 rounded-md ${
              saveMessage.includes('成功') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {saveMessage}
            </div>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">个人信息</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-500">姓名</label>
            <p>{user?.name}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">邮箱</label>
            <p>{user?.email}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">角色</label>
            <p>{user?.role}</p>
          </div>
          
          <button
            onClick={() => setShowChangePassword(!showChangePassword)}
            className="mt-3 text-blue-600 hover:underline text-sm"
          >
            {showChangePassword ? '取消' : '修改密码'}
          </button>
          
          {showChangePassword && (
            <div className="mt-4 pt-4 border-t">
              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">旧密码</label>
                  <input
                    type="password"
                    value={passwordData.oldPassword}
                    onChange={(e) => setPasswordData({...passwordData, oldPassword: e.target.value})}
                    className="input w-full"
                    required
                    minLength={1}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">新密码</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                    className="input w-full"
                    required
                    minLength={6}
                    placeholder="至少6位"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">确认新密码</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                    className="input w-full"
                    required
                  />
                </div>
                
                {(passwordMessage || passwordError) && (
                  <div className={`p-3 rounded-md ${
                    passwordMessage ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {passwordMessage || passwordError}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button type="submit" className="btn btn-primary text-sm">
                    确认修改
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">系统设置</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">自动同步</p>
              <p className="text-sm text-gray-500">自动同步本地文件到服务器</p>
            </div>
            <input type="checkbox" className="w-5 h-5" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">桌面通知</p>
              <p className="text-sm text-gray-500">接收任务更新通知</p>
            </div>
            <input type="checkbox" className="w-5 h-5" defaultChecked />
          </div>
        </div>
      </div>
    </div>
  );
}