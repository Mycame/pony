/**
 * 默克尔树实现
 * 用于构建用户集合的默克尔树并生成成员证明
 */

class MerkleTreeNode {
    constructor(hash, left = null, right = null, isLeaf = false, data = null) {
        this.hash = hash;
        this.left = left;
        this.right = right;
        this.isLeaf = isLeaf;
        this.data = data; // 存储原始数据（仅叶子节点）
    }
}

class MerkleTree {
    constructor() {
        this.root = null;
        this.leaves = [];
        this.nodes = new Map(); // 哈希值到节点的映射
    }

    /**
     * 从用户公钥列表构建默克尔树
     * @param {Array<string>} publicKeys - 用户公钥数组
     */
    async buildTree(publicKeys) {
        if (publicKeys.length === 0) {
            throw new Error('公钥列表不能为空');
        }

        // 生成叶子节点
        this.leaves = [];
        for (let i = 0; i < publicKeys.length; i++) {
            const hash = await CryptoUtils.generateUserId(publicKeys[i]);
            const leaf = new MerkleTreeNode(hash, null, null, true, {
                publicKey: publicKeys[i],
                index: i
            });
            this.leaves.push(leaf);
            this.nodes.set(hash, leaf);
        }

        // 构建树
        this.root = await this._buildTreeRecursive(this.leaves);
    }

    /**
     * 递归构建默克尔树
     * @param {Array<MerkleTreeNode>} nodes - 当前层的节点
     * @returns {Promise<MerkleTreeNode>} 根节点
     */
    async _buildTreeRecursive(nodes) {
        if (nodes.length === 1) {
            return nodes[0];
        }

        const nextLevel = [];
        
        // 如果节点数为奇数，复制最后一个节点
        if (nodes.length % 2 === 1) {
            nodes.push(nodes[nodes.length - 1]);
        }

        // 两两配对创建父节点
        for (let i = 0; i < nodes.length; i += 2) {
            const left = nodes[i];
            const right = nodes[i + 1];
            const combinedHash = await CryptoUtils.combineHashes(left.hash, right.hash);
            
            const parent = new MerkleTreeNode(combinedHash, left, right, false);
            nextLevel.push(parent);
            this.nodes.set(combinedHash, parent);
        }

        return await this._buildTreeRecursive(nextLevel);
    }

    /**
     * 获取根哈希
     * @returns {string} 根节点哈希值
     */
    getRootHash() {
        return this.root ? this.root.hash : null;
    }

    /**
     * 生成成员证明路径
     * @param {string} publicKey - 用户公钥
     * @returns {Promise<Object>} 证明对象
     */
    async generateMembershipProof(publicKey) {
        const userHash = await CryptoUtils.generateUserId(publicKey);
        const leaf = this.leaves.find(l => l.hash === userHash);
        
        if (!leaf) {
            throw new Error('用户不在树中');
        }

        const proof = {
            leafHash: userHash,
            leafIndex: leaf.data.index,
            path: [],
            rootHash: this.getRootHash()
        };

        // 从叶子节点向上遍历到根节点
        let currentNode = leaf;
        let currentHash = userHash;

        while (currentNode !== this.root) {
            const parent = this._findParent(currentNode);
            if (!parent) break;

            // 确定兄弟节点
            const isLeftChild = parent.left === currentNode;
            const sibling = isLeftChild ? parent.right : parent.left;
            
            proof.path.push({
                hash: sibling.hash,
                isLeft: !isLeftChild, // 兄弟节点相对于当前路径的位置
                level: proof.path.length
            });

            currentNode = parent;
            currentHash = parent.hash;
        }

        return proof;
    }

    /**
     * 查找节点的父节点
     * @param {MerkleTreeNode} node - 子节点
     * @returns {MerkleTreeNode|null} 父节点
     */
    _findParent(node) {
        for (const [hash, n] of this.nodes) {
            if ((n.left === node || n.right === node) && !n.isLeaf) {
                return n;
            }
        }
        return null;
    }

    /**
     * 验证成员证明
     * @param {Object} proof - 证明对象
     * @returns {Promise<boolean>} 验证结果
     */
    async verifyMembershipProof(proof) {
        let currentHash = proof.leafHash;

        // 沿着路径重新计算根哈希
        for (const step of proof.path) {
            if (step.isLeft) {
                currentHash = await CryptoUtils.combineHashes(step.hash, currentHash);
            } else {
                currentHash = await CryptoUtils.combineHashes(currentHash, step.hash);
            }
        }

        return currentHash === proof.rootHash;
    }

    /**
     * 获取树的可视化表示
     * @returns {string} 树的文本表示
     */
    getTreeVisualization() {
        if (!this.root) return '树为空';

        const lines = [];
        this._visualizeNode(this.root, '', true, lines);
        return lines.join('\n');
    }

    /**
     * 递归可视化节点
     * @param {MerkleTreeNode} node - 当前节点
     * @param {string} prefix - 前缀
     * @param {boolean} isLast - 是否为最后一个子节点
     * @param {Array<string>} lines - 输出行数组
     */
    _visualizeNode(node, prefix, isLast, lines) {
        if (!node) return;

        const connector = isLast ? '└── ' : '├── ';
        const nodeType = node.isLeaf ? '[叶子]' : '[内部]';
        const hashDisplay = CryptoUtils.truncateHash(node.hash, 12);
        
        lines.push(prefix + connector + nodeType + ' ' + hashDisplay);

        if (!node.isLeaf && (node.left || node.right)) {
            const newPrefix = prefix + (isLast ? '    ' : '│   ');
            
            if (node.left) {
                this._visualizeNode(node.left, newPrefix, !node.right, lines);
            }
            if (node.right) {
                this._visualizeNode(node.right, newPrefix, true, lines);
            }
        }
    }

    /**
     * 获取树的统计信息
     * @returns {Object} 统计信息
     */
    getTreeStats() {
        if (!this.root) {
            return {
                totalNodes: 0,
                leafNodes: 0,
                treeHeight: 0,
                rootHash: null
            };
        }

        return {
            totalNodes: this.nodes.size,
            leafNodes: this.leaves.length,
            treeHeight: this._calculateHeight(this.root),
            rootHash: this.getRootHash()
        };
    }

    /**
     * 计算树的高度
     * @param {MerkleTreeNode} node - 起始节点
     * @returns {number} 树的高度
     */
    _calculateHeight(node) {
        if (!node || node.isLeaf) return 1;
        
        const leftHeight = node.left ? this._calculateHeight(node.left) : 0;
        const rightHeight = node.right ? this._calculateHeight(node.right) : 0;
        
        return 1 + Math.max(leftHeight, rightHeight);
    }

    /**
     * 获取所有叶子节点信息
     * @returns {Array<Object>} 叶子节点信息数组
     */
    getLeafNodes() {
        return this.leaves.map(leaf => ({
            hash: leaf.hash,
            publicKey: leaf.data.publicKey,
            index: leaf.data.index,
            truncatedHash: CryptoUtils.truncateHash(leaf.hash)
        }));
    }
}

// 导出默克尔树类
window.MerkleTree = MerkleTree;
window.MerkleTreeNode = MerkleTreeNode;