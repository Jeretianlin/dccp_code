import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { requireTaskPermission } from '../middleware/permission';
import * as taskService from '../services/task.service';
import * as auditService from '../services/audit.service';

const router = Router();

function serializeTask(task: any) {
  if (!task) return task;
  return {
    ...task,
    versions: task.versions?.map((v: any) => ({
      ...v,
      total_size: v.total_size?.toString() || '0',
      delta_size: v.delta_size?.toString() || '0',
      files: v.files?.map((f: any) => ({
        ...f,
        file_size: f.file_size?.toString() || '0',
      })),
    })),
  };
}

function serializeTasks(tasks: any[]) {
  return tasks.map(serializeTask);
}

const createTaskSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  requirements: z.string().optional(),
  projectId: z.string().optional(),
  parentTaskId: z.string().optional(),
  assigneeId: z.string().min(1, '必须指定负责人'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  expectedCompletion: z.string().optional(),
  autoUploadEnabled: z.boolean().optional(),
  autoUploadInterval: z.enum(['DAILY', 'WEEKLY', 'EVERY_N_DAYS']).optional(),
  autoUploadTime: z.string().optional(),
  autoUploadDayOfWeek: z.number().min(0).max(6).optional(),
  autoUploadEveryNDays: z.number().min(1).max(30).optional(),
  fileFilterEnabled: z.boolean().optional(),
  fileFilterMode: z.enum(['INCLUDE', 'EXCLUDE']).optional(),
  fileFilterRules: z.array(z.string()).optional(),
});

const updateTaskSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  expectedCompletion: z.string().optional(),
  watchDirectory: z.string().optional(),
  autoUploadEnabled: z.boolean().optional(),
  autoUploadInterval: z.enum(['DAILY', 'WEEKLY', 'EVERY_N_DAYS']).optional(),
  autoUploadTime: z.string().optional(),
  autoUploadDayOfWeek: z.number().min(0).max(6).optional(),
  autoUploadEveryNDays: z.number().min(1).max(30).optional(),
  fileFilterEnabled: z.boolean().optional(),
  fileFilterMode: z.enum(['INCLUDE', 'EXCLUDE']).optional(),
  fileFilterRules: z.array(z.string()).optional(),
});

const statusSchema = z.object({
  status: z.enum(['NEW', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED']),
});

router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await taskService.getTasks({
      assigneeId: req.query.assigneeId as string,
      projectId: req.query.projectId as string,
      status: req.query.status as any,
      priority: req.query.priority as any,
      search: req.query.search as string,
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
    }, req.userId!, req.userRole!);
    res.json({ success: true, ...result, tasks: serializeTasks(result.tasks) });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:id', authMiddleware, requireTaskPermission('view'), async (req: AuthRequest, res) => {
  try {
    const task = await taskService.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, data: serializeTask(task) });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post(
  '/',
  authMiddleware,
  requireRole('ADMIN', 'PROJECT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const data = createTaskSchema.parse(req.body);
      const task = await taskService.createTask({
        ...data,
        creatorId: req.userId!,
        expectedCompletion: data.expectedCompletion
          ? new Date(data.expectedCompletion)
          : undefined,
      });
      
      await auditService.createAuditLog({
        category: 'TASK',
        action: 'CREATE',
        operatorId: req.userId,
        operatorName: req.userName,
        targetType: 'Task',
        targetId: task.id,
        targetName: task.name,
        description: `创建了任务 ${task.name}，分配给 ${task.assignee?.name || '未知'}`,
        ipAddress: req.ip,
      });
      
      res.json({ success: true, data: task });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }
);

router.put('/:id', authMiddleware, requireTaskPermission('edit'), async (req: AuthRequest, res) => {
  try {
    const data = updateTaskSchema.parse(req.body);
    const task = await taskService.updateTask(req.params.id, {
      ...data,
      expectedCompletion: data.expectedCompletion
        ? new Date(data.expectedCompletion)
        : undefined,
    });
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});

router.put('/:id/status', authMiddleware, requireTaskPermission('update_status'), async (req: AuthRequest, res) => {
  try {
    const { status } = statusSchema.parse(req.body);
    const oldTask = await taskService.getTaskById(req.params.id);
    const task = await taskService.updateTaskStatus(req.params.id, status);
    
    await auditService.createAuditLog({
      category: 'TASK',
      action: 'STATUS_CHANGE',
      operatorId: req.userId,
      operatorName: req.userName,
      targetType: 'Task',
      targetId: task.id,
      targetName: task.name,
      oldValue: oldTask?.status,
      newValue: status,
      description: `状态从 ${oldTask?.status} 变为 ${status}`,
      ipAddress: req.ip,
    });
    
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});

router.post('/:id/accept', authMiddleware, requireTaskPermission('update_status'), async (req: AuthRequest, res) => {
  try {
    const oldTask = await taskService.getTaskById(req.params.id);
    const task = await taskService.updateTaskStatus(req.params.id, 'ACCEPTED');
    
    await auditService.createAuditLog({
      category: 'TASK',
      action: 'STATUS_CHANGE',
      operatorId: req.userId,
      operatorName: req.userName,
      targetType: 'Task',
      targetId: task.id,
      targetName: task.name,
      oldValue: oldTask?.status,
      newValue: 'ACCEPTED',
      description: `接受了任务`,
      ipAddress: req.ip,
    });
    
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});

router.post('/:id/start', authMiddleware, requireTaskPermission('update_status'), async (req: AuthRequest, res) => {
  try {
    const oldTask = await taskService.getTaskById(req.params.id);
    const task = await taskService.updateTaskStatus(req.params.id, 'IN_PROGRESS');
    
    await auditService.createAuditLog({
      category: 'TASK',
      action: 'STATUS_CHANGE',
      operatorId: req.userId,
      operatorName: req.userName,
      targetType: 'Task',
      targetId: task.id,
      targetName: task.name,
      oldValue: oldTask?.status,
      newValue: 'IN_PROGRESS',
      description: `开始工作`,
      ipAddress: req.ip,
    });
    
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});

router.post('/:id/complete', authMiddleware, requireTaskPermission('update_status'), async (req: AuthRequest, res) => {
  try {
    const oldTask = await taskService.getTaskById(req.params.id);
    const task = await taskService.updateTaskStatus(req.params.id, 'COMPLETED');
    
    await auditService.createAuditLog({
      category: 'TASK',
      action: 'STATUS_CHANGE',
      operatorId: req.userId,
      operatorName: req.userName,
      targetType: 'Task',
      targetId: task.id,
      targetName: task.name,
      oldValue: oldTask?.status,
      newValue: 'COMPLETED',
      description: `完成了任务`,
      ipAddress: req.ip,
    });
    
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});

router.put(
  '/:id/upload-status',
  authMiddleware,
  requireTaskPermission('upload'),
  async (req: AuthRequest, res) => {
    try {
      const { status, versionNumber, errorMessage } = req.body;
      
      if (!status || !['SUCCESS', 'FAILED'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }

      const task = await taskService.updateLastUploadStatus(
        req.params.id,
        status,
        { versionNumber, errorMessage }
      );
      res.json({ success: true, data: task });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }
);

router.delete(
  '/:id',
  authMiddleware,
  requireTaskPermission('delete'),
  async (req: AuthRequest, res) => {
    try {
      const task = await taskService.getTaskById(req.params.id);
      await taskService.deleteTask(req.params.id);
      
      await auditService.createAuditLog({
        category: 'TASK',
        action: 'DELETE',
        operatorId: req.userId,
        operatorName: req.userName,
        targetType: 'Task',
        targetId: req.params.id,
        targetName: task?.name,
        description: `删除了任务 ${task?.name}`,
        ipAddress: req.ip,
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }
);

export default router;