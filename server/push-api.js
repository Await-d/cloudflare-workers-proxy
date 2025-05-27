/**
 * Cloudflare Workers 代理服务服务端
 * 外部推送配置API - 处理外部系统推送配置的操作
 */

import {
    validateAuthorization
} from './auth.js';
import {
    saveServiceConfig,
    deleteServiceConfig,
    getServiceConfig
} from './config.js';
import {
    encryptURL
} from './crypto.js';

/**
 * 处理外部推送配置请求
 * @param {Request} request 请求对象
 * @returns {Promise<Response>} 响应
 */
export async function handlePushConfig(request) {
    try {
        // 验证请求方法
        if (request.method !== 'POST') {
            return new Response('Method not allowed', {
                status: 405
            });
        }

        // 验证授权
        const authResult = await validateAuthorization(request);
        if (!authResult.isValid) {
            return new Response(authResult.message, {
                status: authResult.status
            });
        }

        // 解析请求体
        const requestData = await request.json();

        // 处理单个配置推送
        if (requestData.serviceKey && requestData.proxyURL) {
            return await handleSingleConfigPush(requestData);
        }

        // 处理批量配置推送
        if (requestData.configs && Array.isArray(requestData.configs)) {
            return await handleBatchConfigPush(requestData.configs);
        }

        return new Response('无效的请求数据格式', {
            status: 400
        });
    } catch (error) {
        console.error('推送配置错误:', error);
        return new Response('内部服务器错误', {
            status: 500
        });
    }
}

/**
 * 处理配置同步请求
 * @param {Request} request 请求对象
 * @returns {Promise<Response>} 响应
 */
export async function handleSyncConfig(request) {
    try {
        // 验证请求方法
        if (request.method !== 'POST') {
            return new Response('Method not allowed', {
                status: 405
            });
        }

        // 验证授权
        const authResult = await validateAuthorization(request);
        if (!authResult.isValid) {
            return new Response(authResult.message, {
                status: authResult.status
            });
        }

        // 解析请求体
        const requestData = await request.json();

        // 处理全量同步
        if (requestData.action === 'full-sync' && requestData.configs) {
            return await handleFullSync(requestData.configs);
        }

        // 处理增量同步
        if (requestData.action === 'incremental-sync') {
            return await handleIncrementalSync(requestData);
        }

        return new Response('无效的同步请求', {
            status: 400
        });
    } catch (error) {
        console.error('配置同步错误:', error);
        return new Response('内部服务器错误', {
            status: 500
        });
    }
}

/**
 * 处理单个配置推送
 * @param {Object} configData 配置数据
 * @returns {Promise<Response>} 响应
 */
async function handleSingleConfigPush(configData) {
    try {
        // 验证必需字段
        const validation = validateConfigData(configData);
        if (!validation.isValid) {
            return new Response(validation.message, {
                status: 400
            });
        }

        // 构建配置对象
        const config = {
            encryptedProxyURL: encryptURL(configData.proxyURL),
            updateInterval: parseInt(configData.updateInterval, 10) || 3600,
            lastUpdated: new Date().toISOString(),
            source: 'external-push',
            version: configData.version || '1.0',
            metadata: configData.metadata || {}
        };

        // 保存配置
        const success = await saveServiceConfig(configData.serviceKey, config);
        if (!success) {
            return new Response('保存配置失败', {
                status: 500
            });
        }

        return new Response(JSON.stringify({
            success: true,
            message: '配置推送成功',
            serviceKey: configData.serviceKey,
            timestamp: config.lastUpdated
        }), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('单个配置推送错误:', error);
        return new Response('配置推送失败', {
            status: 500
        });
    }
}

/**
 * 处理批量配置推送
 * @param {Array} configs 配置数组
 * @returns {Promise<Response>} 响应
 */
async function handleBatchConfigPush(configs) {
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const configData of configs) {
        try {
            // 验证配置数据
            const validation = validateConfigData(configData);
            if (!validation.isValid) {
                results.push({
                    serviceKey: configData.serviceKey || 'unknown',
                    success: false,
                    error: validation.message
                });
                failureCount++;
                continue;
            }

            // 构建配置对象
            const config = {
                encryptedProxyURL: encryptURL(configData.proxyURL),
                updateInterval: parseInt(configData.updateInterval, 10) || 3600,
                lastUpdated: new Date().toISOString(),
                source: 'external-batch-push',
                version: configData.version || '1.0',
                metadata: configData.metadata || {}
            };

            // 保存配置
            const success = await saveServiceConfig(configData.serviceKey, config);
            if (success) {
                results.push({
                    serviceKey: configData.serviceKey,
                    success: true,
                    timestamp: config.lastUpdated
                });
                successCount++;
            } else {
                results.push({
                    serviceKey: configData.serviceKey,
                    success: false,
                    error: '保存失败'
                });
                failureCount++;
            }
        } catch (error) {
            results.push({
                serviceKey: configData.serviceKey || 'unknown',
                success: false,
                error: error.message
            });
            failureCount++;
        }
    }

    return new Response(JSON.stringify({
        success: failureCount === 0,
        message: `批量推送完成：成功 ${successCount} 个，失败 ${failureCount} 个`,
        summary: {
            total: configs.length,
            success: successCount,
            failure: failureCount
        },
        results: results
    }), {
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

/**
 * 处理全量同步
 * @param {Array} configs 配置数组
 * @returns {Promise<Response>} 响应
 */
async function handleFullSync(configs) {
    try {
        // 清空现有配置（这里可以根据需要决定是否实现）
        // 注意：全量同步会替换所有现有配置，请谨慎使用

        const results = await handleBatchConfigPush(configs);
        const resultData = await results.json();

        return new Response(JSON.stringify({
            ...resultData,
            syncType: 'full',
            message: `全量同步完成：${resultData.message}`
        }), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('全量同步错误:', error);
        return new Response('全量同步失败', {
            status: 500
        });
    }
}

/**
 * 处理增量同步
 * @param {Object} syncData 同步数据
 * @returns {Promise<Response>} 响应
 */
async function handleIncrementalSync(syncData) {
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    try {
        // 处理新增/更新的配置
        if (syncData.upsert && Array.isArray(syncData.upsert)) {
            for (const configData of syncData.upsert) {
                try {
                    const validation = validateConfigData(configData);
                    if (!validation.isValid) {
                        results.push({
                            action: 'upsert',
                            serviceKey: configData.serviceKey || 'unknown',
                            success: false,
                            error: validation.message
                        });
                        failureCount++;
                        continue;
                    }

                    const config = {
                        encryptedProxyURL: encryptURL(configData.proxyURL),
                        updateInterval: parseInt(configData.updateInterval, 10) || 3600,
                        lastUpdated: new Date().toISOString(),
                        source: 'external-incremental-sync',
                        version: configData.version || '1.0',
                        metadata: configData.metadata || {}
                    };

                    const success = await saveServiceConfig(configData.serviceKey, config);
                    results.push({
                        action: 'upsert',
                        serviceKey: configData.serviceKey,
                        success: success,
                        error: success ? null : '保存失败'
                    });

                    if (success) successCount++;
                    else failureCount++;
                } catch (error) {
                    results.push({
                        action: 'upsert',
                        serviceKey: configData.serviceKey || 'unknown',
                        success: false,
                        error: error.message
                    });
                    failureCount++;
                }
            }
        }

        // 处理删除的配置
        if (syncData.delete && Array.isArray(syncData.delete)) {
            for (const serviceKey of syncData.delete) {
                try {
                    const success = await deleteServiceConfig(serviceKey);
                    results.push({
                        action: 'delete',
                        serviceKey: serviceKey,
                        success: success,
                        error: success ? null : '删除失败'
                    });

                    if (success) successCount++;
                    else failureCount++;
                } catch (error) {
                    results.push({
                        action: 'delete',
                        serviceKey: serviceKey,
                        success: false,
                        error: error.message
                    });
                    failureCount++;
                }
            }
        }

        return new Response(JSON.stringify({
            success: failureCount === 0,
            syncType: 'incremental',
            message: `增量同步完成：成功 ${successCount} 个，失败 ${failureCount} 个`,
            summary: {
                total: results.length,
                success: successCount,
                failure: failureCount
            },
            results: results
        }), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('增量同步错误:', error);
        return new Response('增量同步失败', {
            status: 500
        });
    }
}

/**
 * 验证配置数据
 * @param {Object} configData 配置数据
 * @returns {Object} 验证结果
 */
function validateConfigData(configData) {
    if (!configData.serviceKey) {
        return {
            isValid: false,
            message: '缺少服务标识(serviceKey)'
        };
    }

    if (!configData.proxyURL) {
        return {
            isValid: false,
            message: '缺少代理URL(proxyURL)'
        };
    }

    // 验证URL格式
    try {
        new URL(configData.proxyURL);
    } catch (error) {
        return {
            isValid: false,
            message: '无效的代理URL格式'
        };
    }

    // 验证更新间隔
    if (configData.updateInterval &&
        (isNaN(parseInt(configData.updateInterval, 10)) ||
            parseInt(configData.updateInterval, 10) < 60)) {
        return {
            isValid: false,
            message: '更新间隔必须是大于等于60的数字'
        };
    }

    return {
        isValid: true,
        message: 'OK'
    };
}