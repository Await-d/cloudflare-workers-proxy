# Cloudflare Workers 代理服务

一个基于Cloudflare Pages + Functions的动态代理转发服务，包含独立的客户端和服务端。客户端负责代理转发，服务端提供配置管理和Web界面。

## 🚀 项目特点

- **Pages + Functions架构**：基于Cloudflare Pages和Functions部署，享受全球CDN加速
- **独立部署**：客户端和服务端可独立部署和扩展
- **动态配置**：支持实时更新代理配置，无需重新部署
- **安全可靠**：加密存储配置数据，多层认证机制
- **易于管理**：现代化Web管理界面
- **自动部署**：通过GitHub Actions自动部署到Cloudflare Pages
- **高可用性**：基于Cloudflare的全球网络

## 📋 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   客户端请求     │───▶│   客户端Pages    │───▶│   目标服务器     │
│                 │    │   (代理转发)     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼ 获取配置
                       ┌─────────────────┐
                       │                 │
                       │   服务端Pages    │
                       │   (配置管理)     │
                       │                 │
                       └─────────────────┘
```

## 📁 项目结构

```
cloudflare-workers-proxy/
├── .github/workflows/         # GitHub Actions 自动部署
│   └── deploy.yml            # 客户端部署工作流
├── public/                   # 客户端静态资源
│   └── index.html           # 客户端首页
├── server/                   # 服务端代码（独立部署）
│   ├── admin/               # 管理界面
│   ├── config.js            # 配置管理
│   ├── auth.js              # 认证模块
│   └── README.md            # 服务端部署说明
├── server-pages/             # 服务端Pages部署说明
│   └── README.md            # 服务端Pages部署指南
├── _worker.js               # 客户端Pages Functions入口
├── _routes.json             # 客户端路由配置
├── wrangler.toml           # 客户端部署配置
└── README.md               # 项目总体文档
```

## 🛠️ 快速部署

> 💡 **零配置部署**：本项目支持完全通过环境变量配置，无需修改任何代码文件！

📋 **部署文档**：

- [客户端自动部署](./DEPLOYMENT.md) - GitHub Actions自动部署
- [客户端手动部署](./MANUAL_DEPLOY.md) - 解决内部错误的备选方案
- [服务端部署指南](./SERVER_DEPLOY.md) - 配置管理服务部署

### 方法一：GitHub Actions 自动部署（推荐）

1. **Fork 此仓库**到您的GitHub账户

2. **设置仓库密钥**：
   在GitHub仓库的 Settings > Secrets and Variables > Actions 中添加：

   ```
   CLOUDFLARE_API_TOKEN=你的Cloudflare API Token
   CLOUDFLARE_ACCOUNT_ID=你的Cloudflare账户ID
   ```

3. **推送代码**：
   - Fork 仓库后直接推送到 GitHub
   - GitHub Actions 自动部署到 Cloudflare Pages
   - **完全零配置**：项目移除了 wrangler.toml，避免配置冲突

4. **配置环境变量**：
   在Cloudflare Dashboard的Pages项目设置中添加：

   **方式一：连接服务端（推荐）**

   ```
   SERVER_URL=https://your-server.workers.dev
   SECRET_KEY=your-secret-key
   SERVICE_KEY=your-service-key
   ```

   **方式二：直接代理配置**

   ```
   PROXY_URL=https://api.example.com
   UPDATE_INTERVAL=3600
   ```

   **可选：KV缓存**

   ```
   PROXY_CACHE_KV_ID=your-kv-namespace-id
   ```

### 方法二：本地部署

1. **安装依赖**：

   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. **创建KV命名空间**：

   ```bash
   wrangler kv:namespace create "SERVICE_CONFIGS"
   ```

3. **更新配置文件**：

   ```bash
   # 更新 wrangler.toml 中的 KV 命名空间 ID
   ```

4. **设置环境变量**：

   ```bash
   wrangler secret put SECRET_KEYS
   wrangler secret put ADMIN_KEY  
   wrangler secret put ENCRYPTION_KEY
   ```

5. **部署到Pages**：

   ```bash
   wrangler pages deploy ./ --project-name=cloudflare-workers-proxy
   ```

## 🎯 使用说明

### 管理界面

1. 访问部署后的域名（如：`https://cloudflare-workers-proxy.pages.dev`）
2. 点击"管理控制台"或直接访问 `/admin`
3. 使用管理员密钥登录
4. 在界面中管理代理配置

### API使用

#### 获取配置

```bash
curl -H "Authorization: Bearer YOUR_SECRET_KEY" \
     -H "X-Service-Key: your-service" \
     https://your-domain.pages.dev/api/config
```

#### 推送配置

```bash
curl -X POST https://your-domain.pages.dev/api/push-config \
     -H "Authorization: Bearer YOUR_SECRET_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "serviceKey": "my-service",
       "proxyURL": "https://api.example.com"
     }'
```

#### 代理请求

```bash
# 所有请求会自动代理到配置的目标地址
curl https://your-domain.pages.dev/proxy/api/data
```

## ⚙️ 环境变量配置

### 客户端环境变量

| 变量名 | 类型 | 说明 | 示例值 |
|--------|------|------|--------|
| **方式一：服务端连接** | | | |
| SERVER_URL | Variable | 服务端API地址 | <https://server.workers.dev> |
| SECRET_KEY | Secret | 访问服务端的密钥 | your-secret-key |
| SERVICE_KEY | Variable | 服务标识 | my-service |
| **方式二：直接代理** | | | |
| PROXY_URL | Variable | 代理目标地址 | <https://api.example.com> |
| UPDATE_INTERVAL | Variable | 配置更新间隔（秒） | 3600 |
| **可选配置** | | | |
| DEBUG_MODE | Variable | 调试模式 | false |
| PROXY_CACHE_KV_ID | Variable | KV命名空间ID | xxxx-xxxx-xxxx |

### 服务端环境变量

| 变量名 | 类型 | 说明 | 示例值 |
|--------|------|------|--------|
| SECRET_KEYS | Secret | 客户端访问密钥（逗号分隔） | key1,key2,key3 |
| ADMIN_KEY | Secret | 管理员密钥 | admin-secret-key |
| ENCRYPTION_KEY | Secret | 配置加密密钥 | encryption-secret-key |
| MAX_REQUESTS_PER_MINUTE | Variable | 请求频率限制 | 60 |

## 🔧 高级配置

### 自定义域名

1. 在Cloudflare Dashboard中添加自定义域名
2. 配置DNS解析到Pages项目
3. 启用SSL/TLS加密

### 监控和日志

- 在Cloudflare Dashboard中查看实时日志
- 使用Web Vitals监控性能
- 配置告警规则

## 🆚 与传统Workers部署的对比

| 特性 | Pages + Functions | 传统 Workers |
|------|------------------|-------------|
| 部署方式 | Git自动部署 | 手动部署 |
| 静态资源 | 原生支持 | 需要额外处理 |
| 版本控制 | 自动版本管理 | 手动管理 |
| 预览环境 | 自动预览 | 需要手动创建 |
| 域名管理 | 简化流程 | 复杂配置 |

## 🔒 安全考虑

- 所有敏感数据都通过环境变量或KV存储加密保存
- 支持CORS配置和请求频率限制
- 自动HTTPS和安全头设置

## 📊 性能优化

- 基于Cloudflare全球网络的CDN加速
- 自动缓存静态资源
- 智能路由和负载均衡

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

基于 MIT 许可证开源 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🔗 相关链接

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Cloudflare Functions 文档](https://developers.cloudflare.com/pages/platform/functions/)
- [项目在线演示](https://cloudflare-workers-proxy.pages.dev)
- [GitHub 仓库](https://github.com/Await-d/cloudflare-workers-proxy)

---

## 🎉 从传统Workers迁移

如果您之前使用传统Workers部署，可以很容易迁移到Pages+Functions：

1. 代码无需大幅修改，现有的服务端逻辑可以直接复用
2. 将环境变量和KV绑定迁移到Pages项目
3. 使用GitHub Actions实现自动部署

迁移后您将获得更好的开发体验和部署流程！
