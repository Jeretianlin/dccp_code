import { prisma } from '../utils/database';

export type AuditCategory = 'USER' | 'TASK';
export type AuditAction = 'CREATE' | 'DELETE' | 'PASSWORD_CHANGE' | 'STATUS_CHANGE' | 'UPLOAD' | 'LOGIN';

export interface AuditLogData {
  category: AuditCategory;
  action: AuditAction;
  operatorId?: string;
  operatorName?: string;
  targetType: string;
  targetId?: string;
  targetName?: string;
  oldValue?: string;
  newValue?: string;
  description?: string;
  ipAddress?: string;
}

export interface AuditLogQuery {
  category?: AuditCategory;
  action?: AuditAction;
  operatorId?: string;
  targetId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        category: data.category,
        action: data.action,
        operator_id: data.operatorId,
        operator_name: data.operatorName,
        target_type: data.targetType,
        target_id: data.targetId,
        target_name: data.targetName,
        old_value: data.oldValue,
        new_value: data.newValue,
        description: data.description,
        ip_address: data.ipAddress,
      },
    });
  } catch (error) {
    console.error('Audit log creation failed:', error);
  }
}

export async function getAuditLogs(query: AuditLogQuery) {
  const page = query.page || 1;
  const pageSize = query.pageSize || 50;
  const skip = (page - 1) * pageSize;

  const where: any = {};

  if (query.category) {
    where.category = query.category;
  }
  if (query.action) {
    where.action = query.action;
  }
  if (query.operatorId) {
    where.operator_id = query.operatorId;
  }
  if (query.targetId) {
    where.target_id = query.targetId;
  }
  if (query.startDate) {
    where.created_at = { ...where.created_at, gte: query.startDate };
  }
  if (query.endDate) {
    where.created_at = { ...where.created_at, lte: query.endDate };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { created_at: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}