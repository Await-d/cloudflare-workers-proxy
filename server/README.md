# Cloudflare Workers 代理服务服务端

此服务端基于Cloudflare Workers实现，用于管理代理服务配置，为客户端提供配置获取API，并提供Web管理界面。支持外部系统推送配置数据。

## 功能特点

- 加密存储代理服务配置
- 基于密钥的认证机制
- 请求频率限制防止滥用
- 现代化的Web管理界面
- 支持多服务配置管理
- **外部推送配置API**
- **批量配置同步功能**
- 完善的错误处理和日志记录

## 文件结构

- `index.js`: 主入口文件，处理请求路由
- `config.js`: 配置管理模块，处理服务配置存储和获取
- `auth.js`: 认证授权模块，实现认证和授权机制
- `crypto.js`: 加密解密工具，实现配置数据的加密和解密
- `push-api.js`: 外部推送配置API，处理外部系统的配置推送
- `admin/`: 管理界面相关代码
  - `index.js`: 管理界面入口，处理管理界面请求
  - `api.js`: 管理API，处理管理界面API请求
  - `ui.js`: UI组件，渲染管理界面
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

3. 创建KV命名空间用于存储配置：

   ```bash
   wrangler kv:namespace create "SERVICE_CONFIGS"
   ```

4. 更新`wrangler.toml`中的KV命名空间ID

5. 设置必需的环境变量（安全方式）：

   ```bash
   # 设置允许的客户端访问密钥列表（逗号分隔）
   wrangler secret put SECRET_KEYS
   
   # 设置管理员密钥
   wrangler secret put ADMIN_KEY
   
   # 设置加密密钥（用于加密存储的代理URL）
   wrangler secret put ENCRYPTION_KEY
   ```

6. 部署Worker：

   ```bash
   wrangler deploy
   ```

## 环境变量说明

| 变量名 | 类型 | 说明 | 示例值 |
|--------|------|------|--------|
| SECRET_KEYS | Secret | 允许的客户端访问密钥列表（逗号分隔） | key1,key2,key3 |
| ADMIN_KEY | Secret | 管理界面访问密钥 | admin-secret-key |
| ENCRYPTION_KEY | Secret | 配置数据加密密钥 | encryption-secret-key |
| MAX_REQUESTS_PER_MINUTE | Variable | 每分钟最大请求数限制 | 60 |

## API接口

### 客户端配置API

**GET /api/config**

获取服务配置，用于客户端获取代理配置。

**请求头：**

- `Authorization: Bearer {SECRET_KEY}`
- `X-Service-Key: {SERVICE_KEY}`

**响应：**

```json
{
  "proxyURL": "https://example.com",
  "updateInterval": 3600,
  "timestamp": "2023-09-01T12:00:00.000Z"
}
```

### 外部推送配置API

所有外部推送API都需要使用有效的客户端密钥进行认证。

#### 单个配置推送

**POST /api/push-config**

推送单个服务配置。

**请求头：**

- `Authorization: Bearer {SECRET_KEY}`
- `Content-Type: application/json`

**请求体：**

```json
{
  "serviceKey": "my-service",
  "proxyURL": "https://api.example.com",
  "updateInterval": 3600,
  "version": "1.0",
  "metadata": {
    "description": "示例服务",
    "environment": "production"
  }
}
```

**响应：**

```json
{
  "success": true,
  "message": "配置推送成功",
  "serviceKey": "my-service",
  "timestamp": "2023-09-01T12:00:00.000Z"
}
```

#### 批量配置推送

**POST /api/push-config**

批量推送多个服务配置。

**请求体：**

```json
{
  "configs": [
    {
      "serviceKey": "service-1",
      "proxyURL": "https://api1.example.com",
      "updateInterval": 3600
    },
    {
      "serviceKey": "service-2", 
      "proxyURL": "https://api2.example.com",
      "updateInterval": 1800
    }
  ]
}
```

**响应：**

```json
{
  "success": true,
  "message": "批量推送完成：成功 2 个，失败 0 个",
  "summary": {
    "total": 2,
    "success": 2,
    "failure": 0
  },
  "results": [
    {
      "serviceKey": "service-1",
      "success": true,
      "timestamp": "2023-09-01T12:00:00.000Z"
    },
    {
      "serviceKey": "service-2", 
      "success": true,
      "timestamp": "2023-09-01T12:00:01.000Z"
    }
  ]
}
```

### 配置同步API

#### 全量同步

**POST /api/sync-config**

全量同步配置（替换所有现有配置）。

**请求体：**

```json
{
  "action": "full-sync",
  "configs": [
    {
      "serviceKey": "service-1",
      "proxyURL": "https://api1.example.com",
      "updateInterval": 3600
    }
  ]
}
```

#### 增量同步

**POST /api/sync-config**

增量同步配置（支持新增、更新、删除操作）。

**请求体：**

```json
{
  "action": "incremental-sync",
  "upsert": [
    {
      "serviceKey": "new-service",
      "proxyURL": "https://new-api.example.com",
      "updateInterval": 3600
    }
  ],
  "delete": ["old-service-1", "old-service-2"]
}
```

**响应：**

```json
{
  "success": true,
  "syncType": "incremental",
  "message": "增量同步完成：成功 3 个，失败 0 个",
  "summary": {
    "total": 3,
    "success": 3,
    "failure": 0
  },
  "results": [
    {
      "action": "upsert",
      "serviceKey": "new-service",
      "success": true,
      "error": null
    },
    {
      "action": "delete",
      "serviceKey": "old-service-1",
      "success": true,
      "error": null
    },
    {
      "action": "delete",
      "serviceKey": "old-service-2", 
      "success": true,
      "error": null
    }
  ]
}
```

### 管理界面API

所有管理界面API都需要使用管理员密钥进行认证。

**POST /admin/api/login**

- 验证管理员密钥

**GET /admin/api/services**

- 获取所有服务配置列表

**GET /admin/api/service?key={SERVICE_KEY}**

- 获取特定服务配置

**POST /admin/api/service**

- 创建新的服务配置

**PUT /admin/api/service**

- 更新服务配置

**DELETE /admin/api/service?key={SERVICE_KEY}**

- 删除服务配置

## 管理界面使用

1. 访问Worker的URL（例如：`https://proxy-server.yourname.workers.dev`）
2. 系统会自动跳转到登录页面
3. 输入管理员密钥登录
4. 在管理界面中添加、编辑或删除服务配置

### 服务配置说明

- **服务标识**：唯一标识符，客户端使用此标识获取配置
- **代理URL**：实际的代理目标地址
- **更新间隔**：客户端从服务端获取配置的间隔时间（秒）

## 安全考虑

1. **密钥管理**：所有敏感密钥都应通过`wrangler secret`命令设置，不要在配置文件中明文存储
2. **数据加密**：代理URL在存储时会被加密
3. **请求限流**：防止DOS攻击的请求频率限制
4. **HTTPS传输**：Cloudflare Workers默认使用HTTPS
5. **访问控制**：基于密钥的认证机制
6. **输入验证**：所有外部推送的数据都会进行严格验证

## 监控与日志

- 错误日志会输出到Cloudflare Workers的控制台
- 可以在Cloudflare Dashboard中查看Worker的运行状态和日志
- 建议配置外部监控服务用于生产环境

## 注意事项

- 确保正确配置所有必需的环境变量
- 定期轮换密钥以增强安全性
- 监控Worker的使用量，避免超出Cloudflare的免费配额
- 备份重要的服务配置数据
- 外部推送API支持版本控制和元数据，便于配置管理
- 批量操作会返回详细的操作结果，便于错误排查

## 使用示例

### 使用curl推送配置

```bash
# 推送单个配置
curl -X POST https://proxy-server.yourname.workers.dev/api/push-config \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceKey": "my-api",
    "proxyURL": "https://api.example.com",
    "updateInterval": 3600
  }'

# 批量推送配置
curl -X POST https://proxy-server.yourname.workers.dev/api/push-config \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "configs": [
      {
        "serviceKey": "api-1",
        "proxyURL": "https://api1.example.com"
      },
      {
        "serviceKey": "api-2",
        "proxyURL": "https://api2.example.com"
      }
    ]
  }'

# 增量同步配置
curl -X POST https://proxy-server.yourname.workers.dev/api/sync-config \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "incremental-sync",
    "upsert": [
      {
        "serviceKey": "new-service",
        "proxyURL": "https://new-api.example.com",
        "updateInterval": 3600
      }
    ],
    "delete": ["old-service-1", "old-service-2"]
  }'
```

### 使用JavaScript推送配置

```javascript
// 单个配置推送
async function pushSingleConfig() {
  const response = await fetch('https://proxy-server.yourname.workers.dev/api/push-config', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer your-secret-key',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      serviceKey: 'my-api',
      proxyURL: 'https://api.example.com',
      updateInterval: 3600,
      version: '1.0',
      metadata: {
        environment: 'production',
        description: '生产环境API'
      }
    })
  });
  
  const result = await response.json();
  console.log('推送结果:', result);
}

// 批量配置推送
async function batchPushConfigs() {
  const configs = [
    {
      serviceKey: 'api-service-1',
      proxyURL: 'https://api1.example.com',
      updateInterval: 3600,
      metadata: { environment: 'prod' }
    },
    {
      serviceKey: 'api-service-2',
      proxyURL: 'https://api2.example.com',
      updateInterval: 1800,
      metadata: { environment: 'staging' }
    }
  ];

  const response = await fetch('https://proxy-server.yourname.workers.dev/api/push-config', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer your-secret-key',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ configs })
  });
  
  const result = await response.json();
  console.log('批量推送结果:', result);
}

// 增量同步
async function incrementalSync() {
  const response = await fetch('https://proxy-server.yourname.workers.dev/api/sync-config', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer your-secret-key',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'incremental-sync',
      upsert: [
        {
          serviceKey: 'new-service',
          proxyURL: 'https://new-api.example.com',
          updateInterval: 3600,
          version: '2.0'
        }
      ],
      delete: ['deprecated-service']
    })
  });
  
  const result = await response.json();
  console.log('同步结果:', result);
}

// 全量同步
async function fullSync() {
  const allConfigs = [
    {
      serviceKey: 'service-1',
      proxyURL: 'https://api1.example.com',
      updateInterval: 3600
    },
    {
      serviceKey: 'service-2',
      proxyURL: 'https://api2.example.com',
      updateInterval: 1800
    }
  ];

  const response = await fetch('https://proxy-server.yourname.workers.dev/api/sync-config', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer your-secret-key',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'full-sync',
      configs: allConfigs
    })
  });
  
  const result = await response.json();
  console.log('全量同步结果:', result);
}
```

### 使用Python推送配置

```python
import requests
import json

# 配置
BASE_URL = 'https://proxy-server.yourname.workers.dev'
SECRET_KEY = 'your-secret-key'

def push_single_config():
    """推送单个配置"""
    url = f"{BASE_URL}/api/push-config"
    headers = {
        'Authorization': f'Bearer {SECRET_KEY}',
        'Content-Type': 'application/json'
    }
    data = {
        'serviceKey': 'python-api',
        'proxyURL': 'https://python-api.example.com',
        'updateInterval': 3600,
        'version': '1.0',
        'metadata': {
            'language': 'python',
            'environment': 'production'
        }
    }
    
    response = requests.post(url, headers=headers, json=data)
    return response.json()

def batch_push_configs():
    """批量推送配置"""
    url = f"{BASE_URL}/api/push-config"
    headers = {
        'Authorization': f'Bearer {SECRET_KEY}',
        'Content-Type': 'application/json'
    }
    data = {
        'configs': [
            {
                'serviceKey': 'service-a',
                'proxyURL': 'https://service-a.example.com',
                'updateInterval': 3600
            },
            {
                'serviceKey': 'service-b',
                'proxyURL': 'https://service-b.example.com',
                'updateInterval': 1800
            }
        ]
    }
    
    response = requests.post(url, headers=headers, json=data)
    return response.json()

def incremental_sync():
    """增量同步"""
    url = f"{BASE_URL}/api/sync-config"
    headers = {
        'Authorization': f'Bearer {SECRET_KEY}',
        'Content-Type': 'application/json'
    }
    data = {
        'action': 'incremental-sync',
        'upsert': [
            {
                'serviceKey': 'new-python-service',
                'proxyURL': 'https://new-service.example.com',
                'updateInterval': 2400
            }
        ],
        'delete': ['old-service-1', 'old-service-2']
    }
    
    response = requests.post(url, headers=headers, json=data)
    return response.json()

# 使用示例
if __name__ == '__main__':
    # 推送单个配置
    result = push_single_config()
    print('单个配置推送结果:', result)
    
    # 批量推送
    result = batch_push_configs()
    print('批量推送结果:', result)
    
    # 增量同步
    result = incremental_sync()
    print('增量同步结果:', result)
```
