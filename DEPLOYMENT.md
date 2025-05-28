# 🚀 零配置部署指南

这个项目支持完全通过环境变量配置，无需修改任何代码文件即可部署。

## 📋 前置要求

- GitHub 账户
- Cloudflare 账户
- Cloudflare API Token

## 🎯 客户端部署（代理转发）

### 第一步：Fork 仓库

1. 访问 [GitHub 仓库](https://github.com/Await-d/cloudflare-workers-proxy)
2. 点击 "Fork" 按钮 Fork 到你的账户

### 第二步：设置 GitHub Secrets

在你的仓库中设置以下 Secrets（Settings > Secrets and Variables > Actions）：

```
CLOUDFLARE_API_TOKEN=你的API Token
CLOUDFLARE_ACCOUNT_ID=你的账户ID
```

### 第三步：推送代码触发部署

```bash
git push origin main
```

GitHub Actions 会自动部署到 Cloudflare Pages。

### 第四步：配置环境变量

部署完成后，在 Cloudflare Dashboard 的 Pages 项目设置中添加环境变量：

#### 方式一：从服务端获取配置（推荐）

```
SERVER_URL=https://your-server.workers.dev
SECRET_KEY=your-secret-key
SERVICE_KEY=your-service-key
```

#### 方式二：直接配置代理地址

```
PROXY_URL=https://api.example.com
UPDATE_INTERVAL=3600
```

#### 可选配置

```
# 调试模式
DEBUG_MODE=false

# KV 缓存（可选）
PROXY_CACHE_KV_ID=your-kv-namespace-id
PROXY_CACHE_KV_PREVIEW_ID=your-preview-kv-id
```

## 🔧 服务端部署（配置管理）

### 传统 Workers 部署

1. 使用 `server/` 目录下的代码
2. 按照 `server/README.md` 的说明部署

### Pages 部署

1. 创建新的 Pages 项目
2. 设置根目录为 `server`
3. 参考 `server-pages/README.md` 进行配置

## ✅ 部署验证

### 检查客户端状态

访问你的客户端域名：

- 首页：`https://your-client.pages.dev`
- 健康检查：`https://your-client.pages.dev/api/health`

### 检查配置状态

在首页可以看到：

- ✅ 配置状态
- ✅ 配置来源
- ✅ KV 状态
- ✅ 调试模式

## 🔄 配置更新

只需在 Cloudflare Dashboard 的 Pages 设置中修改环境变量，无需重新部署代码。

## 🎉 优势

- ✅ **完全零配置**：移除所有wrangler.toml文件，避免配置冲突
- ✅ **安全性**：敏感信息不会出现在代码中
- ✅ **灵活性**：支持多种配置方式
- ✅ **易于维护**：配置集中管理
- ✅ **自动部署**：GitHub Actions 自动化
- ✅ **避免冲突**：Pages自动检测Functions，无需手动配置

## ❓ 常见问题

### Q: 如何获取 Cloudflare API Token？

A: 访问 Cloudflare Dashboard > My Profile > API Tokens > Create Token

### Q: 如何找到 Account ID？

A: 在 Cloudflare Dashboard 右侧边栏可以找到

### Q: 支持哪些配置方式？

A: 支持服务端API、环境变量直接配置、KV存储三种方式

### Q: 如何创建 KV 命名空间？

A: 使用命令 `wrangler kv:namespace create "PROXY_CACHE"`

### Q: 配置错误如何调试？

A: 设置 `DEBUG_MODE=true` 并查看健康检查接口的详细信息
