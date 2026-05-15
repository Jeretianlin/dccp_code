import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { checkTaskPermissionWithRole, TaskAction } from '../services/permission.service';

export function requireTaskPermission(action: TaskAction) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const taskId = req.params.id || req.params.taskId || req.body.taskId;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: '缺少任务ID',
      });
    }

    const result = await checkTaskPermissionWithRole(
      taskId,
      req.userId!,
      req.userRole!,
      action
    );

    if (!result.allowed) {
      return res.status(403).json({
        success: false,
        error: result.reason || '权限不足',
      });
    }

    next();
  };
}