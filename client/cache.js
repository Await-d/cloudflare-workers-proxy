/**
 * Cloudflare Workers 代理服务客户端
 * 缓存管理模块 - 实现配置缓存和回退策略
 */

import {
    logError
} from './error.js';

// KV缓存命名空间，必须在Cloudflare Worker环境中绑定
// 参见: https://developers.cloudflare.com/workers/runtime-apis/kv/
// const PROXY_CACHE = PROXY_CACHE; // 在Worker设置中绑定KV命名空间

// 缓存键名
const CONFIG_CACHE_KEY = 'current_proxy_config';

// 缓存过期时间(秒)
const CACHE_TTL = 86400; // 24小时

/**
 * 获取缓存中的配置
 * @returns {Promise<Object|null>} 缓存的配置对象，如果没有则返回null
 */
export async function getCachedConfig() {
    try {
        // 从KV存储获取缓存的配置
        const cachedConfig = await PROXY_CACHE.get(CONFIG_CACHE_KEY, {
            type: 'json'
        });
        return cachedConfig;
    } catch (error) {
        await logError('获取缓存配置失败', error);
        return null;
    }
}

/**
 * 将配置保存到缓存
 * @param {Object} config 要缓存的配置对象
 * @returns {Promise<void>}
 */
export async function cacheConfig(config) {
    try {
        if (!config) {
            return;
        }

        // 保存配置到KV存储
        await PROXY_CACHE.put(CONFIG_CACHE_KEY, JSON.stringify(config), {
            expirationTtl: CACHE_TTL
        });
    } catch (error) {
        await logError('缓存配置失败', error);
    }
}

/**
 * 清除缓存的配置
 * @returns {Promise<void>}
 */
export async function clearCachedConfig() {
    try {
        await PROXY_CACHE.delete(CONFIG_CACHE_KEY);
    } catch (error) {
        await logError('清除缓存配置失败', error);
    }
}

/**
 * 刷新缓存配置的过期时间
 * @returns {Promise<void>}
 */
export async function refreshCacheTTL() {
    try {
        const config = await getCachedConfig();
        if (config) {
            await cacheConfig(config);
        }
    } catch (error) {
        await logError('刷新缓存过期时间失败', error);
    }
}