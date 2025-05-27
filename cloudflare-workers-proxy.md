# Cloudflare Workers 代理服务需求文档

## 项目概述

本项目旨在利用Cloudflare Workers创建一个灵活的代理转发服务，包含客户端和服务端两个部分。系统将允许用户通过服务端配置不同的代理地址，并使客户端能够动态读取这些配置进行代理转发。

## 系统架构

系统分为客户端和服务端两个主要组件：

### 客户端功能需求

1. **环境变量配置**
   - 支持通过环境变量配置服务端地址
   - 配置密钥信息用于验证身份
   - 配置需要获取的服务key名

2. **动态代理转发**
   - 根据配置的密钥访问服务端
   - 获取指定服务key对应的代理地址
   - 将请求转发到获取到的代理地址

3. **配置自动更新**
   - 定时从服务端拉取最新配置
   - 支持配置更新间隔时间
   - 自动应用新的代理转发规则

4. **错误处理与回退策略**
   - 当服务端不可用时使用本地缓存的配置
   - 请求失败时的重试机制
   - 记录详细的错误日志

### 服务端功能需求

1. **代理地址管理**
   - 加密存储各服务的代理地址
   - 支持按服务key名组织不同的代理配置
   - 提供API接口供客户端获取配置

2. **用户认证与授权**
   - 基于密钥的认证机制
   - 不同用户可访问不同的服务配置
   - 请求频率限制防止滥用

3. **管理界面**
   - 提供简洁的Web界面管理代理配置
   - 支持添加、编辑、删除代理服务
   - 查看客户端访问日志和统计信息

4. **安全措施**
   - 所有配置数据加密存储
   - HTTPS传输保障数据安全
   - 访问控制与IP限制

## 技术实现

### 客户端实现（Cloudflare Worker）

```javascript
// 基础Worker代码示例
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // 从环境变量读取配置
  const SERVICE_CONFIG_URL = ENVIRONMENT.SERVICE_CONFIG_URL
  const SECRET_KEY = ENVIRONMENT.SECRET_KEY
  const SERVICE_KEY = ENVIRONMENT.SERVICE_KEY
  
  // 获取代理配置
  let proxyURL
  try {
    // 从服务端获取配置
    const configResponse = await fetch(`${SERVICE_CONFIG_URL}/api/config`, {
      headers: {
        'Authorization': `Bearer ${SECRET_KEY}`,
        'X-Service-Key': SERVICE_KEY
      }
    })
    
    if (configResponse.ok) {
      const config = await configResponse.json()
      proxyURL = config.proxyURL
      // 更新缓存
      await PROXY_CACHE.put('current_proxy', proxyURL, {expirationTtl: 3600})
    } else {
      // 尝试从缓存获取
      proxyURL = await PROXY_CACHE.get('current_proxy')
      if (!proxyURL) {
        return new Response('无法获取代理配置', {status: 500})
      }
    }
  } catch (error) {
    // 尝试从缓存获取
    proxyURL = await PROXY_CACHE.get('current_proxy')
    if (!proxyURL) {
      return new Response('服务配置错误', {status: 500})
    }
  }
  
  // 创建代理请求
  const url = new URL(request.url)
  const targetURL = new URL(proxyURL)
  url.hostname = targetURL.hostname
  
  const proxyRequest = new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body
  })
  
  // 发送代理请求并返回响应
  return fetch(proxyRequest)
}
```

### 服务端实现（Cloudflare Worker）

服务端使用Cloudflare Worker实现，提供以下API：

1. **配置获取API**：`GET /api/config`
   - 需要认证头：`Authorization: Bearer {SECRET_KEY}`
   - 需要服务标识：`X-Service-Key: {SERVICE_KEY}`
   - 返回JSON格式的代理配置

2. **管理界面**：提供Web界面用于管理各服务的代理地址

```javascript
// 服务端Worker代码示例
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // 提供管理界面
  if (url.pathname === '/' || url.pathname.startsWith('/admin')) {
    return handleAdminInterface(request)
  }
  
  // API端点 - 获取配置
  if (url.pathname === '/api/config') {
    // 验证请求
    const authorization = request.headers.get('Authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return new Response('未授权', { status: 401 })
    }
    
    const secretKey = authorization.split('Bearer ')[1]
    if (!SECRET_KEYS.includes(secretKey)) {
      return new Response('无效的访问密钥', { status: 403 })
    }
    
    const serviceKey = request.headers.get('X-Service-Key')
    if (!serviceKey) {
      return new Response('缺少服务标识', { status: 400 })
    }
    
    // 从KV存储中获取服务配置
    const serviceConfig = await SERVICE_CONFIGS.get(serviceKey, { type: 'json' })
    if (!serviceConfig) {
      return new Response('服务配置不存在', { status: 404 })
    }
    
    // 返回解密后的配置
    return new Response(JSON.stringify({
      proxyURL: decryptURL(serviceConfig.encryptedProxyURL),
      updateInterval: serviceConfig.updateInterval,
      // 其他配置...
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  return new Response('Not Found', { status: 404 })
}
```

## 部署步骤

### 客户端部署

1. 在Cloudflare Dashboard创建新的Worker
2. 上传客户端代码
3. 配置环境变量：
   - `SERVICE_CONFIG_URL`: 服务端API地址
   - `SECRET_KEY`: 访问密钥
   - `SERVICE_KEY`: 服务标识
4. 创建KV命名空间用于缓存（如`PROXY_CACHE`）
5. 部署Worker并设置自定义域名（可选）

### 服务端部署

1. 在Cloudflare Dashboard创建新的Worker
2. 上传服务端代码
3. 配置环境变量：
   - `SECRET_KEYS`: 允许的访问密钥列表
   - `ADMIN_KEY`: 管理界面访问密钥
4. 创建KV命名空间用于存储服务配置（如`SERVICE_CONFIGS`）
5. 创建R2存储桶用于存储访问日志（可选）
6. 部署Worker并设置自定义域名（可选）

## 安全考虑

1. 所有密钥和代理URL都应加密存储
2. 客户端与服务端通信必须使用HTTPS
3. 实施请求限流防止DOS攻击
4. 定期轮换密钥增强安全性
5. 监控异常访问模式

## 后续扩展

1. 支持更多代理规则，如URL重写、请求头修改等
2. 增加监控和告警功能
3. 支持多用户管理和权限控制
4. 添加流量统计和分析功能
5. 实现代理负载均衡和故障转移机制
