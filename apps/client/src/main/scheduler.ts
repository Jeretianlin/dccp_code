import cron from 'node-cron';
import { BrowserWindow, Notification } from 'electron';
import { uploadDirectory } from './uploader';
import { getApiUrl } from './config';

interface Task {
  id: string;
  name: string;
  watch_directory: string | null;
  auto_upload_enabled: boolean;
  auto_upload_interval: string | null;
  auto_upload_time: string | null;
  auto_upload_day_of_week: number | null;
  auto_upload_every_n_days: number | null;
  next_upload_time: string | null;
  status: string;
  file_filter_enabled: boolean;
  file_filter_mode: string | null;
  file_filter_rules: string | null;
}

const scheduledTasks = new Map<string, cron.ScheduledTask>();
let everyNDaysChecker: cron.ScheduledTask | null = null;

export async function startScheduler(token: string): Promise<void> {
  console.log('Starting auto-upload scheduler...');
  
  try {
    const response = await fetch(`${getApiUrl()}/tasks?pageSize=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    
    if (data.success && data.tasks) {
      const tasks = data.tasks.filter((t: Task) => 
        t.auto_upload_enabled && 
        t.watch_directory && 
        ['NEW', 'ACCEPTED', 'IN_PROGRESS'].includes(t.status)
      );
      
      for (const task of tasks) {
        scheduleTask(task, token);
      }
      
      console.log(`Scheduled ${tasks.length} auto-upload tasks`);
    }
    
    startEveryNDaysChecker(token);
  } catch (error) {
    console.error('Failed to start scheduler:', error);
  }
}

export function stopScheduler(): void {
  for (const [taskId, task] of scheduledTasks) {
    task.stop();
    console.log(`Stopped scheduler for task ${taskId}`);
  }
  scheduledTasks.clear();
  
  if (everyNDaysChecker) {
    everyNDaysChecker.stop();
    everyNDaysChecker = null;
  }
}

export function scheduleTask(task: Task, token: string): void {
  cancelTask(task.id);
  
  if (!task.auto_upload_enabled || !task.watch_directory || !task.auto_upload_time) {
    return;
  }
  
  if (task.auto_upload_interval === 'EVERY_N_DAYS') {
    console.log(`Task ${task.id} uses EVERY_N_DAYS interval, will be checked by checker`);
    return;
  }
  
  const [hour, minute] = task.auto_upload_time.split(':').map(Number);
  
  let cronExpression: string;
  if (task.auto_upload_interval === 'WEEKLY') {
    const dayOfWeek = task.auto_upload_day_of_week ?? 0;
    cronExpression = `${minute} ${hour} * * ${dayOfWeek}`;
  } else {
    cronExpression = `${minute} ${hour} * * *`;
  }
  
  const scheduledTask = cron.schedule(cronExpression, async () => {
    await executeUpload(task, token);
  });
  
  scheduledTasks.set(task.id, scheduledTask);
  console.log(`Scheduled auto-upload for task ${task.id} (${task.name}): ${cronExpression}`);
}

function startEveryNDaysChecker(token: string): void {
  if (everyNDaysChecker) {
    everyNDaysChecker.stop();
  }
  
  everyNDaysChecker = cron.schedule('* * * * *', async () => {
    await checkEveryNDaysTasks(token);
  });
  
  console.log('Started EVERY_N_DAYS checker (runs every minute)');
}

async function checkEveryNDaysTasks(token: string): Promise<void> {
  try {
    const response = await fetch(`${getApiUrl()}/tasks?pageSize=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    
    if (!data.success || !data.tasks) return;
    
    const now = new Date();
    
    const everyNDaysTasks = data.tasks.filter((t: Task) => 
      t.auto_upload_enabled && 
      t.auto_upload_interval === 'EVERY_N_DAYS' &&
      t.watch_directory &&
      t.next_upload_time &&
      new Date(t.next_upload_time) <= now &&
      ['NEW', 'ACCEPTED', 'IN_PROGRESS'].includes(t.status)
    );
    
    for (const task of everyNDaysTasks) {
      console.log(`EVERY_N_DAYS task ${task.id} is due for upload`);
      await executeUpload(task, token);
    }
  } catch (error) {
    console.error('Failed to check EVERY_N_DAYS tasks:', error);
  }
}

export function cancelTask(taskId: string): void {
  const task = scheduledTasks.get(taskId);
  if (task) {
    task.stop();
    scheduledTasks.delete(taskId);
    console.log(`Cancelled auto-upload for task ${taskId}`);
  }
}

async function executeUpload(task: Task, token: string): Promise<void> {
  try {
    const response = await fetch(`${getApiUrl()}/tasks/${task.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    const currentTask = data.data;
    
    if (currentTask.status !== 'IN_PROGRESS') {
      console.log(`Task ${task.id} status is ${currentTask.status}, skipping auto-upload`);
      cancelTask(task.id);
      return;
    }
  } catch (error) {
    console.error('Failed to check task status:', error);
    return;
  }
  
  if (!task.watch_directory) {
    console.log(`No watch directory for task ${task.id}`);
    return;
  }
  
  console.log(`Executing auto-upload for task ${task.id} (${task.name})`);
  
  let filterRules: string[] = [];
  try {
    if (task.file_filter_rules) {
      filterRules = JSON.parse(task.file_filter_rules);
    }
  } catch (error) {
    console.error('Invalid file_filter_rules JSON:', error);
  }
  
  const filterConfig = task.file_filter_enabled ? {
    enabled: true,
    mode: (task.file_filter_mode || 'INCLUDE') as 'INCLUDE' | 'EXCLUDE',
    rules: filterRules,
  } : undefined;
  
  try {
    const result = await uploadDirectory(task.id, task.watch_directory, token, undefined, 'AUTO_SCHEDULED', filterConfig);
    
    if (result.success) {
      showNotification(true, task.name, `版本 V${result.data?.version?.version_number} 已创建`);
      
      await fetch(`${getApiUrl()}/tasks/${task.id}/upload-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: 'SUCCESS',
          versionNumber: result.data?.version?.version_number,
          uploadType: 'AUTO_SCHEDULED',
        }),
      });
      
      if (task.auto_upload_interval === 'EVERY_N_DAYS' && task.auto_upload_every_n_days) {
        const nextTime = new Date();
        nextTime.setDate(nextTime.getDate() + task.auto_upload_every_n_days);
        const [hour, minute] = (task.auto_upload_time || '20:00').split(':').map(Number);
        nextTime.setHours(hour, minute, 0, 0);
        
        await fetch(`${getApiUrl()}/tasks/${task.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            nextUploadTime: nextTime.toISOString(),
          }),
        });
        
        console.log(`Updated next_upload_time for task ${task.id} to ${nextTime.toISOString()}`);
      }
      
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((win) => {
        win.webContents.send('auto-upload-completed', {
          taskId: task.id,
          success: true,
          version: result.data?.version,
        });
      });
    } else {
      showNotification(false, task.name, result.error || '上传失败');
      
      await fetch(`${getApiUrl()}/tasks/${task.id}/upload-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: 'FAILED',
          errorMessage: result.error || '上传失败',
          uploadType: 'AUTO_SCHEDULED',
        }),
      });
    }
  } catch (error: any) {
    console.error(`Auto-upload failed for task ${task.id}:`, error);
    showNotification(false, task.name, error.message || '上传失败');
    
    await fetch(`${getApiUrl()}/tasks/${task.id}/upload-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status: 'FAILED',
        errorMessage: error.message || '上传失败',
        uploadType: 'AUTO_SCHEDULED',
      }),
    });
  }
}

function showNotification(success: boolean, taskName: string, message: string): void {
  new Notification({
    title: success ? '自动上传成功' : '自动上传失败',
    body: `任务"${taskName}": ${message}`,
  }).show();
}

export function getScheduledTaskIds(): string[] {
  return Array.from(scheduledTasks.keys());
}