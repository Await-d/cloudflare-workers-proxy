# 🔧 故障排除指南

部署过程中遇到问题？这里有完整的解决方案。

## 🚨 常见部署问题

### Q1: GitHub Actions 部署失败

**现象**: Actions显示失败，红色❌

**解决方案**:

1. **检查Secrets配置**:

   ```
   CLOUDFLARE_API_TOKEN=你的API Token  ✅
   CLOUDFLARE_ACCOUNT_ID=你的账户ID   ✅
   ```

2. **API Token权限检查**:
   - 确保有 `Cloudflare Pages:Edit` 权限
   - 确保有账户级别的 `Zone:Read` 权限

3. **重新触发部署**:

   ```bash
   git commit --allow-empty -m "Trigger deploy"
   git push origin main
   ```

### Q2: 部署成功但显示"Internal Error"

**现象**: Pages项目创建成功，但访问显示500错误

**解决方案**: 重新创建Pages项目

#### 方法一：删除重建

1. **删除现有项目**:
   - 登录 Cloudflare Dashboard > Pages
   - 删除现有的 `cf-workers-proxy` 项目

2. **重新创建项目**:
   - 点击 "Create a project"
   - 选择 "Connect to Git"
   - 选择 GitHub 仓库：`cloudflare-workers-proxy`
   - 项目名称：`cf-workers-proxy-new`
   - 根目录：`/` (留空)
   - 构建命令：留空
   - 构建输出目录：留空

#### 方法二：命令行部署

```bash
# 安装 Wrangler
npm install -g wrangler
wrangler login

# 手动部署
wrangler pages deploy . --project-name=cf-workers-proxy-manual
```

### Q3: 服务端部署"server/server not found"

**现象**: 服务端部署时显示找不到server目录

**解决方案**:

1. **确保根目录设置正确**:
   - 在创建服务端Pages项目时
   - **根目录必须设置为**: `server`
   - ⚠️ 不是 `/` 或 `/server`，就是 `server`

2. **重新创建服务端项目**:
   - 删除现有的服务端项目
   - 重新创建，注意根目录设置

### Q4: "No functions dir found"

**现象**: 客户端部署显示找不到functions目录

**解决方案**:

1. **检查项目结构**:

   ```
   cloudflare-workers-proxy/
   ├── functions/
   │   └── [[catchall]].js  ✅ 确保存在
   ├── public/
   │   └── index.html
   └── _routes.json
   ```

2. **如果文件丢失**，重新创建:

   ```bash
   mkdir -p functions
   # 从GitHub重新拉取代码
   ```

### Q5: KV绑定失败

**现象**: 服务端运行但KV操作失败

**解决方案**:

1. **检查KV命名空间**:
   - 进入 Workers & Pages > KV
   - 确保 `SERVICE_CONFIGS` 命名空间存在

2. **检查绑定配置**:
   - 进入服务端Pages项目 > Settings > Functions
   - KV namespace bindings 中必须有:
     - 变量名: `SERVICE_CONFIGS` (大小写敏感)
     - KV 命名空间: 选择正确的命名空间

3. **重新绑定**:
   - 删除现有绑定
   - 重新添加绑定
   - 点击 "Save"

### Q6: 客户端连接不上服务端

**现象**: 客户端健康检查显示服务端连接失败

**解决方案**:

1. **检查客户端环境变量**:

   ```
   SERVER_URL=https://cf-workers-proxy-server.pages.dev  ✅
   SECRET_KEY=key1  ✅ 必须在服务端SECRET_KEYS中
   SERVICE_KEY=my-service  ✅
   ```

2. **检查服务端环境变量**:

   ```
   SECRET_KEYS=key1,key2,key3  ✅ 包含客户端的SECRET_KEY
   ADMIN_KEY=admin-key  ✅
   ENCRYPTION_KEY=encrypt-key  ✅
   ```

3. **测试服务端API**:

   ```bash
   curl -H "Authorization: Bearer key1" \
        -H "X-Service-Key: my-service" \
        https://cf-workers-proxy-server.pages.dev/api/config
   ```

## 🔨 手动部署方案

如果自动部署完全失败，使用以下手动方案：

### 客户端手动部署

#### 方法一：重新创建Pages项目

1. **删除现有项目** (如果存在)
2. **创建新项目**:
   - 项目名称: `cf-workers-proxy-new`
   - 根目录: `/`
   - 构建设置全部留空

3. **配置环境变量**:

   ```
   SERVER_URL=https://cf-workers-proxy-server.pages.dev
   SECRET_KEY=your-secret-key
   SERVICE_KEY=my-service
   ```

#### 方法二：Wrangler CLI部署

```bash
# 1. 安装和登录
npm install -g wrangler
wrangler login

# 2. 部署客户端
wrangler pages deploy . --project-name=cf-workers-proxy-cli

# 3. 设置环境变量
wrangler pages secret put SERVER_URL --project-name=cf-workers-proxy-cli
wrangler pages secret put SECRET_KEY --project-name=cf-workers-proxy-cli
wrangler pages secret put SERVICE_KEY --project-name=cf-workers-proxy-cli
```

### 服务端手动部署

#### 方法一：Pages项目

1. **创建服务端项目**:
   - 项目名称: `cf-workers-proxy-server`
   - **根目录: `server`** ⚠️ 重要
   - 构建设置全部留空

2. **创建KV命名空间**:

   ```bash
   wrangler kv:namespace create "SERVICE_CONFIGS"
   ```

3. **绑定KV命名空间** (在Pages设置中)

4. **配置环境变量**:

   ```
   SECRET_KEYS=key1,key2,key3
   ADMIN_KEY=admin-key
   ENCRYPTION_KEY=encrypt-key
   ```

#### 方法二：传统Workers部署

```bash
# 1. 进入服务端目录
cd server

# 2. 修改wrangler.toml中的KV ID

# 3. 设置环境变量
wrangler secret put SECRET_KEYS
wrangler secret put ADMIN_KEY
wrangler secret put ENCRYPTION_KEY

# 4. 部署
wrangler deploy
```

## 🔍 调试技巧

### 开启调试模式

在客户端环境变量中设置:

```
DEBUG_MODE=true
```

然后访问健康检查接口查看详细信息:

```
https://cf-workers-proxy-new.pages.dev/api/health
```

### 查看实时日志

1. **Cloudflare Dashboard** > Pages项目 > Functions
2. **查看实时日志** 了解错误详情
3. **检查Console输出** 查看具体错误信息

### 测试API连通性

```bash
# 测试客户端健康状态
curl https://cf-workers-proxy-new.pages.dev/api/health

# 测试服务端API
curl -H "Authorization: Bearer your-secret-key" \
     -H "X-Service-Key: your-service" \
     https://cf-workers-proxy-server.pages.dev/api/config

# 测试管理界面
curl https://cf-workers-proxy-server.pages.dev/admin
```

## 📞 获取帮助

### Cloudflare支持

如果是Cloudflare平台问题，可以通过以下方式获取支持:

- [Cloudflare支持中心](https://support.cloudflare.com/)
- [Community论坛](https://community.cloudflare.com/)
- [Discord社区](https://discord.gg/cloudflaredev)

### 项目支持

- GitHub Issues: 在项目仓库提交Issue
- 文档反馈: 通过Pull Request改进文档

## ✅ 成功验证清单

部署完成后，确保以下所有项目都正常:

### 客户端检查 ✅

- [ ] 首页访问正常
- [ ] `/api/health` 返回状态正常
- [ ] 配置来源显示为 "服务端API"
- [ ] 所有状态指示器为绿色

### 服务端检查 ✅

- [ ] 管理界面 `/admin` 可以访问
- [ ] 管理员密钥可以正常登录
- [ ] 可以添加/编辑服务配置
- [ ] API接口 `/api/config` 响应正常

### 代理功能检查 ✅

- [ ] 代理请求被正确转发
- [ ] 响应内容正确
- [ ] 响应头正确传递
- [ ] 错误处理正常

---

如果以上方案都无法解决你的问题，请在GitHub仓库提交Issue，包含以下信息:

1. 具体的错误信息
2. 部署步骤截图
3. 环境变量配置（隐藏敏感信息）
4. 浏览器控制台错误

我们会尽快帮你解决！🚀
