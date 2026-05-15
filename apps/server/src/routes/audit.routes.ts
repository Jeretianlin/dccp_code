import { Router } from 'express';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import * as auditService from '../services/audit.service';

const router = Router();

router.get('/', authMiddleware, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { category, action, operatorId, targetId, startDate, endDate, page, pageSize } = req.query;

    const result = await auditService.getAuditLogs({
      category: category as auditService.AuditCategory,
      action: action as auditService.AuditAction,
      operatorId: operatorId as string,
      targetId: targetId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;