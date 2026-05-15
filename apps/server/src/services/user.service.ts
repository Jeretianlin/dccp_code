import bcrypt from 'bcryptjs';
import { prisma } from '../utils/database';

export type UserRole = 'ADMIN' | 'PROJECT_MANAGER' | 'DESIGNER';

export async function createUser(
  email: string,
  password: string,
  name: string,
  role: UserRole = 'DESIGNER'
) {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.deleted_at) {
      const passwordHash = await bcrypt.hash(password, 10);
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          password_hash: passwordHash,
          name,
          role,
          deleted_at: null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
          created_at: true,
        },
      });
    }
    throw new Error('邮箱已被注册');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.user.create({
    data: {
      email,
      password_hash: passwordHash,
      name,
      role,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatar: true,
      created_at: true,
    },
  });
}

export async function getUsers() {
  return prisma.user.findMany({
    where: { deleted_at: null },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatar: true,
      created_at: true,
    },
    orderBy: { created_at: 'desc' },
  });
}

export async function getUserById(id: string) {
  return prisma.user.findFirst({
    where: { id, deleted_at: null },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatar: true,
      created_at: true,
    },
  });
}

export async function updateUser(id: string, data: { name?: string; avatar?: string }) {
  return prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatar: true,
    },
  });
}

export async function deleteUser(id: string) {
  const incompleteTasks = await prisma.task.count({
    where: {
      OR: [
        { creator_id: id },
        { assignee_id: id },
      ],
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
      deleted_at: null,
    },
  });

  if (incompleteTasks > 0) {
    throw new Error('该用户有未完成的任务，无法删除');
  }

  return prisma.user.update({
    where: { id },
    data: { deleted_at: new Date() },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });
}

export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  
  if (!user) {
    throw new Error('用户不存在');
  }
  
  const isValid = await bcrypt.compare(oldPassword, user.password_hash);
  if (!isValid) {
    throw new Error('旧密码错误');
  }
  
  const passwordHash = await bcrypt.hash(newPassword, 10);
  return prisma.user.update({
    where: { id: userId },
    data: { password_hash: passwordHash },
    select: { id: true, email: true, name: true, role: true },
  });
}