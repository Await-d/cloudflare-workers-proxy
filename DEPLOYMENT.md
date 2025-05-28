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
- Cloudflare API Token（用于自动部署）

### 方法一：GitHub Actions 自动部署（推荐）

#### 📋 步骤1：Fork 仓库

1. **访问GitHub仓库**：
   - 打开 [https://github.com/Await-d/cloudflare-workers-proxy](https://github.com/Await-d/cloudflare-workers-proxy)
   - 点击右上角的 **"Fork"** 按钮
   - 选择你的GitHub账户作为目标
   - 等待Fork完成

2. **克隆到本地（可选）**：

   ```bash
   git clone https://github.com/你的用户名/cloudflare-workers-proxy.git
   cd cloudflare-workers-proxy
   ```

#### 🔑 步骤2：获取Cloudflare凭证

1. **获取API Token**：
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
   - 点击右上角头像 > **"My Profile"**
   - 选择 **"API Tokens"** 标签
   - 点击 **"Create Token"**
   - 选择 **"Custom token"**
   - 配置权限：
     - **Account**: `Cloudflare Pages:Edit`
     - **Zone**: `Zone:Read` (所有区域)
     - **Account**: `Account:Read`
   - 点击 **"Continue to summary"**
   - 点击 **"Create Token"**
   - **复制并安全保存Token**

2. **获取Account ID**：
   - 在Cloudflare Dashboard右侧边栏可以看到
   - 或访问任意域名设置页面，URL中的ID即为Account ID
   - 格式类似：`1234567890abcdef1234567890abcdef`

#### 🔧 步骤3：配置GitHub Secrets

1. **进入仓库设置**：
   - 打开你Fork的仓库页面
   - 点击 **"Settings"** 标签
   - 在左侧菜单中选择 **"Secrets and variables"** > **"Actions"**

2. **添加Repository secrets**：

   点击 **"New repository secret"** 添加以下两个秘钥：

   **第一个秘钥**：
   - Name: `CLOUDFLARE_API_TOKEN`
   - Secret: `刚才获取的API Token`
   - 点击 **"Add secret"**

   **第二个秘钥**：
   - Name: `CLOUDFLARE_ACCOUNT_ID`
   - Secret: `你的Cloudflare账户ID`
   - 点击 **"Add secret"**

#### 🚀 步骤4：触发自动部署

1. **推送代码触发部署**：

   ```bash
   # 如果你克隆到本地，进行一次提交来触发部署
   git commit --allow-empty -m "触发初始部署"
   git push origin master
   ```

   或者直接在GitHub网页上：
   - 进入你的仓库
   - 点击 **"Actions"** 标签
   - 找到 **"Deploy to Cloudflare Pages"** 工作流
   - 点击 **"Run workflow"** > **"Run workflow"**

2. **监控部署状态**：
   - 在GitHub的 **"Actions"** 标签查看部署进度
   - 绿色✅表示成功，红色❌表示失败
   - 点击具体的workflow查看详细日志

3. **获取部署URL**：
   - 部署成功后，在Actions日志中可以看到类似：

     ```
     🎉 Your site is live at: https://cf-workers-proxy-new.pages.dev
     ```

### 方法二：手动创建Pages项目（备选方案）

如果GitHub Actions遇到问题，可以手动创建Pages项目：

#### 📋 详细步骤

1. **登录Cloudflare Dashboard**：
   - 访问 [https://dash.cloudflare.com](https://dash.cloudflare.com)
   - 使用你的账户登录

2. **进入Pages管理**：
   - 在左侧菜单中点击 **"Workers & Pages"**
   - 点击 **"Create application"**
   - 选择 **"Pages"** 标签
   - 点击 **"Connect to Git"**

3. **连接GitHub仓库**：
   - 如果首次使用，点击 **"Connect GitHub"**
   - 授权Cloudflare访问你的GitHub仓库
   - 在仓库列表中找到 `cloudflare-workers-proxy`
   - 点击 **"Begin setup"**

4. **配置项目设置**：

   **基本设置**：
   - **Project name**: `cf-workers-proxy-new`（或你喜欢的名称）
   - **Production branch**: `master`

   **构建设置**：
   - **Framework preset**: `None`
   - **Build command**: 留空（不填写）
   - **Build output directory**: 留空（不填写）
   - **Root directory**: 留空（或填写 `/`）

   ⚠️ **重要提醒**：构建设置全部留空，因为我们使用Pages Functions，不需要构建步骤

5. **完成创建**：
   - 检查所有设置正确
   - 点击 **"Save and Deploy"**
   - 等待首次部署完成（通常1-3分钟）

6. **验证部署**：
   - 部署完成后会显示访问URL，如：`https://cf-workers-proxy-new.pages.dev`
   - 访问该URL应该能看到代理服务首页

#### 🔧 步骤5：配置客户端环境变量

部署完成后，需要配置环境变量来连接服务端或设置直接代理：

1. **进入项目设置**：
   - 在Cloudflare Dashboard中找到你的Pages项目
   - 点击项目名称进入详情页
   - 点击 **"Settings"** 标签
   - 选择 **"Environment variables"**

2. **选择配置方式**：

   **方式一：连接服务端（推荐）**

   适用于需要动态配置管理的场景：

   ```
   变量名: SERVER_URL
   值: https://cf-workers-proxy-server.pages.dev
   环境: Production
   
   变量名: SECRET_KEY  
   值: your-secret-key
   环境: Production
   
   变量名: SERVICE_KEY
   值: my-service
   环境: Production
   ```

   **方式二：直接代理配置**

   适用于简单的固定代理场景：

   ```
   变量名: PROXY_URL
   值: https://api.example.com
   环境: Production
   
   变量名: UPDATE_INTERVAL
   值: 3600
   环境: Production
   ```

3. **可选的高级配置**：

   ```
   变量名: DEBUG_MODE
   值: false
   环境: Production
   说明: 开启调试模式显示更多日志
   
   变量名: PROXY_CACHE_KV_ID
   值: your-kv-namespace-id
   环境: Production
   说明: 启用KV缓存以提高性能
   ```

4. **保存配置**：
   - 添加每个环境变量后点击 **"Add variable"**
   - 所有变量添加完成后，Pages会自动重新部署
   - 等待重新部署完成（1-2分钟）

#### ✅ 步骤6：验证客户端部署

1. **访问基本页面**：

   ```
   https://cf-workers-proxy-new.pages.dev
   ```

   应该显示代理服务的状态页面

2. **测试健康检查**：

   ```
   https://cf-workers-proxy-new.pages.dev/api/health
   ```

   应该返回JSON格式的健康状态

3. **检查配置状态**：
   在首页或健康检查中应该能看到：
   - ✅ 代理配置状态
   - ✅ 配置来源（服务端API 或 环境变量）
   - ✅ KV缓存状态
   - ✅ 调试模式状态

4. **测试代理功能**：

   ```bash
   # 如果配置了直接代理
   curl https://cf-workers-proxy-new.pages.dev/test-endpoint
   
   # 如果连接了服务端，需要先在服务端配置代理规则
   ```

### 🔍 常见问题和解决方案

#### Q1: GitHub Actions部署失败

**检查清单**：

- [ ] API Token权限是否正确（需要Pages:Edit权限）
- [ ] Account ID是否正确
- [ ] Secrets是否正确添加到仓库
- [ ] 是否有特殊字符导致解析错误

**解决方案**：

- 重新生成API Token并确保权限正确
- 检查Account ID（32位十六进制字符串）
- 删除并重新添加Secrets
- 查看Actions日志的具体错误信息

#### Q2: 手动部署后显示404

**可能原因**：

- 项目结构配置错误
- 路由配置问题
- Functions未正确识别

**解决方案**：

- 确保根目录设置为空或 `/`
- 检查是否存在 `functions/` 目录和 `[[catchall]].js` 文件
- 查看Pages的Functions标签页是否显示函数

#### Q3: 环境变量不生效

**检查步骤**：

- 确认变量名拼写正确（大小写敏感）
- 确认变量值没有多余的空格
- 确认选择了正确的环境（Production/Preview）
- 重新部署项目使变量生效

#### Q4: 代理请求失败

**排查步骤**：

1. 检查目标URL是否可访问
2. 启用DEBUG_MODE查看详细日志
3. 检查CORS配置
4. 验证服务端连接（如果使用服务端模式）

### 🎯 下一步：部署服务端

客户端部署完成后，如果选择了"连接服务端"模式，需要继续部署服务端以提供配置管理功能。

请继续阅读本文档的 **"第二部分：服务端部署"** 章节。

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
