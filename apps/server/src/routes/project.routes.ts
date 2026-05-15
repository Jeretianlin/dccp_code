import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import * as projectService from '../services/project.service';

const router = Router();

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const projects = await projectService.getProjects();
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const project = await projectService.getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post(
  '/',
  authMiddleware,
  requireRole('ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const data = createProjectSchema.parse(req.body);
      const project = await projectService.createProject(data.name, data.description);
      res.json({ success: true, data: project });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }
);

router.put('/:id', authMiddleware, requireRole('ADMIN', 'PROJECT_MANAGER'), async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;
    const project = await projectService.updateProject(req.params.id, name, description);
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/:id', authMiddleware, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    await projectService.deleteProject(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});

export default router;