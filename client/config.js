/**
 * Cloudflare Workers 代理服务客户端
 * 配置处理模块 - 处理与服务端通信获取配置
 */

import {
    getCachedConfig,
    cacheConfig
} from './cache.js';
import {
    logError
} from './error.js';

// 环境变量配置名称
const ENV_SERVICE_CONFIG_URL = 'SERVICE_CONFIG_URL';
const ENV_SECRET_KEY = 'SECRET_KEY';
const ENV_SERVICE_KEY = 'SERVICE_KEY';
const ENV_UPDATE_INTERVAL = 'UPDATE_INTERVAL';

// 默认配置更新间隔(秒)
const DEFAULT_UPDATE_INTERVAL = 3600;

// 上次更新时间记录
let lastConfigUpdateTime = 0;

/**
 * 获取代理配置
 * 首先检查是否需要更新，然后决定从服务端获取还是使用缓存
 * @returns {Promise<Object>} 代理配置对象
 */
export async function getProxyConfig() {
    try {
        const now = Date.now();
        const updateInterval = getUpdateInterval();

        // 检查是否需要更新配置
        if (now - lastConfigUpdateTime > updateInterval * 1000) {
            // 尝试从服务端获取最新配置
            try {
                const freshConfig = await fetchConfigFromServer();
                lastConfigUpdateTime = now;
                return freshConfig;
            } catch (error) {
                // 如果服务端获取失败，尝试使用缓存配置
                const cachedConfig = await getCachedConfig();
                if (cachedConfig) {
                    return cachedConfig;
                }
                throw error; // 如果没有缓存配置，继续抛出错误
            }
        } else {
            // 使用缓存的配置
            const cachedConfig = await getCachedConfig();
            if (cachedConfig) {
                return cachedConfig;
            }

            // 如果没有缓存，强制从服务端获取
            const freshConfig = await fetchConfigFromServer();
            lastConfigUpdateTime = now;
            return freshConfig;
        }
    } catch (error) {
        await logError('获取代理配置失败', error);
        throw error;
    }
}

/**
 * 从服务端获取配置
 * @returns {Promise<Object>} 从服务端获取的配置
 */
async function fetchConfigFromServer() {
    const serviceConfigUrl = getRequiredEnv(ENV_SERVICE_CONFIG_URL);
    const secretKey = getRequiredEnv(ENV_SECRET_KEY);
    const serviceKey = getRequiredEnv(ENV_SERVICE_KEY);

    const response = await fetch(`${serviceConfigUrl}/api/config`, {
        headers: {
            'Authorization': `Bearer ${secretKey}`,
            'X-Service-Key': serviceKey
        }
    });

    if (!response.ok) {
        throw new Error(`服务端配置获取失败: ${response.status} ${response.statusText}`);
    }

    const config = await response.json();

    // 缓存获取的配置
    await cacheConfig(config);

    return config;
}

/**
 * 获取更新间隔时间(秒)
 * @returns {number} 更新间隔时间(秒)
 */
function getUpdateInterval() {
    const interval = parseInt(ENV[ENV_UPDATE_INTERVAL], 10);
    return isNaN(interval) ? DEFAULT_UPDATE_INTERVAL : interval;
}

/**
 * 获取必需的环境变量，如果不存在则抛出错误
 * @param {string} name 环境变量名称
 * @returns {string} 环境变量值
 */
function getRequiredEnv(name) {
    const value = ENV[name];
    if (!value) {
        throw new Error(`必需的环境变量 ${name} 未配置`);
    }
    return value;
}