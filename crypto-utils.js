/**
 * 加密工具模块
 * 提供哈希计算、密钥生成等基础加密功能
 */

class CryptoUtils {
    /**
     * 使用SHA-256计算字符串的哈希值
     * @param {string} data - 要哈希的数据
     * @returns {Promise<string>} 十六进制哈希值
     */
    static async sha256(data) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * 生成随机的公钥（模拟）
     * @returns {string} 64字符的十六进制公钥
     */
    static generatePublicKey() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * 生成用户ID（基于公钥的哈希）
     * @param {string} publicKey - 用户公钥
     * @returns {Promise<string>} 用户ID
     */
    static async generateUserId(publicKey) {
        return await this.sha256(publicKey);
    }

    /**
     * 计算两个哈希值的组合哈希
     * @param {string} left - 左子树哈希
     * @param {string} right - 右子树哈希
     * @returns {Promise<string>} 组合哈希值
     */
    static async combineHashes(left, right) {
        return await this.sha256(left + right);
    }

    /**
     * 截断哈希值用于显示
     * @param {string} hash - 完整哈希值
     * @param {number} length - 截断长度
     * @returns {string} 截断的哈希值
     */
    static truncateHash(hash, length = 8) {
        return hash.substring(0, length) + '...';
    }

    /**
     * 验证哈希值格式
     * @param {string} hash - 要验证的哈希值
     * @returns {boolean} 是否为有效的哈希值
     */
    static isValidHash(hash) {
        return /^[a-f0-9]{64}$/i.test(hash);
    }

    /**
     * 生成随机盐值
     * @param {number} length - 盐值长度（字节）
     * @returns {string} 十六进制盐值
     */
    static generateSalt(length = 16) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * 使用盐值计算哈希
     * @param {string} data - 原始数据
     * @param {string} salt - 盐值
     * @returns {Promise<string>} 加盐哈希值
     */
    static async saltedHash(data, salt) {
        return await this.sha256(data + salt);
    }
}

// 导出工具类
window.CryptoUtils = CryptoUtils;