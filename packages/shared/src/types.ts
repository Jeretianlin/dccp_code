export type UserRole = 'ADMIN' | 'PROJECT_MANAGER' | 'DESIGNER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TaskStatus = 'NEW' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type Interval = 'DAILY' | 'WEEKLY' | 'EVERY_N_DAYS';
export type FileFilterMode = 'INCLUDE' | 'EXCLUDE';

export interface FileFilterConfig {
  enabled: boolean;
  mode: FileFilterMode;
  rules: string[];
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  requirements?: string;
  projectId?: string;
  parentTaskId?: string;
  assigneeId?: string;
  creatorId: string;
  status: TaskStatus;
  priority: Priority;
  createdAt: Date;
  acceptedAt?: Date;
  startedAt?: Date;
  expectedCompletion?: Date;
  completedAt?: Date;
  autoUploadEnabled: boolean;
  autoUploadInterval?: Interval;
  autoUploadTime?: string;
  autoUploadDayOfWeek?: number;
  autoUploadEveryNDays?: number;
  nextUploadTime?: Date;
  fileFilterEnabled?: boolean;
  fileFilterMode?: FileFilterMode;
  fileFilterRules?: string[];
}

export type UploadType = 'MANUAL' | 'AUTO_SCHEDULED' | 'AUTO_TRIGGERED';

export interface Version {
  id: string;
  taskId: string;
  versionNumber: number;
  createdAt: Date;
  createdById: string;
  uploadType: UploadType;
  fileCount: number;
  totalSize: bigint;
  deltaSize: bigint;
  storagePath: string;
}

export interface FileRecord {
  id: string;
  versionId: string;
  relativePath: string;
  fileHash: string;
  fileSize: bigint;
  mimeType?: string;
  isNew: boolean;
  isChanged: boolean;
  createdAt: Date;
}

export interface FileManifest {
  path: string;
  hash: string;
  size: number;
  modifiedAt: Date;
  mimeType?: string;
}

export interface DiffResult {
  newFiles: FileManifest[];
  changedFiles: FileManifest[];
  unchangedFiles: FileManifest[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface CreateTaskRequest {
  name: string;
  description?: string;
  requirements?: string;
  projectId?: string;
  parentTaskId?: string;
  assigneeId?: string;
  priority?: Priority;
  expectedCompletion?: Date;
  autoUploadEnabled?: boolean;
  autoUploadInterval?: Interval;
  autoUploadTime?: string;
  autoUploadDayOfWeek?: number;
  autoUploadEveryNDays?: number;
  fileFilterEnabled?: boolean;
  fileFilterMode?: FileFilterMode;
  fileFilterRules?: string[];
}

export interface UpdateTaskRequest {
  name?: string;
  description?: string;
  requirements?: string;
  assigneeId?: string;
  priority?: Priority;
  expectedCompletion?: Date;
  autoUploadEnabled?: boolean;
  autoUploadInterval?: Interval;
  autoUploadTime?: string;
  autoUploadDayOfWeek?: number;
  autoUploadEveryNDays?: number;
  fileFilterEnabled?: boolean;
  fileFilterMode?: FileFilterMode;
  fileFilterRules?: string[];
}

export interface TaskQueryParams {
  assigneeId?: string;
  projectId?: string;
  status?: TaskStatus;
  priority?: Priority;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface UploadInitRequest {
  taskId: string;
  totalFiles: number;
  totalSize: number;
}

export interface UploadInitResponse {
  uploadId: string;
  chunkSize: number;
}

export interface UploadChunkRequest {
  uploadId: string;
  chunkIndex: number;
  chunkHash: string;
}

export interface UploadCompleteRequest {
  uploadId: string;
  files: FileManifest[];
}