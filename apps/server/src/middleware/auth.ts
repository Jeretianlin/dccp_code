import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../utils/database';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  userName?: string;
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
  
  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  
  if (!user) {
    return res.status(401).json({ success: false, error: 'User not found' });
  }
  
  req.userId = user.id;
  req.userRole = user.role;
  req.userName = user.name;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  };
}