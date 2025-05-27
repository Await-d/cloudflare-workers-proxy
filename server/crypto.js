/**
 * Cloudflare Workers 代理服务服务端
 * 加密解密工具 - 实现配置数据的加密和解密
 */

// 环境变量名
const ENV_ENCRYPTION_KEY = 'ENCRYPTION_KEY';

/**
 * 加密URL
 * @param {string} url 原始URL
 * @returns {string} 加密后的URL
 */
export function encryptURL(url) {
    try {
        if (!url) {
            return '';
        }

        // 获取加密密钥
        const encryptionKey = getEncryptionKey();
        if (!encryptionKey) {
            console.warn('未配置加密密钥，使用明文存储URL');
            return url;
        }

        // 使用TextEncoder将URL转换为字节数组
        const encoder = new TextEncoder();
        const urlBytes = encoder.encode(url);

        // 使用HMAC-SHA-256创建伪随机密钥
        const keyData = encoder.encode(encryptionKey);
        const hmacKey = crypto.subtle.importKey(
            'raw',
            keyData, {
                name: 'HMAC',
                hash: 'SHA-256'
            },
            false,
            ['sign']
        );

        // 生成随机向量(IV)
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // 使用AES-GCM进行加密
        const encryptKey = crypto.subtle.importKey(
            'raw',
            keyData, {
                name: 'AES-GCM'
            },
            false,
            ['encrypt']
        );

        // 由于Workers环境中加密API是异步的，我们需要同步返回结果
        // 因此使用一种更简单的方式：Base64编码 + 异或操作
        const simpleEncrypt = (data, key) => {
            const result = new Uint8Array(data.length);
            const keyBytes = encoder.encode(key);

            // 对每个字节进行异或操作
            for (let i = 0; i < data.length; i++) {
                result[i] = data[i] ^ keyBytes[i % keyBytes.length];
            }

            return result;
        };

        // 使用简单方式加密
        const encryptedBytes = simpleEncrypt(urlBytes, encryptionKey);

        // Base64编码
        return btoa(String.fromCharCode.apply(null, [...iv, ...encryptedBytes]));
    } catch (error) {
        console.error('URL加密错误:', error);
        // 出错时返回原始URL并添加错误标记
        return `ERROR_ENCRYPT:${url}`;
    }
}

/**
 * 解密URL
 * @param {string} encryptedURL 加密后的URL
 * @returns {string} 解密后的URL
 */
export function decryptURL(encryptedURL) {
    try {
        if (!encryptedURL) {
            return '';
        }

        // 检查是否有错误标记
        if (encryptedURL.startsWith('ERROR_ENCRYPT:')) {
            return encryptedURL.substring(14);
        }

        // 获取加密密钥
        const encryptionKey = getEncryptionKey();
        if (!encryptionKey) {
            console.warn('未配置加密密钥，假设URL未加密');
            return encryptedURL;
        }

        // Base64解码
        const bytes = new Uint8Array(
            atob(encryptedURL)
            .split('')
            .map(char => char.charCodeAt(0))
        );

        // 提取IV和加密数据
        const iv = bytes.slice(0, 12);
        const encryptedBytes = bytes.slice(12);

        // 简单解密函数
        const simpleDecrypt = (data, key) => {
            const result = new Uint8Array(data.length);
            const encoder = new TextEncoder();
            const keyBytes = encoder.encode(key);

            // 对每个字节进行异或操作
            for (let i = 0; i < data.length; i++) {
                result[i] = data[i] ^ keyBytes[i % keyBytes.length];
            }

            return result;
        };

        // 解密
        const decryptedBytes = simpleDecrypt(encryptedBytes, encryptionKey);

        // 将字节数组转换回字符串
        const decoder = new TextDecoder();
        return decoder.decode(decryptedBytes);
    } catch (error) {
        console.error('URL解密错误:', error);
        return encryptedURL; // 出错时返回加密的URL
    }
}

/**
 * 获取加密密钥
 * @returns {string} 加密密钥
 */
function getEncryptionKey() {
    return ENV[ENV_ENCRYPTION_KEY] || '';
}