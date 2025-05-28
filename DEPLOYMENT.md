# 🚀 完整部署指南

本项目支持完全通过环境变量配置，实现零配置文件修改的部署。

## 📋 部署架构

```
客户端 (cf-workers-proxy-new)     服务端 (cf-workers-proxy-server)
        ↓                                    ↓
   代理转发服务              ←→            配置管理服务
```

## 🎯 第一部分：客户端部署（代理转发）

### 前置要求

- GitHub 账户
- Cloudflare 账户  
- Cloudflare API Token

### 方法一：GitHub Actions 自动部署（推荐）

#### 1. Fork 仓库

1. 访问 [GitHub 仓库](https://github.com/Await-d/cloudflare-workers-proxy)
2. 点击 "Fork" 按钮 Fork 到你的账户

#### 2. 设置 GitHub Secrets

在你的仓库中设置以下 Secrets（Settings > Secrets and Variables > Actions）：

```
CLOUDFLARE_API_TOKEN=你的API Token
CLOUDFLARE_ACCOUNT_ID=你的账户ID
```

> **获取方法**：
>
> - API Token: Cloudflare Dashboard > My Profile > API Tokens > Create Token
> - Account ID: Cloudflare Dashboard 右侧边栏

#### 3. 推送代码触发部署

```bash
git push origin main
```

GitHub Actions 会自动部署到 Cloudflare Pages。

#### 4. 配置客户端环境变量

部署完成后，在 Cloudflare Dashboard 的 Pages 项目设置中添加环境变量：

**方式一：连接服务端（推荐）**

```
SERVER_URL=https://cf-workers-proxy-server.pages.dev
SECRET_KEY=your-secret-key
SERVICE_KEY=my-service
```

**方式二：直接代理**

```
PROXY_URL=https://api.example.com
UPDATE_INTERVAL=3600
```

**可选配置**

```
DEBUG_MODE=false
PROXY_CACHE_KV_ID=your-kv-namespace-id
```

### 方法二：手动创建Pages项目

1. **创建Pages项目**：
   - 登录 Cloudflare Dashboard > Pages
   - 点击 "Create a project" > "Connect to Git"
   - 选择你的GitHub仓库
   - 项目名称：`cf-workers-proxy-new`
   - 根目录：`/` （留空）
   - 构建命令：留空
   - 构建输出目录：留空

2. **部署验证**：
   - 访问：`https://cf-workers-proxy-new.pages.dev`
   - 健康检查：`https://cf-workers-proxy-new.pages.dev/api/health`

## 🎯 第二部分：服务端部署（配置管理）

### 1. 创建服务端Pages项目

1. **登录Cloudflare Dashboard** > Pages
2. **点击 "Create a project"**
3. **选择 "Connect to Git"**
4. **选择GitHub仓库**：`cloudflare-workers-proxy` （同一个仓库）
5. **配置构建设置**：
   - 📛 **项目名称**: `cf-workers-proxy-server`
   - 📛 **生产分支**: `master`
   - 📛 **构建命令**: 留空
   - 📛 **构建输出目录**: 留空
   - 📛 **根目录**: `server` ⚠️ **重要：必须设置为 server**

6. **点击 "Save and Deploy"**

### 2. 创建KV命名空间

1. **创建KV命名空间**：
   - 进入 **Workers & Pages** > **KV**
   - 点击 **"Create a namespace"**
   - 命名空间名称：`SERVICE_CONFIGS`
   - 点击 **"Add"**

2. **绑定到服务端项目**：
   - 回到服务端Pages项目（`cf-workers-proxy-server`）
   - 进入 **Settings** > **Functions**
   - 在 **KV namespace bindings** 部分添加：
     - 变量名：`SERVICE_CONFIGS`
     - KV 命名空间：选择 `SERVICE_CONFIGS`
   - 点击 **"Save"**

### 3. 配置服务端环境变量

在服务端项目的 **Settings** > **Environment variables** 中添加：

```
SECRET_KEYS=key1,key2,key3
ADMIN_KEY=your-admin-key
ENCRYPTION_KEY=your-encryption-key
MAX_REQUESTS_PER_MINUTE=60
```

**重要说明**：

- `SECRET_KEYS`：客户端访问服务端的密钥（逗号分隔多个）
- `ADMIN_KEY`：管理员登录密钥
- `ENCRYPTION_KEY`：配置数据加密密钥
- 这些都是敏感信息，请使用强密码

### 4. 验证服务端部署

访问服务端地址：

- **管理界面**：`https://cf-workers-proxy-server.pages.dev/admin`
- **配置API**：`https://cf-workers-proxy-server.pages.dev/api/config`

## 🔗 第三部分：连接客户端和服务端

### 更新客户端环境变量

回到客户端项目（`cf-workers-proxy-new`），在环境变量中添加：

```
SERVER_URL=https://cf-workers-proxy-server.pages.dev
SECRET_KEY=key1
SERVICE_KEY=my-service
```

**说明**：

- `SERVER_URL`：服务端的完整URL
- `SECRET_KEY`：必须是服务端 `SECRET_KEYS` 中的一个
- `SERVICE_KEY`：服务标识，用于区分不同的代理服务

### 配置代理规则

1. **访问服务端管理界面**：

   ```
   https://cf-workers-proxy-server.pages.dev/admin
   ```

2. **使用管理员密钥登录**（`ADMIN_KEY`）

3. **添加代理配置**：
   - 服务标识：`my-service`
   - 代理目标：`https://api.example.com`
   - 其他配置项

4. **验证客户端连接**：

   ```
   https://cf-workers-proxy-new.pages.dev/api/health
   ```

## ✅ 部署验证

### 客户端状态检查

访问客户端域名，首页应该显示：

- ✅ 代理配置已加载
- ✅ 配置来源：服务端API
- ✅ KV状态：正常
- ✅ 调试模式：关闭

### 服务端功能检查

1. **管理界面**可以：
   - ✅ 正常登录
   - ✅ 添加/修改配置

2. **代理功能**正常：
   - 所有请求被正确转发到目标API

### 完整测试流程

```bash
# 1. 测试客户端健康状态
curl https://cf-workers-proxy-new.pages.dev/api/health

# 2. 测试代理转发
curl https://cf-workers-proxy-new.pages.dev/your-api-path

# 3. 测试服务端API
curl -H "Authorization: Bearer key1" \
     -H "X-Service-Key: my-service" \
     https://cf-workers-proxy-server.pages.dev/api/config
```

## 🎉 部署成功的标志

1. **客户端首页**显示所有状态为绿色✅
2. **服务端管理界面**可以正常登录和配置
3. **代理请求**被正确转发到目标API
4. **健康检查**返回正常状态

## 📊 环境变量总览

### 客户端环境变量

| 变量名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| `SERVER_URL` | Variable | 推荐 | 服务端API地址 |
| `SECRET_KEY` | Secret | 推荐 | 访问服务端的密钥 |
| `SERVICE_KEY` | Variable | 推荐 | 服务标识 |
| `PROXY_URL` | Variable | 可选 | 直接代理目标地址 |
| `DEBUG_MODE` | Variable | 可选 | 调试模式（false） |

### 服务端环境变量

| 变量名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| `SECRET_KEYS` | Secret | ✅ | 客户端访问密钥 |
| `ADMIN_KEY` | Secret | ✅ | 管理员登录密钥 |
| `ENCRYPTION_KEY` | Secret | ✅ | 配置加密密钥 |
| `MAX_REQUESTS_PER_MINUTE` | Variable | 可选 | 请求频率限制（60） |

## 🔧 高级配置

### 自定义域名

1. 在Cloudflare Dashboard中添加自定义域名
2. 配置DNS解析到Pages项目
3. 启用SSL/TLS加密

### 多服务配置

可以在一个服务端管理多个代理服务：

```
服务端: cf-workers-proxy-server.pages.dev
├── my-service-1 → https://api1.example.com
├── my-service-2 → https://api2.example.com
└── my-service-3 → https://api3.example.com

客户端们:
├── client-1.pages.dev (SERVICE_KEY=my-service-1)
├── client-2.pages.dev (SERVICE_KEY=my-service-2)
└── client-3.pages.dev (SERVICE_KEY=my-service-3)
```

### 负载均衡

在服务端配置多个后端服务器，实现负载均衡：

```json
{
  "serviceKey": "my-service",
  "proxyURLs": [
    "https://api1.example.com",
    "https://api2.example.com",
    "https://api3.example.com"
  ],
  "loadBalanceMethod": "round-robin"
}
```

## 🆚 架构对比

| 架构模式 | 优势 | 适用场景 |
|---------|------|----------|
| **客户端+服务端** | 集中管理、动态配置 | 多个代理服务、团队协作 |
| **客户端独立** | 简单直接、低延迟 | 单一代理、个人使用 |

---

恭喜！你已经成功部署了完整的Cloudflare Workers代理服务系统！🎉

如果遇到问题，请查看 [故障排除指南](./TROUBLESHOOTING.md)。
