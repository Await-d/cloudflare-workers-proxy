<!--
 * @Author: Await
 * @Date: 2025-05-27 22:00:05
 * @LastEditors: Await
 * @LastEditTime: 2025-05-27 22:05:27
 * @Description: 请填写简介
-->
# Cloudflare Workers 代理服务客户端

此客户端基于Cloudflare Workers实现，用于接收请求并动态转发到配置的代理目标。客户端会定期从服务端获取最新的代理配置，并在服务端不可用时使用本地缓存作为回退策略。

## 功能特点

- 支持通过环境变量配置服务端地址和密钥
- 动态代理转发，根据服务端配置将请求转发到目标服务
- 定时从服务端拉取最新配置，保持代理目标最新
- 当服务端不可用时使用本地缓存的配置
- 完善的错误处理和日志记录机制
- 支持监控集成

## 文件结构

- `index.js`: 主入口文件，处理请求转发
- `config.js`: 配置处理模块，处理与服务端通信获取配置
- `cache.js`: 缓存管理模块，实现配置缓存和回退策略
- `error.js`: 错误处理模块，统一错误处理和日志记录
- `wrangler.toml`: Wrangler配置文件，用于部署Worker

## 部署步骤

1. 安装Wrangler CLI工具：

   ```bash
   npm install -g wrangler
   ```

2. 登录到Cloudflare账号：

   ```bash
   wrangler login
   ```

3. 创建KV命名空间用于缓存：

   ```bash
   wrangler kv:namespace create "PROXY_CACHE"
   ```

4. 更新`wrangler.toml`中的KV命名空间ID

5. 设置环境变量：
   - 编辑`wrangler.toml`文件，更新`SERVICE_CONFIG_URL`, `SERVICE_KEY`, `UPDATE_INTERVAL`等变量
   - 安全设置密钥：

     ```bash
     wrangler secret put SECRET_KEY
     ```

6. 部署Worker：

   ```bash
   wrangler deploy
   ```

## 环境变量说明

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| SERVICE_CONFIG_URL | 服务端API地址 | <https://proxy-server.example.workers.dev> |
| SECRET_KEY | 访问密钥 | xxxxxx |
| SERVICE_KEY | 服务标识 | example-service |
| UPDATE_INTERVAL | 配置更新间隔(秒) | 3600 |
| DEBUG_MODE | 调试模式开关 | true/false |
| MONITORING_URL | 监控服务地址 | <https://monitoring.example.com/api/logs> |

## 使用自定义域名

如需使用自定义域名，可在Cloudflare Dashboard中为Worker配置自定义域名：

1. 登录Cloudflare Dashboard
2. 进入Workers & Pages部分
3. 选择已部署的Worker
4. 点击"触发器"标签
5. 添加自定义域

## 注意事项

- 确保在部署前设置了所有必需的环境变量
- SECRET_KEY应通过wrangler secret命令设置，不要在配置文件中明文存储
- 正确配置KV命名空间用于缓存代理配置
- 服务端必须实现符合预期的API接口
