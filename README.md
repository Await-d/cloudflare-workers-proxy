# Cloudflare Workers 代理服务

一个基于Cloudflare Workers的动态代理转发服务，包含客户端和服务端两个部分。系统允许用户通过服务端配置不同的代理地址，客户端能够动态读取这些配置进行代理转发。

## 项目特点

- **全Worker架构**：客户端和服务端都基于Cloudflare Workers部署
- **动态配置**：支持实时更新代理配置，无需重新部署
- **安全可靠**：加密存储配置数据，多层认证机制
- **易于管理**：提供现代化Web管理界面
- **高可用性**：基于Cloudflare的全球CDN网络

## 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   客户端请求     │───▶│   客户端Worker   │───▶│   目标服务器     │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │                 │
                       │   服务端Worker   │
                       │   (配置管理)     │
                       │                 │
                       └─────────────────┘
```

## 项目结构

```
cloudflare-workers-proxy/
├── client/                    # 客户端Worker代码
│   ├── index.js              # 主入口文件
│   ├── config.js             # 配置处理模块
│   ├── cache.js              # 缓存管理模块
│   ├── error.js              # 错误处理模块
│   ├── wrangler.toml         # 客户端部署配置
│   └── README.md             # 客户端文档
│
├── server/                   # 服务端Worker代码
│   ├── index.js              # 主入口文件
│   ├── config.js             # 配置管理模块
│   ├── auth.js               # 认证授权模块
│   ├── crypto.js             # 加密解密工具
│   ├── admin/                # 管理界面
│   │   ├── index.js          # 管理界面入口
│   │   ├── api.js            # 管理API
│   │   └── ui.js             # UI组件
│   ├── wrangler.toml         # 服务端部署配置
│   └── README.md             # 服务端文档
│
├── .cursor/                  # Cursor规则配置
│   └── rules/
│       ├── project-guide.mdc
│       ├── implementation-guide.mdc
│       └── directory-structure.mdc
│
├── cloudflare-workers-proxy.md  # 需求文档
└── README.md                    # 项目总体文档
```

## 快速开始

### 1. 部署服务端

```bash
cd server

# 安装Wrangler CLI
npm install -g wrangler

# 登录Cloudflare
wrangler login

# 创建KV命名空间
wrangler kv:namespace create "SERVICE_CONFIGS"

# 更新wrangler.toml中的KV命名空间ID
# 设置环境变量
wrangler secret put SECRET_KEYS      # 客户端访问密钥列表
wrangler secret put ADMIN_KEY        # 管理员密钥
wrangler secret put ENCRYPTION_KEY   # 加密密钥

# 部署服务端
wrangler deploy
```

### 2. 配置服务

1. 访问服务端Worker的URL
2. 使用管理员密钥登录
3. 添加服务配置（服务标识、代理URL等）

### 3. 部署客户端

```bash
cd client

# 创建KV命名空间
wrangler kv:namespace create "PROXY_CACHE"

# 更新wrangler.toml中的配置
# 设置环境变量
wrangler secret put SECRET_KEY       # 访问密钥（与服务端匹配）

# 部署客户端
wrangler deploy
```

## 主要功能

### 客户端功能

- ✅ 动态代理转发
- ✅ 配置自动更新
- ✅ 缓存回退策略
- ✅ 错误处理与日志
- ✅ 请求重试机制

### 服务端功能

- ✅ 代理配置管理
- ✅ 用户认证与授权
- ✅ Web管理界面
- ✅ 配置数据加密
- ✅ 请求频率限制

## 配置说明

### 客户端环境变量

| 变量名 | 说明 | 必需 |
|--------|------|------|
| SERVICE_CONFIG_URL | 服务端API地址 | ✅ |
| SECRET_KEY | 访问密钥 | ✅ |
| SERVICE_KEY | 服务标识 | ✅ |
| UPDATE_INTERVAL | 配置更新间隔(秒) | ❌ |
| DEBUG_MODE | 调试模式 | ❌ |

### 服务端环境变量

| 变量名 | 说明 | 必需 |
|--------|------|------|
| SECRET_KEYS | 客户端访问密钥列表 | ✅ |
| ADMIN_KEY | 管理员密钥 | ✅ |
| ENCRYPTION_KEY | 配置加密密钥 | ✅ |
| MAX_REQUESTS_PER_MINUTE | 请求频率限制 | ❌ |

## 使用场景

1. **API代理**：为不同的API服务提供统一的代理入口
2. **负载均衡**：动态切换后端服务器
3. **A/B测试**：根据配置将流量分配到不同版本
4. **故障转移**：当主服务不可用时自动切换到备用服务
5. **开发环境**：快速切换不同的开发/测试环境

## 安全特性

- 🔐 密钥认证机制
- 🔐 配置数据加密存储
- 🔐 HTTPS强制传输
- 🔐 请求频率限制
- 🔐 访问日志记录

## 监控与运维

- 📊 Cloudflare Dashboard监控
- 📊 Worker运行状态查看
- 📊 请求日志分析
- 📊 错误率统计

## 贡献指南

1. Fork本项目
2. 创建功能分支
3. 提交变更
4. 创建Pull Request

## 许可证

MIT License

## 相关链接

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [项目需求文档](./cloudflare-workers-proxy.md)
