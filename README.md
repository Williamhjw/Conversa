# Conversa — MERN 实时聊天应用

<div align="center">

![MongoDB](https://img.shields.io/badge/MongoDB-%2347A248.svg?style=flat&logo=mongodb&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-%23000000.svg?style=flat&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React%2019-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)
![Node.js](https://img.shields.io/badge/Node.js-%23339933.svg?style=flat&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-%23000000.svg?style=flat&logo=socket.io&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-%2306B6D4.svg?style=flat&logo=tailwindcss&logoColor=white)
![七牛云](https://img.shields.io/badge/七牛云-00B4D8?style=flat&logo=qiniu&logoColor=white)
![智谱 GLM](https://img.shields.io/badge/智谱%20GLM-AI-4285F4?style=flat&logo=zhipu&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)

一个全栈、生产级的实时聊天应用，基于 MERN 技术栈和 Socket.IO 构建。功能包括一对一消息、由智谱 GLM 驱动的个性化 AI 聊天机器人、通过七牛云分享图片、邮箱验证、邮件通知，以及使用 React 19、TypeScript、Tailwind CSS v4 和 shadcn/ui 组件构建的完全响应式深色/浅色界面。

</div>

---

## 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [架构概览](#架构概览)
- [数据模型](#数据模型)
- [REST API 参考](#rest-api-参考)
- [Socket.IO 事件](#socketio-事件)
- [环境变量](#环境变量)
- [快速开始](#快速开始)
  - [Docker（推荐）](#docker推荐)
  - [手动部署（本地开发）](#手动部署本地开发)
- [脚本命令](#脚本命令)
- [安全设计](#安全设计)
- [后台任务](#后台任务)
- [许可证](#许可证)

---

## 功能特性

### 身份验证与邮箱验证
- **注册/登录** — 使用邮箱和密码（bcrypt 加密，JWT 有效期 7 天）
- **OTP 登录** — 通过 Nodemailer/Gmail SMTP 发送一次性密码；限时 5 分钟，bcrypt 存储
- **邮箱验证** — 注册后（或首次登录时针对已有账户），用户必须通过 6 位数字 OTP 验证邮箱才能访问仪表板；未验证用户始终重定向到 `/verify-email`
- **持久会话** — JWT 存储在 `localStorage`；每次 API 调用使用 `auth-token` 请求头
- **账户删除** — 软匿名化账户（清除姓名、邮箱、简介、凭证），同时保留其他参与者的对话历史

### 个人资料管理
- 更新姓名、个性签名和头像
- 修改密码（需验证旧密码）
- 头像通过预签名 POST URL 直接从浏览器上传到七牛云（最大 5 MB，仅限图片）；删除后重置为 ui-avatars.com 生成的 URL

### 消息功能
- **实时一对一聊天** — 基于 Socket.IO
- **文字和图片消息** — 图片上传到七牛云，可附带说明文字
- **回复消息** — 每条消息存储 `replyTo` 引用；在界面中显示为引用上下文
- **仅对我删除** — 仅从你的视图中硬删除消息（添加到 `hiddenFrom`）
- **对所有人删除** — 软删除设置 `softDeleted: true`；消息对所有成员显示为 *"此消息已删除"* 占位符
- **批量隐藏** — 一次性隐藏多条选中的消息
- **清空聊天** — 一键隐藏整个对话历史
- **收藏/取消收藏消息** — 为单条消息添加书签；在专门页面查看所有收藏消息
- **已读回执** — `seenBy` 数组追踪谁在何时阅读了每条消息
- **未读计数** — 在 `Conversation` 文档上维护每用户计数器，加入房间时重置
- **最新消息预览** — `latestmessage` 字段实时更新聊天列表

### AI 聊天机器人
- 每位用户注册时自动创建一个**个人 AI 聊天机器人**对话
- 由 **智谱 GLM** 驱动，模型可配置
- **流式响应** — 机器人回复通过 Socket.IO 逐块流式传输（`bot-chunk`、`bot-done`），文字逐步显示
- **上下文感知** — 每次请求发送最近 19 条文字消息作为聊天历史，让机器人记住对话内容
- **输入指示器** — 机器人生成时发送 `typing`/`stop-typing` 事件
- **错误回滚** — 如果 GLM 流失败，用户消息会被删除并发送 `bot-error` 事件

### 邮件通知
- 当收到消息且接收方**完全离线**（无打开的 socket）时，发送带有消息预览和对话深层链接的品牌 HTML 邮件
- **即发即忘** — 邮件在 socket 路径中从不等待，消息传递零延迟
- 用户可从设置页面（`/user/profile`）**开关邮件通知**；偏好设置持久化到数据库

### 实时在线状态与通知
- **在线/离线状态** — socket 连接/断开时更新 `isOnline` 标志；广播给所有对话伙伴
- **最后在线时间** — 断开连接时记录时间戳，通过 API 提供
- **多设备/多标签页感知** — `Map<userId, Set<socketId>>` 追踪所有打开的 socket；用户仅在*最后一个* socket 关闭时标记为离线
- **过期在线状态清理** — 后台定时任务每小时运行，强制将 socket 断开事件丢失的用户设为离线（如服务器崩溃）
- **输入指示器** — `typing`/`stop-typing` 事件广播到对话房间*以及*接收方的个人房间（如果他们在线但不在查看该聊天）
- **应用内推送通知** — 当接收方不在当前对话中时，向其个人房间发送 `new-message-notification` 事件

### 对话管理
- **发起对话** — 搜索任意已注册用户；如已存在对话则复用
- **对话列表** — 按 `updatedAt` 降序排列；置顶对话始终显示在最上方
- **置顶/取消置顶对话** — 每用户独立；存储在 User 文档的 `pinnedConversations` 数组中
- **拉黑/取消拉黑用户** — User 文档的 `blockedUsers` 数组
  - 被拉黑用户无法发送消息（每次 `send-message` socket 事件前服务端检查）
  - 被拉黑用户看到的是净化后的资料信息（通用姓名、头像和离线状态）
- **用户发现** — 分页、可搜索、可排序的与你没有对话的用户列表

### 界面与体验
- **React 19** 完整 **TypeScript** 类型安全
- **Tailwind CSS v4** 配合 **shadcn/ui** 组件库
- **深色/浅色/跟随系统** 主题切换，由 `next-themes` 驱动
- 完全**响应式** — 针对桌面和移动端优化
- **React Router v7** 嵌套路由布局系统（`DashboardLayout` → `ConversationLayout`）
- **Sonner** Toast 通知
- 机器人消息中的 **Markdown 渲染**，通过 `react-markdown` + `remark-gfm`

---

## 技术栈

| 层级 | 技术 |
|---|---|
| **前端** | React 19, TypeScript, Vite 7, Tailwind CSS v4, shadcn/ui, React Router v7 |
| **后端** | Node.js, Express.js 4 |
| **数据库** | MongoDB (Mongoose 8) |
| **实时通信** | Socket.IO 4（服务端 + 客户端） |
| **身份验证** | JSON Web Tokens (jsonwebtoken), bcryptjs |
| **AI** | 智谱 GLM |
| **文件存储** | 七牛云（预签名 POST 上传） |
| **邮件** | Nodemailer (Gmail SMTP) — OTP 登录、邮箱验证、消息通知 |
| **容器化** | Docker, Docker Compose |

---

## 项目结构

```
conversa/
├── docker-compose.yml                 # 编排 mongo + backend + frontend
├── .env.example                       # 所有环境变量模板
│
├── backend/
│   ├── Dockerfile
│   ├── index.js                       # Express 应用入口、HTTP 服务器、Socket.IO 初始化
│   ├── db.js                          # MongoDB 连接
│   ├── secrets.js                     # 环境变量导出
│   ├── Controllers/
│   │   ├── auth-controller.js         # 注册、登录、OTP 登录、获取当前用户、
│   │   │                              #   发送验证 OTP、验证邮箱
│   │   ├── conversation-controller.js # 创建、列表、获取、切换置顶
│   │   ├── message-controller.js      # 获取所有消息、删除、批量隐藏、收藏、清空、AI 流式
│   │   └── user-controller.js         # 更新资料、拉黑、七牛云预签名、用户搜索、
│   │                                  #   删除账户、获取拉黑状态
│   ├── Models/
│   │   ├── User.js                    # 完整用户模式（见数据模型）
│   │   ├── Conversation.js            # 成员、最新消息、未读计数
│   │   └── Message.js                 # 已读、隐藏自、软删除、收藏者、回复引用
│   ├── Routes/
│   │   ├── auth-routes.js
│   │   ├── conversation-routes.js
│   │   ├── message-routes.js
│   │   └── user-routes.js
│   ├── socket/
│   │   ├── index.js                   # Socket.IO 设置、JWT 认证中间件、用户 Socket 映射
│   │   └── handlers.js                # 所有 socket 事件处理器 + 邮件通知触发
│   ├── middleware/
│   │   └── fetchUser.js               # REST 路由的 JWT 验证中间件
│   ├── utils/
│   │   └── sendMessageEmail.js        # 离线消息邮件助手（即发即忘）
│   ├── jobs/
│   │   └── staleOnlineUsers.js        # 每小时清理过期的在线状态标志
│   └── scripts/
│       ├── seed-test-users.js
│       └── delete-test-users.js
│
└── frontend/
    ├── Dockerfile
    ├── nginx.conf                     # SPA 回退 + 资源缓存配置
    └── src/
        ├── App.tsx                    # 路由定义
        ├── pages/
        │   ├── Home.tsx
        │   ├── Login.tsx              # 密码 + OTP 登录标签页
        │   ├── SignUp.tsx
        │   ├── VerifyEmail.tsx        # 登录后邮箱验证关卡
        │   ├── Conversations.tsx
        │   ├── ConversationDetail.tsx # 聊天视图，支持流式机器人响应
        │   ├── StarredMessages.tsx
        │   ├── User.tsx               # 重定向助手
        │   └── UserProfile.tsx        # 资料、密码、外观、通知设置
        ├── components/
        │   ├── layout/
        │   │   ├── DashboardLayout.tsx  # 认证 + 邮箱验证守卫
        │   │   ├── ConversationLayout.tsx
        │   │   └── DashboardSidebar.tsx
        │   ├── dashboard/             # 聊天专用组件
        │   └── ui/                    # shadcn/ui 组件库
        ├── context/                   # AuthProvider, ChatProvider, ConversationsProvider
        ├── hooks/                     # use-auth, use-chat, use-conversations, use-socket
        └── lib/
            ├── api.ts                 # 集中式 HTTP 客户端
            └── socket.ts              # Socket.IO 客户端设置
```

---

## 架构概览

```
浏览器 ──HTTP──▶  Express REST API  ──▶  MongoDB
     ──WS────▶  Socket.IO Server  ──▶  MongoDB
                                ──▶  Gmail SMTP（离线邮件通知）

Socket.IO 认证
  每个 socket 连接在 handshake.auth.token 中提供 JWT。
  中间件验证令牌并附加 socket.userId。
  处理器从不信任任何客户端提供的用户 ID。

每用户 Socket 追踪
  userSocketMap: Map<userId, Set<socketId>>
  追踪跨多标签页和设备的所有打开连接。
  用户仅在其最后一个 socket 断开时标记为离线。

邮件通知管道
  send-message 事件 ──▶ 接收方没有打开的 socket？
                    ──▶ 接收方启用邮件通知？
                    ──▶ sendMessageEmail()（即发即忘，无 await）

AI 流式管道
  浏览器 ──send-message──▶  服务端检测到机器人成员
        ◀──bot-chunk───── 通过 Socket.IO 流式传输 GLM 块
        ◀──bot-done──────  最终保存的 Message 文档
```

---

## 数据模型

### User

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | String | 3–50 字符，必填 |
| `email` | String | 唯一，小写 |
| `password` | String | bcrypt 加密 |
| `about` | String | 简介/状态文字 |
| `profilePic` | String | URL；默认为 ui-avatars.com |
| `isOnline` | Boolean | socket 连接/断开时更新 |
| `lastSeen` | Date | 断开连接时设置 |
| `isEmailVerified` | Boolean | OTP 验证完成后设为 `true` |
| `emailNotificationsEnabled` | Boolean | 控制离线邮件通知；默认 `true` |
| `isBot` | Boolean | AI 机器人账户为 `true` |
| `otp` | String | bcrypt 加密的 OTP（登录 OTP 和邮箱验证共用） |
| `otpExpiry` | Date | OTP 过期时间戳 |
| `blockedUsers` | [ObjectId → User] | 该用户拉黑的用户 |
| `pinnedConversations` | [ObjectId → Conversation] | 置顶对话 ID |
| `isDeleted` | Boolean | 匿名化账户的软删除标志 |

### Conversation

| 字段 | 类型 | 说明 |
|---|---|---|
| `members` | [ObjectId → User] | 参与者（始终为 2 人） |
| `latestmessage` | String | 聊天列表预览文字 |
| `unreadCounts` | [{userId, count}] | 每成员未读计数器 |
| `timestamps` | auto | `createdAt`、`updatedAt` |

### Message

| 字段 | 类型 | 说明 |
|---|---|---|
| `conversationId` | ObjectId → Conversation | 必填 |
| `senderId` | ObjectId → User | 必填 |
| `text` | String | 无 `imageUrl` 时必填 |
| `imageUrl` | String | 无 `text` 时必填；七牛云 URL |
| `seenBy` | [{user, seenAt}] | 已读回执 |
| `hiddenFrom` | [ObjectId → User] | 对这些用户硬删除 |
| `softDeleted` | Boolean | `true` = 对所有人显示"已删除"占位符 |
| `starredBy` | [ObjectId → User] | 收藏此消息的用户 |
| `replyTo` | ObjectId → Message | 引用回复参考 |
| `timestamps` | auto | `createdAt`、`updatedAt` |

---

## REST API 参考

所有受保护路由需要请求头 `auth-token: <JWT>`。

### 身份验证 — `/auth`

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| `POST` | `/auth/register` | — | 创建账户 + 个人机器人 + 初始对话 |
| `POST` | `/auth/login` | — | 使用密码或 OTP 登录（`{ email, password }` 或 `{ email, otp }`） |
| `POST` | `/auth/getotp` | — | 发送 OTP 到邮箱用于 OTP 登录 |
| `GET` | `/auth/me` | ✅ | 获取已认证用户资料 |
| `POST` | `/auth/send-verification-otp` | ✅ | 向已登录用户邮箱发送 10 分钟有效验证 OTP |
| `POST` | `/auth/verify-email` | ✅ | 用 OTP 验证邮箱；设置 `isEmailVerified: true` |

### 对话 — `/conversation`

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| `POST` | `/conversation` | ✅ | 创建或获取对话 |
| `GET` | `/conversation` | ✅ | 列出所有对话（置顶优先，然后按 `updatedAt` 排序） |
| `GET` | `/conversation/:id` | ✅ | 获取单个对话 |
| `POST` | `/conversation/:id/pin` | ✅ | 切换对话置顶状态 |

### 消息 — `/message`

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| `GET` | `/message/starred` | ✅ | 获取当前用户收藏的所有消息 |
| `GET` | `/message/:id` | ✅ | 获取对话中所有消息（标记为已读） |
| `DELETE` | `/message/bulk/hide` | ✅ | 批量隐藏消息（`body: { messageIds }`） |
| `DELETE` | `/message/:id` | ✅ | 删除消息（`body: { scope: "me" \| "everyone" }`） |
| `POST` | `/message/clear/:conversationId` | ✅ | 清空整个聊天历史（仅对自己） |
| `POST` | `/message/:id/star` | ✅ | 切换消息收藏状态 |

### 用户 — `/user`

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| `PUT` | `/user/update` | ✅ | 更新资料（姓名、简介、头像、密码、邮件通知开关） |
| `GET` | `/user/online-status/:id` | ✅ | 获取用户在线状态 |
| `GET` | `/user/non-friends` | ✅ | 分页、可搜索、可排序的用户发现 |
| `GET` | `/user/presigned-url` | ✅ | 获取七牛云预签名 POST URL 用于图片上传 |
| `POST` | `/user/block/:id` | ✅ | 拉黑用户 |
| `DELETE` | `/user/block/:id` | ✅ | 取消拉黑用户 |
| `GET` | `/user/block-status/:id` | ✅ | 获取当前用户与目标用户的相互拉黑状态 |
| `DELETE` | `/user/delete` | ✅ | 软删除/匿名化已认证用户账户 |

#### `GET /user/non-friends` 查询参数

| 参数 | 默认值 | 选项 |
|---|---|---|
| `search` | `""` | 姓名或邮箱子串 |
| `sort` | `name_asc` | `name_asc`、`name_desc`、`last_seen_recent`、`last_seen_oldest` |
| `page` | `1` | 整数 ≥ 1 |
| `limit` | `20` | 1–50 |

---

## Socket.IO 事件

Socket 服务器需要在 `handshake.auth.token` 中传递有效的 JWT。

### 客户端 → 服务端

| 事件 | 载荷 | 说明 |
|---|---|---|
| `setup` | — | 加入个人房间；标记用户在线；通知好友 |
| `join-chat` | `{ roomId }` | 加入对话房间；重置未读计数；标记所有消息已读 |
| `leave-chat` | `roomId` | 离开对话房间 |
| `send-message` | `{ conversationId, text?, imageUrl?, replyTo? }` | 发送消息（或触发 AI 机器人响应） |
| `delete-message` | `{ messageId, conversationId, scope }` | 删除消息（`scope: "me" \| "everyone"`） |
| `typing` | `{ conversationId, typer, receiverId }` | 广播输入指示器 |
| `stop-typing` | `{ conversationId, typer, receiverId }` | 广播停止输入 |

### 服务端 → 客户端

| 事件 | 载荷 | 说明 |
|---|---|---|
| `user setup` | `userId` | 确认设置完成 |
| `user-joined-room` | `userId` | 另一用户进入对话房间 |
| `receive-message` | `Message` | 新消息投递到房间 |
| `new-message-notification` | `{ message, sender, conversation }` | 当不在聊天中时，推送到接收方个人房间 |
| `messages-seen` | `{ conversationId, seenBy, seenAt }` | 通知发送方消息已读 |
| `message-deleted` | `{ messageId, conversationId, softDeleted, latestmessage }` | scope="everyone" 时广播占位符；侧边栏预览更新 |
| `message-blocked` | `{ conversationId }` | 因拉黑拒绝消息 |
| `typing` | `{ conversationId, typer, receiverId? }` | 转发的输入指示器 |
| `stop-typing` | `{ conversationId, typer, receiverId? }` | 转发的停止输入指示器 |
| `user-online` | `{ userId }` | 联系人上线 |
| `user-offline` | `{ userId }` | 联系人离线 |
| `bot-chunk` | `{ conversationId, tempId, chunk }` | 流式 AI 响应文本块 |
| `bot-done` | `{ conversationId, tempId, message }` | AI 响应完成；`message` 为保存的文档 |
| `bot-error` | `{ conversationId, userMessageId? }` | AI 响应失败；提供回滚的消息 ID |

---

## 环境变量

项目根目录的单一 `.env` 文件用于 Docker Compose 和本地开发。复制 `.env.example` 为 `.env` 并填入你的值。

```env
# ── 数据库 ──────────────────────────────────────────────────────────────────
# Docker Compose 会自动覆盖指向 mongo 服务
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=conversa

# ── 身份验证 ────────────────────────────────────────────────────────────────
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRY=7d

# ── 邮件 (Gmail SMTP) ───────────────────────────────────────────────────────
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# ── 七牛云 ──────────────────────────────────────────────────────────────────
QINIU_ACCESS_KEY=your-access-key
QINIU_SECRET_KEY=your-secret-key
QINIU_BUCKET=your-bucket-name
QINIU_DOMAIN=https://your-domain.com

# ── 智谱 GLM AI ─────────────────────────────────────────────────────────────
GLM_API_KEY=your-glm-api-key

# ── 前端 ────────────────────────────────────────────────────────────────────
VITE_API_URL=http://localhost:5000
```

---

## 快速开始

### Docker（推荐）

1. **克隆仓库**
   ```bash
   git clone https://github.com/your-username/conversa.git
   cd conversa
   ```

2. **创建环境文件**
   ```bash
   cp .env.example .env
   ```
   编辑 `.env` 填入你的配置值。

3. **启动服务**
   ```bash
   docker-compose up -d
   ```

4. **访问应用**
   - 前端: http://localhost:5173
   - 后端 API: http://localhost:5000

### 手动部署（本地开发）

1. **克隆仓库**
   ```bash
   git clone https://github.com/your-username/conversa.git
   cd conversa
   ```

2. **安装依赖**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. **配置环境变量**
   ```bash
   cp .env.example .env
   ```
   编辑 `.env` 填入你的配置值。

4. **启动 MongoDB**（本地或使用 Docker）
   ```bash
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

5. **启动后端**
   ```bash
   cd backend
   npm run dev
   ```

6. **启动前端**
   ```bash
   cd frontend
   npm run dev
   ```

---

## 脚本命令

### 后端

| 命令 | 说明 |
|---|---|
| `npm start` | 生产模式启动 |
| `npm run dev` | 开发模式启动（nodemon） |
| `npm run seed` | 填充测试用户 |
| `npm run delete-test-users` | 删除测试用户 |

### 前端

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |

---

## 安全设计

- **密码** — bcrypt 加密，成本因子 10
- **JWT** — 存储在 `localStorage`，每次请求通过 `auth-token` 头发送
- **Socket.IO 认证** — 每次连接在握手时验证 JWT
- **输入验证** — 所有 API 输入经过验证和清理
- **CORS** — 配置允许的源
- **速率限制** — 防止暴力攻击（可配置）
- **七牛云预签名 URL** — 直接上传，凭证不经过服务器

---

## 后台任务

### 过期在线状态清理

每小时运行一次，为 `isOnline` 仍为 `true` 但在 `userSocketMap` 中无活跃 socket 的用户设置 `isOnline: false` 并更新 `lastSeen`。这用于从 `disconnect` 事件未触发的崩溃场景中恢复。

---

## 贡献

欢迎贡献！请提交 issue 或 pull request 来改进或修复问题。

**贡献步骤：**
1. Fork 仓库并为你的功能或修复创建新分支。
2. 进行修改并编写清晰的提交信息。
3. 确保所有测试通过且应用正常运行。
4. 提交 pull request，描述你的修改及为何应该合并。

## 许可证

MIT — 详见 [LICENSE](LICENSE) 文件。

---

## 关于作者

由 **Pankil Soni** 构建

- 邮箱: pmsoni2016@gmail.com
- LinkedIn: [pankil-soni-5a0541170](https://www.linkedin.com/in/pankil-soni-5a0541170/)
- Kaggle: [pankilsoni](https://www.kaggle.com/pankilsoni)
