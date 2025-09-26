/**
 * 零知识证明系统
 * 基于默克尔树的成员身份证明，不暴露用户公钥
 */

class ZKProofSystem {
    constructor() {
        this.merkleTree = null;
        this.userKeys = new Map(); // 存储用户公钥（实际应用中应安全存储）
        this.currentProof = null;
    }

    /**
     * 初始化系统，生成用户集合和默克尔树
     * @param {number} userCount - 用户数量
     */
    async initializeSystem(userCount) {
        if (userCount < 2 || userCount > 32) {
            throw new Error('用户数量必须在2-32之间');
        }

        // 生成用户公钥
        const publicKeys = [];
        this.userKeys.clear();

        for (let i = 0; i < userCount; i++) {
            const publicKey = CryptoUtils.generatePublicKey();
            const userId = await CryptoUtils.generateUserId(publicKey);
            
            publicKeys.push(publicKey);
            this.userKeys.set(i, {
                publicKey,
                userId,
                userIndex: i
            });
        }

        // 构建默克尔树
        this.merkleTree = new MerkleTree();
        await this.merkleTree.buildTree(publicKeys);

        return {
            userCount,
            rootHash: this.merkleTree.getRootHash(),
            treeStats: this.merkleTree.getTreeStats(),
            users: Array.from(this.userKeys.entries()).map(([index, data]) => ({
                index,
                userId: CryptoUtils.truncateHash(data.userId),
                publicKeyPreview: CryptoUtils.truncateHash(data.publicKey)
            }))
        };
    }

    /**
     * 生成零知识证明
     * @param {number} userIndex - 用户索引
     * @returns {Promise<Object>} 零知识证明
     */
    async generateZKProof(userIndex) {
        if (!this.merkleTree) {
            throw new Error('系统未初始化');
        }

        const userData = this.userKeys.get(userIndex);
        if (!userData) {
            throw new Error('用户不存在');
        }

        // 生成默克尔树成员证明
        const membershipProof = await this.merkleTree.generateMembershipProof(userData.publicKey);

        // 生成零知识证明承诺
        const commitment = await this._generateCommitment(userData.publicKey);

        // 生成挑战
        const challenge = await this._generateChallenge(commitment, membershipProof);

        // 生成响应（不暴露公钥）
        const response = await this._generateResponse(userData.publicKey, challenge, commitment);

        this.currentProof = {
            commitment,
            challenge,
            response,
            membershipProof,
            timestamp: Date.now(),
            userIndex // 仅用于演示，实际应用中不应包含
        };

        return {
            proof: this.currentProof,
            proofSummary: {
                commitmentHash: CryptoUtils.truncateHash(commitment.hash),
                challengeHash: CryptoUtils.truncateHash(challenge),
                responseHash: CryptoUtils.truncateHash(response.hash),
                pathLength: membershipProof.path.length,
                rootHash: CryptoUtils.truncateHash(membershipProof.rootHash)
            }
        };
    }

    /**
     * 生成承诺
     * @param {string} publicKey - 用户公钥
     * @returns {Promise<Object>} 承诺对象
     */
    async _generateCommitment(publicKey) {
        // 生成随机数r
        const randomness = CryptoUtils.generateSalt(32);
        
        // 计算承诺 C = H(publicKey || r)
        const commitmentData = publicKey + randomness;
        const hash = await CryptoUtils.sha256(commitmentData);

        return {
            hash,
            randomness, // 在实际应用中，这应该保密
            timestamp: Date.now()
        };
    }

    /**
     * 生成挑战
     * @param {Object} commitment - 承诺对象
     * @param {Object} membershipProof - 成员证明
     * @returns {Promise<string>} 挑战值
     */
    async _generateChallenge(commitment, membershipProof) {
        // 使用Fiat-Shamir启发式生成挑战
        const challengeData = commitment.hash + membershipProof.rootHash + membershipProof.leafHash;
        return await CryptoUtils.sha256(challengeData);
    }

    /**
     * 生成响应
     * @param {string} publicKey - 用户公钥
     * @param {string} challenge - 挑战值
     * @param {Object} commitment - 承诺对象
     * @returns {Promise<Object>} 响应对象
     */
    async _generateResponse(publicKey, challenge, commitment) {
        // 计算响应 z = r + challenge * privateKey (简化版本)
        // 在实际实现中，这里会使用更复杂的零知识证明协议
        const responseData = commitment.randomness + challenge;
        const hash = await CryptoUtils.sha256(responseData);

        return {
            hash,
            data: responseData, // 简化实现，实际应用中结构会更复杂
            timestamp: Date.now()
        };
    }

    /**
     * 验证零知识证明
     * @param {Object} proof - 证明对象
     * @returns {Promise<Object>} 验证结果
     */
    async verifyZKProof(proof) {
        if (!proof) {
            throw new Error('证明对象为空');
        }

        const verificationSteps = [];
        let isValid = true;

        try {
            // 步骤1: 验证默克尔树成员证明
            const membershipValid = await this.merkleTree.verifyMembershipProof(proof.membershipProof);
            verificationSteps.push({
                step: '默克尔树成员证明验证',
                result: membershipValid,
                details: membershipValid ? '用户确实属于注册用户集合' : '用户不属于注册用户集合'
            });

            if (!membershipValid) {
                isValid = false;
            }

            // 步骤2: 验证挑战生成
            const expectedChallenge = await this._generateChallenge(proof.commitment, proof.membershipProof);
            const challengeValid = expectedChallenge === proof.challenge;
            verificationSteps.push({
                step: '挑战值验证',
                result: challengeValid,
                details: challengeValid ? '挑战值正确生成' : '挑战值不匹配'
            });

            if (!challengeValid) {
                isValid = false;
            }

            // 步骤3: 验证响应一致性
            const responseValid = await this._verifyResponse(proof);
            verificationSteps.push({
                step: '响应一致性验证',
                result: responseValid,
                details: responseValid ? '响应与承诺和挑战一致' : '响应验证失败'
            });

            if (!responseValid) {
                isValid = false;
            }

            // 步骤4: 验证时间戳（防重放攻击）
            const timestampValid = this._verifyTimestamp(proof.timestamp);
            verificationSteps.push({
                step: '时间戳验证',
                result: timestampValid,
                details: timestampValid ? '证明在有效时间窗口内' : '证明已过期'
            });

            if (!timestampValid) {
                isValid = false;
            }

        } catch (error) {
            verificationSteps.push({
                step: '验证过程',
                result: false,
                details: `验证过程出错: ${error.message}`
            });
            isValid = false;
        }

        return {
            isValid,
            verificationSteps,
            summary: {
                totalSteps: verificationSteps.length,
                passedSteps: verificationSteps.filter(s => s.result).length,
                finalResult: isValid ? '证明有效' : '证明无效'
            }
        };
    }

    /**
     * 验证响应
     * @param {Object} proof - 证明对象
     * @returns {Promise<boolean>} 验证结果
     */
    async _verifyResponse(proof) {
        // 简化的响应验证
        // 在实际实现中，这里会验证零知识证明的数学关系
        const expectedResponseData = proof.commitment.randomness + proof.challenge;
        const expectedHash = await CryptoUtils.sha256(expectedResponseData);
        
        return expectedHash === proof.response.hash;
    }

    /**
     * 验证时间戳
     * @param {number} timestamp - 证明时间戳
     * @returns {boolean} 是否在有效时间窗口内
     */
    _verifyTimestamp(timestamp) {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5分钟有效期
        return (now - timestamp) <= maxAge;
    }

    /**
     * 获取系统状态
     * @returns {Object} 系统状态信息
     */
    getSystemStatus() {
        if (!this.merkleTree) {
            return {
                initialized: false,
                message: '系统未初始化'
            };
        }

        const stats = this.merkleTree.getTreeStats();
        return {
            initialized: true,
            userCount: this.userKeys.size,
            rootHash: CryptoUtils.truncateHash(stats.rootHash),
            treeHeight: stats.treeHeight,
            totalNodes: stats.totalNodes,
            hasCurrentProof: !!this.currentProof
        };
    }

    /**
     * 获取用户列表（用于演示）
     * @returns {Array} 用户信息列表
     */
    getUserList() {
        return Array.from(this.userKeys.entries()).map(([index, data]) => ({
            index,
            label: `用户 ${index + 1}`,
            userIdPreview: CryptoUtils.truncateHash(data.userId, 16),
            publicKeyPreview: CryptoUtils.truncateHash(data.publicKey, 16)
        }));
    }

    /**
     * 重置系统
     */
    reset() {
        this.merkleTree = null;
        this.userKeys.clear();
        this.currentProof = null;
    }

    /**
     * 获取证明的详细信息（用于调试）
     * @param {Object} proof - 证明对象
     * @returns {Object} 详细信息
     */
    getProofDetails(proof) {
        if (!proof) return null;

        return {
            commitment: {
                hash: CryptoUtils.truncateHash(proof.commitment.hash),
                timestamp: new Date(proof.commitment.timestamp).toLocaleString()
            },
            challenge: CryptoUtils.truncateHash(proof.challenge),
            response: {
                hash: CryptoUtils.truncateHash(proof.response.hash),
                timestamp: new Date(proof.response.timestamp).toLocaleString()
            },
            membershipProof: {
                leafHash: CryptoUtils.truncateHash(proof.membershipProof.leafHash),
                rootHash: CryptoUtils.truncateHash(proof.membershipProof.rootHash),
                pathLength: proof.membershipProof.path.length,
                leafIndex: proof.membershipProof.leafIndex
            },
            proofTimestamp: new Date(proof.timestamp).toLocaleString()
        };
    }
}

// 导出零知识证明系统
window.ZKProofSystem = ZKProofSystem;