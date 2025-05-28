# 🛠️ 手动部署指南

如果GitHub Actions遇到内部错误，请按照以下步骤手动部署：

## 方法一：重新创建Pages项目

### 1. 删除现有项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 Pages 部分
3. 删除现有的 `cloudflare-workers-proxy-client` 或 `cf-workers-proxy` 项目

### 2. 创建新项目

1. 点击 "Create a project"
2. 选择 "Connect to Git"
3. 选择你的GitHub仓库：`cloudflare-workers-proxy`
4. 配置构建设置：
   - **项目名称**: `cf-workers-proxy-new`
   - **生产分支**: `master`
   - **构建命令**: 留空
   - **构建输出目录**: 留空
   - **根目录**: `/`

### 3. 完成部署

点击 "Save and Deploy"，Pages会自动：

- 检测 `functions/` 目录
- 部署 `functions/[[catchall]].js` 作为函数
- 服务 `public/` 目录中的静态文件

### 4. 配置环境变量

部署成功后，在项目设置中添加环境变量：

```
# 方式一：连接服务端（推荐）
SERVER_URL=https://your-server.workers.dev
SECRET_KEY=your-secret-key
SERVICE_KEY=your-service-key

# 方式二：直接代理
PROXY_URL=https://api.example.com
UPDATE_INTERVAL=3600

# 可选配置
DEBUG_MODE=false
```

## 方法二：命令行部署

### 1. 安装Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 2. 部署项目

```bash
wrangler pages deploy . --project-name=cf-workers-proxy-manual
```

### 3. 设置环境变量

```bash
wrangler pages secret put SERVER_URL --project-name=cf-workers-proxy-manual
wrangler pages secret put SECRET_KEY --project-name=cf-workers-proxy-manual
wrangler pages secret put SERVICE_KEY --project-name=cf-workers-proxy-manual
```

## 验证部署

访问你的域名：

- 首页：`https://cf-workers-proxy-new.pages.dev`
- 健康检查：`https://cf-workers-proxy-new.pages.dev/api/health`

## 常见问题

### Q: 为什么会出现内部错误？

A: 可能的原因：

- Cloudflare服务临时问题
- 项目配置缓存冲突
- 项目名称冲突

### Q: 如何避免再次出现？

A: 建议：

- 使用新的项目名称
- 重新创建而不是更新现有项目
- 避免频繁更改配置

### Q: 可以联系支持吗？

A: 可以通过 <https://cfl.re/3WgEyrH> 联系Cloudflare支持
