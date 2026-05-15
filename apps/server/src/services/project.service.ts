import { prisma } from '../utils/database';

export async function createProject(name: string, description?: string) {
  return prisma.project.create({
    data: { name, description },
  });
}

export async function getProjects() {
  return prisma.project.findMany({
    orderBy: { created_at: 'desc' },
    include: {
      _count: { select: { tasks: true } },
    },
  });
}

export async function getProjectById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      tasks: {
        include: {
          assignee: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function updateProject(id: string, name?: string, description?: string) {
  return prisma.project.update({
    where: { id },
    data: { name, description },
  });
}

export async function deleteProject(id: string) {
  return prisma.project.delete({ where: { id } });
}