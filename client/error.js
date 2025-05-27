/**
 * Cloudflare Workers 代理服务客户端
 * 错误处理模块 - 统一错误处理和日志记录
 */

// 日志级别
const LOG_LEVEL = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
};

/**
 * 记录错误信息
 * @param {string} message 错误消息
 * @param {Error|any} error 错误对象
 * @returns {Promise<void>}
 */
export async function logError(message, error) {
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    const logEntry = {
        timestamp,
        level: LOG_LEVEL.ERROR,
        message,
        error: errorMessage,
        stack: errorStack,
    };

    // 在控制台输出错误信息
    console.error(JSON.stringify(logEntry));

    // 如果在生产环境，可以将日志发送到监控服务
    await sendErrorToMonitoring(logEntry);
}

/**
 * 记录信息日志
 * @param {string} message 日志消息
 * @param {Object} data 附加数据
 * @returns {Promise<void>}
 */
export async function logInfo(message, data = {}) {
    const timestamp = new Date().toISOString();

    const logEntry = {
        timestamp,
        level: LOG_LEVEL.INFO,
        message,
        data
    };

    console.log(JSON.stringify(logEntry));
}

/**
 * 记录调试日志
 * @param {string} message 日志消息
 * @param {Object} data 附加数据
 * @returns {Promise<void>}
 */
export function logDebug(message, data = {}) {
    // 检查是否启用调试
    const debugMode = ENV.DEBUG_MODE === 'true';

    if (!debugMode) {
        return;
    }

    const timestamp = new Date().toISOString();

    const logEntry = {
        timestamp,
        level: LOG_LEVEL.DEBUG,
        message,
        data
    };

    console.log(JSON.stringify(logEntry));
}

/**
 * 发送错误到监控服务（如果配置了）
 * @param {Object} logEntry 日志条目
 * @returns {Promise<void>}
 */
async function sendErrorToMonitoring(logEntry) {
    // 检查是否配置了监控服务
    const monitoringUrl = ENV.MONITORING_URL;

    if (!monitoringUrl) {
        return;
    }

    try {
        await fetch(monitoringUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(logEntry),
        });
    } catch (err) {
        // 避免监控服务失败影响主业务逻辑
        console.error('发送错误到监控服务失败:', err);
    }
}