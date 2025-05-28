# Cloudflare Workers 代理服务 - 服务端 Pages 部署

这是服务端的 Cloudflare Pages + Functions 部署版本。

## 🚀 快速部署

### 1. 创建新的 Pages 项目

1. 在 Cloudflare Dashboard 中创建新的 Pages 项目
2. 连接到您的 GitHub 仓库
3. 设置构建配置：
   - 构建命令：留空
   - 构建输出目录：`server`
   - 根目录：`server`

### 2. 配置环境变量

在 Pages 项目设置中添加以下环境变量：

```
SECRET_KEYS=key1,key2,key3
ADMIN_KEY=your-admin-key
ENCRYPTION_KEY=your-encryption-key
MAX_REQUESTS_PER_MINUTE=60
```

### 3. 创建 KV 命名空间

```bash
wrangler kv:namespace create "SERVICE_CONFIGS"
```

然后在 Pages 项目设置中绑定 KV 命名空间：

- 变量名：`SERVICE_CONFIGS`
- KV 命名空间：选择刚创建的命名空间

### 4. 部署

推送代码到 GitHub，Pages 会自动部署。

## 📁 文件结构

需要在 `server` 目录下创建以下文件：

```
server/
├── _worker.js          # Pages Functions 入口
├── _routes.json        # 路由配置
├── wrangler.toml       # 部署配置
├── admin/              # 管理界面代码
├── config.js           # 配置管理
├── auth.js             # 认证模块
└── ...                 # 其他服务端文件
```

## 🔧 配置说明

### _worker.js

服务端的 Pages Functions 入口文件，处理：

- 管理界面路由 (`/admin/*`)
- 配置 API (`/api/config`)
- 推送 API (`/api/push-config`, `/api/sync-config`)

### _routes.json

定义哪些路径使用 Functions 处理：

```json
{
  "version": 1,
  "include": ["/api/*", "/admin/*", "/"],
  "exclude": ["/static/*", "/*.ico", "/*.png"]
}
```

## 🌐 访问地址

部署完成后，您可以通过以下地址访问：

- 管理界面：`https://your-server.pages.dev/admin`
- 配置 API：`https://your-server.pages.dev/api/config`
- 推送 API：`https://your-server.pages.dev/api/push-config`

## 🔗 与客户端连接

客户端可以通过以下环境变量连接到服务端：

```
SERVER_URL=https://your-server.pages.dev
SECRET_KEY=your-secret-key
SERVICE_KEY=your-service-key
```

## 📝 注意事项

1. 服务端和客户端应该部署为独立的 Pages 项目
2. 确保正确配置所有必需的环境变量
3. KV 命名空间需要正确绑定
4. 定期备份重要的配置数据
