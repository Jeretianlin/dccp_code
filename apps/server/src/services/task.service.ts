import { prisma } from '../utils/database';

export type TaskStatus = 'NEW' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type Interval = 'DAILY' | 'WEEKLY' | 'EVERY_N_DAYS';
export type FileFilterMode = 'INCLUDE' | 'EXCLUDE';

export interface CreateTaskData {
  name: string;
  description?: string;
  requirements?: string;
  projectId?: string;
  parentTaskId?: string;
  assigneeId?: string;
  creatorId: string;
  priority?: Priority;
  expectedCompletion?: Date;
  autoUploadEnabled?: boolean;
  autoUploadInterval?: Interval;
  autoUploadTime?: string;
  autoUploadDayOfWeek?: number;
  autoUploadEveryNDays?: number;
  fileFilterEnabled?: boolean;
  fileFilterMode?: FileFilterMode;
  fileFilterRules?: string[];
}

export interface UpdateTaskData {
  name?: string;
  description?: string;
  requirements?: string;
  assigneeId?: string;
  priority?: Priority;
  expectedCompletion?: Date;
  watchDirectory?: string;
  autoUploadEnabled?: boolean;
  autoUploadInterval?: Interval;
  autoUploadTime?: string;
  autoUploadDayOfWeek?: number;
  autoUploadEveryNDays?: number;
  fileFilterEnabled?: boolean;
  fileFilterMode?: FileFilterMode;
  fileFilterRules?: string[];
}

export interface TaskQuery {
  assigneeId?: string;
  projectId?: string;
  status?: TaskStatus;
  priority?: Priority;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function calculateNextUploadTime(
  interval: Interval | undefined,
  time: string | undefined,
  dayOfWeek: number | undefined,
  everyNDays: number | undefined
): Date | null {
  if (!interval || !time) return null;

  const now = new Date();
  const [hour, minute] = time.split(':').map(Number);
  
  let next = new Date();
  next.setHours(hour, minute, 0, 0);
  
  if (interval === 'DAILY') {
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
  } else if (interval === 'WEEKLY') {
    const targetDay = dayOfWeek ?? 0;
    const currentDay = now.getDay();
    let daysUntilTarget = targetDay - currentDay;
    
    if (daysUntilTarget < 0 || (daysUntilTarget === 0 && next <= now)) {
      daysUntilTarget += 7;
    } else if (daysUntilTarget === 0 && next > now) {
      // Today is the target day and time hasn't passed yet
    }
    
    next.setDate(next.getDate() + daysUntilTarget);
  } else if (interval === 'EVERY_N_DAYS') {
    const days = everyNDays ?? 1;
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
  }
  
  return next;
}

export async function createTask(data: CreateTaskData) {
  const nextUploadTime = data.autoUploadEnabled 
    ? calculateNextUploadTime(
        data.autoUploadInterval,
        data.autoUploadTime,
        data.autoUploadDayOfWeek,
        data.autoUploadEveryNDays
      )
    : null;

  return prisma.task.create({
    data: {
      name: data.name,
      description: data.description,
      requirements: data.requirements,
      project_id: data.projectId,
      parent_task_id: data.parentTaskId,
      assignee_id: data.assigneeId,
      creator_id: data.creatorId,
      priority: data.priority || 'MEDIUM',
      expected_completion: data.expectedCompletion,
      auto_upload_enabled: data.autoUploadEnabled || false,
      auto_upload_interval: data.autoUploadInterval,
      auto_upload_time: data.autoUploadTime,
      auto_upload_day_of_week: data.autoUploadDayOfWeek,
      auto_upload_every_n_days: data.autoUploadEveryNDays,
      next_upload_time: nextUploadTime,
      file_filter_enabled: data.fileFilterEnabled || false,
      file_filter_mode: data.fileFilterMode,
      file_filter_rules: data.fileFilterRules ? JSON.stringify(data.fileFilterRules) : null,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      creator: { select: { id: true, name: true, email: true } },
      project: true,
    },
  });
}

export async function getTaskById(id: string) {
  return prisma.task.findFirst({
    where: { id, deleted_at: null },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      creator: { select: { id: true, name: true, email: true } },
      project: true,
      sub_tasks: {
        where: { deleted_at: null },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
        },
      },
      versions: {
        orderBy: { version_number: 'desc' },
        take: 5,
        include: {
          created_by: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}

export async function getTasks(query: TaskQuery, userId?: string, userRole?: string) {
  const page = query.page || 1;
  const pageSize = query.pageSize || 20;
  const skip = (page - 1) * pageSize;

  const where: any = { deleted_at: null };

  // 根据角色过滤任务
  if (userId && userRole) {
    if (userRole === 'ADMIN') {
      // 管理员查看所有任务
    } else if (userRole === 'PROJECT_MANAGER') {
      // 项目总管只能查看自己创建的任务
      where.creator_id = userId;
    } else {
      // 设计师只能查看分配给自己的任务
      where.assignee_id = userId;
    }
  }

  if (query.assigneeId) {
    where.assignee_id = query.assigneeId;
  }
  if (query.projectId) {
    where.project_id = query.projectId;
  }
  if (query.status) {
    where.status = query.status;
  }
  if (query.priority) {
    where.priority = query.priority;
  }
  if (query.search) {
    where.name = { contains: query.search };
  }

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { created_at: 'desc' },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        _count: { select: { sub_tasks: true, versions: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  return {
    tasks,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function updateTask(id: string, data: UpdateTaskData) {
  let nextUploadTime: Date | null | undefined = undefined;
  
  if (data.autoUploadEnabled !== undefined && data.autoUploadInterval !== undefined) {
    if (data.autoUploadEnabled) {
      nextUploadTime = calculateNextUploadTime(
        data.autoUploadInterval,
        data.autoUploadTime,
        data.autoUploadDayOfWeek,
        data.autoUploadEveryNDays
      );
    } else {
      nextUploadTime = null;
    }
  }

  return prisma.task.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      requirements: data.requirements,
      assignee_id: data.assigneeId,
      priority: data.priority,
      expected_completion: data.expectedCompletion,
      watch_directory: data.watchDirectory,
      auto_upload_enabled: data.autoUploadEnabled,
      auto_upload_interval: data.autoUploadInterval,
      auto_upload_time: data.autoUploadTime,
      auto_upload_day_of_week: data.autoUploadDayOfWeek,
      auto_upload_every_n_days: data.autoUploadEveryNDays,
      next_upload_time: nextUploadTime,
      file_filter_enabled: data.fileFilterEnabled,
      file_filter_mode: data.fileFilterMode,
      file_filter_rules: data.fileFilterRules ? JSON.stringify(data.fileFilterRules) : null,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      creator: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  const updateData: any = { status };

  if (status === 'ACCEPTED') {
    updateData.accepted_at = new Date();
  } else if (status === 'IN_PROGRESS') {
    updateData.started_at = new Date();
  } else if (status === 'COMPLETED') {
    updateData.completed_at = new Date();
  }

  return prisma.task.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteTask(id: string) {
  const subTasks = await prisma.task.findMany({
    where: { parent_task_id: id, deleted_at: null },
    select: { id: true },
  });

  for (const sub of subTasks) {
    await deleteTask(sub.id);
  }

  return prisma.task.update({
    where: { id },
    data: { deleted_at: new Date() },
  });
}

export async function getTasksByAssignee(assigneeId: string) {
  return prisma.task.findMany({
    where: { assignee_id: assigneeId, deleted_at: null },
    orderBy: { created_at: 'desc' },
    include: {
      project: { select: { id: true, name: true } },
    },
  });
}

export async function updateLastUploadStatus(
  taskId: string,
  status: 'SUCCESS' | 'FAILED',
  data?: {
    versionNumber?: number;
    errorMessage?: string;
    uploadType?: string;
  }
) {
  return prisma.task.update({
    where: { id: taskId },
    data: {
      last_upload_status: status,
      last_upload_time: new Date(),
      last_upload_version: data?.versionNumber,
      last_upload_error: data?.errorMessage,
      last_upload_type: data?.uploadType,
    },
  });
}