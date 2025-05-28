# Cloudflare Workers 代理服务

一个基于Cloudflare Pages + Functions的动态代理转发服务，包含独立的客户端和服务端。客户端负责代理转发，服务端提供配置管理和Web界面。

## 🚀 项目特点

- **Pages + Functions架构**：基于Cloudflare Pages和Functions部署，享受全球CDN加速
- **独立部署**：客户端和服务端可独立部署和扩展
- **动态配置**：支持实时更新代理配置，无需重新部署
- **安全可靠**：加密存储配置数据，多层认证机制
- **易于管理**：现代化Web管理界面
- **零配置部署**：完全通过环境变量配置，无需修改代码文件
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
├── functions/                # 客户端Pages Functions
│   └── [[catchall]].js      # 代理转发入口
├── public/                   # 客户端静态资源
│   └── index.html           # 客户端首页
├── server/                   # 服务端代码（独立部署）
│   ├── admin/               # 管理界面
│   ├── config.js            # 配置管理
│   └── auth.js              # 认证模块
├── .github/workflows/        # 自动部署工作流
├── _routes.json             # 客户端路由配置
└── 📋 完整部署文档           # 详见下方链接
```

## 🛠️ 快速部署

> 💡 **零配置部署**：本项目支持完全通过环境变量配置，无需修改任何代码文件！

### 📋 部署文档

#### 客户端部署（代理转发）

- [📘 自动部署指南](./DEPLOYMENT.md) - GitHub Actions自动部署（推荐）
- [📗 手动部署指南](./MANUAL_DEPLOY.md) - 解决内部错误的备选方案

#### 服务端部署（配置管理）

- [📕 服务端部署指南](./SERVER_DEPLOY.md) - 完整的服务端部署步骤

### 🎯 部署概览

1. **客户端**：处理代理转发请求
   - 项目名：`cf-workers-proxy-new`
   - 根目录：`/`

2. **服务端**：提供配置管理界面
   - 项目名：`cf-workers-proxy-server`
   - 根目录：`server`

## ⚙️ 配置方式

### 客户端环境变量

| 配置方式 | 环境变量 | 说明 |
|---------|----------|------|
| **连接服务端（推荐）** | `SERVER_URL`<br>`SECRET_KEY`<br>`SERVICE_KEY` | 从服务端动态获取配置 |
| **直接代理** | `PROXY_URL`<br>`UPDATE_INTERVAL` | 直接配置代理目标 |
| **可选配置** | `DEBUG_MODE`<br>`PROXY_CACHE_KV_ID` | 调试模式和KV缓存 |

### 服务端环境变量

| 变量名 | 说明 |
|-------|------|
| `SECRET_KEYS` | 客户端访问密钥（逗号分隔） |
| `ADMIN_KEY` | 管理员登录密钥 |
| `ENCRYPTION_KEY` | 配置数据加密密钥 |
| `MAX_REQUESTS_PER_MINUTE` | 请求频率限制 |

## 🎯 使用示例

### 1. 访问管理界面

```
https://cf-workers-proxy-server.pages.dev/admin
```

### 2. 配置代理规则

- 服务标识：`my-service`
- 代理目标：`https://api.example.com`

### 3. 使用代理服务

```
# 所有请求自动转发到目标API
curl https://cf-workers-proxy-new.pages.dev/path/to/api
```

### 4. 健康检查

```
https://cf-workers-proxy-new.pages.dev/api/health
```

## 🔧 高级功能

- **动态配置**：无需重启即可更新代理规则
- **负载均衡**：支持多个后端服务器
- **请求限流**：防止滥用和攻击
- **访问日志**：详细的请求记录和分析
- **自定义域名**：支持绑定自己的域名

## 🔒 安全特性

- **加密存储**：所有配置数据加密保存
- **多层认证**：API密钥 + 管理员密钥
- **CORS支持**：灵活的跨域配置
- **请求验证**：防止恶意请求
- **自动HTTPS**：强制SSL/TLS加密

## 📊 性能优势

- **全球CDN**：基于Cloudflare的全球网络
- **边缘计算**：就近处理用户请求
- **智能缓存**：自动缓存优化
- **零冷启动**：Pages Functions即时响应

## 🆚 与传统方案对比

| 特性 | 本项目 | 传统反向代理 |
|------|-------|-------------|
| 部署复杂度 | ⭐ 极简 | ⭐⭐⭐ 复杂 |
| 运维成本 | ⭐ 免费额度 | ⭐⭐⭐ 需要服务器 |
| 性能 | ⭐⭐⭐ 全球CDN | ⭐⭐ 单点服务 |
| 扩展性 | ⭐⭐⭐ 自动扩容 | ⭐⭐ 手动扩容 |
| 稳定性 | ⭐⭐⭐ 99.9%+ | ⭐⭐ 依赖运维 |

## 📚 文档导航

- [📘 完整部署指南](./DEPLOYMENT.md) - 客户端+服务端一站式部署
- [🔧 故障排除指南](./TROUBLESHOOTING.md) - 问题解决和手动部署
- [📋 项目设计文档](./docs/design.md) - 开发者技术文档

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
- [项目在线演示](https://cf-workers-proxy-new.pages.dev)
- [GitHub 仓库](https://github.com/Await-d/cloudflare-workers-proxy)

---

## 🎉 从传统Workers迁移

如果您之前使用传统Workers部署，可以很容易迁移到Pages+Functions：

1. 代码无需大幅修改，现有的服务端逻辑可以直接复用
2. 将环境变量和KV绑定迁移到Pages项目
3. 使用GitHub Actions实现自动部署

迁移后您将获得更好的开发体验和部署流程！
