import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type GithubProjectsPlugin from '../main';
import { GitHubIssueCache, GitHubDataSync } from '../github/dataSync';

export interface GithubRepository {
	name: string; // 显示名称
	owner: string; // GitHub用户名或组织名
	repo: string; // 仓库名
	isDefault: boolean; // 是否为默认仓库
	isDisabled?: boolean; // 是否禁用（不显示在下拉栏，不同步）
}

export interface GithubProjectsSettings {
	githubToken: string;
	repositories: GithubRepository[]; // 多仓库列表
	autoSync: boolean;
	syncInterval: number; // in minutes
	issueCache: GitHubIssueCache; // Issue 缓存数据
}

export const DEFAULT_SETTINGS: GithubProjectsSettings = {
	githubToken: '',
	repositories: [],
	autoSync: false,
	syncInterval: 5,
	issueCache: {}
}

export class GithubProjectsSettingTab extends PluginSettingTab {
	plugin: GithubProjectsPlugin;
	private activeTab = 'basic';
	private tokenStatus: 'untested' | 'testing' | 'valid' | 'invalid' = 'untested';
	private tokenTestResult = '';

	constructor(app: App, plugin: GithubProjectsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		// 创建标签页导航
		const tabNav = containerEl.createDiv();
		tabNav.style.marginBottom = '20px';
		tabNav.style.borderBottom = '1px solid var(--background-modifier-border)';

		const tabs = [
			{ id: 'basic', name: 'Token Setup' },
			{ id: 'repositories', name: 'Repositories' },
			{ id: 'sync', name: 'Sync Options' }
		];

		tabs.forEach(tab => {
			const tabButton = tabNav.createEl('button', { text: tab.name });
			tabButton.style.padding = '10px 20px';
			tabButton.style.margin = '0 5px 0 0';
			tabButton.style.border = 'none';
			tabButton.style.backgroundColor = this.activeTab === tab.id ? 'var(--interactive-accent)' : 'transparent';
			tabButton.style.color = this.activeTab === tab.id ? 'var(--text-on-accent)' : 'var(--text-normal)';
			tabButton.style.cursor = 'pointer';
			tabButton.style.borderRadius = '5px 5px 0 0';

			tabButton.addEventListener('click', () => {
				this.activeTab = tab.id;
				this.display();
			});
		});

		// 显示对应的标签页内容
		this.displayTabContent(containerEl);
	}

	private displayTabContent(containerEl: HTMLElement): void {
		switch (this.activeTab) {
			case 'basic':
				this.displayBasicSettings(containerEl);
				break;
			case 'repositories':
				this.displayRepositorySettings(containerEl);
				break;
			case 'sync':
				this.displaySyncSettings(containerEl);
				break;
		}
	}

	private displayBasicSettings(containerEl: HTMLElement): void {
		// GitHub Token 设置容器
		const tokenContainer = containerEl.createDiv();
		tokenContainer.style.marginBottom = '20px';

		// GitHub Token 设置
		new Setting(tokenContainer)
			.setName('GitHub Personal Access Token')
			.setDesc('Enter your GitHub personal access token.')
			.addText(text => text
				.setPlaceholder('ghp_xxxxxxxxxxxxxxxxxxxx')
				.setValue(this.plugin.settings.githubToken)
				.onChange(async (value) => {
					this.plugin.settings.githubToken = value;
					await this.plugin.saveSettings();
					// Token 改变时重置状态
					this.tokenStatus = 'untested';
					this.tokenTestResult = '';
					this.updateTokenStatus(tokenContainer);
				}));

		// 测试按钮和状态指示器容器
		const testContainer = tokenContainer.createDiv();
		testContainer.style.display = 'flex';
		testContainer.style.alignItems = 'center';
		testContainer.style.marginTop = '10px';
		testContainer.style.gap = '10px';

		// 测试按钮
		const testButton = testContainer.createEl('button', {
			text: 'Test Token',
			cls: 'mod-cta'
		});

		// 状态指示灯
		const statusIndicator = testContainer.createDiv();
		statusIndicator.style.width = '12px';
		statusIndicator.style.height = '12px';
		statusIndicator.style.borderRadius = '50%';
		statusIndicator.style.flexShrink = '0';

		// 状态文本
		const statusText = testContainer.createDiv();
		statusText.style.fontSize = '12px';
		statusText.style.flex = '1';

		// 绑定测试按钮事件
		testButton.addEventListener('click', async () => {
			await this.testGitHubToken(tokenContainer);
		});

		// 初始化状态显示
		this.updateTokenStatus(tokenContainer);

		// 添加创建token的链接和权限说明
		const tokenInfoDiv = containerEl.createDiv();
		tokenInfoDiv.style.marginTop = '10px';
		tokenInfoDiv.style.marginBottom = '20px';
		tokenInfoDiv.style.padding = '10px';
		tokenInfoDiv.style.backgroundColor = 'var(--background-secondary)';
		tokenInfoDiv.style.borderRadius = '5px';
		tokenInfoDiv.style.fontSize = '12px';
		tokenInfoDiv.style.color = 'var(--text-muted)';

		const tokenLinkP = tokenInfoDiv.createEl('p');
		tokenLinkP.style.margin = '0 0 8px 0';
		tokenLinkP.innerHTML = 'Don\'t have a token? <a href="https://github.com/settings/tokens/new" target="_blank" style="color: var(--text-accent);">Create one here</a>';

		const permissionP = tokenInfoDiv.createEl('p');
		permissionP.style.margin = '0';
		permissionP.innerHTML = '<strong>Required permissions:</strong> repo (for private repos) or public_repo (for public repos only)';

		// 添加令牌格式说明
		const formatP = tokenInfoDiv.createEl('p');
		formatP.style.margin = '8px 0 0 0';
		formatP.innerHTML = '<strong>Token format:</strong> Should start with "ghp_" followed by 36 characters';

		// 添加说明文档
		const helpDiv = containerEl.createDiv();
		helpDiv.style.marginTop = '30px';
		helpDiv.createEl('h3', {text: 'Setup Instructions'});
		helpDiv.createEl('p', {text: '1. Create a GitHub Personal Access Token with repo permissions'});
		helpDiv.createEl('p', {text: '2. Enter the token above and test it'});
		helpDiv.createEl('p', {text: '3. Switch to Repositories tab to add your repositories'});
		helpDiv.createEl('p', {text: '4. Configure sync preferences in Sync Options tab'});
	}

	private displayRepositorySettings(containerEl: HTMLElement): void {
		containerEl.createEl('h3', {text: 'Repository Management'});

		// 添加新仓库的输入框
		const addRepoContainer = containerEl.createDiv();
		addRepoContainer.style.marginBottom = 'var(--size-4-3)';
		addRepoContainer.style.padding = 'var(--size-4-2)';
		addRepoContainer.style.border = '1px solid var(--background-modifier-border)';
		addRepoContainer.style.borderRadius = 'var(--radius-s)';
		addRepoContainer.style.backgroundColor = 'var(--background-secondary)';

		addRepoContainer.createEl('h4', {text: 'Add New Repository'});

		// URL 输入框
		const urlInput = addRepoContainer.createEl('input', {
			type: 'text',
			placeholder: 'GitHub URL (e.g., https://github.com/username/reponame)'
		});
		urlInput.style.width = '100%';
		urlInput.style.marginBottom = 'var(--size-2-2)';
		urlInput.style.padding = 'var(--size-2-2)';
		urlInput.style.borderRadius = 'var(--radius-s)';
		urlInput.style.border = '1px solid var(--background-modifier-border)';
		urlInput.style.fontSize = 'var(--font-ui-small)';

		// 或分隔线
		const orDiv = addRepoContainer.createDiv();
		orDiv.textContent = 'OR';
		orDiv.style.textAlign = 'center';
		orDiv.style.margin = 'var(--size-2-2) 0';
		orDiv.style.color = 'var(--text-muted)';
		orDiv.style.fontSize = 'var(--font-ui-smaller)';

		// 手动输入区域
		const manualDiv = addRepoContainer.createDiv();
		manualDiv.style.marginTop = 'var(--size-2-2)';

		const nameInput = manualDiv.createEl('input', {
			type: 'text',
			placeholder: 'Repository display name (e.g., My Project)'
		});
		nameInput.style.width = '100%';
		nameInput.style.marginBottom = 'var(--size-2-2)';
		nameInput.style.padding = 'var(--size-2-2)';
		nameInput.style.borderRadius = 'var(--radius-s)';
		nameInput.style.border = '1px solid var(--background-modifier-border)';
		nameInput.style.fontSize = 'var(--font-ui-small)';

		const ownerInput = manualDiv.createEl('input', {
			type: 'text',
			placeholder: 'Owner/Organization (e.g., username)'
		});
		ownerInput.style.width = '48%';
		ownerInput.style.marginRight = '4%';
		ownerInput.style.marginBottom = 'var(--size-2-2)';
		ownerInput.style.padding = 'var(--size-2-2)';
		ownerInput.style.borderRadius = 'var(--radius-s)';
		ownerInput.style.border = '1px solid var(--background-modifier-border)';
		ownerInput.style.fontSize = 'var(--font-ui-small)';

		const repoInput = manualDiv.createEl('input', {
			type: 'text',
			placeholder: 'Repository name (e.g., my-repo)'
		});
		repoInput.style.width = '48%';
		repoInput.style.marginBottom = 'var(--size-2-2)';
		repoInput.style.padding = 'var(--size-2-2)';
		repoInput.style.borderRadius = 'var(--radius-s)';
		repoInput.style.border = '1px solid var(--background-modifier-border)';
		repoInput.style.fontSize = 'var(--font-ui-small)';

		// URL 自动解析功能
		urlInput.addEventListener('input', () => {
			const url = urlInput.value.trim();
			const parsed = this.parseGitHubUrl(url);
			
			if (parsed) {
				nameInput.value = parsed.name;
				ownerInput.value = parsed.owner;
				repoInput.value = parsed.repo;
				
				// 给手动输入框添加视觉提示（绿色边框）
				nameInput.style.borderColor = 'var(--color-green)';
				ownerInput.style.borderColor = 'var(--color-green)';
				repoInput.style.borderColor = 'var(--color-green)';
				nameInput.style.backgroundColor = '';
				ownerInput.style.backgroundColor = '';
				repoInput.style.backgroundColor = '';
			} else if (url.length > 0) {
				// 如果有输入但解析失败，重置样式
				nameInput.style.borderColor = '';
				ownerInput.style.borderColor = '';
				repoInput.style.borderColor = '';
				nameInput.style.backgroundColor = '';
				ownerInput.style.backgroundColor = '';
				repoInput.style.backgroundColor = '';
			} else {
				// 清空时重置样式
				nameInput.style.borderColor = '';
				ownerInput.style.borderColor = '';
				repoInput.style.borderColor = '';
				nameInput.style.backgroundColor = '';
				ownerInput.style.backgroundColor = '';
				repoInput.style.backgroundColor = '';
			}
		});

		// 当手动输入框被修改时，清除 URL 输入框
		[nameInput, ownerInput, repoInput].forEach(input => {
			input.addEventListener('input', () => {
				if (input.value.trim()) {
					urlInput.value = '';
				}
			});
		});

		const addButton = addRepoContainer.createEl('button', {
			text: 'Add Repository',
			cls: 'mod-cta'
		});

		addButton.addEventListener('click', async () => {
			let name = nameInput.value.trim();
			let owner = ownerInput.value.trim();
			let repo = repoInput.value.trim();

			// 如果没有手动输入，尝试从URL解析
			if ((!name || !owner || !repo) && urlInput.value.trim()) {
				const parsed = this.parseGitHubUrl(urlInput.value.trim());
				if (parsed) {
					name = name || parsed.name;
					owner = owner || parsed.owner;
					repo = repo || parsed.repo;
				}
			}

			if (!name || !owner || !repo) {
				// 创建错误提示
				const errorDiv = addRepoContainer.querySelector('.error-message') as HTMLElement;
				if (errorDiv) {
					errorDiv.remove();
				}
				
				const newErrorDiv = addRepoContainer.createDiv();
				newErrorDiv.className = 'error-message';
				newErrorDiv.textContent = 'Please provide a valid GitHub URL or fill in all fields manually.';
				newErrorDiv.style.color = 'var(--text-error)';
				newErrorDiv.style.fontSize = '12px';
				newErrorDiv.style.marginTop = '5px';
				
				// 3秒后自动删除错误提示
				setTimeout(() => {
					newErrorDiv.remove();
				}, 3000);
				
				return;
			}

			const newRepo: GithubRepository = {
				name,
				owner,
				repo,
				isDefault: this.plugin.settings.repositories.length === 0, // 第一个仓库自动设为默认
				isDisabled: false // 新仓库默认启用
			};

			this.plugin.settings.repositories.push(newRepo);
			await this.plugin.saveSettings();

			// 清空输入框
			urlInput.value = '';
			nameInput.value = '';
			ownerInput.value = '';
			repoInput.value = '';
			
			// 重置输入框样式
			nameInput.style.backgroundColor = '';
			ownerInput.style.backgroundColor = '';
			repoInput.style.backgroundColor = '';
			nameInput.style.borderColor = '';
			ownerInput.style.borderColor = '';
			repoInput.style.borderColor = '';

			// 重新渲染页面
			this.display();
		});

		// 显示已添加的仓库列表
		if (this.plugin.settings.repositories.length > 0) {
			containerEl.createEl('h4', {text: 'Configured Repositories'});
			
			this.plugin.settings.repositories.forEach((repository, index) => {
				const repoDiv = containerEl.createDiv();
				repoDiv.style.marginBottom = '12px';
				repoDiv.style.padding = '12px';
				repoDiv.style.border = '1px solid var(--background-modifier-border)';
				repoDiv.style.borderRadius = 'var(--radius-s)';
				
				// 根据状态设置背景色
				if (repository.isDisabled) {
					repoDiv.style.backgroundColor = 'var(--background-modifier-border)';
					repoDiv.style.opacity = '0.6';
				} else if (repository.isDefault) {
					repoDiv.style.backgroundColor = 'var(--background-modifier-hover)';
				} else {
					repoDiv.style.backgroundColor = 'transparent';
				}

				const repoHeader = repoDiv.createDiv();
				repoHeader.style.display = 'flex';
				repoHeader.style.justifyContent = 'space-between';
				repoHeader.style.alignItems = 'center';
				repoHeader.style.marginBottom = '8px';

				const repoTitle = repoHeader.createEl('h5');
				let titleText = repository.name;
				if (repository.isDefault) titleText += ' (Default)';
				if (repository.isDisabled) titleText += ' (Disabled)';
				repoTitle.textContent = titleText;
				repoTitle.style.margin = '0';
				repoTitle.style.fontSize = 'var(--font-ui-small)';
				repoTitle.style.fontWeight = 'var(--font-weight-medium)';
				if (repository.isDisabled) {
					repoTitle.style.color = 'var(--text-muted)';
				}

				const actionsDiv = repoHeader.createDiv();
				actionsDiv.style.display = 'flex';
				actionsDiv.style.gap = 'var(--size-2-2)';

				// 设为默认按钮
				if (!repository.isDefault) {
					const setDefaultButton = actionsDiv.createEl('button', {
						text: 'Set Default',
						cls: 'mod-cta'
					});
					setDefaultButton.addEventListener('click', async () => {
						// 取消其他仓库的默认状态
						this.plugin.settings.repositories.forEach(repo => repo.isDefault = false);
						// 设置当前仓库为默认
						repository.isDefault = true;
						// 如果设为默认，自动启用
						repository.isDisabled = false;
						await this.plugin.saveSettings();
						this.display();
					});
				}

				// 禁用/启用按钮
				const toggleButton = actionsDiv.createEl('button', {
					text: repository.isDisabled ? 'Enable' : 'Disable',
					cls: repository.isDisabled ? 'mod-cta' : 'mod-muted'
				});
				toggleButton.addEventListener('click', async () => {
					repository.isDisabled = !repository.isDisabled;
					// 如果禁用了默认仓库，需要设置另一个为默认
					if (repository.isDisabled && repository.isDefault) {
						repository.isDefault = false;
						// 找到第一个未禁用的仓库设为默认
						const activeRepos = this.plugin.settings.repositories.filter(r => !r.isDisabled);
						if (activeRepos.length > 0) {
							activeRepos[0].isDefault = true;
						}
					}
					await this.plugin.saveSettings();
					this.display();
				});

				// 删除按钮
				const deleteButton = actionsDiv.createEl('button', {
					cls: 'mod-warning'
				});
				deleteButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
				deleteButton.title = 'Delete repository';
				deleteButton.addEventListener('click', async () => {
					this.plugin.settings.repositories.splice(index, 1);
					// 如果删除的是默认仓库且还有其他仓库，设置第一个未禁用的为默认
					if (repository.isDefault && this.plugin.settings.repositories.length > 0) {
						const activeRepos = this.plugin.settings.repositories.filter(r => !r.isDisabled);
						if (activeRepos.length > 0) {
							activeRepos[0].isDefault = true;
						}
					}
					await this.plugin.saveSettings();
					this.display();
				});

				// 仓库信息
				const repoInfo = repoDiv.createDiv();
				repoInfo.addClass('repo-info');
				repoInfo.style.display = 'flex';
				repoInfo.style.alignItems = 'center';
				repoInfo.style.gap = 'var(--size-2-2)';

				const repoLabel = repoInfo.createSpan();
				repoLabel.innerHTML = '<strong>Repository:</strong>';
				repoLabel.style.fontSize = 'var(--font-ui-smaller)';
				repoLabel.style.color = 'var(--text-muted)';
				repoLabel.style.minWidth = 'fit-content';

				// 显示完整的可复制链接
				const repoUrl = `https://github.com/${repository.owner}/${repository.repo}`;
				const repoLink = repoInfo.createEl('a');
				repoLink.textContent = repoUrl;
				repoLink.href = repoUrl;
				repoLink.style.color = 'var(--text-accent)';
				repoLink.style.textDecoration = 'none';
				repoLink.style.cursor = 'pointer';
				repoLink.style.fontFamily = 'var(--font-monospace)';
				repoLink.style.fontSize = 'var(--font-ui-smaller)';
				repoLink.style.flex = '1';
				repoLink.style.overflow = 'hidden';
				repoLink.style.textOverflow = 'ellipsis';
				repoLink.style.whiteSpace = 'nowrap';
				repoLink.title = 'Click to copy URL';
				repoLink.addEventListener('click', (e) => {
					e.preventDefault();
					navigator.clipboard.writeText(repoUrl).then(() => {
						new Notice('Repository URL copied to clipboard');
						// 临时改变样式提供视觉反馈
						const originalColor = repoLink.style.color;
						repoLink.style.color = 'var(--color-green)';
						setTimeout(() => {
							repoLink.style.color = originalColor;
						}, 1000);
					}).catch(() => {
						new Notice('Failed to copy URL');
					});
				});

				// 按钮容器
				const buttonContainer = repoInfo.createDiv();
				buttonContainer.style.display = 'flex';
				buttonContainer.style.gap = 'var(--size-2-1)';
				buttonContainer.style.flexShrink = '0';

				// 添加复制图标按钮
				const copyIcon = buttonContainer.createEl('button', {
					cls: 'clickable-icon'
				});
				copyIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
				copyIcon.title = 'Copy repository URL';
				copyIcon.addEventListener('click', () => {
					navigator.clipboard.writeText(repoUrl).then(() => {
						new Notice('Repository URL copied to clipboard');
					});
				});

				// 添加外部链接图标（在新标签页打开）
				const externalIcon = buttonContainer.createEl('button', {
					cls: 'clickable-icon'
				});
				externalIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';
				externalIcon.title = 'Open in GitHub';
				externalIcon.addEventListener('click', () => {
					window.open(repoUrl, '_blank');
				});
			});
		}
	}

	private displaySyncSettings(containerEl: HTMLElement): void {
		// 自动同步设置
		new Setting(containerEl)
			.setName('Auto Sync')
			.setDesc('Automatically sync issues from GitHub')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSync)
				.onChange(async (value) => {
					this.plugin.settings.autoSync = value;
					await this.plugin.saveSettings();
					// 重启自动同步
					this.plugin.restartAutoSync();
				}));

		// 同步间隔设置
		new Setting(containerEl)
			.setName('Sync Interval')
			.setDesc('How often to sync issues (in minutes)')
			.addSlider(slider => slider
				.setLimits(1, 60, 1)
				.setValue(this.plugin.settings.syncInterval)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.syncInterval = value;
					await this.plugin.saveSettings();
					// 重启自动同步
					this.plugin.restartAutoSync();
				}));

		// 手动同步按钮
		new Setting(containerEl)
			.setName('Manual Sync')
			.setDesc('Sync all repositories now')
			.addButton(button => button
				.setButtonText('Sync Now')
				.setCta()
				.onClick(async () => {
					button.setButtonText('Syncing...');
					button.setDisabled(true);
					
					try {
						const results = await this.plugin.syncAllRepositories();
						const successCount = Object.values(results).filter(r => r.success).length;
						const totalCount = Object.keys(results).length;
						
						if (successCount === totalCount) {
							new Notice(`Successfully synced all ${totalCount} repositories`);
						} else {
							new Notice(`Synced ${successCount}/${totalCount} repositories. Check console for errors.`);
						}
					} catch (error) {
						new Notice(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
					} finally {
						button.setButtonText('Sync Now');
						button.setDisabled(false);
					}
				}));

		// 同步说明
		const syncHelpDiv = containerEl.createDiv();
		syncHelpDiv.style.marginTop = '20px';
		syncHelpDiv.createEl('h4', {text: 'Sync Information'});
		syncHelpDiv.createEl('p', {text: 'Auto sync will periodically fetch issues from all enabled repositories.'});
		syncHelpDiv.createEl('p', {text: 'Disabled repositories will not be synced and won\'t appear in the repository selector.'});
		syncHelpDiv.createEl('p', {text: 'You can also manually sync issues using plugin commands or the button above.'});
		syncHelpDiv.createEl('p', {text: 'Data is cached locally for offline access and fast searching.'});
	}

	private parseGitHubUrl(url: string): {name: string, owner: string, repo: string} | null {
		if (!url) return null;
		
		// 支持多种 GitHub URL 格式
		const patterns = [
			// https://github.com/owner/repo
			/^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)/,
			// github.com/owner/repo
			/^github\.com\/([^/]+)\/([^/?#]+)/,
			// owner/repo
			/^([^/]+)\/([^/?#]+)$/
		];
		
		for (const pattern of patterns) {
			const match = url.match(pattern);
			if (match) {
				const owner = match[1];
				const repo = match[2];
				
				// 移除常见的后缀
				const cleanRepo = repo.replace(/\.(git|zip)$/, '');
				
				// 生成显示名称（保持原始大小写，仅替换连字符为空格）
				const displayName = cleanRepo
					.split(/[-_]/)
					.join(' ');
				
				return {
					name: displayName,
					owner: owner,
					repo: cleanRepo
				};
			}
		}
		
		return null;
	}

	private async testGitHubToken(containerEl: HTMLElement): Promise<void> {
		const token = this.plugin.settings.githubToken.trim();
		
		if (!token) {
			this.tokenStatus = 'invalid';
			this.tokenTestResult = 'Please enter a token first';
			this.updateTokenStatus(containerEl);
			return;
		}

		// 基本格式验证
		if (!token.startsWith('ghp_') || token.length !== 40) {
			this.tokenStatus = 'invalid';
			this.tokenTestResult = '✗ Invalid token format (should start with "ghp_" and be 40 characters long)';
			this.updateTokenStatus(containerEl);
			return;
		}

		this.tokenStatus = 'testing';
		this.tokenTestResult = 'Testing token...';
		this.updateTokenStatus(containerEl);

		try {
			// 使用我们的同步工具来验证 token
			const sync = new GitHubDataSync(token);
			const result = await sync.validateToken();

			if (result.success) {
				this.tokenStatus = 'valid';
				this.tokenTestResult = `✓ Token is valid! (Rate limit remaining: ${result.rateLimitRemaining || 'Unknown'})`;
			} else {
				this.tokenStatus = 'invalid';
				this.tokenTestResult = `✗ ${result.error}`;
			}
		} catch (error) {
			this.tokenStatus = 'invalid';
			this.tokenTestResult = `✗ Network error: ${error instanceof Error ? error.message : 'Unknown error'}`;
		}

		this.updateTokenStatus(containerEl);
	}

	private updateTokenStatus(containerEl: HTMLElement): void {
		const testContainer = containerEl.querySelector('div[style*="display: flex"]') as HTMLElement;
		if (!testContainer) return;

		const testButton = testContainer.querySelector('button') as HTMLButtonElement;
		const statusIndicator = testContainer.children[1] as HTMLElement;
		const statusText = testContainer.children[2] as HTMLElement;

		if (!statusIndicator || !statusText || !testButton) return;

		// 更新按钮状态
		if (this.tokenStatus === 'testing') {
			testButton.disabled = true;
			testButton.textContent = 'Testing...';
		} else {
			testButton.disabled = false;
			testButton.textContent = 'Test Token';
		}

		// 更新状态指示灯和文本
		switch (this.tokenStatus) {
			case 'untested':
				statusIndicator.style.backgroundColor = 'var(--text-muted)';
				statusIndicator.style.boxShadow = 'none';
				statusText.textContent = 'Click "Test Token" to verify';
				statusText.style.color = 'var(--text-muted)';
				break;
			case 'testing':
				statusIndicator.style.backgroundColor = 'var(--text-accent)';
				statusIndicator.style.boxShadow = '0 0 8px var(--text-accent)';
				statusIndicator.style.animation = 'pulse 1.5s infinite';
				statusText.textContent = 'Testing token...';
				statusText.style.color = 'var(--text-accent)';
				break;
			case 'valid':
				statusIndicator.style.backgroundColor = '#10b981'; // 使用固定的绿色
				statusIndicator.style.boxShadow = '0 0 8px #10b981';
				statusIndicator.style.animation = 'none';
				statusText.textContent = this.tokenTestResult;
				statusText.style.color = '#10b981';
				break;
			case 'invalid':
				statusIndicator.style.backgroundColor = '#ef4444'; // 使用固定的红色
				statusIndicator.style.boxShadow = 'none';
				statusIndicator.style.animation = 'none';
				statusText.textContent = this.tokenTestResult;
				statusText.style.color = '#ef4444';
				break;
		}
	}
}
