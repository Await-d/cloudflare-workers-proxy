/**
 * Cloudflare Pages Functions Entry Point
 * 统一处理代理服务的客户端和服务端逻辑
 */

// 导入工具函数
import {
    validateClientAuthorization,
    validateAdminAuthorization
} from './server/auth.js';
import {
    handleAdminInterface
} from './server/admin/index.js';
import {
    handleConfigAPI
} from './server/config.js';
import {
    handlePushAPI
} from './server/push-api.js';

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
export default {
    async fetch(request, env, ctx) {
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
            if (path.startsWith('/admin')) {
                // 管理界面路由
                response = await handleAdminInterface(request, env);
            } else if (path.startsWith('/api/config')) {
                // 配置获取API
                response = await handleConfigAPI(request, env);
            } else if (path.startsWith('/api/push-config') || path.startsWith('/api/sync-config')) {
                // 外部推送配置API
                response = await handlePushAPI(request, env);
            } else if (path.startsWith('/proxy') || path === '/') {
                // 代理功能路由
                response = await handleProxyRequest(request, env, ctx);
            } else {
                // 静态资源或404
                response = await handleStaticRequest(request, env);
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
};

/**
 * 处理代理请求（客户端功能）
 */
async function handleProxyRequest(request, env, ctx) {
    const url = new URL(request.url);

    // 获取服务配置
    const config = await getServiceConfig(env);
    if (!config) {
        return new Response('Service configuration not found', {
            status: 404
        });
    }

    try {
        // 构建目标URL
        const targetUrl = new URL(config.proxyURL);
        targetUrl.pathname = url.pathname.replace('/proxy', '') || '/';
        targetUrl.search = url.search;

        // 创建新的请求
        const modifiedRequest = new Request(targetUrl.toString(), {
            method: request.method,
            headers: request.headers,
            body: request.body
        });

        // 转发请求
        const response = await fetch(modifiedRequest);

        // 创建新的响应，移除一些可能冲突的头
        const modifiedResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });

        // 移除可能导致问题的头
        modifiedResponse.headers.delete('content-encoding');
        modifiedResponse.headers.delete('content-length');

        return modifiedResponse;

    } catch (error) {
        console.error('Proxy error:', error);
        return new Response('Proxy Error: ' + error.message, {
            status: 502
        });
    }
}

/**
 * 获取服务配置
 */
async function getServiceConfig(env) {
    try {
        // 这里可以从KV存储或环境变量获取配置
        const serviceKey = env.SERVICE_KEY || 'default';

        if (env.SERVICE_CONFIGS) {
            const configData = await env.SERVICE_CONFIGS.get(serviceKey);
            if (configData) {
                return JSON.parse(configData);
            }
        }

        // 回退到环境变量配置
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
 * 处理静态资源请求
 */
async function handleStaticRequest(request, env) {
    const url = new URL(request.url);

    // 如果请求根路径，重定向到管理界面
    if (url.pathname === '/' || url.pathname === '') {
        return Response.redirect(`${url.origin}/admin`, 302);
    }

    // 对于其他路径，返回404
    return new Response('Not Found', {
        status: 404
    });
}