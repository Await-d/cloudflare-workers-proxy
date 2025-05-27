/**
 * Cloudflare Workers 代理服务服务端
 * 认证授权模块 - 实现认证和授权机制
 */

// 环境变量名常量
const ENV_SECRET_KEYS = 'SECRET_KEYS';
const ENV_ADMIN_KEY = 'ADMIN_KEY';
const ENV_MAX_REQUESTS_PER_MINUTE = 'MAX_REQUESTS_PER_MINUTE';

// 请求限制默认值（每分钟）
const DEFAULT_MAX_REQUESTS_PER_MINUTE = 60;

// 请求计数器（IP地址 -> {count, timestamp}）
const requestCounts = new Map();

/**
 * 验证API请求的授权
 * @param {Request} request 请求对象
 * @returns {Promise<{isValid: boolean, status: number, message: string}>} 验证结果
 */
export async function validateAuthorization(request) {
    try {
        // 1. 检查请求频率限制
        const rateLimit = await checkRateLimit(request);
        if (!rateLimit.allowed) {
            return {
                isValid: false,
                status: 429,
                message: '请求过于频繁，请稍后再试'
            };
        }

        // 2. 检查授权头
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                isValid: false,
                status: 401,
                message: '未授权：缺少有效的授权头'
            };
        }

        // 3. 验证密钥
        const token = authHeader.split('Bearer ')[1];
        if (!token || !isValidSecretKey(token)) {
            return {
                isValid: false,
                status: 403,
                message: '禁止：无效的访问密钥'
            };
        }

        // 验证通过
        return {
            isValid: true,
            status: 200,
            message: 'OK'
        };
    } catch (error) {
        console.error('授权验证错误:', error);
        return {
            isValid: false,
            status: 500,
            message: '内部服务器错误'
        };
    }
}

/**
 * 验证管理界面的授权
 * @param {Request} request 请求对象
 * @returns {Promise<{isValid: boolean, status: number, message: string}>} 验证结果
 */
export async function validateAdminAuthorization(request) {
    try {
        // 获取管理员密钥
        const adminKey = ENV[ENV_ADMIN_KEY];
        if (!adminKey) {
            console.error('管理员密钥未配置');
            return {
                isValid: false,
                status: 500,
                message: '服务器配置错误：未设置管理员密钥'
            };
        }

        // 检查授权头
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                isValid: false,
                status: 401,
                message: '未授权：缺少有效的授权头'
            };
        }

        // 验证管理员密钥
        const token = authHeader.split('Bearer ')[1];
        if (token !== adminKey) {
            return {
                isValid: false,
                status: 403,
                message: '禁止：无效的管理员密钥'
            };
        }

        // 验证通过
        return {
            isValid: true,
            status: 200,
            message: 'OK'
        };
    } catch (error) {
        console.error('管理员授权验证错误:', error);
        return {
            isValid: false,
            status: 500,
            message: '内部服务器错误'
        };
    }
}

/**
 * 检查密钥是否有效
 * @param {string} key 待验证的密钥
 * @returns {boolean} 密钥是否有效
 */
function isValidSecretKey(key) {
    // 从环境变量获取允许的密钥列表
    const secretKeysStr = ENV[ENV_SECRET_KEYS] || '';
    const secretKeys = secretKeysStr.split(',').map(k => k.trim());

    return secretKeys.includes(key);
}

/**
 * 检查请求频率限制
 * @param {Request} request 请求对象
 * @returns {Promise<{allowed: boolean, remaining: number}>} 是否允许请求
 */
async function checkRateLimit(request) {
    // 获取客户端IP地址
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    // 获取当前时间戳（毫秒）
    const now = Date.now();

    // 获取最大请求次数限制
    const maxRequestsPerMinute = parseInt(ENV[ENV_MAX_REQUESTS_PER_MINUTE], 10) ||
        DEFAULT_MAX_REQUESTS_PER_MINUTE;

    // 检查是否有该IP的请求记录
    if (!requestCounts.has(ip)) {
        // 新IP，初始化计数
        requestCounts.set(ip, {
            count: 1,
            timestamp: now
        });
        return {
            allowed: true,
            remaining: maxRequestsPerMinute - 1
        };
    }

    // 获取现有记录
    const record = requestCounts.get(ip);

    // 检查是否需要重置计数（超过一分钟）
    if (now - record.timestamp > 60000) {
        requestCounts.set(ip, {
            count: 1,
            timestamp: now
        });
        return {
            allowed: true,
            remaining: maxRequestsPerMinute - 1
        };
    }

    // 检查是否超过限制
    if (record.count >= maxRequestsPerMinute) {
        return {
            allowed: false,
            remaining: 0
        };
    }

    // 增加计数
    record.count++;
    requestCounts.set(ip, record);

    return {
        allowed: true,
        remaining: maxRequestsPerMinute - record.count
    };
}