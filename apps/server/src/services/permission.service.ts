import { prisma } from '../utils/database';

export type TaskAction = 'view' | 'edit' | 'update_status' | 'upload' | 'delete';

export type TaskMemberRole = 'ADMIN' | 'PROJECT_MANAGER' | 'CREATOR' | 'ASSIGNEE' | 'NONE';

export interface TaskMembershipResult {
  isMember: boolean;
  role: TaskMemberRole;
  task?: {
    creator_id: string;
    assignee_id: string | null;
  };
}

export async function getTaskMembership(
  taskId: string,
  userId: string
): Promise<TaskMembershipResult> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      creator_id: true,
      assignee_id: true,
    },
  });

  if (!task) {
    return { isMember: false, role: 'NONE' };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    return { isMember: false, role: 'NONE' };
  }

  if (user.role === 'ADMIN') {
    return { isMember: true, role: 'ADMIN', task };
  }

  if (user.role === 'PROJECT_MANAGER') {
    if (task.creator_id === userId) {
      return { isMember: true, role: 'PROJECT_MANAGER', task };
    }
    return { isMember: false, role: 'NONE' };
  }

  if (task.creator_id === userId) {
    return { isMember: true, role: 'CREATOR', task };
  }

  if (task.assignee_id === userId) {
    return { isMember: true, role: 'ASSIGNEE', task };
  }

  return { isMember: false, role: 'NONE' };
}

export async function checkTaskPermission(
  taskId: string,
  userId: string,
  action: TaskAction
): Promise<{ allowed: boolean; reason?: string }> {
  const membership = await getTaskMembership(taskId, userId);

  if (!membership.isMember) {
    return { allowed: false, reason: '您没有权限访问此任务' };
  }

  if (action === 'delete') {
    const allowed = membership.role === 'ADMIN' || membership.role === 'PROJECT_MANAGER';
    return {
      allowed,
      reason: allowed ? undefined : '只有管理员或项目总管可以删除任务',
    };
  }

  return { allowed: true };
}

export async function checkTaskPermissionWithRole(
  taskId: string,
  userId: string,
  userRole: string,
  action: TaskAction
): Promise<{ allowed: boolean; reason?: string }> {
  if (userRole === 'ADMIN') {
    return { allowed: true };
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      creator_id: true,
      assignee_id: true,
    },
  });

  if (!task) {
    return { allowed: false, reason: '任务不存在' };
  }

  const isCreator = task.creator_id === userId;
  const isAssignee = task.assignee_id === userId;

  if (userRole === 'PROJECT_MANAGER') {
    if (!isCreator) {
      return { allowed: false, reason: '您只能操作自己创建的任务' };
    }
    return { allowed: true };
  }

  if (!isAssignee) {
    return { allowed: false, reason: '您没有权限访问此任务' };
  }

  if (action === 'delete') {
    return { allowed: false, reason: '设计师不能删除任务' };
  }

  return { allowed: true };
}