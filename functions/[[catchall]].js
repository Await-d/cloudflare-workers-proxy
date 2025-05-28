/**
 * Cloudflare Pages Functions Entry Point - 客户端代理服务
 * 处理代理转发功能，从服务端获取配置
 */

// 全局变量和配置
const DEFAULT_CONFIG = {
    updateInterval: 3600, // 1小时
    cacheTTL: 300, // 5分钟
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000
};

/**
 * 主入口函数 - Cloudflare Pages Functions格式
 */
export async function onRequest(context) {
    const {
        request,
        env,
        ctx
    } = context;
    try {
        const url = new URL(request.url);
        const path = url.pathname;

        // 添加 CORS 头
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Service-Key',
            'Access-Control-Max-Age': '86400',
        };

        // 处理预检请求
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders
            });
        }

        let response;

        // 路由分发
        if (path.startsWith('/api/health')) {
            // 健康检查
            response = await handleHealthCheck(request, env);
        } else if (path === '/api/status') {
            // 状态页面，通过特殊路径访问
            response = await handleHomePage(request, env);
        } else {
            // 所有其他请求都进行代理转发（包括根路径）
            response = await handleProxyRequest(request, env, ctx);
        }

        // 添加CORS头到响应
        Object.entries(corsHeaders).forEach(([key, value]) => {
            response.headers.set(key, value);
        });

        return response;

    } catch (error) {
        console.error('Worker error:', error);
        return new Response(JSON.stringify({
            error: 'Internal Server Error',
            message: error.message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

/**
 * 处理健康检查
 */
async function handleHealthCheck(request, env) {
    const config = await getServiceConfig(env);
    const kvInfo = getKVInfo(env);

    return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        buildVersion: '2025-05-28-fix-ip-access', // 版本标识
        service: 'cloudflare-workers-proxy-client',
        config: config ? 'loaded' : 'not_configured',
        configSource: getConfigSource(env),
        kv: kvInfo.available ? 'available' : 'not_configured',
        statusPage: '/api/status', // 状态页面路径
        environment: {
            hasServerUrl: !!env.SERVER_URL,
            hasProxyUrl: !!env.PROXY_URL,
            hasKV: kvInfo.available,
            debugMode: env.DEBUG_MODE === 'true'
        },
        // 调试信息：显示实际配置数据
        configDebug: env.DEBUG_MODE === 'true' ? config : undefined
    }), {
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

/**
 * 获取KV信息
 */
function getKVInfo(env) {
    // 动态检查KV绑定
    const kvBinding = env.PROXY_CACHE || null;
    return {
        available: !!kvBinding,
        binding: kvBinding ? 'PROXY_CACHE' : null
    };
}

/**
 * 获取配置来源
 */
function getConfigSource(env) {
    if (env.SERVER_URL && env.SECRET_KEY && env.SERVICE_KEY) {
        return 'server_api';
    }
    if (env.PROXY_URL) {
        return 'environment_variable';
    }
    const kvInfo = getKVInfo(env);
    if (kvInfo.available) {
        return 'kv_storage';
    }
    return 'not_configured';
}

/**
 * 处理首页请求
 */
async function handleHomePage(request, env) {
    const config = await getServiceConfig(env);
    const configSource = getConfigSource(env);
    const kvInfo = getKVInfo(env);

    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>代理客户端 - Cloudflare Workers Proxy</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 2rem;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 10px;
            padding: 3rem;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 700px;
        }
        h1 {
            color: #333;
            margin-bottom: 1rem;
        }
        .status {
            padding: 1rem;
            border-radius: 5px;
            margin: 2rem 0;
        }
        .status.configured {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status.not-configured {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .info {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 5px;
            margin: 2rem 0;
            text-align: left;
        }
        .config-details {
            background: #e3f2fd;
            padding: 1rem;
            border-radius: 5px;
            margin: 1rem 0;
            font-size: 0.9rem;
        }
        .btn {
            display: inline-block;
            padding: 0.75rem 1.5rem;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 0.5rem;
        }
        .btn:hover {
            background: #5a6fd8;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 代理客户端</h1>
        <p>Cloudflare Workers Proxy - 客户端服务</p>
        
        <div class="status ${config ? 'configured' : 'not-configured'}">
            ${config ? 
                `✅ 代理配置已加载<br>目标地址: ${config.proxyURL}<br>配置来源: ${getConfigSourceName(configSource)}` : 
                '❌ 代理配置未设置'
            }
        </div>
        
        <div class="config-details">
            <strong>📊 配置状态:</strong><br>
            • 服务端连接: ${env.SERVER_URL ? '✅ 已配置' : '❌ 未配置'}<br>
            • 直接代理: ${env.PROXY_URL ? '✅ 已配置' : '❌ 未配置'}<br>
            • KV存储: ${kvInfo.available ? '✅ 可用' : '❌ 未配置'}<br>
            • 调试模式: ${env.DEBUG_MODE === 'true' ? '✅ 开启' : '❌ 关闭'}
        </div>
        
        <div class="info">
            <h3>📋 使用说明</h3>
            <p><strong>代理访问：</strong>所有发送到此域名的请求都会被代理转发到配置的目标地址</p>
            <p><strong>健康检查：</strong><code>/api/health</code></p>
            <p><strong>配置方式：</strong>通过Pages环境变量配置，无需修改代码文件</p>
        </div>
        
        <div>
            <a href="/api/health" class="btn">🔍 健康检查</a>
            ${env.SERVER_URL ? `<a href="${env.SERVER_URL}/admin" class="btn">⚙️ 管理配置</a>` : ''}
        </div>
        
        <p style="margin-top: 2rem; color: #666; font-size: 0.9rem;">
            当前时间: ${new Date().toLocaleString()}
        </p>
    </div>
</body>
</html>`;

    return new Response(html, {
        headers: {
            'Content-Type': 'text/html;charset=UTF-8'
        }
    });
}

/**
 * 获取配置来源名称
 */
function getConfigSourceName(source) {
    const names = {
        'server_api': '服务端API',
        'environment_variable': '环境变量',
        'kv_storage': 'KV存储',
        'not_configured': '未配置'
    };
    return names[source] || source;
}

/**
 * 处理代理请求（客户端功能）
 */
async function handleProxyRequest(request, env, ctx) {
    const url = new URL(request.url);

    // 获取服务配置
    const config = await getServiceConfig(env);
    if (!config) {
        return new Response(JSON.stringify({
            error: 'Service configuration not found',
            message: 'Please configure one of the following: SERVER_URL+SECRET_KEY+SERVICE_KEY, PROXY_URL, or KV storage',
            configSource: getConfigSource(env)
        }), {
            status: 404,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    try {
        // 构建目标URL
        const targetUrl = new URL(config.proxyURL);
        targetUrl.pathname = url.pathname;
        targetUrl.search = url.search;

        // 复制原始请求头
        const modifiedHeaders = new Headers(request.headers);

        // 处理Host头 - 对于IP访问的特殊处理
        const targetHost = targetUrl.host;

        // 如果目标是IP地址，尝试不同的Host头策略
        if (/^\d+\.\d+\.\d+\.\d+/.test(targetUrl.hostname)) {
            // 对于IP地址，可以尝试以下策略：
            // 1. 保持原始Host头（用户访问的域名）
            // 2. 或者移除Host头让服务器使用默认
            // 3. 或者设置为IP:port

            // 策略1：保持原始域名作为Host头（适用于反向代理场景）
            // modifiedHeaders.set('Host', url.host);

            // 策略2：设置为目标IP和端口
            modifiedHeaders.set('Host', targetHost);

            // 策略3：移除Host头（某些情况下有效）
            // modifiedHeaders.delete('Host');
        } else {
            // 对于域名，设置正确的Host头
            modifiedHeaders.set('Host', targetHost);
        }

        // 添加一些可能有用的头部
        modifiedHeaders.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '');
        modifiedHeaders.set('X-Forwarded-Proto', url.protocol.slice(0, -1));
        modifiedHeaders.set('X-Forwarded-Host', url.host);

        // 移除可能导致问题的头部
        modifiedHeaders.delete('cf-ray');
        modifiedHeaders.delete('cf-ipcountry');
        modifiedHeaders.delete('cf-visitor');

        // 创建新的请求
        const modifiedRequest = new Request(targetUrl.toString(), {
            method: request.method,
            headers: modifiedHeaders,
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null
        });

        // 转发请求
        const response = await fetch(modifiedRequest);

        // 创建新的响应，移除一些可能冲突的头
        const responseHeaders = new Headers(response.headers);

        // 移除可能导致问题的响应头
        responseHeaders.delete('content-encoding');
        responseHeaders.delete('content-length');
        responseHeaders.delete('transfer-encoding');

        const modifiedResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders
        });

        return modifiedResponse;

    } catch (error) {
        console.error('Proxy error:', error);
        return new Response(JSON.stringify({
            error: 'Proxy Error',
            message: error.message,
            target: config.proxyURL,
            timestamp: new Date().toISOString()
        }), {
            status: 502,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}

/**
 * 获取服务配置
 */
async function getServiceConfig(env) {
    try {
        // 方式1: 从服务端API获取配置
        if (env.SERVER_URL && env.SECRET_KEY && env.SERVICE_KEY) {
            try {
                const response = await fetch(`${env.SERVER_URL}/api/config`, {
                    headers: {
                        'Authorization': `Bearer ${env.SECRET_KEY}`,
                        'X-Service-Key': env.SERVICE_KEY
                    }
                });

                if (response.ok) {
                    const responseData = await response.json();
                    // 检查响应格式并提取实际配置数据
                    let config;
                    if (responseData.success && responseData.data) {
                        // 服务端返回格式: { success: true, data: { proxyURL: "...", ... } }
                        config = responseData.data;
                    } else if (responseData.proxyURL) {
                        // 直接返回配置格式: { proxyURL: "...", ... }
                        config = responseData;
                    } else {
                        throw new Error('Invalid server response format');
                    }

                    // 缓存到KV（如果可用）
                    await cacheConfig(env, config);
                    return config;
                }
            } catch (error) {
                console.warn('Failed to fetch config from server:', error);
                // 如果服务端获取失败，尝试从缓存获取
                const cachedConfig = await getCachedConfig(env);
                if (cachedConfig) {
                    console.log('Using cached config due to server fetch failure');
                    return cachedConfig;
                }
            }
        }

        // 方式2: 从KV存储获取配置
        const kvConfig = await getKVConfig(env);
        if (kvConfig) {
            return kvConfig;
        }

        // 方式3: 直接从环境变量获取配置
        if (env.PROXY_URL) {
            return {
                proxyURL: env.PROXY_URL,
                updateInterval: parseInt(env.UPDATE_INTERVAL) || DEFAULT_CONFIG.updateInterval,
                timestamp: new Date().toISOString()
            };
        }

        return null;
    } catch (error) {
        console.error('Failed to get service config:', error);
        return null;
    }
}

/**
 * 从KV获取配置
 */
async function getKVConfig(env) {
    try {
        const kvInfo = getKVInfo(env);
        if (!kvInfo.available) {
            return null;
        }

        const serviceKey = env.SERVICE_KEY || 'default';
        const configData = await env.PROXY_CACHE.get(serviceKey);
        if (configData) {
            return JSON.parse(configData);
        }
    } catch (error) {
        console.warn('Failed to get config from KV:', error);
    }
    return null;
}

/**
 * 缓存配置到KV
 */
async function cacheConfig(env, config) {
    try {
        const kvInfo = getKVInfo(env);
        if (!kvInfo.available) {
            return;
        }

        const serviceKey = env.SERVICE_KEY || 'default';
        await env.PROXY_CACHE.put(serviceKey, JSON.stringify(config), {
            expirationTtl: DEFAULT_CONFIG.cacheTTL
        });
    } catch (error) {
        console.warn('Failed to cache config to KV:', error);
    }
}

/**
 * 获取缓存的配置
 */
async function getCachedConfig(env) {
    return await getKVConfig(env);
}