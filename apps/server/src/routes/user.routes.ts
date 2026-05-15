import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import * as userService from '../services/user.service';
import * as auditService from '../services/audit.service';

const router = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'PROJECT_MANAGER', 'DESIGNER']).optional(),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

router.post(
  '/',
  authMiddleware,
  requireRole('ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const data = createUserSchema.parse(req.body);
      const user = await userService.createUser(
        data.email,
        data.password,
        data.name,
        data.role as any
      );
      
      await auditService.createAuditLog({
        category: 'USER',
        action: 'CREATE',
        operatorId: req.userId,
        operatorName: req.userName,
        targetType: 'User',
        targetId: user.id,
        targetName: user.name,
        description: `创建了用户 ${user.name} (${user.role})`,
        ipAddress: req.ip,
      });
      
      res.json({ success: true, data: user });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }
);

router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const users = await userService.getUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, avatar } = req.body;
    const user = await userService.updateUser(req.params.id, { name, avatar });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});

router.put('/me/password', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { oldPassword, newPassword } = changePasswordSchema.parse(req.body);
      const user = await userService.changePassword(req.userId!, oldPassword, newPassword);
      
      await auditService.createAuditLog({
        category: 'USER',
        action: 'PASSWORD_CHANGE',
        operatorId: req.userId,
        operatorName: req.userName,
        targetType: 'User',
        targetId: req.userId,
        targetName: req.userName,
        description: `修改了密码`,
        ipAddress: req.ip,
      });
      
      res.json({ success: true, data: user });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  });

router.delete(
  '/:id',
  authMiddleware,
  requireRole('ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      if (req.params.id === req.userId) {
        return res.status(400).json({ success: false, error: '不能删除自己' });
      }
      const user = await userService.deleteUser(req.params.id);
      
      await auditService.createAuditLog({
        category: 'USER',
        action: 'DELETE',
        operatorId: req.userId,
        operatorName: req.userName,
        targetType: 'User',
        targetId: user.id,
        targetName: user.name,
        description: `删除了用户 ${user.name} (${user.role})`,
        ipAddress: req.ip,
      });
      
      res.json({ success: true, data: user });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }
);

export default router;