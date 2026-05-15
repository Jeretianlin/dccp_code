import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import * as authService from '../services/auth.service';
import * as auditService from '../services/audit.service';
import { prisma } from '../utils/database';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'PROJECT_MANAGER', 'DESIGNER']).optional(),
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await authService.login(email, password);
    
    await auditService.createAuditLog({
      category: 'USER',
      action: 'LOGIN',
      operatorId: result.user.id,
      operatorName: result.user.name,
      targetType: 'User',
      targetId: result.user.id,
      targetName: result.user.name,
      description: `用户登录`,
      ipAddress: req.ip,
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(401).json({ success: false, error: (error as Error).message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    
    if (userCount > 0) {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
    }

    const data = registerSchema.parse(req.body);
    const role = userCount === 0 ? 'ADMIN' : (data.role || 'DESIGNER');
    const result = await authService.register(data.email, data.password, data.name, role as any);
    
    await auditService.createAuditLog({
      category: 'USER',
      action: 'CREATE',
      operatorId: result.user.id,
      operatorName: result.user.name,
      targetType: 'User',
      targetId: result.user.id,
      targetName: result.user.name,
      description: `注册了用户 ${result.user.name} (${role})`,
      ipAddress: req.ip,
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await authService.getCurrentUser(req.userId!);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(404).json({ success: false, error: (error as Error).message });
  }
});

export default router;