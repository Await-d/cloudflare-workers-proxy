# 🚀 服务端部署指南

既然客户端已经成功部署，现在部署服务端来提供配置管理功能。

## 📋 部署步骤

### 第一步：创建服务端Pages项目

1. **登录Cloudflare Dashboard** > Pages
2. **点击 "Create a project"**
3. **选择 "Connect to Git"**
4. **选择GitHub仓库**：`cloudflare-workers-proxy`
5. **配置构建设置**：
   - 📛 **项目名称**: `cf-workers-proxy-server`
   - 📛 **生产分支**: `master`
   - 📛 **构建命令**: 留空
   - 📛 **构建输出目录**: 留空
   - 📛 **根目录**: `server` ⚠️ **重要：必须设置为 server**

6. **点击 "Save and Deploy"**

### 第二步：创建KV命名空间

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

### 第三步：配置环境变量

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

### 第四步：验证部署

访问服务端地址：

- **管理界面**：`https://cf-workers-proxy-server.pages.dev/admin`
- **配置API**：`https://cf-workers-proxy-server.pages.dev/api/config`

## 🔗 连接客户端和服务端

### 配置客户端环境变量

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

### 完整的代理配置流程

1. **访问服务端管理界面**：

   ```
   https://cf-workers-proxy-server.pages.dev/admin
   ```

2. **使用管理员密钥登录**（`ADMIN_KEY`）

3. **添加代理配置**：
   - 服务标识：`my-service`
   - 代理目标：`https://api.example.com`
   - 其他配置项

4. **客户端自动获取配置**：

   ```
   https://cf-workers-proxy-new.pages.dev/api/health
   ```

   查看配置状态

## 🎯 架构总览

```
用户请求 → 客户端(cf-workers-proxy-new) → 目标API
              ↓ 获取配置
          服务端(cf-workers-proxy-server)
```

## ✅ 验证成功标志

1. **客户端首页**显示：
   - ✅ 代理配置已加载
   - ✅ 配置来源：服务端API

2. **服务端管理界面**可以：
   - ✅ 正常登录
   - ✅ 添加/修改配置

3. **代理功能**正常：
   - 所有请求被正确转发到目标API

## 🔧 故障排除

### Q: 服务端部署失败？

A: 确保根目录设置为 `server`，不是 `/` 或留空

### Q: KV绑定失败？

A: 检查变量名是否为 `SERVICE_CONFIGS`（大小写敏感）

### Q: 客户端连接不上服务端？

A: 检查：

- `SERVER_URL` 是否正确
- `SECRET_KEY` 是否在服务端的 `SECRET_KEYS` 列表中
- 服务端是否正常运行

### Q: 管理界面访问不了？

A: 检查 `ADMIN_KEY` 环境变量是否正确设置
