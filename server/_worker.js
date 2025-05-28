/**
 * Cloudflare Pages Functions 入口文件 - 服务端
 * 处理代理服务的配置管理和API请求
 */

import {
    handleAdminInterface
} from './admin/index.js';
import {
    validateAuthorization
} from './auth.js';
import {
    getServiceConfig
} from './config.js';
import {
    decryptURL
} from './crypto.js';
import {
    handlePushConfig,
    handleSyncConfig
} from './push-api.js';

/**
 * Pages Functions 入口点
 * @param {EventContext} context - Pages Functions 上下文
 * @returns {Promise<Response>} 响应
 */
export default {
    async fetch(request, env, ctx) {
        // 将环境变量设置为全局可用（兼容现有代码）
        globalThis.ENV = env;
        globalThis.SERVICE_CONFIGS = env.SERVICE_CONFIGS;

        return handleRequest(request);
    }
};

/**
 * 处理请求
 * @param {Request} request 原始请求
 * @returns {Promise<Response>} 响应
 */
async function handleRequest(request) {
    try {
        const url = new URL(request.url);

        // 添加CORS头
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Service-Key'
        };

        // 处理预检请求
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 200,
                headers: corsHeaders
            });
        }

        let response;

        // 管理界面请求处理
        if (url.pathname === '/' || url.pathname.startsWith('/admin')) {
            response = await handleAdminInterface(request);
        }
        // API请求处理
        else if (url.pathname === '/api/config') {
            response = await handleConfigRequest(request);
        }
        // 外部推送配置API
        else if (url.pathname === '/api/push-config') {
            response = await handlePushConfig(request);
        }
        // 配置同步API
        else if (url.pathname === '/api/sync-config') {
            response = await handleSyncConfig(request);
        }
        // 健康检查端点
        else if (url.pathname === '/health' || url.pathname === '/api/health') {
            response = new Response(JSON.stringify({
                status: 'ok',
                service: 'cloudflare-workers-proxy-server',
                timestamp: new Date().toISOString(),
                environment: {
                    hasAdminKey: !!globalThis.ENV?.ADMIN_KEY,
                    hasSecretKeys: !!globalThis.ENV?.SECRET_KEYS,
                    hasEncryptionKey: !!globalThis.ENV?.ENCRYPTION_KEY,
                    hasKV: !!globalThis.SERVICE_CONFIGS
                }
            }), {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        // 404 - 未找到
        else {
            response = new Response('Not Found', {
                status: 404
            });
        }

        // 添加CORS头到所有响应
        const newHeaders = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
            newHeaders.set(key, value);
        });

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });

    } catch (error) {
        console.error('请求处理错误:', error);
        return new Response(JSON.stringify({
            error: 'Internal Server Error',
            message: error.message,
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
 * 处理配置获取请求
 * @param {Request} request 请求对象
 * @returns {Promise<Response>} 响应
 */
async function handleConfigRequest(request) {
    try {
        // 验证请求授权
        const authResult = await validateAuthorization(request);
        if (!authResult.isValid) {
            return new Response(JSON.stringify({
                error: authResult.message,
                timestamp: new Date().toISOString()
            }), {
                status: authResult.status,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        // 从请求头获取服务标识
        const serviceKey = request.headers.get('X-Service-Key');
        if (!serviceKey) {
            return new Response(JSON.stringify({
                error: '缺少服务标识',
                message: '请在请求头中提供 X-Service-Key',
                timestamp: new Date().toISOString()
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        // 获取服务配置
        const serviceConfig = await getServiceConfig(serviceKey);
        if (!serviceConfig) {
            return new Response(JSON.stringify({
                error: '服务配置不存在',
                serviceKey: serviceKey,
                timestamp: new Date().toISOString()
            }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        // 解密配置并返回
        const response = {
            success: true,
            data: {
                proxyURL: decryptURL(serviceConfig.encryptedProxyURL),
                updateInterval: serviceConfig.updateInterval || 3600,
                serviceKey: serviceKey
            },
            timestamp: new Date().toISOString()
        };

        return new Response(JSON.stringify(response), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('获取配置错误:', error);
        return new Response(JSON.stringify({
            error: '内部服务器错误',
            message: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}