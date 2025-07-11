import { exec } from 'child_process';
import { promisify } from 'util';
import { Notice, Platform } from 'obsidian';

/**
 * IDE 命令工具类
 * 提供执行和测试 IDE 命令的功能
 */
export class IdeCommandTool {
    /**
     * 测试 IDE 命令是否可执行
     * @param command 要测试的命令
     * @returns 返回命令是否可以执行
     * @throws 如果在移动端环境或命令为空
     */
    static async testCommand(command: string): Promise<boolean> {
        if (Platform.isMobile) {
            throw new Error('IDE commands are not supported on mobile devices');
        }

        if (!command.trim()) {
            throw new Error('Command cannot be empty');
        }

        return new Promise((resolve) => {
            const execAsync = promisify(exec);
            
            // 在 Windows 上，我们可能需要稍微不同的处理方式
            // 这里我们只是尝试执行命令的第一部分来测试可用性
            const commandParts = command.trim().split(' ');
            const executable = commandParts[0];
            
            // 在 Windows 上测试命令是否存在
            const testCommand = process.platform === 'win32' 
                ? `where "${executable}"` 
                : `which "${executable}"`;

            execAsync(testCommand, { timeout: 5000 })
                .then(() => {
                    resolve(true);
                })
                .catch(() => {
                    resolve(false);
                });
        });
    }

    /**
     * 执行 IDE 命令打开仓库
     * @param command 要执行的命令
     * @param silent 是否不显示通知
     * @returns 返回命令是否执行成功
     */
    static async executeCommand(command: string, silent: boolean = false): Promise<boolean> {
        if (Platform.isMobile) {
            if (!silent) {
                new Notice('IDE commands are not supported on mobile devices');
            }
            return false;
        }

        if (!command.trim()) {
            if (!silent) {
                new Notice('No IDE command configured for this repository');
            }
            return false;
        }

        try {
            const execAsync = promisify(exec);
            await execAsync(command, { timeout: 10000 });
            if (!silent) {
                new Notice('IDE command executed successfully');
            }
            return true;
        } catch (error) {
            console.error('Failed to execute IDE command:', error);
            if (!silent) {
                new Notice(`Failed to execute IDE command: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            return false;
        }
    }
}
