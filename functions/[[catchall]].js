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

        // 动态处理URL参数，覆盖环境变量设置 (借鉴epeius项目)
        if (url.searchParams.has('proxyip')) {
            env.PROXY_URL_OVERRIDE = `http://${url.searchParams.get('proxyip')}`;
            console.log(`URL参数覆盖PROXY_URL: ${env.PROXY_URL_OVERRIDE}`);
        }

        if (url.searchParams.has('target')) {
            env.PROXY_URL_OVERRIDE = url.searchParams.get('target');
            console.log(`URL参数覆盖PROXY_URL: ${env.PROXY_URL_OVERRIDE}`);
        }

        // 处理路径中的代理设置 (借鉴epeius项目)
        if (path.startsWith('/proxyip=')) {
            const proxyIP = path.split('/proxyip=')[1];
            env.PROXY_URL_OVERRIDE = `http://${proxyIP}`;
            console.log(`路径参数覆盖PROXY_URL: ${env.PROXY_URL_OVERRIDE}`);
        }

        if (path.startsWith('/target=')) {
            const target = path.split('/target=')[1];
            env.PROXY_URL_OVERRIDE = target;
            console.log(`路径参数覆盖PROXY_URL: ${env.PROXY_URL_OVERRIDE}`);
        }

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
        } else if (path === '/api/test-target') {
            // 测试目标服务器连接
            response = await handleTestTarget(request, env);
        } else if (path === '/api/network-test') {
            // 网络连接诊断测试
            response = await handleNetworkTest(request, env);
        } else if (path === '/api/proxy-report') {
            // 代理系统诊断报告
            response = await handleProxyReport(request, env);
        } else if (path === '/api/debug-proxy') {
            // 调试代理请求，强制开启详细日志
            response = await handleDebugProxy(request, env, ctx);
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
        buildVersion: '2025-05-28-network-diagnostics-21-strategies', // 版本标识
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
    if (env.PROXY_URL_OVERRIDE) {
        return 'url_parameter';
    }
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
        'url_parameter': 'URL参数',
        'server_api': '服务端API',
        'environment_variable': '环境变量',
        'kv_storage': 'KV存储',
        'not_configured': '未配置'
    };
    return names[source] || source;
}

/**
 * 处理代理请求 - 重新设计的智能代理系统
 */
async function handleProxyRequest(request, env, ctx) {
    const url = new URL(request.url);

    // 获取服务配置 (保留原有逻辑)
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

        // 创建代理请求
        const proxyRequest = await createProxyRequest(request, targetUrl, env);

        // 发送请求并获取响应
        const response = await fetchWithRetry(proxyRequest, env);

        // 智能处理响应
        return await processProxyResponse(response, request, targetUrl, env);

    } catch (error) {
        console.error('Proxy error:', error);

        const errorDetails = {
            error: 'Proxy Error',
            message: error.message,
            target: config.proxyURL,
            timestamp: new Date().toISOString(),
            debugInfo: {
                requestUrl: url.pathname + url.search,
                targetHost: new URL(config.proxyURL).host,
                requestMethod: request.method,
                errorStack: error.stack
            }
        };

        return new Response(JSON.stringify(errorDetails), {
            status: 502,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}

/**
 * 创建代理请求
 */
async function createProxyRequest(originalRequest, targetUrl, env) {
    // 构建优化的请求头
    const headers = new Headers();

    // 复制原始请求的重要头部
    const importantHeaders = [
        'accept', 'accept-language', 'accept-encoding',
        'content-type', 'authorization', 'cookie',
        'x-requested-with', 'referer'
    ];

    for (const headerName of importantHeaders) {
        const value = originalRequest.headers.get(headerName);
        if (value) {
            headers.set(headerName, value);
        }
    }

    // 设置适合的User-Agent和浏览器头部
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8');
    headers.set('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8');
    headers.set('Accept-Encoding', 'gzip, deflate, br');
    headers.set('Cache-Control', 'no-cache');
    headers.set('Pragma', 'no-cache');

    // 关键：正确设置Host头部
    headers.set('Host', targetUrl.host);

    // 设置来源信息，让目标服务器认为是直接访问
    const origin = `${targetUrl.protocol}//${targetUrl.host}`;
    headers.set('Origin', origin);
    headers.set('Referer', origin + '/');

    // 现代浏览器安全头部
    headers.set('Sec-Fetch-Dest', 'document');
    headers.set('Sec-Fetch-Mode', 'navigate');
    headers.set('Sec-Fetch-Site', 'same-origin');
    headers.set('Sec-Fetch-User', '?1');

    // 移除可能暴露代理身份的头部
    headers.delete('cf-ray');
    headers.delete('cf-visitor');
    headers.delete('x-forwarded-for');
    headers.delete('x-real-ip');

    return new Request(targetUrl.toString(), {
        method: originalRequest.method,
        headers: headers,
        body: originalRequest.method !== 'GET' && originalRequest.method !== 'HEAD' ?
            originalRequest.body : undefined
    });
}

/**
 * 带重试的请求发送
 */
async function fetchWithRetry(request, env, maxRetries = 3) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(request.clone());

            if (response.ok || response.status < 500) {
                // 成功或客户端错误（4xx），直接返回
                return response;
            }

            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);

            // 服务器错误，稍后重试
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }

        } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    throw lastError;
}

/**
 * 智能处理代理响应
 */
async function processProxyResponse(response, originalRequest, targetUrl, env) {
    // 检查响应是否成功
    if (!response.ok) {
        // 对于4xx和5xx错误，直接返回，但要处理CORS
        const responseHeaders = new Headers(response.headers);
        addCorsHeaders(responseHeaders);

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders
        });
    }

    const contentType = response.headers.get('content-type') || '';
    const responseHeaders = new Headers(response.headers);

    // 添加CORS头部
    addCorsHeaders(responseHeaders);

    // 移除可能导致问题的头部
    responseHeaders.delete('content-security-policy');
    responseHeaders.delete('x-frame-options');
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');
    responseHeaders.delete('transfer-encoding');

    // 根据内容类型进行不同处理
    if (contentType.includes('text/html')) {
        return await processHtmlResponse(response, originalRequest, targetUrl, responseHeaders, env);
    } else if (contentType.includes('text/css')) {
        return await processCssResponse(response, originalRequest, targetUrl, responseHeaders);
    } else if (contentType.includes('application/javascript') || contentType.includes('text/javascript')) {
        return await processJsResponse(response, originalRequest, targetUrl, responseHeaders);
    } else {
        // 其他类型文件直接返回
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders
        });
    }
}

/**
 * 处理HTML响应 - 重写URL和注入代理脚本
 */
async function processHtmlResponse(response, originalRequest, targetUrl, responseHeaders, env) {
    let html = await response.text();
    const proxyUrl = new URL(originalRequest.url);
    const baseUrl = `${proxyUrl.protocol}//${proxyUrl.host}`;

    // URL重写规则
    const targetBase = `${targetUrl.protocol}//${targetUrl.host}`;

    // 重写绝对URL
    html = html.replace(
        new RegExp(`https?://${escapeRegex(targetUrl.host)}`, 'gi'),
        baseUrl
    );

    // 重写相对URL
    html = html.replace(
        /(?:href|src|action)=["']([^"']+)["']/gi,
        (match, url) => {
            if (url.startsWith('http') || url.startsWith('//') || url.startsWith('data:') || url.startsWith('mailto:')) {
                return match;
            }

            // 处理相对路径
            let newUrl = url;
            if (url.startsWith('/')) {
                newUrl = baseUrl + url;
            } else if (!url.startsWith('#')) {
                // 相对路径，需要基于当前路径计算
                const currentPath = new URL(originalRequest.url).pathname;
                const basePath = currentPath.endsWith('/') ? currentPath : currentPath + '/';
                newUrl = baseUrl + basePath + url;
            }

            return match.replace(url, newUrl);
        }
    );

    // 注入代理增强脚本
    const proxyScript = `
    <script>
    (function() {
        // 拦截和重写fetch请求
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
            if (typeof url === 'string' && !url.startsWith('http') && !url.startsWith('//')) {
                if (url.startsWith('/')) {
                    url = '${baseUrl}' + url;
                } else {
                    const currentPath = window.location.pathname;
                    const basePath = currentPath.endsWith('/') ? currentPath : currentPath + '/';
                    url = '${baseUrl}' + basePath + url;
                }
            }
            return originalFetch.call(this, url, options);
        };
        
        // 拦截XMLHttpRequest
        const originalXHROpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            if (typeof url === 'string' && !url.startsWith('http') && !url.startsWith('//')) {
                if (url.startsWith('/')) {
                    url = '${baseUrl}' + url;
                } else {
                    const currentPath = window.location.pathname;
                    const basePath = currentPath.endsWith('/') ? currentPath : currentPath + '/';
                    url = '${baseUrl}' + basePath + url;
                }
            }
            return originalXHROpen.call(this, method, url, ...args);
        };
        
        // 修复window.location
        if (window.location.host !== '${targetUrl.host}') {
            Object.defineProperty(window, 'location', {
                value: {
                    ...window.location,
                    host: '${targetUrl.host}',
                    hostname: '${targetUrl.hostname}',
                    origin: '${targetBase}',
                    protocol: '${targetUrl.protocol}',
                    port: '${targetUrl.port || (targetUrl.protocol === 'https:' ? '443' : '80')}'
                },
                writable: false
            });
        }
    })();
    </script>
    `;

    // 在</head>之前插入脚本
    if (html.includes('</head>')) {
        html = html.replace('</head>', proxyScript + '\n</head>');
    } else if (html.includes('<head>')) {
        html = html.replace('<head>', '<head>\n' + proxyScript);
    } else {
        html = proxyScript + '\n' + html;
    }

    responseHeaders.set('Content-Type', 'text/html; charset=utf-8');

    return new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
    });
}

/**
 * 处理CSS响应 - 重写URL引用
 */
async function processCssResponse(response, originalRequest, targetUrl, responseHeaders) {
    let css = await response.text();
    const proxyUrl = new URL(originalRequest.url);
    const baseUrl = `${proxyUrl.protocol}//${proxyUrl.host}`;

    // 重写CSS中的URL引用
    css = css.replace(
        /url\(['"]?([^'"）]+)['"]?\)/gi,
        (match, url) => {
            if (url.startsWith('http') || url.startsWith('//') || url.startsWith('data:')) {
                return match;
            }

            let newUrl = url;
            if (url.startsWith('/')) {
                newUrl = baseUrl + url;
            } else {
                const currentPath = new URL(originalRequest.url).pathname;
                const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
                newUrl = baseUrl + basePath + url;
            }

            return `url('${newUrl}')`;
        }
    );

    return new Response(css, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
    });
}

/**
 * 处理JavaScript响应
 */
async function processJsResponse(response, originalRequest, targetUrl, responseHeaders) {
    // 对于JS文件，暂时直接返回，避免破坏复杂的JS逻辑
    // 可以根据需要在这里添加特定的JS重写逻辑
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
    });
}

/**
 * 添加CORS头部
 */
function addCorsHeaders(headers) {
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Service-Key, X-Requested-With');
    headers.set('Access-Control-Max-Age', '86400');
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 获取服务配置
 */
async function getServiceConfig(env) {
    try {
        // 首先检查是否有URL参数直接指定的代理配置
        // 这些参数应该优先于所有其他配置
        if (env.PROXY_URL_OVERRIDE) {
            return {
                proxyURL: env.PROXY_URL_OVERRIDE,
                source: 'url_parameter',
                updateInterval: parseInt(env.UPDATE_INTERVAL) || DEFAULT_CONFIG.updateInterval,
                timestamp: new Date().toISOString()
            };
        }

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

                    config.source = 'server_api';

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
            kvConfig.source = 'kv_storage';
            return kvConfig;
        }

        // 方式3: 直接从环境变量获取配置
        if (env.PROXY_URL) {
            return {
                proxyURL: env.PROXY_URL,
                source: 'environment_variable',
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

/**
 * 测试目标服务器连接
 */
async function handleTestTarget(request, env) {
    const config = await getServiceConfig(env);

    if (!config) {
        return new Response(JSON.stringify({
            error: 'No configuration found',
            message: 'Cannot test target without configuration'
        }), {
            status: 404,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    const testResults = [];
    const targetUrl = new URL(config.proxyURL);

    // 测试1: 基本连接测试
    try {
        const testUrl = `${targetUrl.protocol}//${targetUrl.host}/`;
        const response = await fetch(testUrl, {
            method: 'HEAD',
            headers: {
                'User-Agent': 'Cloudflare-Workers-Proxy-Test'
            }
        });

        testResults.push({
            test: 'Basic Connection',
            url: testUrl,
            status: response.status,
            statusText: response.statusText,
            success: response.ok
        });
    } catch (error) {
        testResults.push({
            test: 'Basic Connection',
            url: `${targetUrl.protocol}//${targetUrl.host}/`,
            error: error.message,
            success: false
        });
    }

    // 测试2: 带Host头的连接测试
    try {
        const testUrl = `${targetUrl.protocol}//${targetUrl.host}/`;
        const response = await fetch(testUrl, {
            method: 'HEAD',
            headers: {
                'Host': targetUrl.host,
                'User-Agent': 'Cloudflare-Workers-Proxy-Test'
            }
        });

        testResults.push({
            test: 'With Host Header',
            url: testUrl,
            host: targetUrl.host,
            status: response.status,
            statusText: response.statusText,
            success: response.ok
        });
    } catch (error) {
        testResults.push({
            test: 'With Host Header',
            url: `${targetUrl.protocol}//${targetUrl.host}/`,
            host: targetUrl.host,
            error: error.message,
            success: false
        });
    }

    // 测试3: HTTP版本测试（如果原来是HTTPS）
    if (targetUrl.protocol === 'https:') {
        try {
            const httpUrl = `http://${targetUrl.host}/`;
            const response = await fetch(httpUrl, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Cloudflare-Workers-Proxy-Test'
                }
            });

            testResults.push({
                test: 'HTTP Version',
                url: httpUrl,
                status: response.status,
                statusText: response.statusText,
                success: response.ok
            });
        } catch (error) {
            testResults.push({
                test: 'HTTP Version',
                url: `http://${targetUrl.host}/`,
                error: error.message,
                success: false
            });
        }
    }

    return new Response(JSON.stringify({
        timestamp: new Date().toISOString(),
        targetConfig: config.proxyURL,
        testResults: testResults,
        summary: {
            total: testResults.length,
            successful: testResults.filter(r => r.success).length,
            failed: testResults.filter(r => !r.success).length
        }
    }, null, 2), {
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

/**
 * 调试代理请求，强制开启详细日志
 */
async function handleDebugProxy(request, env, ctx) {
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

        // 构建完整的浏览器请求头
        const browserHeaders = new Headers();

        // 标准浏览器请求头
        browserHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        browserHeaders.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7');
        browserHeaders.set('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8');
        browserHeaders.set('Accept-Encoding', 'gzip, deflate, br');
        browserHeaders.set('Cache-Control', 'max-age=0');
        browserHeaders.set('Connection', 'keep-alive');
        browserHeaders.set('Upgrade-Insecure-Requests', '1');
        browserHeaders.set('Sec-Fetch-Dest', 'document');
        browserHeaders.set('Sec-Fetch-Mode', 'navigate');
        browserHeaders.set('Sec-Fetch-Site', 'none');
        browserHeaders.set('Sec-Fetch-User', '?1');
        browserHeaders.set('sec-ch-ua', '"Google Chrome";v="120", "Chromium";v="120", "Not:A-Brand";v="99"');
        browserHeaders.set('sec-ch-ua-mobile', '?0');
        browserHeaders.set('sec-ch-ua-platform', '"Windows"');

        // 尝试多种Host策略
        const strategies = [{
                name: 'domain_masking',
                headers: () => {
                    const headers = new Headers(browserHeaders);
                    // 尝试使用一个看起来像真实域名的Host
                    headers.set('Host', '1panel.example.com');
                    headers.set('Referer', 'https://1panel.example.com/');
                    headers.set('Origin', 'https://1panel.example.com');
                    return headers;
                }
            },
            {
                name: 'localhost_masking',
                headers: () => {
                    const headers = new Headers(browserHeaders);
                    // 尝试使用localhost
                    headers.set('Host', 'localhost:' + targetUrl.port);
                    headers.set('Referer', `http://localhost:${targetUrl.port}/`);
                    return headers;
                }
            },
            {
                name: 'target_host_direct',
                headers: () => {
                    const headers = new Headers(browserHeaders);
                    // 直接使用目标服务器的Host
                    headers.set('Host', targetUrl.host);
                    headers.set('Referer', `${targetUrl.protocol}//${targetUrl.host}/`);
                    headers.set('Origin', `${targetUrl.protocol}//${targetUrl.host}`);
                    return headers;
                }
            },
            {
                name: 'no_host',
                headers: () => {
                    const headers = new Headers(browserHeaders);
                    // 完全不设置Host
                    return headers;
                }
            },
            {
                name: 'minimal_headers',
                headers: () => {
                    const headers = new Headers();
                    // 只使用最基本的头
                    headers.set('User-Agent', 'curl/7.68.0');
                    headers.set('Accept', '*/*');
                    return headers;
                }
            },
            {
                name: 'firefox_simulation',
                headers: () => {
                    const headers = new Headers();
                    headers.set('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/109.0');
                    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8');
                    headers.set('Accept-Language', 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2');
                    headers.set('Accept-Encoding', 'gzip, deflate');
                    headers.set('DNT', '1');
                    headers.set('Connection', 'keep-alive');
                    headers.set('Upgrade-Insecure-Requests', '1');
                    headers.set('Host', targetUrl.host);
                    return headers;
                }
            },
            {
                name: 'python_requests',
                headers: () => {
                    const headers = new Headers();
                    headers.set('User-Agent', 'python-requests/2.28.1');
                    headers.set('Accept', '*/*');
                    headers.set('Accept-Encoding', 'gzip, deflate');
                    headers.set('Connection', 'keep-alive');
                    headers.set('Host', targetUrl.host);
                    return headers;
                }
            },
            {
                name: 'wget_simulation',
                headers: () => {
                    const headers = new Headers();
                    headers.set('User-Agent', 'Wget/1.20.3 (linux-gnu)');
                    headers.set('Accept', '*/*');
                    headers.set('Accept-Encoding', 'identity');
                    headers.set('Connection', 'Keep-Alive');
                    headers.set('Host', targetUrl.host);
                    return headers;
                }
            },
            {
                name: 'cloudflare_bypass',
                headers: () => {
                    const headers = new Headers();
                    // 伪装成来自CDN的请求
                    headers.set('User-Agent', 'Mozilla/5.0 (compatible; CloudflareBot/1.0; +https://www.cloudflare.com/bot-management/)');
                    headers.set('Accept', '*/*');
                    headers.set('CF-RAY', '12345-ABC');
                    headers.set('CF-Visitor', '{"scheme":"https"}');
                    headers.set('Host', targetUrl.host);
                    return headers;
                }
            },
            {
                name: 'nginx_proxy',
                headers: () => {
                    const headers = new Headers();
                    // 伪装成Nginx反向代理
                    headers.set('User-Agent', 'nginx/1.18.0');
                    headers.set('Accept', '*/*');
                    headers.set('X-Real-IP', '192.168.1.100');
                    headers.set('X-Forwarded-For', '192.168.1.100');
                    headers.set('X-Forwarded-Proto', 'https');
                    headers.set('Host', targetUrl.host);
                    return headers;
                }
            },
            {
                name: 'mobile_safari',
                headers: () => {
                    const headers = new Headers();
                    // 移动端Safari伪装
                    headers.set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1');
                    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
                    headers.set('Accept-Language', 'zh-CN,zh;q=0.9');
                    headers.set('Accept-Encoding', 'gzip, deflate');
                    headers.set('Host', targetUrl.host);
                    return headers;
                }
            },
            {
                name: 'no_special_headers',
                headers: () => {
                    const headers = new Headers();
                    // 只保留最基础的头部，不包含任何可能被识别为代理的头部
                    headers.set('Accept', 'text/html');
                    headers.set('Host', targetUrl.host);
                    return headers;
                }
            },
            {
                name: 'direct_ip_access',
                headers: () => {
                    const headers = new Headers();
                    // 尝试直接IP访问，不设置任何虚拟主机头
                    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
                    headers.set('Accept-Language', 'en-US,en;q=0.5');
                    headers.set('Cache-Control', 'no-cache');
                    headers.set('Pragma', 'no-cache');
                    // 不设置Host头，让服务器直接处理IP访问
                    return headers;
                }
            },
            {
                name: 'legacy_browser',
                headers: () => {
                    const headers = new Headers();
                    // 模拟老版本浏览器
                    headers.set('User-Agent', 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)');
                    headers.set('Accept', 'text/html,application/xhtml+xml,*/*');
                    headers.set('Accept-Language', 'en-us');
                    headers.set('Host', targetUrl.host);
                    return headers;
                }
            },
            {
                name: 'api_client',
                headers: () => {
                    const headers = new Headers();
                    // 模拟API客户端访问
                    headers.set('User-Agent', 'okhttp/4.9.0');
                    headers.set('Accept', 'application/json, text/plain, */*');
                    headers.set('Content-Type', 'application/json');
                    headers.set('Host', targetUrl.host);
                    return headers;
                }
            },
            {
                name: 'postman_simulation',
                headers: () => {
                    const headers = new Headers();
                    // 模拟Postman客户端
                    headers.set('User-Agent', 'PostmanRuntime/7.28.4');
                    headers.set('Accept', '*/*');
                    headers.set('Accept-Encoding', 'gzip, deflate, br');
                    headers.set('Host', targetUrl.host);
                    headers.set('Cache-Control', 'no-cache');
                    headers.set('Postman-Token', '12345678-1234-1234-1234-123456789012');
                    return headers;
                }
            },
            {
                name: 'health_check',
                headers: () => {
                    const headers = new Headers();
                    // 模拟健康检查请求
                    headers.set('User-Agent', 'HealthCheck/1.0');
                    headers.set('Accept', '*/*');
                    headers.set('Host', targetUrl.host);
                    headers.set('X-Health-Check', 'true');
                    return headers;
                }
            },
            {
                name: 'internal_service',
                headers: () => {
                    const headers = new Headers();
                    // 模拟内部服务调用
                    headers.set('User-Agent', 'InternalService/1.0');
                    headers.set('Accept', '*/*');
                    headers.set('Host', targetUrl.host);
                    headers.set('X-Internal-Request', 'true');
                    headers.set('X-Service-Name', 'proxy-gateway');
                    return headers;
                }
            },
            {
                name: 'load_balancer',
                headers: () => {
                    const headers = new Headers();
                    // 模拟负载均衡器请求
                    headers.set('User-Agent', 'HAProxy/2.4');
                    headers.set('Accept', '*/*');
                    headers.set('Host', targetUrl.host);
                    headers.set('X-Forwarded-For', '10.0.0.1');
                    headers.set('X-Real-IP', '10.0.0.1');
                    headers.set('X-Forwarded-Proto', 'https');
                    headers.set('X-Load-Balancer', 'true');
                    return headers;
                }
            },
            {
                name: 'monitoring_agent',
                headers: () => {
                    const headers = new Headers();
                    // 模拟监控代理
                    headers.set('User-Agent', 'Prometheus/2.30.0');
                    headers.set('Accept', 'text/plain');
                    headers.set('Host', targetUrl.host);
                    headers.set('X-Prometheus-Scrape', 'true');
                    return headers;
                }
            },
            {
                name: 'raw_request',
                headers: () => {
                    const headers = new Headers();
                    // 最原始的HTTP请求
                    headers.set('Host', targetUrl.host);
                    return headers;
                }
            }
        ];

        let lastError = null;
        let debugInfo = [];

        // 尝试不同的策略
        for (const strategy of strategies) {
            try {
                const strategyHeaders = strategy.headers();

                // 复制原始请求的重要头部（除了Host相关的）
                const importantHeaders = ['authorization', 'content-type', 'x-api-key', 'x-auth-token'];
                for (const headerName of importantHeaders) {
                    const value = request.headers.get(headerName);
                    if (value) {
                        strategyHeaders.set(headerName, value);
                    }
                }

                // 创建请求
                const modifiedRequest = new Request(targetUrl.toString(), {
                    method: request.method,
                    headers: strategyHeaders,
                    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null
                });

                // 发送请求
                const response = await fetch(modifiedRequest);

                debugInfo.push({
                    strategy: strategy.name,
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(strategyHeaders.entries()),
                    success: response.ok
                });

                // 如果成功，返回响应
                if (response.ok) {
                    const responseHeaders = new Headers(response.headers);

                    // 移除可能导致问题的响应头
                    responseHeaders.delete('content-encoding');
                    responseHeaders.delete('content-length');
                    responseHeaders.delete('transfer-encoding');

                    // 添加调试信息到响应头（如果开启调试模式）
                    // 调试端点强制添加调试信息
                    responseHeaders.set('X-Proxy-Strategy', strategy.name);
                    responseHeaders.set('X-Proxy-Debug', JSON.stringify(debugInfo));

                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: responseHeaders
                    });
                }

                lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);

            } catch (error) {
                debugInfo.push({
                    strategy: strategy.name,
                    error: error.message,
                    success: false
                });
                lastError = error;
            }
        }

        // 所有策略都失败了
        const errorDetails = {
            error: 'All proxy strategies failed',
            message: lastError ? lastError.message : 'Unknown error',
            target: config.proxyURL,
            timestamp: new Date().toISOString(),
            strategiesTried: debugInfo.length
        };

        // 调试端点强制显示详细信息
        errorDetails.debugInfo = debugInfo;
        errorDetails.targetHost = targetUrl.host;
        errorDetails.requestMethod = request.method;
        errorDetails.requestPath = url.pathname + url.search;

        return new Response(JSON.stringify(errorDetails, null, 2), {
            status: 502,
            headers: {
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error('Proxy error:', error);

        const errorDetails = {
            error: 'Proxy Error',
            message: error.message,
            target: config.proxyURL,
            timestamp: new Date().toISOString()
        };

        // 调试端点强制显示详细错误信息
        errorDetails.debugInfo = {
            requestUrl: url.pathname + url.search,
            targetHost: new URL(config.proxyURL).host,
            requestMethod: request.method,
            errorStack: error.stack
        };

        return new Response(JSON.stringify(errorDetails), {
            status: 502,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}

/**
 * 网络连接诊断测试
 */
async function handleNetworkTest(request, env) {
    const config = await getServiceConfig(env);

    if (!config) {
        return new Response(JSON.stringify({
            error: 'No configuration found',
            message: 'Cannot test network without configuration'
        }), {
            status: 404,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    const testResults = [];
    const targetUrl = new URL(config.proxyURL);

    // 测试1: 基本连接测试
    try {
        const testUrl = `${targetUrl.protocol}//${targetUrl.host}/`;
        const response = await fetch(testUrl, {
            method: 'HEAD',
            headers: {
                'User-Agent': 'Cloudflare-Workers-Proxy-Test'
            }
        });

        testResults.push({
            test: 'Basic Connection',
            url: testUrl,
            status: response.status,
            statusText: response.statusText,
            success: response.ok
        });
    } catch (error) {
        testResults.push({
            test: 'Basic Connection',
            url: `${targetUrl.protocol}//${targetUrl.host}/`,
            error: error.message,
            success: false
        });
    }

    // 测试2: 带Host头的连接测试
    try {
        const testUrl = `${targetUrl.protocol}//${targetUrl.host}/`;
        const response = await fetch(testUrl, {
            method: 'HEAD',
            headers: {
                'Host': targetUrl.host,
                'User-Agent': 'Cloudflare-Workers-Proxy-Test'
            }
        });

        testResults.push({
            test: 'With Host Header',
            url: testUrl,
            host: targetUrl.host,
            status: response.status,
            statusText: response.statusText,
            success: response.ok
        });
    } catch (error) {
        testResults.push({
            test: 'With Host Header',
            url: `${targetUrl.protocol}//${targetUrl.host}/`,
            host: targetUrl.host,
            error: error.message,
            success: false
        });
    }

    // 测试3: HTTP版本测试（如果原来是HTTPS）
    if (targetUrl.protocol === 'https:') {
        try {
            const httpUrl = `http://${targetUrl.host}/`;
            const response = await fetch(httpUrl, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Cloudflare-Workers-Proxy-Test'
                }
            });

            testResults.push({
                test: 'HTTP Version',
                url: httpUrl,
                status: response.status,
                statusText: response.statusText,
                success: response.ok
            });
        } catch (error) {
            testResults.push({
                test: 'HTTP Version',
                url: `http://${targetUrl.host}/`,
                error: error.message,
                success: false
            });
        }
    }

    return new Response(JSON.stringify({
        timestamp: new Date().toISOString(),
        targetConfig: config.proxyURL,
        testResults: testResults,
        summary: {
            total: testResults.length,
            successful: testResults.filter(r => r.success).length,
            failed: testResults.filter(r => !r.success).length
        }
    }, null, 2), {
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

/**
 * 代理系统诊断报告
 */
async function handleProxyReport(request, env) {
    const config = await getServiceConfig(env);

    if (!config) {
        return new Response(JSON.stringify({
            error: 'No configuration found',
            message: 'Cannot generate proxy report without configuration'
        }), {
            status: 404,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    const report = {
        timestamp: new Date().toISOString(),
        targetConfig: config.proxyURL,
        configSource: getConfigSource(env),
        kvInfo: getKVInfo(env),
        config: config,
        testResults: await handleTestTarget(request, env),
        networkTestResults: await handleNetworkTest(request, env)
    };

    return new Response(JSON.stringify(report), {
        headers: {
            'Content-Type': 'application/json'
        }
    });
}