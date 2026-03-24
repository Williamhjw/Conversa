# Conversa 部署指南

## 📋 部署架构

```
用户 → Render 前端 → Render 后端 → MongoDB Atlas
```

## 🔧 已修改的文件

### 前端配置
1. **`frontend/src/lib/api.ts`** - API 地址配置
   - 本地开发：`http://localhost:5500`
   - 生产环境：使用相对路径（空字符串）

2. **`frontend/src/lib/socket.ts`** - Socket.IO 配置
   - 本地开发：`http://localhost:5500`
   - 生产环境：使用当前域名

### 后端配置
1. **`backend/index.js`** - 服务器启动逻辑
   - 端口：`process.env.PORT || 10000`
   - 监听地址：`0.0.0.0`
   - 数据库连接失败不退出

2. **`backend/db.js`** - 数据库连接
   - 添加超时配置
   - 连接失败不退出进程

3. **`backend/Routes/leetcode-routes.js`** - 修复路径大小写

## 🚀 部署步骤

### 第一步：准备 MongoDB Atlas

1. 访问 https://www.mongodb.com/atlas/database
2. 创建免费集群
3. 创建数据库用户
4. 允许所有 IP 访问（0.0.0.0/0）
5. 获取连接字符串

### 第二步：部署后端

1. 在 Render 创建 **New Web Service**
2. 连接 GitHub 仓库
3. 配置：

| 设置 | 值 |
|------|-----|
| **Name** | `conversa-backend` |
| **Runtime** | `Node` |
| **Build Command** | `cd backend && npm install` |
| **Start Command** | `cd backend && npm start` |
| **Root Directory** | 留空 |

4. 环境变量：

| 变量 | 值 |
|------|-----|
| `MONGO_URI` | MongoDB 连接字符串 |
| `MONGO_DB_NAME` | `conversa` |
| `JWT_SECRET` | 强密钥（openssl rand -base64 32） |
| `CORS_ORIGIN` | `*` 或前端地址 |
| `PORT` | `10000` |

### 第三步：部署前端

1. 在 Render 创建 **New Static Site**
2. 连接同一个 GitHub 仓库
3. 配置：

| 设置 | 值 |
|------|-----|
| **Name** | `conversa-frontend` |
| **Build Command** | `cd frontend && npm install && npm run build` |
| **Publish Directory** | `frontend/dist` |
| **Root Directory** | 留空 |

4. 环境变量：

| 变量 | 值 |
|------|-----|
| `VITE_API_URL` | 后端地址（如 `https://conversa-backend-xxx.onrender.com`） |

### 第四步：更新 CORS

后端部署成功后，更新前端环境变量：

```
VITE_API_URL=https://你的后端地址.onrender.com
```

然后更新后端 CORS：

```
CORS_ORIGIN=https://你的前端地址.onrender.com
```

## 📝 本地开发

本地开发不受影响，直接运行：

```bash
# 后端
cd backend
npm install
npm run dev

# 前端
cd frontend
npm install
npm run dev
```

## ⚠️ 注意事项

1. **图片上传功能**：线上不可用（需要持久化存储）
2. **Socket.IO**：需要确保后端和前端在同一区域
3. **冷启动**：免费版有冷启动延迟（约30秒）
4. **数据库**：确保 MongoDB Atlas 允许所有 IP 访问

## 🔍 故障排查

### 后端启动失败
- 检查 `MONGO_URI` 是否正确
- 检查 MongoDB Atlas 是否允许所有 IP

### 前端无法连接后端
- 检查 `VITE_API_URL` 是否正确
- 检查后端 CORS 配置

### Socket.IO 连接失败
- 确保前端使用正确的后端地址
- 检查后端是否正常运行
