/**
 * Cloudflare Workers 代理服务服务端
 * 主入口文件 - 处理请求路由
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

// 监听请求事件
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

/**
 * 处理请求
 * @param {Request} request 原始请求
 * @returns {Promise<Response>} 响应
 */
async function handleRequest(request) {
    try {
        const url = new URL(request.url);

        // 管理界面请求处理
        if (url.pathname === '/' || url.pathname.startsWith('/admin')) {
            return await handleAdminInterface(request);
        }

        // API请求处理
        if (url.pathname === '/api/config') {
            return await handleConfigRequest(request);
        }

        // 外部推送配置API
        if (url.pathname === '/api/push-config') {
            return await handlePushConfig(request);
        }

        // 配置同步API
        if (url.pathname === '/api/sync-config') {
            return await handleSyncConfig(request);
        }

        // 健康检查端点
        if (url.pathname === '/health') {
            return new Response(JSON.stringify({
                status: 'ok'
            }), {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        // 404 - 未找到
        return new Response('Not Found', {
            status: 404
        });
    } catch (error) {
        console.error('请求处理错误:', error);
        return new Response('Internal Server Error', {
            status: 500
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
            return new Response(authResult.message, {
                status: authResult.status
            });
        }

        // 从请求头获取服务标识
        const serviceKey = request.headers.get('X-Service-Key');
        if (!serviceKey) {
            return new Response('缺少服务标识', {
                status: 400
            });
        }

        // 获取服务配置
        const serviceConfig = await getServiceConfig(serviceKey);
        if (!serviceConfig) {
            return new Response('服务配置不存在', {
                status: 404
            });
        }

        // 解密配置并返回
        const response = {
            proxyURL: decryptURL(serviceConfig.encryptedProxyURL),
            updateInterval: serviceConfig.updateInterval || 3600,
            timestamp: new Date().toISOString()
        };

        return new Response(JSON.stringify(response), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('获取配置错误:', error);
        return new Response('内部服务器错误', {
            status: 500
        });
    }
}