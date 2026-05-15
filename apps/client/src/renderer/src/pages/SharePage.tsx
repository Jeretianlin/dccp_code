import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { getApiUrl } from '../api/client';

interface ShareInfo {
  id: string;
  expiresAt: string | null;
  maxDownloads: number | null;
  downloadCount: number;
  hasPassword: boolean;
}

interface VersionInfo {
  versionNumber: number;
  fileCount: number;
  totalSize: string;
}

export default function SharePage() {
  const { shareId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [password, setPassword] = useState('');
  const [needPassword, setNeedPassword] = useState(false);

  useEffect(() => {
    fetchShareInfo();
  }, [shareId]);

  const fetchShareInfo = async (pwd?: string) => {
    try {
      setLoading(true);
      setError(null);

      const apiUrl = await getApiUrl();
      const response = await axios.get(`${apiUrl}/share/${shareId}`, {
        params: { password: pwd },
      });

      setShareInfo(response.data.data.share);
      setVersionInfo(response.data.data.version);
      setNeedPassword(false);
    } catch (err: any) {
      if (err.response?.data?.error === '密码错误') {
        setNeedPassword(true);
        setError('请输入访问密码');
      } else {
        setError(err.response?.data?.error || '获取分享信息失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchShareInfo(password);
  };

  const handleDownload = async () => {
    try {
      const params = new URLSearchParams();
      if (password) params.append('password', password);

      const apiUrl = await getApiUrl();
      const response = await axios.get(
        `${apiUrl}/share/${shareId}/download?${params.toString()}`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `share-v${versionInfo?.versionNumber || 1}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      fetchShareInfo(password);
    } catch (err: any) {
      alert(err.response?.data?.error || '下载失败');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-lg">加载中...</div>
      </div>
    );
  }

  if (needPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-lg">
          <h1 className="text-xl font-bold mb-6 text-center">访问密码</h1>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-4"
              placeholder="请输入访问密码"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              确认
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-lg text-center">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h1 className="text-xl font-bold mb-2">无法访问</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-lg">
        <h1 className="text-xl font-bold mb-6">文件分享</h1>

        {versionInfo && (
          <div className="space-y-3 mb-6">
            <div className="flex justify-between">
              <span className="text-gray-500">版本</span>
              <span className="font-medium">V{versionInfo.versionNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">文件数</span>
              <span>{versionInfo.fileCount} 个</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">大小</span>
              <span>{(Number(versionInfo.totalSize) / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            {shareInfo?.expiresAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">过期时间</span>
                <span>{new Date(shareInfo.expiresAt).toLocaleString()}</span>
              </div>
            )}
            {shareInfo?.maxDownloads && (
              <div className="flex justify-between">
                <span className="text-gray-500">下载次数</span>
                <span>{shareInfo.downloadCount} / {shareInfo.maxDownloads}</span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleDownload}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium"
        >
          下载文件
        </button>
      </div>
    </div>
  );
}