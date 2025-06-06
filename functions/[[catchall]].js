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
        } else if (path === '/api/debug-direct') {
            // 直接测试目标服务器响应
            response = await handleDebugDirect(request, env);
        } else if (path === '/api/test-bypass') {
            // 测试最新绕过策略
            response = await handleTestBypass(request, env);
        } else if (path === '/api/bright-bypass') {
            // 基于Bright Data方法的高级绕过策略  
            response = await handleBrightBypass(request, env);
        } else if (path === '/api/advanced-bypass') {
            // 高级绕过技术测试，包括端口扫描和子域名发现
            response = await handleAdvancedBypassTest(request, env);
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
        const originalPathname = url.pathname;
        const originalSearch = url.search;

        targetUrl.pathname = originalPathname;
        targetUrl.search = originalSearch;

        console.log('代理请求:', {
            original: request.url,
            target: targetUrl.toString(),
            method: request.method
        });

        const bypassStrategies = [{
                name: 'raw_ip_access',
                createRequest: () => {
                    const headers = new Headers();
                    // 完全不设置Host头，让服务器处理原始IP访问
                    headers.set('User-Agent', 'curl/7.68.0');
                    headers.set('Accept', '*/*');
                    headers.set('Connection', 'close');
                    return headers;
                }
            },
            {
                name: 'session_warmup',
                createRequest: async () => {
                    const headers = new Headers();
                    // 多步骤访问：先访问根路径预热连接
                    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8');
                    headers.set('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8');
                    headers.set('Cache-Control', 'max-age=0');
                    headers.set('Sec-Fetch-Dest', 'document');
                    headers.set('Sec-Fetch-Mode', 'navigate');
                    headers.set('Sec-Fetch-Site', 'none');
                    headers.set('Sec-Fetch-User', '?1');
                    headers.set('Upgrade-Insecure-Requests', '1');
                    // 创建看起来真实的会话ID
                    headers.set('Cookie', `PHPSESSID=${generateSessionId()}; cf_clearance=${generateCfClearance()}`);
                    return headers;
                }
            },
            {
                name: 'protocol_downgrade',
                createRequest: () => {
                    const headers = new Headers();
                    // 使用HTTP/1.0协议特征
                    headers.set('User-Agent', 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)');
                    headers.set('Accept', 'image/gif, image/x-xbitmap, image/jpeg, image/pjpeg, */*');
                    headers.set('Accept-Language', 'en-us');
                    headers.set('Connection', 'Keep-Alive');
                    headers.set('Pragma', 'no-cache');
                    return headers;
                }
            },
            {
                name: 'bot_simulation',
                createRequest: () => {
                    const headers = new Headers();
                    // 模拟搜索引擎爬虫
                    headers.set('User-Agent', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
                    headers.set('Accept', '*/*');
                    headers.set('Accept-Language', 'en');
                    headers.set('From', 'googlebot@google.com');
                    return headers;
                }
            },
            {
                name: 'edge_case_exploit',
                createRequest: () => {
                    const headers = new Headers();
                    // 利用边缘情况：非标准但有效的头部组合
                    headers.set('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36');
                    headers.set('Accept', 'text/html');
                    headers.set('Accept-Encoding', ''); // 空的Accept-Encoding
                    headers.set('Connection', 'close');
                    headers.set('Cache-Control', 'no-store');
                    headers.set('Pragma', 'no-cache');
                    // 添加一些混淆的头部
                    headers.set('X-Forwarded-Host', 'localhost');
                    headers.set('X-Original-URL', '/');
                    return headers;
                }
            },
            {
                name: 'cdn_bypass',
                createRequest: () => {
                    const headers = new Headers();
                    // 伪装成CDN回源请求
                    headers.set('User-Agent', 'Amazon CloudFront');
                    headers.set('Accept', '*/*');
                    headers.set('Via', '1.1 ' + generateRandomCloudFrontId() + '.cloudfront.net (CloudFront)');
                    headers.set('X-Amz-Cf-Id', generateRandomCloudFrontId());
                    headers.set('X-Forwarded-For', generateRandomIP());
                    headers.set('X-Forwarded-Proto', 'https');
                    headers.set('X-Forwarded-Port', '443');
                    headers.set('CF-Ray', generateCfRay());
                    headers.set('CF-Visitor', '{"scheme":"https"}');
                    return headers;
                }
            },
            {
                name: 'localhost_bypass',
                createRequest: () => {
                    const headers = new Headers();
                    // 伪装成本地访问
                    headers.set('Host', 'localhost:' + targetUrl.port);
                    headers.set('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36');
                    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
                    headers.set('X-Forwarded-For', '127.0.0.1');
                    headers.set('X-Real-IP', '127.0.0.1');
                    return headers;
                }
            },
            {
                name: 'internal_service',
                createRequest: () => {
                    const headers = new Headers();
                    // 伪装成内部服务调用
                    headers.set('Host', targetUrl.host);
                    headers.set('User-Agent', 'InternalService/1.0');
                    headers.set('Accept', '*/*');
                    headers.set('X-Internal-Request', 'true');
                    headers.set('X-Service-Name', 'internal-proxy');
                    headers.set('X-Forwarded-For', '192.168.1.1');
                    headers.set('X-Real-IP', '192.168.1.1');
                    return headers;
                }
            },
            {
                name: 'nginx_upstream',
                createRequest: () => {
                    const headers = new Headers();
                    // 伪装成Nginx上游服务器请求
                    headers.set('Host', targetUrl.host);
                    headers.set('User-Agent', 'nginx/1.20.1');
                    headers.set('Accept', '*/*');
                    headers.set('X-Forwarded-Proto', 'http');
                    headers.set('X-Forwarded-For', '10.0.0.1');
                    headers.set('X-Real-IP', '10.0.0.1');
                    headers.set('X-Nginx-Proxy', 'true');
                    return headers;
                }
            },
            {
                name: 'timing_attack',
                createRequest: () => {
                    const headers = new Headers();
                    // 使用特定时间间隔的请求模式
                    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
                    headers.set('Accept-Language', 'zh-CN,zh;q=0.9');
                    headers.set('If-Modified-Since', new Date(Date.now() - 3600000).toUTCString());
                    headers.set('If-None-Match', '"' + Math.random().toString(36) + '"');
                    return headers;
                }
            },
            {
                name: 'direct_connect',
                createRequest: () => {
                    const headers = new Headers();
                    // 最小化请求头，避免触发Cloudflare检测
                    headers.set('User-Agent', 'wget/1.20.3 (linux-gnu)');
                    headers.set('Accept', '*/*');
                    headers.set('Accept-Encoding', 'identity');
                    // 不设置Host头
                    return headers;
                }
            },
            {
                name: 'mobile_browser',
                createRequest: () => {
                    const headers = new Headers();
                    // 伪装成移动浏览器
                    headers.set('Host', targetUrl.host);
                    headers.set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1');
                    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
                    headers.set('Accept-Language', 'en-US,en;q=0.5');
                    headers.set('Accept-Encoding', 'gzip, deflate');
                    return headers;
                }
            },
            {
                name: 'api_client',
                createRequest: () => {
                    const headers = new Headers();
                    // 伪装成API客户端
                    headers.set('Host', targetUrl.host);
                    headers.set('User-Agent', 'okhttp/4.9.3');
                    headers.set('Accept', 'application/json, text/plain, */*');
                    headers.set('Content-Type', 'application/json');
                    return headers;
                }
            },
            {
                name: 'legacy_browser',
                createRequest: () => {
                    const headers = new Headers();
                    // 伪装成老版本浏览器
                    headers.set('Host', targetUrl.host);
                    headers.set('User-Agent', 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)');
                    headers.set('Accept', 'text/html,application/xhtml+xml,*/*');
                    headers.set('Accept-Language', 'en-us');
                    return headers;
                }
            },
            {
                name: 'cors_proxy_bypass',
                createRequest: () => {
                    // 使用第三方CORS代理绕过限制
                    const corsProxies = [
                        'https://corsproxy.io/?',
                        'https://cors-anywhere.herokuapp.com/',
                        'https://api.allorigins.win/raw?url=',
                        'https://cors.bridged.cc/',
                        'https://yacdn.org/proxy/'
                    ];

                    // 随机选择一个代理
                    const proxy = corsProxies[Math.floor(Math.random() * corsProxies.length)];
                    const proxiedUrl = proxy + encodeURIComponent(targetUrl.toString());

                    const headers = new Headers();
                    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
                    headers.set('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8');

                    return {
                        headers,
                        url: proxiedUrl
                    };
                }
            },
            {
                name: 'dns_over_https',
                createRequest: () => {
                    const headers = new Headers();
                    // 尝试通过DoH解析域名绕过某些限制
                    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                    headers.set('Accept', '*/*');
                    headers.set('Accept-Encoding', 'identity');
                    headers.set('Connection', 'close');
                    // 添加DoH相关头部
                    headers.set('Accept', 'application/dns-message');
                    headers.set('Content-Type', 'application/dns-message');
                    return headers;
                }
            },
            {
                name: 'sni_spoofing_simulation',
                createRequest: () => {
                    const headers = new Headers();
                    // 模拟SNI欺骗 - 伪装成访问合法域名
                    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7');
                    headers.set('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8');
                    headers.set('Accept-Encoding', 'gzip, deflate, br');
                    headers.set('Sec-Fetch-Dest', 'document');
                    headers.set('Sec-Fetch-Mode', 'navigate');
                    headers.set('Sec-Fetch-Site', 'none');
                    headers.set('Sec-Fetch-User', '?1');
                    // 关键：不设置Host头，让系统自动处理
                    // 这模拟了SNI欺骗的行为
                    return headers;
                }
            },
            {
                name: 'http_1_downgrade',
                createRequest: () => {
                    const headers = new Headers();
                    // HTTP/1.1降级策略 - 某些Cloudflare保护可能只检查HTTP/2
                    headers.set('User-Agent', 'curl/7.68.0');
                    headers.set('Accept', '*/*');
                    headers.set('Connection', 'close');
                    headers.set('Cache-Control', 'no-cache');
                    headers.set('Pragma', 'no-cache');
                    // 强制HTTP/1.1
                    return headers;
                }
            },
            {
                name: 'websocket_upgrade_attempt',
                createRequest: () => {
                    const headers = new Headers();
                    // 尝试WebSocket升级绕过
                    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                    headers.set('Connection', 'Upgrade');
                    headers.set('Upgrade', 'websocket');
                    headers.set('Sec-WebSocket-Version', '13');
                    headers.set('Sec-WebSocket-Key', btoa(Math.random().toString()).substr(0, 22) + '==');
                    headers.set('Origin', 'https://example.com');
                    return headers;
                }
            },
            {
                name: 'range_request_bypass',
                createRequest: () => {
                    const headers = new Headers();
                    // Range请求绕过
                    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                    headers.set('Accept', '*/*');
                    headers.set('Range', 'bytes=0-1024');
                    headers.set('Accept-Encoding', 'identity');
                    return headers;
                }
            },
            {
                name: 'cache_control_bypass',
                createRequest: () => {
                    const headers = new Headers();
                    // 缓存控制绕过
                    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                    headers.set('Accept', '*/*');
                    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
                    headers.set('Pragma', 'no-cache');
                    headers.set('Expires', '0');
                    headers.set('If-Modified-Since', 'Thu, 01 Jan 1970 00:00:00 GMT');
                    return headers;
                }
            },
            {
                name: 'method_override_bypass',
                createRequest: () => {
                    const headers = new Headers();
                    // HTTP方法覆盖绕过
                    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                    headers.set('Accept', '*/*');
                    headers.set('X-HTTP-Method-Override', 'GET');
                    headers.set('X-Method-Override', 'GET');
                    headers.set('X-Original-Method', 'GET');
                    return headers;
                }
            },
            {
                name: 'cf_ray_spoofing',
                createRequest: () => {
                    const headers = new Headers();
                    // 伪造Cloudflare Ray ID
                    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                    headers.set('Accept', '*/*');
                    headers.set('CF-Ray', generateCfRay());
                    headers.set('CF-Visitor', '{"scheme":"https"}');
                    headers.set('CF-IPCountry', 'US');
                    headers.set('CF-Connecting-IP', generateRandomIP());
                    return headers;
                }
            },
            {
                name: 'xff_forwarding_bypass',
                createRequest: () => {
                    const headers = new Headers();
                    // X-Forwarded-For绕过
                    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                    headers.set('Accept', '*/*');
                    headers.set('X-Forwarded-For', '127.0.0.1, 192.168.1.1, ' + generateRandomIP());
                    headers.set('X-Real-IP', '127.0.0.1');
                    headers.set('X-Originating-IP', '127.0.0.1');
                    headers.set('X-Forwarded-Host', 'localhost');
                    headers.set('X-Remote-IP', '127.0.0.1');
                    headers.set('X-Remote-Addr', '127.0.0.1');
                    return headers;
                }
            },
            {
                name: 'accept_encoding_bypass',
                createRequest: () => {
                    const headers = new Headers();
                    // Accept-Encoding绕过
                    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                    headers.set('Accept', '*/*');
                    headers.set('Accept-Encoding', ''); // 空的Accept-Encoding
                    headers.set('Accept-Charset', 'ISO-8859-1,utf-8;q=0.7,*;q=0.7');
                    return headers;
                }
            }
        ];

        let lastError = null;
        let debugInfo = [];

        // 尝试不同的绕过策略
        for (const strategy of bypassStrategies) {
            // 在尝试每个策略前加入随机延迟
            const randomDelay = Math.floor(Math.random() * 1500) + 500; // 500ms to 2000ms
            console.log(`等待 ${randomDelay}ms 后尝试策略: ${strategy.name}`);
            await new Promise(resolve => setTimeout(resolve, randomDelay));

            try {
                const strategyResult = strategy.createRequest();

                // 处理异步策略
                const proxyHeaders = strategyResult instanceof Promise ?
                    await strategyResult :
                    (strategyResult.headers || strategyResult);

                // 确保Host头是目标服务器的Host
                proxyHeaders.set('Host', targetUrl.host);

                // 复制Referer头 (如果存在)
                if (request.headers.has('Referer')) {
                    proxyHeaders.set('Referer', request.headers.get('Referer').replace(url.origin, targetUrl.origin));
                }

                const requestUrlToFetch = strategyResult.url || targetUrl.toString();

                // 复制重要的认证头部
                const authHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
                for (const headerName of authHeaders) {
                    const value = request.headers.get(headerName);
                    if (value) {
                        proxyHeaders.set(headerName, value);
                    }
                }

                const proxyRequest = new Request(requestUrlToFetch, {
                    method: request.method,
                    headers: proxyHeaders,
                    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
                });

                console.log(`尝试策略 ${strategy.name}:`, {
                    url: requestUrlToFetch,
                    headers: Object.fromEntries(proxyHeaders.entries())
                });

                const response = await fetch(proxyRequest);

                debugInfo.push({
                    strategy: strategy.name,
                    status: response.status,
                    statusText: response.statusText,
                    success: response.ok,
                    headers: Object.fromEntries(proxyHeaders.entries()),
                    requestUrl: requestUrlToFetch
                });

                console.log(`策略 ${strategy.name} 结果:`, {
                    status: response.status,
                    statusText: response.statusText,
                    success: response.ok
                });

                // 如果成功，处理响应
                if (response.ok) {
                    const responseHeaders = new Headers(response.headers);

                    // 添加CORS头部
                    responseHeaders.set('Access-Control-Allow-Origin', '*');
                    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Service-Key, X-Requested-With');

                    // 移除可能导致问题的头部
                    responseHeaders.delete('content-security-policy');
                    responseHeaders.delete('x-frame-options');
                    responseHeaders.delete('content-encoding');
                    responseHeaders.delete('content-length');
                    responseHeaders.delete('transfer-encoding');

                    // 添加调试信息
                    responseHeaders.set('X-Proxy-Strategy', strategy.name);
                    responseHeaders.set('X-Bypass-Success', 'true');

                    let responseBody = await response.arrayBuffer();
                    let contentType = response.headers.get('content-type') || '';

                    // 内容重写：替换目标URL为代理URL
                    if (contentType.includes('text/html') || contentType.includes('application/javascript') || contentType.includes('text/css')) {
                        let textBody = new TextDecoder().decode(responseBody);

                        // 替换所有 http(s)://targetHost:targetPort 为 https://proxyHost
                        const targetOriginRegex = new RegExp(targetUrl.origin.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'g');
                        textBody = textBody.replace(targetOriginRegex, url.origin);

                        // 替换所有 //targetHost:targetPort (协议相对URL)
                        const targetHostPort = targetUrl.host;
                        const protocolRelativeRegex = new RegExp(`//${targetHostPort.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`, 'g');
                        textBody = textBody.replace(protocolRelativeRegex, `//${url.host}`);

                        // 替换相对路径中的 / (确保只处理引号或括号内的)
                        // 注意: 这是一个简化的版本，可能不够鲁棒，需要更复杂的解析器才能完美处理所有情况
                        // 例如: src="/path", href='/path', url(/path)
                        const relativePathRegex = /(href|src|action|url\()(['"]?)(\/)(?!\/)/gi;
                        textBody = textBody.replace(relativePathRegex, (match, p1, p2, p3) => {
                            return `${p1}${p2}${url.origin}/`;
                        });

                        responseBody = new TextEncoder().encode(textBody);
                    }

                    // 如果原始响应是gzip压缩的，我们需要重新压缩
                    // Cloudflare Workers 会自动处理 Accept-Encoding 和响应的 gzip 压缩，
                    // 所以我们通常不需要手动处理，除非明确要控制。
                    // 这里我们删除了原有的Content-Encoding，让CF自动处理或不压缩。

                    return new Response(responseBody, {
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
                console.log(`策略 ${strategy.name} 失败:`, error.message);
            }
        }

        // 所有策略都失败了
        const errorDetails = {
            error: 'All bypass strategies failed',
            message: lastError ? lastError.message : 'Unknown error',
            target: config.proxyURL,
            timestamp: new Date().toISOString(),
            strategiesTried: debugInfo.length,
            debugInfo: debugInfo
        };

        console.error('所有绕过策略都失败了:', errorDetails);

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

/**
 * 直接测试目标服务器响应
 */
async function handleDebugDirect(request, env) {
    const config = await getServiceConfig(env);

    if (!config) {
        return new Response(JSON.stringify({
            error: 'No configuration found'
        }), {
            status: 404,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    const targetUrl = new URL(config.proxyURL);
    const debugInfo = {
        timestamp: new Date().toISOString(),
        targetConfig: config.proxyURL,
        targetHost: targetUrl.host,
        tests: []
    };

    // 测试1: 直接访问目标服务器根路径
    try {
        const testUrl = `${targetUrl.protocol}//${targetUrl.host}/`;
        const response = await fetch(testUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Cloudflare-Workers-Proxy-Debug',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        const responseText = await response.text();

        debugInfo.tests.push({
            test: 'Direct Access',
            url: testUrl,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            bodyPreview: responseText.substring(0, 500),
            success: response.ok
        });
    } catch (error) {
        debugInfo.tests.push({
            test: 'Direct Access',
            error: error.message,
            success: false
        });
    }

    // 测试2: 使用Host头访问
    try {
        const testUrl = `${targetUrl.protocol}//${targetUrl.host}/`;
        const response = await fetch(testUrl, {
            method: 'GET',
            headers: {
                'Host': targetUrl.host,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        const responseText = await response.text();

        debugInfo.tests.push({
            test: 'With Host Header',
            url: testUrl,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            bodyPreview: responseText.substring(0, 500),
            success: response.ok
        });
    } catch (error) {
        debugInfo.tests.push({
            test: 'With Host Header',
            error: error.message,
            success: false
        });
    }

    // 测试3: 模拟我们的代理请求
    try {
        const testUrl = `${targetUrl.protocol}//${targetUrl.host}/`;
        const proxyHeaders = new Headers();

        // 复制当前请求的头部
        for (const [name, value] of request.headers.entries()) {
            if (!['host', 'cf-ray', 'cf-visitor', 'cf-connecting-ip'].includes(name.toLowerCase())) {
                proxyHeaders.set(name, value);
            }
        }

        proxyHeaders.set('Host', targetUrl.host);
        proxyHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        const response = await fetch(testUrl, {
            method: 'GET',
            headers: proxyHeaders
        });

        const responseText = await response.text();

        debugInfo.tests.push({
            test: 'Proxy Simulation',
            url: testUrl,
            requestHeaders: Object.fromEntries(proxyHeaders.entries()),
            status: response.status,
            statusText: response.statusText,
            responseHeaders: Object.fromEntries(response.headers.entries()),
            bodyPreview: responseText.substring(0, 500),
            success: response.ok
        });
    } catch (error) {
        debugInfo.tests.push({
            test: 'Proxy Simulation',
            error: error.message,
            success: false
        });
    }

    return new Response(JSON.stringify(debugInfo, null, 2), {
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

/**
 * 测试最新绕过策略
 */
async function handleTestBypass(request, env) {
    try {
        const config = await getServiceConfig(env);
        if (!config) {
            return new Response('配置未找到', {
                status: 500
            });
        }

        const targetUrl = new URL(config.proxyURL);

        // 测试最有效的几种策略
        const testStrategies = [
            'sni_spoofing_simulation',
            'http_1_downgrade',
            'xff_forwarding_bypass',
            'cf_ray_spoofing',
            'accept_encoding_bypass'
        ];

        const results = [];

        for (const strategyName of testStrategies) {
            try {
                const headers = new Headers();

                switch (strategyName) {
                    case 'sni_spoofing_simulation':
                        headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                        headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7');
                        headers.set('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8');
                        headers.set('Accept-Encoding', 'gzip, deflate, br');
                        headers.set('Sec-Fetch-Dest', 'document');
                        headers.set('Sec-Fetch-Mode', 'navigate');
                        headers.set('Sec-Fetch-Site', 'none');
                        headers.set('Sec-Fetch-User', '?1');
                        break;
                    case 'http_1_downgrade':
                        headers.set('User-Agent', 'curl/7.68.0');
                        headers.set('Accept', '*/*');
                        headers.set('Connection', 'close');
                        headers.set('Cache-Control', 'no-cache');
                        headers.set('Pragma', 'no-cache');
                        break;
                    case 'xff_forwarding_bypass':
                        headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                        headers.set('Accept', '*/*');
                        headers.set('X-Forwarded-For', '127.0.0.1, 192.168.1.1, ' + generateRandomIP());
                        headers.set('X-Real-IP', '127.0.0.1');
                        headers.set('X-Originating-IP', '127.0.0.1');
                        headers.set('X-Forwarded-Host', 'localhost');
                        break;
                    case 'cf_ray_spoofing':
                        headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                        headers.set('Accept', '*/*');
                        headers.set('CF-Ray', generateCfRay());
                        headers.set('CF-Visitor', '{"scheme":"https"}');
                        headers.set('CF-IPCountry', 'US');
                        headers.set('CF-Connecting-IP', generateRandomIP());
                        break;
                    case 'accept_encoding_bypass':
                        headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                        headers.set('Accept', '*/*');
                        headers.set('Accept-Encoding', '');
                        headers.set('Accept-Charset', 'ISO-8859-1,utf-8;q=0.7,*;q=0.7');
                        break;
                }

                const startTime = Date.now();

                const proxyResponse = await fetch(targetUrl.toString(), {
                    method: request.method,
                    headers: headers,
                    signal: AbortSignal.timeout(10000) // 10秒超时
                });

                const endTime = Date.now();
                const responseTime = endTime - startTime;

                const result = {
                    strategy: strategyName,
                    status: proxyResponse.status,
                    statusText: proxyResponse.statusText,
                    responseTime: responseTime + 'ms',
                    headers: Object.fromEntries(proxyResponse.headers.entries()),
                    success: proxyResponse.ok,
                    bodyPreview: await proxyResponse.text().then(text => text.substring(0, 200))
                };

                results.push(result);

            } catch (error) {
                results.push({
                    strategy: strategyName,
                    error: error.message,
                    success: false
                });
            }
        }

        return new Response(JSON.stringify({
            timestamp: new Date().toISOString(),
            target: targetUrl.toString(),
            testResults: results,
            summary: {
                totalTests: results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            }
        }, null, 2), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({
            error: '测试绕过策略失败: ' + error.message,
            timestamp: new Date().toISOString()
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
 * 测试多种高级绕过技术包括端口扫描
 */
async function handleAdvancedBypassTest(request, env) {
    try {
        const config = await getServiceConfig(env);
        if (!config) {
            return new Response('配置未找到', {
                status: 500
            });
        }

        const targetUrl = new URL(config.proxyURL);
        const targetHost = targetUrl.hostname;
        const targetPort = targetUrl.port || (targetUrl.protocol === 'https:' ? '443' : '80');

        const results = [];

        // 策略1: 端口扫描 - 尝试其他可能的端口
        const commonPorts = ['80', '443', '8080', '8443', '8000', '8008', '8888', '3000', '5000', '9000'];

        for (const port of commonPorts) {
            if (port === targetPort) continue; // 跳过已知端口

            try {
                const testUrl = `${targetUrl.protocol}//${targetHost}:${port}/`;
                const startTime = Date.now();

                const response = await fetch(testUrl, {
                    method: 'HEAD',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': '*/*',
                        'Connection': 'close'
                    },
                    signal: AbortSignal.timeout(5000)
                });

                const responseTime = Date.now() - startTime;

                results.push({
                    strategy: `port_scan_${port}`,
                    url: testUrl,
                    status: response.status,
                    statusText: response.statusText,
                    responseTime: responseTime + 'ms',
                    success: response.ok && response.status !== 403,
                    headers: Object.fromEntries(response.headers.entries())
                });

                // 如果找到一个可用端口，立即返回成功结果
                if (response.ok && response.status !== 403) {
                    return new Response(JSON.stringify({
                        success: true,
                        alternativeAccess: testUrl,
                        message: `发现可用端口: ${port}`,
                        response: {
                            status: response.status,
                            headers: Object.fromEntries(response.headers.entries())
                        }
                    }, null, 2), {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                }

            } catch (error) {
                results.push({
                    strategy: `port_scan_${port}`,
                    url: `${targetUrl.protocol}//${targetHost}:${port}/`,
                    error: error.message,
                    success: false
                });
            }
        }

        // 策略2: 子域名发现和测试
        const subdomains = ['www', 'api', 'admin', 'app', 'web', 'mail', 'ftp', 'staging', 'dev', 'test'];

        for (const subdomain of subdomains) {
            try {
                const subdomainUrl = `${targetUrl.protocol}//${subdomain}.${targetHost}:${targetPort}/`;
                const startTime = Date.now();

                const response = await fetch(subdomainUrl, {
                    method: 'HEAD',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': '*/*',
                        'Host': `${subdomain}.${targetHost}`
                    },
                    signal: AbortSignal.timeout(5000)
                });

                const responseTime = Date.now() - startTime;

                results.push({
                    strategy: `subdomain_${subdomain}`,
                    url: subdomainUrl,
                    status: response.status,
                    statusText: response.statusText,
                    responseTime: responseTime + 'ms',
                    success: response.ok && response.status !== 403,
                    headers: Object.fromEntries(response.headers.entries())
                });

                // 如果找到一个可用子域名，返回成功结果
                if (response.ok && response.status !== 403) {
                    return new Response(JSON.stringify({
                        success: true,
                        alternativeAccess: subdomainUrl,
                        message: `发现可用子域名: ${subdomain}.${targetHost}`,
                        response: {
                            status: response.status,
                            headers: Object.fromEntries(response.headers.entries())
                        }
                    }, null, 2), {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                }

            } catch (error) {
                results.push({
                    strategy: `subdomain_${subdomain}`,
                    url: `${targetUrl.protocol}//${subdomain}.${targetHost}:${targetPort}/`,
                    error: error.message,
                    success: false
                });
            }
        }

        // 策略3: DNS over HTTPS查找真实IP
        try {
            const dohUrl = `https://cloudflare-dns.com/dns-query?name=${targetHost}&type=A`;
            const dohResponse = await fetch(dohUrl, {
                headers: {
                    'Accept': 'application/dns-json',
                    'User-Agent': 'Advanced-Bypass-Scanner/1.0'
                }
            });

            if (dohResponse.ok) {
                const dnsData = await dohResponse.json();
                if (dnsData.Answer && dnsData.Answer.length > 0) {
                    const realIPs = dnsData.Answer
                        .filter(record => record.type === 1) // A records
                        .map(record => record.data);

                    results.push({
                        strategy: 'dns_over_https',
                        discoveredIPs: realIPs,
                        success: realIPs.length > 0
                    });

                    // 测试发现的真实IP
                    for (const ip of realIPs) {
                        if (ip !== targetHost) { // 确保不是同一个IP
                            try {
                                const directIpUrl = `${targetUrl.protocol}//${ip}:${targetPort}/`;
                                const response = await fetch(directIpUrl, {
                                    method: 'HEAD',
                                    headers: {
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                        'Accept': '*/*'
                                    },
                                    signal: AbortSignal.timeout(5000)
                                });

                                if (response.ok && response.status !== 403) {
                                    return new Response(JSON.stringify({
                                        success: true,
                                        alternativeAccess: directIpUrl,
                                        message: `通过DNS解析发现可用真实IP: ${ip}`,
                                        response: {
                                            status: response.status,
                                            headers: Object.fromEntries(response.headers.entries())
                                        }
                                    }, null, 2), {
                                        headers: {
                                            'Content-Type': 'application/json'
                                        }
                                    });
                                }
                            } catch (error) {
                                results.push({
                                    strategy: `real_ip_${ip}`,
                                    error: error.message,
                                    success: false
                                });
                            }
                        }
                    }
                }
            }
        } catch (error) {
            results.push({
                strategy: 'dns_over_https',
                error: error.message,
                success: false
            });
        }

        // 策略4: HTTP到HTTPS转换测试
        if (targetUrl.protocol === 'http:') {
            try {
                const httpsUrl = `https://${targetHost}:443/`;
                const response = await fetch(httpsUrl, {
                    method: 'HEAD',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': '*/*'
                    },
                    signal: AbortSignal.timeout(5000)
                });

                if (response.ok && response.status !== 403) {
                    return new Response(JSON.stringify({
                        success: true,
                        alternativeAccess: httpsUrl,
                        message: 'HTTPS版本可用',
                        response: {
                            status: response.status,
                            headers: Object.fromEntries(response.headers.entries())
                        }
                    }, null, 2), {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                }
            } catch (error) {
                results.push({
                    strategy: 'http_to_https',
                    error: error.message,
                    success: false
                });
            }
        }

        // 如果所有策略都失败，返回详细报告
        return new Response(JSON.stringify({
            success: false,
            message: '所有高级绕过策略都失败了',
            originalTarget: config.proxyURL,
            timestamp: new Date().toISOString(),
            detailedResults: results,
            summary: {
                totalTests: results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            },
            recommendations: [
                '目标服务器的Cloudflare保护非常严格',
                '建议联系目标服务器管理员获取正确的域名',
                '考虑使用VPN或其他网络路径',
                '检查是否有官方的API端点可用'
            ]
        }, null, 2), {
            headers: {
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({
            error: '高级绕过测试失败: ' + error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}

// 生成随机会话ID
function generateSessionId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// 生成CF Clearance token
function generateCfClearance() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-';
    let result = '';
    for (let i = 0; i < 43; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 生成随机CloudFront ID
function generateRandomCloudFrontId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 14; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 生成随机IP
function generateRandomIP() {
    return Math.floor(Math.random() * 255) + '.' +
        Math.floor(Math.random() * 255) + '.' +
        Math.floor(Math.random() * 255) + '.' +
        Math.floor(Math.random() * 255);
}

// 生成CF Ray ID
function generateCfRay() {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < 16; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result + '-LAX';
}

/**
 * 基于Bright Data方法的高级Cloudflare绕过策略
 * 参考：https://github.com/bright-cn/bypass-cloudflare
 */
async function handleBrightBypass(request, env) {
    try {
        const config = await getServiceConfig(env);
        if (!config) {
            return new Response('配置未找到', {
                status: 500
            });
        }

        const targetUrl = new URL(config.proxyURL);

        // 基于Bright Data文档的高级绕过策略
        const brightStrategies = [{
                name: 'realistic_chrome_fingerprint',
                createHeaders: () => {
                    const headers = new Headers();
                    // 完整的Chrome浏览器指纹模拟
                    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7');
                    headers.set('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8');
                    headers.set('Accept-Encoding', 'gzip, deflate, br');
                    headers.set('Cache-Control', 'max-age=0');
                    headers.set('Connection', 'keep-alive');
                    headers.set('Upgrade-Insecure-Requests', '1');
                    headers.set('Sec-Fetch-Dest', 'document');
                    headers.set('Sec-Fetch-Mode', 'navigate');
                    headers.set('Sec-Fetch-Site', 'none');
                    headers.set('Sec-Fetch-User', '?1');
                    headers.set('sec-ch-ua', '"Google Chrome";v="120", "Chromium";v="120", "Not:A-Brand";v="99"');
                    headers.set('sec-ch-ua-mobile', '?0');
                    headers.set('sec-ch-ua-platform', '"Windows"');
                    headers.set('Referer', 'https://www.google.com/');
                    // 模拟真实的来源
                    headers.set('Origin', 'https://www.google.com');
                    return headers;
                }
            },
            {
                name: 'firefox_mobile_fingerprint',
                createHeaders: () => {
                    const headers = new Headers();
                    // Firefox移动端指纹模拟
                    headers.set('User-Agent', 'Mozilla/5.0 (Mobile; rv:109.0) Gecko/109.0 Firefox/109.0');
                    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8');
                    headers.set('Accept-Language', 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2');
                    headers.set('Accept-Encoding', 'gzip, deflate');
                    headers.set('DNT', '1');
                    headers.set('Connection', 'keep-alive');
                    headers.set('Upgrade-Insecure-Requests', '1');
                    headers.set('Sec-Fetch-Dest', 'document');
                    headers.set('Sec-Fetch-Mode', 'navigate');
                    headers.set('Sec-Fetch-Site', 'none');
                    headers.set('Sec-Fetch-User', '?1');
                    headers.set('Referer', 'https://m.baidu.com/');
                    return headers;
                }
            },
            {
                name: 'safari_mac_fingerprint',
                createHeaders: () => {
                    const headers = new Headers();
                    // Safari macOS指纹模拟
                    headers.set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15');
                    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
                    headers.set('Accept-Language', 'zh-CN,zh-Hans;q=0.9');
                    headers.set('Accept-Encoding', 'gzip, deflate, br');
                    headers.set('Connection', 'keep-alive');
                    headers.set('Upgrade-Insecure-Requests', '1');
                    headers.set('Sec-Fetch-Dest', 'document');
                    headers.set('Sec-Fetch-Mode', 'navigate');
                    headers.set('Sec-Fetch-Site', 'none');
                    headers.set('Referer', 'https://www.apple.com/');
                    return headers;
                }
            },
            {
                name: 'edge_windows_fingerprint',
                createHeaders: () => {
                    const headers = new Headers();
                    // Microsoft Edge指纹模拟
                    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0');
                    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7');
                    headers.set('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6');
                    headers.set('Accept-Encoding', 'gzip, deflate, br');
                    headers.set('Cache-Control', 'max-age=0');
                    headers.set('Connection', 'keep-alive');
                    headers.set('Upgrade-Insecure-Requests', '1');
                    headers.set('Sec-Fetch-Dest', 'document');
                    headers.set('Sec-Fetch-Mode', 'navigate');
                    headers.set('Sec-Fetch-Site', 'none');
                    headers.set('Sec-Fetch-User', '?1');
                    headers.set('sec-ch-ua', '"Microsoft Edge";v="120", "Chromium";v="120", "Not:A-Brand";v="99"');
                    headers.set('sec-ch-ua-mobile', '?0');
                    headers.set('sec-ch-ua-platform', '"Windows"');
                    headers.set('Referer', 'https://www.bing.com/');
                    return headers;
                }
            },
            {
                name: 'api_client_simulation',
                createHeaders: () => {
                    const headers = new Headers();
                    // 模拟合法的API客户端
                    headers.set('User-Agent', 'PostmanRuntime/7.35.0');
                    headers.set('Accept', '*/*');
                    headers.set('Accept-Encoding', 'gzip, deflate, br');
                    headers.set('Connection', 'keep-alive');
                    headers.set('Cache-Control', 'no-cache');
                    headers.set('Postman-Token', generateRandomUUID());
                    return headers;
                }
            },
            {
                name: 'curl_advanced_simulation',
                createHeaders: () => {
                    const headers = new Headers();
                    // 高级curl模拟，添加更多真实性
                    headers.set('User-Agent', 'curl/8.4.0');
                    headers.set('Accept', '*/*');
                    headers.set('Connection', 'keep-alive');
                    // 添加一些curl不常见但合法的头部
                    headers.set('X-Request-ID', generateRandomRequestId());
                    return headers;
                }
            },
            {
                name: 'http2_fingerprint_simulation',
                createHeaders: () => {
                    const headers = new Headers();
                    // 模拟HTTP/2特征的请求
                    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
                    headers.set('Accept-Language', 'en-US,en;q=0.5');
                    headers.set('Accept-Encoding', 'gzip, deflate, br');
                    headers.set('Cache-Control', 'no-cache');
                    headers.set('Pragma', 'no-cache');
                    // HTTP/2 伪头部模拟（虽然在fetch中不能直接设置，但可以在一定程度上模拟行为）
                    headers.set(':authority', targetUrl.host);
                    headers.set(':method', 'GET');
                    headers.set(':path', '/');
                    headers.set(':scheme', targetUrl.protocol.slice(0, -1));
                    return headers;
                }
            },
            {
                name: 'search_engine_bot_simulation',
                createHeaders: () => {
                    const headers = new Headers();
                    // 模拟搜索引擎爬虫（通常不被阻止）
                    const bots = [
                        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                        'Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)',
                        'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
                        'Mozilla/5.0 (compatible; DuckDuckBot-Https/1.1; https://duckduckgo.com/duckduckbot)',
                        'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)'
                    ];
                    const selectedBot = bots[Math.floor(Math.random() * bots.length)];
                    headers.set('User-Agent', selectedBot);
                    headers.set('Accept', '*/*');
                    headers.set('Accept-Language', 'en');
                    return headers;
                }
            },
            {
                name: 'residential_proxy_simulation',
                createHeaders: () => {
                    const headers = new Headers();
                    // 模拟来自住宅代理的请求
                    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
                    headers.set('Accept-Language', 'zh-CN,zh;q=0.9');
                    headers.set('Accept-Encoding', 'gzip, deflate, br');
                    // 伪造真实的住宅IP特征
                    headers.set('X-Forwarded-For', generateResidentialIP());
                    headers.set('X-Real-IP', generateResidentialIP());
                    headers.set('Via', '1.1 residential-proxy');
                    headers.set('Forwarded', `for=${generateResidentialIP()};proto=https`);
                    return headers;
                }
            },
            {
                name: 'mobile_app_simulation',
                createHeaders: () => {
                    const headers = new Headers();
                    // 模拟移动应用的网络请求
                    headers.set('User-Agent', 'MyApp/1.0 (iPhone; iOS 17.1; Scale/3.00)');
                    headers.set('Accept', 'application/json, text/plain, */*');
                    headers.set('Accept-Language', 'zh-CN');
                    headers.set('Accept-Encoding', 'gzip, deflate, br');
                    headers.set('X-App-Version', '1.2.3');
                    headers.set('X-Platform', 'iOS');
                    headers.set('X-Device-ID', generateRandomUUID());
                    return headers;
                }
            }
        ];

        const results = [];

        // 尝试每种策略
        for (const strategy of brightStrategies) {
            try {
                const strategyHeaders = strategy.createHeaders();

                // 复制原始请求的认证头部
                const authHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
                for (const headerName of authHeaders) {
                    const value = request.headers.get(headerName);
                    if (value) {
                        strategyHeaders.set(headerName, value);
                    }
                }

                const startTime = Date.now();

                const proxyResponse = await fetch(targetUrl.toString(), {
                    method: request.method,
                    headers: strategyHeaders,
                    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
                    signal: AbortSignal.timeout(15000)
                });

                const responseTime = Date.now() - startTime;

                const result = {
                    strategy: strategy.name,
                    status: proxyResponse.status,
                    statusText: proxyResponse.statusText,
                    responseTime: responseTime + 'ms',
                    success: proxyResponse.ok && proxyResponse.status !== 403,
                    headers: Object.fromEntries(strategyHeaders.entries()),
                    responseHeaders: Object.fromEntries(proxyResponse.headers.entries())
                };

                results.push(result);

                console.log(`Bright策略 ${strategy.name} 结果:`, {
                    status: proxyResponse.status,
                    success: result.success
                });

                // 如果成功，立即处理并返回响应
                if (proxyResponse.ok && proxyResponse.status !== 403) {
                    const responseHeaders = new Headers(proxyResponse.headers);

                    // 添加CORS头部
                    responseHeaders.set('Access-Control-Allow-Origin', '*');
                    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Service-Key, X-Requested-With');

                    // 移除可能导致问题的头部
                    responseHeaders.delete('content-security-policy');
                    responseHeaders.delete('x-frame-options');
                    responseHeaders.delete('content-encoding');
                    responseHeaders.delete('content-length');
                    responseHeaders.delete('transfer-encoding');

                    // 添加成功标识
                    responseHeaders.set('X-Bright-Strategy', strategy.name);
                    responseHeaders.set('X-Bypass-Success', 'true');
                    responseHeaders.set('X-Response-Time', responseTime + 'ms');

                    return new Response(proxyResponse.body, {
                        status: proxyResponse.status,
                        statusText: proxyResponse.statusText,
                        headers: responseHeaders
                    });
                }

            } catch (error) {
                results.push({
                    strategy: strategy.name,
                    error: error.message,
                    success: false
                });
                console.log(`Bright策略 ${strategy.name} 失败:`, error.message);
            }
        }

        // 所有策略都失败了
        return new Response(JSON.stringify({
            success: false,
            message: '所有Bright Data启发的绕过策略都失败了',
            originalTarget: config.proxyURL,
            timestamp: new Date().toISOString(),
            strategiesTested: results.length,
            detailedResults: results,
            summary: {
                totalTests: results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            },
            recommendations: [
                '目标服务器的Cloudflare保护级别非常高',
                '可能需要付费的专业绕过服务如Bright Data Web Unlocker',
                '建议尝试使用真正的无头浏览器如Selenium或Playwright',
                '考虑联系目标服务管理员获取白名单访问'
            ]
        }, null, 2), {
            status: 502,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({
            error: '基于Bright Data的绕过测试失败: ' + error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

// 生成随机UUID
function generateRandomUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// 生成随机请求ID
function generateRandomRequestId() {
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// 生成住宅IP地址
function generateResidentialIP() {
    // 生成看起来像住宅的IP段
    const ranges = [
        [192, 168], // 本地网络
        [10, 0], // 私有网络
        [172, 16], // 私有网络
        [203, 0], // 亚太地区
        [115, 0], // 中国地区
        [124, 0] // 亚洲地区
    ];

    const range = ranges[Math.floor(Math.random() * ranges.length)];
    const third = Math.floor(Math.random() * 255);
    const fourth = Math.floor(Math.random() * 254) + 1;

    return `${range[0]}.${range[1]}.${third}.${fourth}`;
}