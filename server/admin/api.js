/**
 * Cloudflare Workers 代理服务服务端
 * 管理API - 处理管理界面API请求
 */

import {
    validateAdminAuthorization
} from '../auth.js';
import {
    getServiceConfig,
    saveServiceConfig,
    deleteServiceConfig,
    listServiceKeys
} from '../config.js';
import {
    encryptURL,
    decryptURL
} from '../crypto.js';

/**
 * 处理管理界面API请求
 * @param {Request} request 请求对象
 * @returns {Promise<Response>} API响应
 */
export async function handleAdminAPI(request) {
    try {
        const url = new URL(request.url);
        const apiPath = url.pathname.replace('/admin/api/', '');

        // 登录API不需要验证授权
        if (apiPath === 'login') {
            return await handleLoginAPI(request);
        }

        // 其他API需要验证管理员授权
        const authResult = await validateAdminAuthorization(request);
        if (!authResult.isValid) {
            return new Response(authResult.message, {
                status: authResult.status
            });
        }

        // 根据API路径分发请求
        switch (apiPath) {
            case 'services':
                return await handleServicesAPI(request);
            case 'service':
                return await handleServiceAPI(request);
            default:
                return new Response('API not found', {
                    status: 404
                });
        }
    } catch (error) {
        console.error('管理API错误:', error);
        return new Response('内部服务器错误', {
            status: 500
        });
    }
}

/**
 * 处理登录API
 * @param {Request} request 请求对象
 * @returns {Promise<Response>} 登录响应
 */
async function handleLoginAPI(request) {
    try {
        // 验证管理员授权
        const authResult = await validateAdminAuthorization(request);
        if (!authResult.isValid) {
            return new Response(authResult.message, {
                status: authResult.status
            });
        }

        // 授权验证通过
        return new Response(JSON.stringify({
            success: true
        }), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('登录API错误:', error);
        return new Response('内部服务器错误', {
            status: 500
        });
    }
}

/**
 * 处理服务列表API
 * @param {Request} request 请求对象
 * @returns {Promise<Response>} 服务列表响应
 */
async function handleServicesAPI(request) {
    try {
        // 处理获取服务列表
        if (request.method === 'GET') {
            const serviceKeys = await listServiceKeys();
            const services = [];

            // 获取所有服务配置详情
            for (const key of serviceKeys) {
                const config = await getServiceConfig(key);
                if (config) {
                    services.push({
                        key,
                        proxyURL: decryptURL(config.encryptedProxyURL),
                        updateInterval: config.updateInterval || 3600,
                        lastUpdated: config.lastUpdated || null
                    });
                }
            }

            return new Response(JSON.stringify({
                services
            }), {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        // 不支持的方法
        return new Response('Method not allowed', {
            status: 405
        });
    } catch (error) {
        console.error('服务列表API错误:', error);
        return new Response('内部服务器错误', {
            status: 500
        });
    }
}

/**
 * 处理单个服务配置API
 * @param {Request} request 请求对象
 * @returns {Promise<Response>} 服务配置响应
 */
async function handleServiceAPI(request) {
    try {
        const url = new URL(request.url);
        const serviceKey = url.searchParams.get('key');

        // 获取单个服务配置
        if (request.method === 'GET') {
            if (!serviceKey) {
                return new Response('缺少服务标识', {
                    status: 400
                });
            }

            const config = await getServiceConfig(serviceKey);
            if (!config) {
                return new Response('服务配置不存在', {
                    status: 404
                });
            }

            const serviceConfig = {
                key: serviceKey,
                proxyURL: decryptURL(config.encryptedProxyURL),
                updateInterval: config.updateInterval || 3600,
                lastUpdated: config.lastUpdated || null
            };

            return new Response(JSON.stringify(serviceConfig), {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        // 创建或更新服务配置
        if (request.method === 'POST' || request.method === 'PUT') {
            const body = await request.json();

            if (!body.key) {
                return new Response('缺少服务标识', {
                    status: 400
                });
            }

            if (!body.proxyURL) {
                return new Response('缺少代理URL', {
                    status: 400
                });
            }

            // 构建配置对象
            const config = {
                encryptedProxyURL: encryptURL(body.proxyURL),
                updateInterval: parseInt(body.updateInterval, 10) || 3600,
                lastUpdated: new Date().toISOString()
            };

            // 保存配置
            const success = await saveServiceConfig(body.key, config);
            if (!success) {
                return new Response('保存配置失败', {
                    status: 500
                });
            }

            return new Response(JSON.stringify({
                success: true
            }), {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        // 删除服务配置
        if (request.method === 'DELETE') {
            if (!serviceKey) {
                return new Response('缺少服务标识', {
                    status: 400
                });
            }

            const success = await deleteServiceConfig(serviceKey);
            if (!success) {
                return new Response('删除配置失败', {
                    status: 500
                });
            }

            return new Response(JSON.stringify({
                success: true
            }), {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        // 不支持的方法
        return new Response('Method not allowed', {
            status: 405
        });
    } catch (error) {
        console.error('服务配置API错误:', error);
        return new Response('内部服务器错误', {
            status: 500
        });
    }
}