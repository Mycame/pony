/**
 * 零知识证明身份验证系统 - 主应用
 * 集成所有组件并提供用户界面交互
 */

class ZKAuthApp {
    constructor() {
        this.zkSystem = new ZKProofSystem();
        this.currentProof = null;
        this.initializeEventListeners();
    }

    /**
     * 初始化事件监听器
     */
    initializeEventListeners() {
        // 系统初始化
        document.getElementById('initSystem').addEventListener('click', () => {
            this.initializeSystem();
        });

        // 生成证明
        document.getElementById('generateProof').addEventListener('click', () => {
            this.generateProof();
        });

        // 验证证明
        document.getElementById('verifyProof').addEventListener('click', () => {
            this.verifyProof();
        });

        // 用户数量变化时重置系统
        document.getElementById('userCount').addEventListener('change', () => {
            this.resetSystem();
        });
    }

    /**
     * 初始化系统
     */
    async initializeSystem() {
        const userCount = parseInt(document.getElementById('userCount').value);
        const statusBox = document.getElementById('systemStatus');
        const initButton = document.getElementById('initSystem');

        try {
            initButton.disabled = true;
            statusBox.textContent = '正在初始化系统...';
            statusBox.className = 'status-box';

            const result = await this.zkSystem.initializeSystem(userCount);

            // 更新用户选择下拉框
            this.updateUserSelect(result.users);

            // 显示系统状态
            const statusText = `系统初始化成功！
用户数量: ${result.userCount}
根哈希: ${CryptoUtils.truncateHash(result.rootHash)}
树高度: ${result.treeStats.treeHeight}
总节点数: ${result.treeStats.totalNodes}

用户列表:
${result.users.map(u => `用户 ${u.index + 1}: ${u.userId}`).join('\n')}`;

            statusBox.textContent = statusText;
            statusBox.className = 'status-box success';

            // 更新默克尔树可视化
            this.updateMerkleTreeVisualization();

            // 启用其他功能
            document.getElementById('generateProof').disabled = false;

        } catch (error) {
            statusBox.textContent = `初始化失败: ${error.message}`;
            statusBox.className = 'status-box error';
        } finally {
            initButton.disabled = false;
        }
    }

    /**
     * 更新用户选择下拉框
     */
    updateUserSelect(users) {
        const userSelect = document.getElementById('userSelect');
        userSelect.innerHTML = '<option value="">请选择用户</option>';

        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.index;
            option.textContent = `用户 ${user.index + 1} (ID: ${user.userId})`;
            userSelect.appendChild(option);
        });
    }

    /**
     * 生成零知识证明
     */
    async generateProof() {
        const userIndex = parseInt(document.getElementById('userSelect').value);
        const proofResult = document.getElementById('proofResult');
        const generateButton = document.getElementById('generateProof');

        if (isNaN(userIndex)) {
            proofResult.textContent = '请先选择一个用户';
            proofResult.className = 'status-box error';
            return;
        }

        try {
            generateButton.disabled = true;
            proofResult.textContent = '正在生成零知识证明...';
            proofResult.className = 'status-box';

            const result = await this.zkSystem.generateZKProof(userIndex);
            this.currentProof = result.proof;

            const proofText = `零知识证明生成成功！

证明摘要:
- 承诺哈希: ${result.proofSummary.commitmentHash}
- 挑战哈希: ${result.proofSummary.challengeHash}
- 响应哈希: ${result.proofSummary.responseHash}
- 证明路径长度: ${result.proofSummary.pathLength}
- 根哈希: ${result.proofSummary.rootHash}

证明详情:
${this.formatProofPath(result.proof.membershipProof)}

注意: 整个过程中用户的公钥从未暴露给验证者！`;

            proofResult.textContent = proofText;
            proofResult.className = 'status-box success';

            // 启用验证按钮
            document.getElementById('verifyProof').disabled = false;

        } catch (error) {
            proofResult.textContent = `证明生成失败: ${error.message}`;
            proofResult.className = 'status-box error';
        } finally {
            generateButton.disabled = false;
        }
    }

    /**
     * 格式化证明路径
     */
    formatProofPath(membershipProof) {
        let pathText = `叶子节点: ${CryptoUtils.truncateHash(membershipProof.leafHash)}\n`;
        pathText += `叶子索引: ${membershipProof.leafIndex}\n`;
        pathText += `证明路径:\n`;

        membershipProof.path.forEach((step, index) => {
            const position = step.isLeft ? '左' : '右';
            pathText += `  第${index + 1}层: ${position}侧兄弟节点 ${CryptoUtils.truncateHash(step.hash)}\n`;
        });

        pathText += `根节点: ${CryptoUtils.truncateHash(membershipProof.rootHash)}`;
        return pathText;
    }

    /**
     * 验证零知识证明
     */
    async verifyProof() {
        const verificationResult = document.getElementById('verificationResult');
        const verifyButton = document.getElementById('verifyProof');

        if (!this.currentProof) {
            verificationResult.textContent = '请先生成证明';
            verificationResult.className = 'status-box error';
            return;
        }

        try {
            verifyButton.disabled = true;
            verificationResult.textContent = '正在验证证明...';
            verificationResult.className = 'status-box';

            const result = await this.zkSystem.verifyZKProof(this.currentProof);

            let resultText = `验证结果: ${result.summary.finalResult}\n\n`;
            resultText += `验证步骤 (${result.summary.passedSteps}/${result.summary.totalSteps} 通过):\n`;

            result.verificationSteps.forEach((step, index) => {
                const status = step.result ? '✓' : '✗';
                resultText += `${index + 1}. ${status} ${step.step}\n`;
                resultText += `   ${step.details}\n\n`;
            });

            if (result.isValid) {
                resultText += '🎉 证明验证成功！用户身份得到确认，且公钥未暴露。';
            } else {
                resultText += '❌ 证明验证失败！';
            }

            verificationResult.textContent = resultText;
            verificationResult.className = result.isValid ? 'status-box success' : 'status-box error';

        } catch (error) {
            verificationResult.textContent = `验证过程出错: ${error.message}`;
            verificationResult.className = 'status-box error';
        } finally {
            verifyButton.disabled = false;
        }
    }

    /**
     * 更新默克尔树可视化
     */
    updateMerkleTreeVisualization() {
        const treeContainer = document.getElementById('merkleTreeViz');
        
        if (!this.zkSystem.merkleTree) {
            treeContainer.textContent = '请先初始化系统';
            return;
        }

        const treeVisualization = this.zkSystem.merkleTree.getTreeVisualization();
        const stats = this.zkSystem.merkleTree.getTreeStats();

        const content = `默克尔树结构:
${treeVisualization}

树统计信息:
- 叶子节点数: ${stats.leafNodes}
- 总节点数: ${stats.totalNodes}
- 树高度: ${stats.treeHeight}
- 根哈希: ${CryptoUtils.truncateHash(stats.rootHash)}`;

        treeContainer.textContent = content;
    }

    /**
     * 重置系统
     */
    resetSystem() {
        this.zkSystem.reset();
        this.currentProof = null;

        // 重置UI
        document.getElementById('systemStatus').textContent = '';
        document.getElementById('systemStatus').className = 'status-box';
        
        document.getElementById('proofResult').textContent = '';
        document.getElementById('proofResult').className = 'status-box';
        
        document.getElementById('verificationResult').textContent = '';
        document.getElementById('verificationResult').className = 'status-box';
        
        document.getElementById('merkleTreeViz').textContent = '请先初始化系统';

        // 重置用户选择
        const userSelect = document.getElementById('userSelect');
        userSelect.innerHTML = '<option value="">请先初始化系统</option>';

        // 禁用按钮
        document.getElementById('generateProof').disabled = true;
        document.getElementById('verifyProof').disabled = true;
    }

    /**
     * 显示系统信息
     */
    showSystemInfo() {
        const status = this.zkSystem.getSystemStatus();
        console.log('系统状态:', status);
        
        if (status.initialized) {
            const users = this.zkSystem.getUserList();
            console.log('用户列表:', users);
        }
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ZKAuthApp();
    
    // 添加一些调试功能
    window.showSystemInfo = () => window.app.showSystemInfo();
    
    console.log('零知识证明身份验证系统已加载');
    console.log('使用 showSystemInfo() 查看系统状态');
});