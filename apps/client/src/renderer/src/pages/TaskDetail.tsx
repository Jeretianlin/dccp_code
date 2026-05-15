import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { getApiUrl, getBaseUrl } from '../api/client';

interface Task {
  id: string;
  name: string;
  description?: string;
  requirements?: string;
  status: string;
  priority: string;
  assignee?: { id: string; name: string; email: string };
  creator: { id: string; name: string; email: string };
  project?: { id: string; name: string };
  created_at: string;
  expected_completion?: string;
  watch_directory?: string;
  auto_upload_enabled: boolean;
  auto_upload_interval?: string;
  auto_upload_time?: string;
  auto_upload_day_of_week?: number;
  auto_upload_every_n_days?: number;
  next_upload_time?: string;
  last_upload_status?: string;
  last_upload_time?: string;
  last_upload_error?: string;
  last_upload_version?: number;
  last_upload_type?: string;
  sub_tasks?: Task[];
  versions?: Version[];
  file_filter_enabled?: boolean;
  file_filter_mode?: string;
  file_filter_rules?: string;
}

interface Version {
  id: string;
  version_number: number;
  created_at: string;
  upload_type: string;
  file_count: number;
  total_size: string;
  created_by: { name: string };
  files?: FileRecord[];
}

interface FileRecord {
  id: string;
  relative_path: string;
  file_hash: string;
  file_size: string;
  is_new: boolean;
  is_changed: boolean;
}

interface PreviewFile {
  path: string;
  size: number;
  selected: boolean;
}

interface ScannedFile {
  path: string;
  size: number;
}

interface ShareModal {
  isOpen: boolean;
  versionNumber: number;
  shareId: string | null;
  password: string;
  expiresAt: string;
  maxDownloads: string;
  shareLink: string | null;
}

interface AcceptModal {
  isOpen: boolean;
  watchDirectory: string;
  autoUploadEnabled: boolean;
  autoUploadInterval: string;
  autoUploadTime: string;
  autoUploadDayOfWeek: number;
  autoUploadEveryNDays: number;
  fileFilterEnabled: boolean;
  fileFilterMode: 'INCLUDE' | 'EXCLUDE';
  fileFilterRules: string[];
}

interface EditAutoUploadModal {
  isOpen: boolean;
  watchDirectory: string;
  autoUploadEnabled: boolean;
  autoUploadInterval: string;
  autoUploadTime: string;
  autoUploadDayOfWeek: number;
  autoUploadEveryNDays: number;
  fileFilterEnabled: boolean;
  fileFilterMode: 'INCLUDE' | 'EXCLUDE';
  fileFilterRules: string[];
}

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [selectedFiles, setSelectedFiles] = useState<string[] | null>(null);
  const [selectionType, setSelectionType] = useState<'file' | 'directory' | null>(null);
  const [currentVersion, setCurrentVersion] = useState<number>(0);
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);
  const [previewTotalSize, setPreviewTotalSize] = useState<number>(0);
  const [scanning, setScanning] = useState(false);
  const [latestVersionFiles, setLatestVersionFiles] = useState<FileRecord[]>([]);
  const [shareModal, setShareModal] = useState<ShareModal>({
    isOpen: false,
    versionNumber: 0,
    shareId: null,
    password: '',
    expiresAt: '',
    maxDownloads: '',
    shareLink: null,
  });
  const [acceptModal, setAcceptModal] = useState<AcceptModal>({
    isOpen: false,
    watchDirectory: '',
    autoUploadEnabled: false,
    autoUploadInterval: 'DAILY',
    autoUploadTime: '20:00',
    autoUploadDayOfWeek: 0,
    autoUploadEveryNDays: 1,
    fileFilterEnabled: false,
    fileFilterMode: 'INCLUDE',
    fileFilterRules: [],
  });
  const [editAutoUploadModal, setEditAutoUploadModal] = useState<EditAutoUploadModal>({
    isOpen: false,
    watchDirectory: '',
    autoUploadEnabled: false,
    autoUploadInterval: 'DAILY',
    autoUploadTime: '20:00',
    autoUploadDayOfWeek: 0,
    autoUploadEveryNDays: 1,
    fileFilterEnabled: false,
    fileFilterMode: 'INCLUDE',
    fileFilterRules: [],
  });

  useEffect(() => {
    fetchTask();
  }, [id]);

  const fetchTask = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      const response = await axios.get(`${apiUrl}/tasks/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const taskData = response.data.data;
      setTask(taskData);

      if (taskData.versions && taskData.versions.length > 0) {
        const latestVersion = taskData.versions[0];
        setCurrentVersion(latestVersion.version_number);
        
        const versionResponse = await axios.get(
          `${apiUrl}/tasks/${id}/versions/${latestVersion.version_number}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setLatestVersionFiles(versionResponse.data.data?.files || []);
      }
    } catch (error) {
      console.error('Failed to fetch task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (status === 'ACCEPTED') {
      setAcceptModal({
        isOpen: true,
        watchDirectory: '',
        autoUploadEnabled: false,
        autoUploadInterval: 'DAILY',
        autoUploadTime: '20:00',
        autoUploadDayOfWeek: 0,
        autoUploadEveryNDays: 1,
        fileFilterEnabled: false,
        fileFilterMode: 'INCLUDE',
        fileFilterRules: [],
      });
      return;
    }
    
    if (status === 'COMPLETED') {
      const confirmed = confirm(
        '完成任务前，请手动上传一次作品。\n\n' +
        '完成任务后，系统将不支持自动上传。\n\n' +
        '确定要完成任务吗？'
      );
      if (!confirmed) {
        return;
      }
      await (window as any).electron.cancelTask(id);
    }
    
    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      await axios.put(
        `${apiUrl}/tasks/${id}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchTask();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleSelectWatchDirectory = async () => {
    const dir = await (window as any).electron.selectDirectory();
    if (dir) {
      setAcceptModal(prev => ({ ...prev, watchDirectory: dir }));
    }
  };

  const handleSelectEditWatchDirectory = async () => {
    const dir = await (window as any).electron.selectDirectory();
    if (dir) {
      setEditAutoUploadModal(prev => ({ ...prev, watchDirectory: dir }));
    }
  };

  const handleAcceptTask = async () => {
    if (!acceptModal.watchDirectory) {
      alert('请选择监控目录');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      
      await axios.put(
        `${apiUrl}/tasks/${id}`,
        {
          watchDirectory: acceptModal.watchDirectory,
          autoUploadEnabled: acceptModal.autoUploadEnabled,
          autoUploadInterval: acceptModal.autoUploadEnabled ? acceptModal.autoUploadInterval : undefined,
          autoUploadTime: acceptModal.autoUploadEnabled ? acceptModal.autoUploadTime : undefined,
          autoUploadDayOfWeek: acceptModal.autoUploadEnabled && acceptModal.autoUploadInterval === 'WEEKLY' ? acceptModal.autoUploadDayOfWeek : undefined,
          autoUploadEveryNDays: acceptModal.autoUploadEnabled && acceptModal.autoUploadInterval === 'EVERY_N_DAYS' ? acceptModal.autoUploadEveryNDays : undefined,
          fileFilterEnabled: acceptModal.fileFilterEnabled,
          fileFilterMode: acceptModal.fileFilterEnabled ? acceptModal.fileFilterMode : undefined,
          fileFilterRules: acceptModal.fileFilterEnabled && acceptModal.fileFilterRules.length > 0 ? acceptModal.fileFilterRules : undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await axios.put(
        `${apiUrl}/tasks/${id}/status`,
        { status: 'ACCEPTED' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setAcceptModal({
        isOpen: false,
        watchDirectory: '',
        autoUploadEnabled: false,
        autoUploadInterval: 'DAILY',
        autoUploadTime: '20:00',
        autoUploadDayOfWeek: 0,
        autoUploadEveryNDays: 1,
        fileFilterEnabled: false,
        fileFilterMode: 'INCLUDE',
        fileFilterRules: [],
      });

      fetchTask();
      
      if (acceptModal.autoUploadEnabled) {
        await (window as any).electron.startScheduler(token);
      }
    } catch (error) {
      console.error('Failed to accept task:', error);
      alert('接受任务失败');
    }
  };

  const handleOpenEditAutoUpload = () => {
    if (task) {
      let filterRules: string[] = [];
      try {
        if (task.file_filter_rules) {
          filterRules = JSON.parse(task.file_filter_rules);
        }
      } catch {
        console.error('Invalid file_filter_rules JSON');
      }
      
      setEditAutoUploadModal({
        isOpen: true,
        watchDirectory: task.watch_directory || '',
        autoUploadEnabled: task.auto_upload_enabled,
        autoUploadInterval: task.auto_upload_interval || 'DAILY',
        autoUploadTime: task.auto_upload_time || '20:00',
        autoUploadDayOfWeek: task.auto_upload_day_of_week ?? 0,
        autoUploadEveryNDays: task.auto_upload_every_n_days ?? 1,
        fileFilterEnabled: task.file_filter_enabled || false,
        fileFilterMode: (task.file_filter_mode as 'INCLUDE' | 'EXCLUDE') || 'INCLUDE',
        fileFilterRules: filterRules,
      });
    }
  };

  const handleSaveAutoUpload = async () => {
    if (!editAutoUploadModal.watchDirectory) {
      alert('请选择监控目录');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      
      await axios.put(
        `${apiUrl}/tasks/${id}`,
        {
          watchDirectory: editAutoUploadModal.watchDirectory,
          autoUploadEnabled: editAutoUploadModal.autoUploadEnabled,
          autoUploadInterval: editAutoUploadModal.autoUploadEnabled ? editAutoUploadModal.autoUploadInterval : undefined,
          autoUploadTime: editAutoUploadModal.autoUploadEnabled ? editAutoUploadModal.autoUploadTime : undefined,
          autoUploadDayOfWeek: editAutoUploadModal.autoUploadEnabled && editAutoUploadModal.autoUploadInterval === 'WEEKLY' ? editAutoUploadModal.autoUploadDayOfWeek : undefined,
          autoUploadEveryNDays: editAutoUploadModal.autoUploadEnabled && editAutoUploadModal.autoUploadInterval === 'EVERY_N_DAYS' ? editAutoUploadModal.autoUploadEveryNDays : undefined,
          fileFilterEnabled: editAutoUploadModal.fileFilterEnabled,
          fileFilterMode: editAutoUploadModal.fileFilterEnabled ? editAutoUploadModal.fileFilterMode : undefined,
          fileFilterRules: editAutoUploadModal.fileFilterEnabled && editAutoUploadModal.fileFilterRules.length > 0 ? editAutoUploadModal.fileFilterRules : undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setEditAutoUploadModal({
        isOpen: false,
        watchDirectory: '',
        autoUploadEnabled: false,
        autoUploadInterval: 'DAILY',
        autoUploadTime: '20:00',
        autoUploadDayOfWeek: 0,
        autoUploadEveryNDays: 1,
        fileFilterEnabled: false,
        fileFilterMode: 'INCLUDE',
        fileFilterRules: [],
      });

      fetchTask();
      
      const taskData = {
        id: task?.id,
        name: task?.name,
        watch_directory: editAutoUploadModal.watchDirectory,
        auto_upload_enabled: editAutoUploadModal.autoUploadEnabled,
        auto_upload_interval: editAutoUploadModal.autoUploadInterval,
        auto_upload_time: editAutoUploadModal.autoUploadTime,
        auto_upload_day_of_week: editAutoUploadModal.autoUploadDayOfWeek,
        auto_upload_every_n_days: editAutoUploadModal.autoUploadEveryNDays,
        status: task?.status,
        file_filter_enabled: editAutoUploadModal.fileFilterEnabled,
        file_filter_mode: editAutoUploadModal.fileFilterMode,
        file_filter_rules: JSON.stringify(editAutoUploadModal.fileFilterRules),
      };
      
      if (editAutoUploadModal.autoUploadEnabled) {
        await (window as any).electron.scheduleTask(taskData, token);
      } else {
        await (window as any).electron.cancelTask(task?.id);
      }
    } catch (error) {
      console.error('Failed to save auto upload settings:', error);
      alert('保存失败');
    }
  };

  const handleSelectFiles = async () => {
    const files = await (window as any).electron.selectFiles();
    if (files && files.length > 0) {
      setSelectedFiles(files);
      setSelectionType('file');
      setUploadStatus('idle');
      setPreviewFiles([]);
      setPreviewTotalSize(0);
      setScanning(true);
      try {
        const result = await (window as any).electron.scanFiles(files);
        const filesWithSelection = result.files.map((file: ScannedFile) => ({
          ...file,
          selected: true
        }));
        setPreviewFiles(filesWithSelection);
        setPreviewTotalSize(result.totalSize);
      } catch (error) {
        console.error('Scan error:', error);
      } finally {
        setScanning(false);
      }
    }
  };

  const handleSelectDirectory = async () => {
    const dir = await (window as any).electron.selectDirectory();
    if (dir) {
      setSelectedFiles([dir]);
      setSelectionType('directory');
      setUploadStatus('idle');
      setPreviewFiles([]);
      setPreviewTotalSize(0);
      setScanning(true);
      try {
        const result = await (window as any).electron.scanFiles([dir]);
        const filesWithSelection = result.files.map((file: ScannedFile) => ({
          ...file,
          selected: true
        }));
        setPreviewFiles(filesWithSelection);
        setPreviewTotalSize(result.totalSize);
      } catch (error) {
        console.error('Scan error:', error);
      } finally {
        setScanning(false);
      }
    }
  };

  const handleToggleFileSelection = (index: number) => {
    setPreviewFiles(prev => {
      const newFiles = [...prev];
      newFiles[index] = { ...newFiles[index], selected: !newFiles[index].selected };
      
      // 计算新的总大小
      const newTotalSize = newFiles.reduce((sum, f) => {
        return f.selected ? sum + f.size : sum;
      }, 0);
      
      setPreviewTotalSize(newTotalSize);
      return newFiles;
    });
  };

  const handleSelectAllFiles = (checked: boolean) => {
    setPreviewFiles(prev => {
      const newFiles = prev.map(file => ({ ...file, selected: checked }));
      
      // 计算新的总大小
      const newTotalSize = checked 
        ? prev.reduce((sum, f) => sum + f.size, 0)
        : 0;
      
      setPreviewTotalSize(newTotalSize);
      return newFiles;
    });
  };

const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      alert('请选择要上传的文件');
      return;
    }

    const selectedPreviewFiles = previewFiles.filter(f => f.selected);
    if (selectedPreviewFiles.length === 0) {
      alert('请选择至少一个要上传的文件');
      return;
    }

    const token = localStorage.getItem('token');
    setUploading(true);
    setUploadStatus('uploading');
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 500);

    try {
      let result;
      
      // 判断是目录还是文件
      if (selectionType === 'directory') {
        // 目录上传
        result = await (window as any).electron.uploadDirectory(
          id, 
          selectedFiles[0], 
          token, 
          previewFiles.filter(f => f.selected)
        );
      } else {
        // 文件上传（单个或多个）
        result = await (window as any).electron.uploadFiles(
          id, 
          selectedFiles, 
          token, 
          previewFiles.filter(f => f.selected)
        );
      }

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.success) {
        setUploadStatus('success');
        setSelectedFiles(null);
        setPreviewFiles([]);
        setPreviewTotalSize(0);
        fetchTask();
      } else {
        setUploadStatus('error');
        alert('上传失败: ' + result.error);
      }
    } catch (error) {
      clearInterval(progressInterval);
      setUploadStatus('error');
      console.error('Upload error:', error);
      alert('上传失败');
    } finally {
      setUploading(false);
    }
  };

const handleRollback = async (versionNumber: number) => {
    if (!confirm(`确定要回滚到 V${versionNumber} 吗？`)) return;

    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      await axios.post(
        `${apiUrl}/tasks/${id}/versions/${versionNumber}/rollback`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCurrentVersion(versionNumber);
      
      const versionResponse = await axios.get(
        `${apiUrl}/tasks/${id}/versions/${versionNumber}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLatestVersionFiles(versionResponse.data.data?.files || []);
      
      alert('回滚成功');
    } catch (error) {
      alert('回滚失败');
    }
  };

  const handleDownload = async (versionNumber: number) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      const response = await axios.get(
        `${apiUrl}/tasks/${id}/versions/${versionNumber}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `task-${id?.substring(0, 8)}-v${versionNumber}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('下载失败');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`确定要删除任务"${task?.name}"吗？\n\n注意：删除后子任务也会被删除。`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      await axios.delete(`${apiUrl}/tasks/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate('/tasks');
    } catch (error: any) {
      alert(error.response?.data?.error || '删除失败');
    }
  };

  const handleOpenShareModal = (versionNumber: number) => {
    setShareModal({
      isOpen: true,
      versionNumber,
      shareId: null,
      password: '',
      expiresAt: '',
      maxDownloads: '',
      shareLink: null,
    });
  };

  const handleCreateShare = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = await getApiUrl();
      const response = await axios.post(
        `${apiUrl}/share/create`,
        {
          taskId: id,
          versionNumber: shareModal.versionNumber,
          password: shareModal.password || undefined,
          expiresAt: shareModal.expiresAt || undefined,
          maxDownloads: shareModal.maxDownloads ? parseInt(shareModal.maxDownloads) : undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const shareId = response.data.data.id;
      const baseUrl = await getBaseUrl();
      const shareLink = `${baseUrl}/api/share/${shareId}/page`;
      
      setShareModal(prev => ({
        ...prev,
        shareId,
        shareLink,
      }));
    } catch (error) {
      console.error('Create share error:', error);
      alert('创建分享失败');
    }
  };

  const handleCopyShareLink = async () => {
    if (shareModal.shareLink) {
      await (window as any).electron.writeClipboard(shareModal.shareLink);
      alert('链接已复制到剪贴板');
    }
  };

  const handleCloseShareModal = () => {
    setShareModal({
      isOpen: false,
      versionNumber: 0,
      shareId: null,
      password: '',
      expiresAt: '',
      maxDownloads: '',
      shareLink: null,
    });
  };

  if (loading) {
    return <div className="p-8">加载中...</div>;
  }

  if (!task) {
    return <div className="p-8">任务不存在</div>;
  }

  const isAssignee = task.assignee?.id === user?.id;
  const canOperate = isAssignee && task.status !== 'COMPLETED' && task.status !== 'CANCELLED';
  const canDelete = user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER';

  return (
    <div className="p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{task.name}</h1>
          <p className="text-gray-500 mt-1">
            创建者: {task.creator?.name || '未知'} | 创建时间: {new Date(task.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          {canOperate && task.status === 'NEW' && (
            <button onClick={() => handleStatusChange('ACCEPTED')} className="btn btn-primary">
              接受任务
            </button>
          )}
          {canOperate && task.status === 'ACCEPTED' && (
            <button onClick={() => handleStatusChange('IN_PROGRESS')} className="btn btn-primary">
              开始工作
            </button>
          )}
          {canOperate && task.status === 'IN_PROGRESS' && (
            <button onClick={() => handleStatusChange('COMPLETED')} className="btn btn-primary">
              完成任务
            </button>
          )}
          {canDelete && (
            <button onClick={handleDelete} className="btn btn-secondary text-red-600">
              删除任务
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">任务详情</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500">描述</label>
                <p>{task.description || '无'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">具体需求</label>
                <p className="whitespace-pre-wrap">{task.requirements || '无'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">状态</label>
                  <p>{task.status}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">优先级</label>
                  <p>{task.priority}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">负责人</label>
                  <p>{task.assignee?.name || '未分配'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">项目</label>
                  <p>{task.project?.name || '无'}</p>
                </div>
              </div>
            </div>
          </div>

          {task.status === 'NEW' && isAssignee && (
            <div className="card bg-yellow-50 border border-yellow-200">
              <div className="flex items-center gap-3">
                <div className="text-yellow-600 text-2xl">⚠️</div>
                <div>
                  <h3 className="font-semibold text-yellow-800">任务待接受</h3>
                  <p className="text-yellow-700 text-sm">
                    您需要先接受此任务，才能设置采集目录和上传作品。
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleStatusChange('ACCEPTED')}
                className="btn btn-primary mt-4"
              >
                接受任务
              </button>
            </div>
          )}

          {task.status !== 'NEW' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">上传作品</h2>
              
              <div className="mb-4 flex gap-2">
                <button onClick={handleSelectDirectory} className="btn btn-secondary">
                  选择目录
                </button>
                <button onClick={handleSelectFiles} className="btn btn-secondary">
                  选择文件
                </button>
              </div>

              {selectedFiles && selectedFiles.length > 0 && (
                <div className="mb-4">
                  <span className="text-sm text-gray-500">已选择 {selectedFiles.length} 个文件：</span>
                  <div className="mt-1 px-3 py-2 bg-gray-100 rounded-md truncate">
                    {selectedFiles.join(', ')}
                  </div>
                </div>
              )}

              {scanning && (
                <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-md">
                  正在扫描文件...
                </div>
              )}

              {previewFiles.length > 0 && !scanning && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={previewFiles.length > 0 && previewFiles.every(f => f.selected)}
                        onChange={(e) => handleSelectAllFiles(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-500">
                        选中 {previewFiles.filter(f => f.selected).length} / {previewFiles.length} 个文件
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      总大小: {(previewTotalSize / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  <ul className="max-h-48 overflow-auto border rounded p-2 bg-gray-50">
                    {previewFiles.slice(0, 100).map((f, i) => (
                      <li key={i} className="py-1 flex items-center">
                        <input
                          type="checkbox"
                          checked={f.selected}
                          onChange={() => handleToggleFileSelection(i)}
                          className="mr-2"
                        />
                        <div className="flex justify-between flex-1">
                          <span className="text-sm truncate flex-1">{f.path}</span>
                          <span className="text-sm text-gray-400 ml-2">
                            {(f.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                      </li>
                    ))}
                    {previewFiles.length > 100 && (
                      <li className="text-sm text-gray-500 py-1 text-center">
                        ... 还有 {previewFiles.length - 100} 个文件
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {uploadStatus === 'uploading' && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>上传中...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadStatus === 'success' && (
                <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">
                  上传成功！
                </div>
              )}

              {uploadStatus === 'error' && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
                  上传失败，请重试
                </div>
              )}

              {previewFiles.length > 0 && !uploading && (
                <button onClick={handleUpload} className="btn btn-primary">
                  开始上传
                </button>
              )}
            </div>
          )}

          {latestVersionFiles.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">
                当前文件列表 (V{currentVersion})
              </h2>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">文件路径</th>
                    <th className="text-left py-2">大小</th>
                    <th className="text-left py-2">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {latestVersionFiles.map((file) => (
                    <tr key={file.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 text-sm truncate max-w-md" title={file.relative_path}>
                        {file.relative_path}
                      </td>
                      <td className="py-2 text-sm">
                        {(Number(file.file_size) / 1024).toFixed(1)} KB
                      </td>
                      <td className="py-2">
                        {file.is_new && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">新增</span>
                        )}
                        {file.is_changed && !file.is_new && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">已修改</span>
                        )}
                        {!file.is_new && !file.is_changed && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">未变</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">版本历史</h2>
            {task.versions && task.versions.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">版本</th>
                    <th className="text-left py-2">上传时间</th>
                    <th className="text-left py-2">上传者</th>
                    <th className="text-left py-2">文件数</th>
                    <th className="text-left py-2">大小</th>
                    <th className="text-left py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {task.versions.map((version) => (
                    <tr key={version.id} className="border-b">
                      <td className="py-2">
                        <span className="font-medium">V{version.version_number}</span>
                        {version.version_number === currentVersion && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                            当前
                          </span>
                        )}
                        {version.upload_type === 'AUTO_SCHEDULED' ? (
                          <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                            🤖 自动上传
                          </span>
                        ) : (
                          <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                            手动上传
                          </span>
                        )}
                      </td>
                      <td className="py-2">{new Date(version.created_at).toLocaleString()}</td>
                      <td className="py-2">{version.created_by?.name || '未知'}</td>
                      <td className="py-2">{version.file_count}</td>
                      <td className="py-2">{(Number(version.total_size) / 1024 / 1024).toFixed(2)} MB</td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDownload(version.version_number)}
                            className="text-green-600 hover:underline text-sm"
                          >
                            下载
                          </button>
                          <button
                            onClick={() => handleOpenShareModal(version.version_number)}
                            className="text-purple-600 hover:underline text-sm"
                          >
                            分享
                          </button>
                          {version.version_number !== currentVersion && (
                            <button
                              onClick={() => handleRollback(version.version_number)}
                              className="text-blue-600 hover:underline text-sm"
                            >
                              回滚
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500">暂无版本</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">监控目录与自动上传</h2>
              {task.status !== 'NEW' && task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
                <button
                  onClick={handleOpenEditAutoUpload}
                  className="text-blue-600 hover:underline text-sm"
                >
                  编辑
                </button>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">监控目录</span>
                <span className={task.watch_directory ? 'text-gray-900' : 'text-gray-400'}>
                  {task.watch_directory || '未设置'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">启用自动上传</span>
                <span className={task.auto_upload_enabled ? 'text-green-600' : 'text-gray-400'}>
                  {task.auto_upload_enabled ? '是' : '否'}
                </span>
              </div>
              {task.auto_upload_enabled && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">上传频率</span>
                    <span>
                      {task.auto_upload_interval === 'DAILY' ? '每天' : 
                       task.auto_upload_interval === 'WEEKLY' ? `每周${['日', '一', '二', '三', '四', '五', '六'][task.auto_upload_day_of_week ?? 0]}` :
                       `每隔${task.auto_upload_every_n_days ?? 1}天`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">上传时间</span>
                    <span>{task.auto_upload_time}</span>
                  </div>
                  {task.next_upload_time && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">下次上传</span>
                      <span className="text-sm">
                        {new Date(task.next_upload_time).toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-500">文件过滤</span>
                <span className={task.file_filter_enabled ? 'text-green-600' : 'text-gray-400'}>
                  {task.file_filter_enabled ? '已启用' : '未启用'}
                </span>
              </div>
              {task.file_filter_enabled && task.file_filter_rules && (() => {
                  try {
                    const rules = JSON.parse(task.file_filter_rules);
                    if (!Array.isArray(rules) || rules.length === 0) return null;
                    return (
                      <div className="flex items-start justify-between">
                        <span className="text-gray-500">过滤规则</span>
                        <div className="text-right">
                          <span className="text-sm text-gray-600">
                            {task.file_filter_mode === 'INCLUDE' ? '只上传' : '排除'}
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1 justify-end">
                            {rules.map((rule: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                                {rule}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })()}
            </div>
            
            <div className="border-t pt-3 mt-3">
              <span className="text-gray-500 text-sm">最近上传</span>
              {!task.last_upload_status ? (
                <div className="mt-2 p-3 bg-gray-50 rounded text-gray-400 text-sm">
                  暂无上传记录
                </div>
              ) : task.last_upload_status === 'SUCCESS' ? (
                <div className="mt-2 p-3 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    <span className="font-medium">V{task.last_upload_version}</span>
                    <span className="text-gray-500 text-sm">
                      {task.last_upload_time && new Date(task.last_upload_time).toLocaleString()}
                    </span>
                    {task.last_upload_type === 'AUTO_SCHEDULED' && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                        自动上传
                      </span>
                    )}
                    {task.last_upload_type === 'MANUAL' && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        手动上传
                      </span>
                    )}
                  </div>
                  {task.versions && task.versions[0] && (
                    <div className="text-gray-500 text-sm mt-1">
                      {task.versions[0].file_count} 个文件 · 
                      {(Number(task.versions[0].total_size) / 1024 / 1024).toFixed(2)} MB
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2 p-3 bg-red-50 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-red-500">✗</span>
                    <span className="font-medium text-red-700">上传失败</span>
                    <span className="text-gray-500 text-sm">
                      {task.last_upload_time && new Date(task.last_upload_time).toLocaleString()}
                    </span>
                    {task.last_upload_type === 'AUTO_SCHEDULED' && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                        自动上传
                      </span>
                    )}
                  </div>
                  {task.last_upload_error && (
                    <div className="text-red-600 text-sm mt-1">
                      {task.last_upload_error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {task.sub_tasks && task.sub_tasks.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">子任务</h2>
              <ul className="space-y-2">
                {task.sub_tasks.map((sub) => (
                  <li key={sub.id} className="flex items-center justify-between">
                    <span>{sub.name}</span>
                    <span className={`badge badge-${sub.status.toLowerCase()}`}>
                      {sub.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {shareModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              分享 V{shareModal.versionNumber}
            </h3>

            {!shareModal.shareId ? (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">密码（可选）</label>
                    <input
                      type="text"
                      value={shareModal.password}
                      onChange={(e) => setShareModal(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full border rounded px-3 py-2"
                      placeholder="留空则无需密码"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">过期时间（可选）</label>
                    <input
                      type="datetime-local"
                      value={shareModal.expiresAt}
                      onChange={(e) => setShareModal(prev => ({ ...prev, expiresAt: e.target.value }))}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">最大下载次数（可选）</label>
                    <input
                      type="number"
                      value={shareModal.maxDownloads}
                      onChange={(e) => setShareModal(prev => ({ ...prev, maxDownloads: e.target.value }))}
                      className="w-full border rounded px-3 py-2"
                      placeholder="留空则无限制"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={handleCloseShareModal}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleCreateShare}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    创建分享
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">分享链接</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={shareModal.shareLink || ''}
                        readOnly
                        className="flex-1 border rounded px-3 py-2 bg-gray-50"
                      />
                      <button
                        onClick={handleCopyShareLink}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        复制
                      </button>
                    </div>
                  </div>
                  {shareModal.password && (
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">访问密码</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={shareModal.password}
                          readOnly
                          className="flex-1 border rounded px-3 py-2 bg-gray-50"
                        />
                        <button
                          onClick={async () => await (window as any).electron.writeClipboard(shareModal.password)}
                          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                        >
                          复制
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-end mt-6">
                  <button
                    onClick={handleCloseShareModal}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    关闭
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {acceptModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">接受任务</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">监控目录 *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={acceptModal.watchDirectory}
                    readOnly
                    className="flex-1 border rounded px-3 py-2 bg-gray-50"
                    placeholder="请选择目录"
                  />
                  <button
                    onClick={handleSelectWatchDirectory}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    选择
                  </button>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    id="acceptAutoUpload"
                    checked={acceptModal.autoUploadEnabled}
                    onChange={(e) => setAcceptModal(prev => ({ ...prev, autoUploadEnabled: e.target.checked }))}
                    className="mr-2"
                  />
                  <label htmlFor="acceptAutoUpload" className="text-sm">启用自动上传</label>
                </div>
                
                {acceptModal.autoUploadEnabled && (
                  <div className="pl-6 space-y-3">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">上传频率</label>
                      <select
                        value={acceptModal.autoUploadInterval}
                        onChange={(e) => setAcceptModal(prev => ({ ...prev, autoUploadInterval: e.target.value }))}
                        className="w-full border rounded px-3 py-2"
                      >
                        <option value="DAILY">每天</option>
                        <option value="WEEKLY">每周</option>
                        <option value="EVERY_N_DAYS">每隔N天</option>
                      </select>
                    </div>
                    {acceptModal.autoUploadInterval === 'WEEKLY' && (
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">每周几</label>
                        <select
                          value={acceptModal.autoUploadDayOfWeek}
                          onChange={(e) => setAcceptModal(prev => ({ ...prev, autoUploadDayOfWeek: parseInt(e.target.value) }))}
                          className="w-full border rounded px-3 py-2"
                        >
                          <option value={0}>周日</option>
                          <option value={1}>周一</option>
                          <option value={2}>周二</option>
                          <option value={3}>周三</option>
                          <option value={4}>周四</option>
                          <option value={5}>周五</option>
                          <option value={6}>周六</option>
                        </select>
                      </div>
                    )}
                    {acceptModal.autoUploadInterval === 'EVERY_N_DAYS' && (
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">每隔几天</label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={acceptModal.autoUploadEveryNDays}
                          onChange={(e) => setAcceptModal(prev => ({ ...prev, autoUploadEveryNDays: parseInt(e.target.value) || 1 }))}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">上传时间</label>
                      <input
                        type="time"
                        value={acceptModal.autoUploadTime}
                        onChange={(e) => setAcceptModal(prev => ({ ...prev, autoUploadTime: e.target.value }))}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="border-t pt-4">
                <div className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    id="acceptFileFilter"
                    checked={acceptModal.fileFilterEnabled}
                    onChange={(e) => setAcceptModal(prev => ({ ...prev, fileFilterEnabled: e.target.checked }))}
                    className="mr-2"
                  />
                  <label htmlFor="acceptFileFilter" className="text-sm">启用文件过滤</label>
                </div>
                
                {acceptModal.fileFilterEnabled && (
                  <div className="pl-6 space-y-3">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">过滤模式</label>
                      <select
                        value={acceptModal.fileFilterMode}
                        onChange={(e) => setAcceptModal(prev => ({ ...prev, fileFilterMode: e.target.value as 'INCLUDE' | 'EXCLUDE' }))}
                        className="w-full border rounded px-3 py-2"
                      >
                        <option value="INCLUDE">只上传匹配的文件</option>
                        <option value="EXCLUDE">排除匹配的文件</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">过滤规则</label>
                      <div className="space-y-2">
                        {acceptModal.fileFilterRules.map((rule, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={rule}
                              onChange={(e) => {
                                const newRules = [...acceptModal.fileFilterRules];
                                newRules[index] = e.target.value;
                                setAcceptModal(prev => ({ ...prev, fileFilterRules: newRules }));
                              }}
                              className="flex-1 border rounded px-3 py-2"
                              placeholder="输入关键词"
                            />
                            <button
                              onClick={() => {
                                const newRules = acceptModal.fileFilterRules.filter((_, i) => i !== index);
                                setAcceptModal(prev => ({ ...prev, fileFilterRules: newRules }));
                              }}
                              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded"
                            >
                              删除
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setAcceptModal(prev => ({ ...prev, fileFilterRules: [...prev.fileFilterRules, ''] }))}
                          className="text-blue-600 text-sm hover:underline"
                        >
                          + 添加规则
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        文件名包含指定关键词的文件将被{acceptModal.fileFilterMode === 'INCLUDE' ? '上传' : '排除'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setAcceptModal({
                  isOpen: false,
                  watchDirectory: '',
                  autoUploadEnabled: false,
                  autoUploadInterval: 'DAILY',
                  autoUploadTime: '20:00',
                  autoUploadDayOfWeek: 0,
                  autoUploadEveryNDays: 1,
                  fileFilterEnabled: false,
                  fileFilterMode: 'INCLUDE',
                  fileFilterRules: [],
                })}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleAcceptTask}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                确认接受
              </button>
            </div>
          </div>
        </div>
      )}

      {editAutoUploadModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">编辑监控目录与自动上传</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">监控目录 *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editAutoUploadModal.watchDirectory}
                    readOnly
                    className="flex-1 border rounded px-3 py-2 bg-gray-50"
                    placeholder="请选择目录"
                  />
                  <button
                    onClick={handleSelectEditWatchDirectory}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    选择
                  </button>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    id="editAutoUpload"
                    checked={editAutoUploadModal.autoUploadEnabled}
                    onChange={(e) => setEditAutoUploadModal(prev => ({ ...prev, autoUploadEnabled: e.target.checked }))}
                    className="mr-2"
                  />
                  <label htmlFor="editAutoUpload" className="text-sm">启用自动上传</label>
                </div>
                
                {editAutoUploadModal.autoUploadEnabled && (
                  <div className="pl-6 space-y-3">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">上传频率</label>
                      <select
                        value={editAutoUploadModal.autoUploadInterval}
                        onChange={(e) => setEditAutoUploadModal(prev => ({ ...prev, autoUploadInterval: e.target.value }))}
                        className="w-full border rounded px-3 py-2"
                      >
                        <option value="DAILY">每天</option>
                        <option value="WEEKLY">每周</option>
                        <option value="EVERY_N_DAYS">每隔N天</option>
                      </select>
                    </div>
                    {editAutoUploadModal.autoUploadInterval === 'WEEKLY' && (
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">每周几</label>
                        <select
                          value={editAutoUploadModal.autoUploadDayOfWeek}
                          onChange={(e) => setEditAutoUploadModal(prev => ({ ...prev, autoUploadDayOfWeek: parseInt(e.target.value) }))}
                          className="w-full border rounded px-3 py-2"
                        >
                          <option value={0}>周日</option>
                          <option value={1}>周一</option>
                          <option value={2}>周二</option>
                          <option value={3}>周三</option>
                          <option value={4}>周四</option>
                          <option value={5}>周五</option>
                          <option value={6}>周六</option>
                        </select>
                      </div>
                    )}
                    {editAutoUploadModal.autoUploadInterval === 'EVERY_N_DAYS' && (
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">每隔几天</label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={editAutoUploadModal.autoUploadEveryNDays}
                          onChange={(e) => setEditAutoUploadModal(prev => ({ ...prev, autoUploadEveryNDays: parseInt(e.target.value) || 1 }))}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">上传时间</label>
                      <input
                        type="time"
                        value={editAutoUploadModal.autoUploadTime}
                        onChange={(e) => setEditAutoUploadModal(prev => ({ ...prev, autoUploadTime: e.target.value }))}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="border-t pt-4">
                <div className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    id="editFileFilter"
                    checked={editAutoUploadModal.fileFilterEnabled}
                    onChange={(e) => setEditAutoUploadModal(prev => ({ ...prev, fileFilterEnabled: e.target.checked }))}
                    className="mr-2"
                  />
                  <label htmlFor="editFileFilter" className="text-sm">启用文件过滤</label>
                </div>
                
                {editAutoUploadModal.fileFilterEnabled && (
                  <div className="pl-6 space-y-3">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">过滤模式</label>
                      <select
                        value={editAutoUploadModal.fileFilterMode}
                        onChange={(e) => setEditAutoUploadModal(prev => ({ ...prev, fileFilterMode: e.target.value as 'INCLUDE' | 'EXCLUDE' }))}
                        className="w-full border rounded px-3 py-2"
                      >
                        <option value="INCLUDE">只上传匹配的文件</option>
                        <option value="EXCLUDE">排除匹配的文件</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">过滤规则</label>
                      <div className="space-y-2">
                        {editAutoUploadModal.fileFilterRules.map((rule, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={rule}
                              onChange={(e) => {
                                const newRules = [...editAutoUploadModal.fileFilterRules];
                                newRules[index] = e.target.value;
                                setEditAutoUploadModal(prev => ({ ...prev, fileFilterRules: newRules }));
                              }}
                              className="flex-1 border rounded px-3 py-2"
                              placeholder="输入关键词"
                            />
                            <button
                              onClick={() => {
                                const newRules = editAutoUploadModal.fileFilterRules.filter((_, i) => i !== index);
                                setEditAutoUploadModal(prev => ({ ...prev, fileFilterRules: newRules }));
                              }}
                              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded"
                            >
                              删除
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setEditAutoUploadModal(prev => ({ ...prev, fileFilterRules: [...prev.fileFilterRules, ''] }))}
                          className="text-blue-600 text-sm hover:underline"
                        >
                          + 添加规则
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        文件名包含指定关键词的文件将被{editAutoUploadModal.fileFilterMode === 'INCLUDE' ? '上传' : '排除'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditAutoUploadModal({
                  isOpen: false,
                  watchDirectory: '',
                  autoUploadEnabled: false,
                  autoUploadInterval: 'DAILY',
                  autoUploadTime: '20:00',
                  autoUploadDayOfWeek: 0,
                  autoUploadEveryNDays: 1,
                  fileFilterEnabled: false,
                  fileFilterMode: 'INCLUDE',
                  fileFilterRules: [],
                })}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveAutoUpload}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}