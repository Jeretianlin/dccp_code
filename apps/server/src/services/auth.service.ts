import bcrypt from 'bcryptjs';
import { prisma } from '../utils/database';
import { generateToken } from '../middleware/auth';

export async function login(email: string, password: string) {
  const user = await prisma.user.findFirst({
    where: { email, deleted_at: null },
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isValid = await bcrypt.compare(password, user.password_hash);

  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  const token = generateToken(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
    },
    token,
  };
}

export async function register(
  email: string,
  password: string,
  name: string,
  role: 'ADMIN' | 'PROJECT_MANAGER' | 'DESIGNER' = 'DESIGNER'
) {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.deleted_at) {
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          password_hash: passwordHash,
          name,
          role,
          deleted_at: null,
        },
      });

      const token = generateToken(user.id);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      };
    }
    throw new Error('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password_hash: passwordHash,
      name,
      role,
    },
  });

  const token = generateToken(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    token,
  };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deleted_at: null },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar: user.avatar,
  };
}