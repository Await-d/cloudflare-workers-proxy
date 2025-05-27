/**
 * Cloudflare Workers 代理服务服务端
 * 配置管理模块 - 处理服务配置的存储和获取
 */

// 服务配置的KV存储命名空间
// SERVICE_CONFIGS需要在Cloudflare Worker设置中绑定

/**
 * 获取服务配置
 * @param {string} serviceKey 服务标识
 * @returns {Promise<Object|null>} 服务配置或null(如果不存在)
 */
export async function getServiceConfig(serviceKey) {
    try {
        if (!serviceKey) {
            return null;
        }

        // 从KV存储获取服务配置
        return await SERVICE_CONFIGS.get(serviceKey, {
            type: 'json'
        });
    } catch (error) {
        console.error(`获取服务配置错误(${serviceKey}):`, error);
        return null;
    }
}

/**
 * 保存服务配置
 * @param {string} serviceKey 服务标识
 * @param {Object} config 配置对象
 * @returns {Promise<boolean>} 操作是否成功
 */
export async function saveServiceConfig(serviceKey, config) {
    try {
        if (!serviceKey || !config) {
            return false;
        }

        // 保存到KV存储
        await SERVICE_CONFIGS.put(serviceKey, JSON.stringify(config));
        return true;
    } catch (error) {
        console.error(`保存服务配置错误(${serviceKey}):`, error);
        return false;
    }
}

/**
 * 删除服务配置
 * @param {string} serviceKey 服务标识
 * @returns {Promise<boolean>} 操作是否成功
 */
export async function deleteServiceConfig(serviceKey) {
    try {
        if (!serviceKey) {
            return false;
        }

        await SERVICE_CONFIGS.delete(serviceKey);
        return true;
    } catch (error) {
        console.error(`删除服务配置错误(${serviceKey}):`, error);
        return false;
    }
}

/**
 * 获取所有服务配置的键名列表
 * @returns {Promise<Array<string>>} 服务键名列表
 */
export async function listServiceKeys() {
    try {
        // 列出KV存储中的所有键
        const list = await SERVICE_CONFIGS.list();
        return list.keys.map(key => key.name);
    } catch (error) {
        console.error('列出服务配置错误:', error);
        return [];
    }
}

/**
 * 获取所有服务配置
 * @returns {Promise<Object>} 服务配置映射表 {serviceKey: configObject}
 */
export async function getAllServiceConfigs() {
    try {
        const keys = await listServiceKeys();
        const configs = {};

        // 并行获取所有配置
        await Promise.all(keys.map(async (key) => {
            const config = await getServiceConfig(key);
            if (config) {
                configs[key] = config;
            }
        }));

        return configs;
    } catch (error) {
        console.error('获取所有服务配置错误:', error);
        return {};
    }
}