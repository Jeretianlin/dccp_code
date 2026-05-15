# AGENTS.md - DCCP Project Guidelines

## Project Overview

DCCP (Designer Creative Collaboration Platform) is a monorepo for 3D/graphic design task management and file versioning. Built with TypeScript, Express, Electron, and React.

## Build Commands

```bash
# Install dependencies
npm install

# Development (run both server and client)
npm run dev

# Development (server only)
npm run dev:server

# Development (client only)
npm run dev:client

# Build all workspaces
npm run build

# Build server executable
npm run build:exe

# Database operations
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema to database
npm run db:studio      # Open Prisma Studio
npm run db:migrate     # Run migrations
```

## Testing

No test framework is currently configured. When adding tests, consider using Vitest or Jest.

## TypeScript Configuration

- Target: ES2022
- Strict mode enabled
- Server: CommonJS modules with Node module resolution
- Client: ESNext modules with bundler resolution
- Source maps and declarations enabled

## Code Style Guidelines

### Import Style

```typescript
// Server: ES module imports with CommonJS compatibility
import { Router } from 'express';
import { z } from 'zod';
import * as jwt from 'jsonwebtoken';

// Service imports use namespace pattern
import * as taskService from '../services/task.service';

// Client: ES module imports
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (server) | kebab-case with suffix | `task.routes.ts`, `auth.service.ts` |
| Files (client) | PascalCase | `TaskList.tsx`, `AuthContext.tsx` |
| Variables | camelCase | `taskId`, `userName` |
| Constants | SCREAMING_SNAKE_CASE | `JWT_SECRET`, `MAX_FILE_SIZE` |
| Types/Interfaces | PascalCase | `TaskStatus`, `CreateTaskRequest` |
| Database columns | snake_case | `created_at`, `user_id` |
| API routes | kebab-case | `/api/tasks`, `/api/auth/login` |

### File Organization

```
apps/server/src/
  config/       # Environment and path configuration
  middleware/   # Express middleware (auth, permissions)
  routes/       # API route handlers (*.routes.ts)
  services/     # Business logic (*.service.ts)
  utils/        # Shared utilities

apps/client/src/
  main/         # Electron main process
  preload/      # Electron preload scripts
  renderer/src/ # React application
    api/        # API client functions
    components/ # Reusable React components
    contexts/   # React contexts
    pages/      # Page components

packages/shared/src/
  types.ts      # Shared TypeScript interfaces
```

### Error Handling

Server routes use try-catch with consistent response format:

```typescript
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await service.getById(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Validation errors return 400
router.post('/', async (req, res) => {
  try {
    const data = schema.parse(req.body);
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});
```

### API Response Format

```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: string }

// Paginated
{ success: true, data: T[], total: number, page: number, pageSize: number, totalPages: number }
```

### Validation

Use Zod schemas defined at the top of route files:

```typescript
const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

// In route handler
const data = createSchema.parse(req.body);
```

### BigInt Serialization

BigInt fields must be serialized to strings for JSON responses:

```typescript
function serializeTask(task: any) {
  return {
    ...task,
    versions: task.versions?.map((v: any) => ({
      ...v,
      total_size: v.total_size?.toString() || '0',
      delta_size: v.delta_size?.toString() || '0',
    })),
  };
}
```

### React Component Style

- Functional components with hooks
- Default exports for page components
- Named exports for reusable components and hooks

```typescript
// Page component - default export
export default function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => { fetchTasks(); }, []);
  // ...
}

// Reusable component - named export
export function Button({ children, onClick }: ButtonProps) {
  return <button onClick={onClick}>{children}</button>;
}

// Context hook - named export
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

### Tailwind CSS

- Use Tailwind utility classes directly
- Custom styles defined in `index.css`: `.btn`, `.btn-primary`, `.btn-secondary`, `.input`, `.card`, `.badge-*`

### Database (Prisma)

- Snake_case for column names in schema
- Use `@@map()` to map table names
- BigInt fields need serialization: `v.total_size?.toString()`
- JSON fields stored as strings: `JSON.stringify(data.fileFilterRules)`

```prisma
model Task {
  id            String   @id @default(uuid())
  assignee_id   String?
  created_at    DateTime @default(now())
  
  @@map("tasks")
}
```

### Authentication Flow

1. JWT tokens stored in localStorage (client)
2. Token passed via Authorization header: `Bearer <token>`
3. `authMiddleware` validates token and attaches `userId`/`userRole` to request
4. `requireRole()` middleware for role-based access control

```typescript
export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}
```

### Electron IPC

Preload script exposes API via `contextBridge`:

```typescript
contextBridge.exposeInMainWorld('electron', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  uploadDirectory: (taskId, dirPath, token) => 
    ipcRenderer.invoke('upload-directory', taskId, dirPath, token),
});
```

### Environment Variables

Server (`.env`):
- `PORT` - Server port (default: 3000)
- `JWT_SECRET` - JWT signing secret
- `DATABASE_URL` - MySQL connection string
- `HTTPS_ENABLED` - Enable HTTPS
- `HTTPS_KEY_PATH` / `HTTPS_CERT_PATH` - SSL certificate paths

## Key Dependencies

| Purpose | Server | Client |
|---------|--------|--------|
| Framework | Express | Electron + React |
| ORM | Prisma | - |
| Validation | Zod | - |
| Styling | - | Tailwind CSS |
| HTTP Client | - | Axios |
| Routing | - | react-router-dom |

## Common Tasks

### Adding a new API endpoint

1. Create/update service in `apps/server/src/services/`
2. Create route in `apps/server/src/routes/`
3. Register route in `apps/server/src/index.ts`
4. Add types to `packages/shared/src/types.ts` if needed

### Adding a new page

1. Create component in `apps/client/src/renderer/src/pages/`
2. Add route in `apps/client/src/renderer/src/App.tsx`
3. Add navigation item in `apps/client/src/renderer/src/components/Layout.tsx`

### Database schema changes

1. Edit `apps/server/prisma/schema.prisma`
2. Run `npm run db:generate && npm run db:push`
3. Update shared types if needed