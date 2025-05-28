/**
 * Cloudflare Workers 代理服务客户端
 * 主入口文件 - 处理请求转发
 */

import {
    getProxyConfig
} from './config.js';
import {
    logError
} from './error.js';

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

/**
 * 处理请求并转发到目标代理
 * @param {Request} request 原始请求
 * @returns {Promise<Response>} 代理响应
 */
async function handleRequest(request) {
    try {
        // 获取代理配置
        const proxyConfig = await getProxyConfig();

        if (!proxyConfig || !proxyConfig.proxyURL) {
            return new Response('无法获取有效的代理配置', {
                status: 503
            });
        }

        // 创建代理请求
        const proxyRequest = createProxyRequest(request, proxyConfig.proxyURL);

        // 发送代理请求
        return await fetch(proxyRequest);
    } catch (error) {
        await logError('请求处理失败', error);
        return new Response('代理请求处理错误', {
            status: 500
        });
    }
}

/**
 * 创建代理请求
 * @param {Request} originalRequest 原始请求
 * @param {string} proxyURL 代理URL
 * @returns {Request} 新的代理请求
 */
function createProxyRequest(originalRequest, proxyURL) {
    // 解析原始请求URL和代理URL
    const url = new URL(originalRequest.url);
    const targetURL = new URL(proxyURL);

    // 更新主机名为代理目标
    url.hostname = targetURL.hostname;

    // 如果代理URL包含路径，添加到请求路径前
    if (targetURL.pathname !== '/') {
        url.pathname = targetURL.pathname.replace(/\/$/, '') + url.pathname;
    }

    // 创建新的请求对象
    return new Request(url.toString(), {
        method: originalRequest.method,
        headers: originalRequest.headers,
        body: originalRequest.body,
        redirect: 'follow'
    });
}