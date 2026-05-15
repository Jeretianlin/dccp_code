# DCCP - 设计师创意协同平台

Designer Creative Collaboration Platform - 3D/平面设计行业任务分配与作品回收提交系统

## 功能特性

### 1\. 任务管理

* ✅ 任务创建、分配、查询
* ✅ 任务状态流转（新建 → 接受 → 进行中 → 完成）
* ✅ 子任务支持
* ✅ 任务优先级设置
* ✅ 按负责人、项目、状态筛选

### 2\. 文件版本管理

* ✅ 文件上传与版本创建
* ✅ 内容寻址存储（按hash去重）
* ✅ 增量上传检测
* ✅ 版本历史记录
* ✅ latest 目录自动更新

### 3\. 自动上传

* ✅ 定时自动上传（每天/每周）
* ✅ 任务完成自动停止
* ✅ 文件变化监听

### 4\. 客户端

* ✅ Electron 桌面应用
* ✅ 本地目录选择
* ✅ 文件监听与同步

## 技术栈

|层级|技术|
|-|-|
|桌面客户端|Electron + React 18 + TypeScript|
|UI组件库|Tailwind CSS|
|后端框架|Express + TypeScript|
|数据库|MySQL + Prisma ORM|
|文件存储|本地文件系统 + 内容寻址去重|
|认证|JWT|

## 项目结构

```
dccp/
├── apps/
│   ├── server/                 # Express 后端服务
│   │   ├── src/
│   │   │   ├── routes/         # API 路由
│   │   │   ├── services/       # 业务逻辑
│   │   │   ├── middleware/     # 中间件
│   │   │   └── utils/          # 工具函数
│   │   └── prisma/
│   │       └── schema.prisma   # 数据库模型
│   │
│   └── client/                 # Electron 客户端
│       └── src/
│           ├── main/           # 主进程
│           ├── renderer/       # 渲染进程 (React)
│           └── preload/        # 预加载脚本
│
├── packages/
│   └── shared/                 # 共享类型定义
│
└── data/                       # 数据存储目录
    ├── content/                # 内容寻址存储
    └── tasks/                  # 任务文件存储
```

## 快速开始

### 1\. 安装依赖

```bash
npm install
```

### 2\. 初始化数据库

```bash
npm run db:generate
npm run db:push
```

### 3\. 创建管理员账户

首次运行需要创建管理员账户。启动服务后，使用 API 或数据库直接插入：

```bash
# 启动服务端
npm run dev:server
```

然后在另一个终端使用 curl 或 Postman 注册：

```bash
curl -X POST http://localhost:3000/api/auth/register \\\\
  -H "Content-Type: application/json" \\\\
  -d '{"email":"admin@example.com","password":"admin123","name":"管理员","role":"ADMIN"}'
```

### 4\. 启动开发服务器

```bash
# 同时启动服务端和客户端
npm run dev

# 或分别启动
npm run dev:server  # 服务端 http://localhost:3000
npm run dev:client  # 客户端
```

## API 文档

### 认证

|方法|路径|描述|
|-|-|-|
|POST|/api/auth/login|登录|
|POST|/api/auth/register|注册（需管理员权限）|
|GET|/api/auth/me|获取当前用户|

### 任务

|方法|路径|描述|
|-|-|-|
|GET|/api/tasks|获取任务列表|
|GET|/api/tasks/:id|获取任务详情|
|POST|/api/tasks|创建任务|
|PUT|/api/tasks/:id|更新任务|
|PUT|/api/tasks/:id/status|更新状态|
|POST|/api/tasks/:id/accept|接受任务|
|POST|/api/tasks/:id/complete|完成任务|
|DELETE|/api/tasks/:id|删除任务|

### 版本

|方法|路径|描述|
|-|-|-|
|GET|/api/tasks/:id/versions|获取版本列表|
|GET|/api/tasks/:id/versions/:v|获取版本详情|

### 上传

|方法|路径|描述|
|-|-|-|
|POST|/api/upload/init|初始化上传|
|POST|/api/upload/chunk|上传分片|
|POST|/api/upload/complete|完成上传|
|POST|/api/upload/directory|上传整个目录|

## 数据库模型

### User（用户）

* id, email, name, role, avatar
* role: ADMIN | MANAGER | EMPLOYEE

### Task（任务）

* id, name, description, requirements
* status: NEW | ACCEPTED | IN\_PROGRESS | COMPLETED | CANCELLED | ARCHIVED
* priority: LOW | MEDIUM | HIGH | URGENT
* 支持子任务、自动上传配置

### Version（版本）

* version\_number, file\_count, total\_size, delta\_size
* upload\_type: MANUAL | AUTO\_SCHEDULED | AUTO\_TRIGGERED

### FileRecord（文件记录）

* relative\_path, file\_hash, file\_size
* is\_new, is\_changed

### ContentStore（内容存储）

* file\_hash, storage\_path, ref\_count
* 用于去重和引用计数

## 存储结构

```
data/
├── content/                    # 内容寻址存储
│   └── {hash前2位}/
│       └── {hash}              # 文件内容
│
└── tasks/{task\\\_id}/
    ├── latest/                 # 最新版本
    ├── versions/
    │   ├── v1/
    │   │   └── manifest.json
    │   └── v2/
    └── metadata.json
```

## 开发计划

### Phase 1 ✅

* \[x] 项目结构搭建
* \[x] 用户认证系统
* \[x] 任务管理 API
* \[x] 文件上传与版本管理
* \[x] Electron 客户端基础

### Phase 2（待开发）

* \[ ] 文件预览功能
* \[ ] 版本对比
* \[ ] 断点续传
* \[ ] 块级增量存储

### Phase 3（待开发）

* \[ ] WebSocket 实时通知
* \[ ] 文件在线预览
* \[ ] 协作评论功能

## 许可证

MIT目前没有许可证的约束，主要是自己开发自己应用。 这个是我最新的修改。

