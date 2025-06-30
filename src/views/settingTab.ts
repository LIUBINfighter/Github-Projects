import { App, PluginSettingTab, Setting, Notice, Platform } from 'obsidian';
import type GithubProjectsPlugin from '../main';
import { GitHubIssueCache, GitHubDataSync } from '../github/dataSync';
import { IdeCommandTool } from '../utils/ideCommandTool';

export interface GithubRepository {
	name: string; // 显示名称
	owner: string; // GitHub用户名或组织名
	repo: string; // 仓库名
	isDefault: boolean; // 是否为默认仓库
	isDisabled?: boolean; // 是否禁用（不显示在下拉栏，不同步）
	ideCommand?: string; // IDE 打开命令（完整的命令行）
}

export interface GithubProject {
	name: string; // 显示名称
	owner: string; // GitHub用户名或组织名
	projectNumber: number; // Project 编号
	isDefault: boolean; // 是否为默认项目
	isDisabled?: boolean; // 是否禁用（不显示在下拉栏，不同步）
	type?: 'user' | 'org'; // 项目类型：用户项目或组织项目
}

export interface GitHubProjectCache {
	[projectKey: string]: {
		last_sync: string;
		project: GitHubProjectDetails; // 项目详情数据
	};
}

interface GitHubProjectDetails {
	id: number;
	number: number;
	title: string;
	body: string | null;
	state: 'open' | 'closed';
	creator: {
		login: string;
		avatar_url: string;
	};
	created_at: string;
	updated_at: string;
	html_url: string;
}

export interface GithubProjectsSettings {
	githubToken: string;
	currentUser?: {
		login: string;
		name?: string;
		avatar_url: string;
	};
	repositories: GithubRepository[]; // 多仓库列表
	projects: GithubProject[]; // 多项目列表
	autoSync: boolean;
	syncInterval: number; // in minutes
	issueCache: GitHubIssueCache; // Issue 缓存数据
	projectCache: GitHubProjectCache; // Project 缓存数据
}

export const DEFAULT_SETTINGS: GithubProjectsSettings = {
	githubToken: '',
	currentUser: undefined,
	repositories: [],
	projects: [],
	autoSync: false,
	syncInterval: 5,
	issueCache: {},
	projectCache: {}
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
			{ id: 'projects', name: 'Projects' },
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
			case 'projects':
				this.displayProjectsSettings(containerEl);
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
					// 清除用户信息，将在下次验证时重新获取
					this.plugin.settings.currentUser = undefined;
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

				// IDE 命令配置区域（仅在桌面端显示）
				if (!Platform.isMobile) {
					const ideSection = repoDiv.createDiv();
					ideSection.style.marginTop = 'var(--size-2-3)';
					ideSection.style.paddingTop = 'var(--size-2-3)';
					ideSection.style.borderTop = '1px solid var(--background-modifier-border)';

					const ideHeader = ideSection.createDiv();
					ideHeader.style.display = 'flex';
					ideHeader.style.alignItems = 'center';
					ideHeader.style.gap = 'var(--size-2-2)';
					ideHeader.style.marginBottom = 'var(--size-2-2)';

					const ideLabel = ideHeader.createSpan();
					ideLabel.innerHTML = '<strong>IDE Command:</strong>';
					ideLabel.style.fontSize = 'var(--font-ui-smaller)';
					ideLabel.style.color = 'var(--text-muted)';
					ideLabel.style.minWidth = 'fit-content';

					const ideInput = ideSection.createEl('input', {
						type: 'text',
						placeholder: 'e.g., code D:\\Projects\\my-repo or webstorm D:\\Projects\\my-repo'
					});
					ideInput.style.width = '100%';
					ideInput.style.marginBottom = 'var(--size-2-2)';
					ideInput.style.padding = 'var(--size-2-2)';
					ideInput.style.borderRadius = 'var(--radius-s)';
					ideInput.style.border = '1px solid var(--background-modifier-border)';
					ideInput.style.fontSize = 'var(--font-ui-smaller)';
					ideInput.style.fontFamily = 'var(--font-monospace)';
					ideInput.value = repository.ideCommand || '';

					// IDE 命令输入框变化处理
					ideInput.addEventListener('change', async () => {
						repository.ideCommand = ideInput.value.trim() || undefined;
						await this.plugin.saveSettings();
					});

					// 测试按钮容器
					const testButtonContainer = ideSection.createDiv();
					testButtonContainer.style.display = 'flex';
					testButtonContainer.style.alignItems = 'center';
					testButtonContainer.style.gap = 'var(--size-2-2)';

					const testButton = testButtonContainer.createEl('button', {
						cls: 'clickable-icon-button'
					});
					testButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
					testButton.title = 'Test IDE command';
					testButton.style.padding = 'var(--size-2-2)';

					const testStatus = testButtonContainer.createSpan();
					testStatus.style.fontSize = 'var(--font-ui-smaller)';
					testStatus.style.color = 'var(--text-muted)';

					// 测试按钮点击事件，直接运行命令
					testButton.addEventListener('click', async () => {
						const command = ideInput.value.trim();
						if (!command) {
							testStatus.textContent = 'Please enter a command first';
							testStatus.style.color = 'var(--text-error)';
							return;
						}

						testStatus.textContent = 'Running...';
						testStatus.style.color = 'var(--text-muted)';
						testButton.disabled = true;

						try {
							const success = await this.plugin.executeIdeCommand(command);
							if (success) {
								testStatus.textContent = 'Command executed successfully';
								testStatus.style.color = 'var(--color-green)';
							} else {
								testStatus.textContent = 'Command failed to execute';
								testStatus.style.color = 'var(--text-error)';
							}
						} catch (error) {
							testStatus.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
							testStatus.style.color = 'var(--text-error)';
						} finally {
							testButton.disabled = false;
							// 3秒后清除状态
							setTimeout(() => {
								testStatus.textContent = '';
							}, 3000);
						}
					});

					// 如果没有命令，禁用测试按钮
					if (!repository.ideCommand) {
						testButton.disabled = true;
					}

					// 监听输入框变化来启用/禁用测试按钮
					ideInput.addEventListener('input', () => {
						testButton.disabled = !ideInput.value.trim();
					});
				}
			});
		}
	}

	private displayProjectsSettings(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Project Management' });

		// 添加新项目区域
		const addProjectContainer = containerEl.createDiv();
		addProjectContainer.style.marginBottom = 'var(--size-4-3)';
		addProjectContainer.style.padding = 'var(--size-4-2)';
		addProjectContainer.style.border = '1px solid var(--background-modifier-border)';
		addProjectContainer.style.borderRadius = 'var(--radius-s)';
		addProjectContainer.style.backgroundColor = 'var(--background-secondary)';

		addProjectContainer.createEl('h4', { text: 'Add New Project' });

		// Project URL 输入
		const projectUrlInput = addProjectContainer.createEl('input', {
			type: 'text',
			placeholder: 'GitHub Project URL (e.g., https://github.com/orgs/myorg/projects/1 or https://github.com/users/username/projects/3)'
		});
		projectUrlInput.style.width = '100%';
		projectUrlInput.style.marginBottom = 'var(--size-2-2)';
		projectUrlInput.style.padding = 'var(--size-2-2)';
		projectUrlInput.style.borderRadius = 'var(--radius-s)';
		projectUrlInput.style.border = '1px solid var(--background-modifier-border)';
		projectUrlInput.style.fontSize = 'var(--font-ui-small)';

		// 添加支持格式说明
		const urlHintDiv = addProjectContainer.createDiv();
		urlHintDiv.style.fontSize = 'var(--font-ui-smaller)';
		urlHintDiv.style.color = 'var(--text-muted)';
		urlHintDiv.style.marginBottom = 'var(--size-2-2)';
		urlHintDiv.innerHTML = '💡 Supports both organization projects (<code>/orgs/name/projects/N</code>) and user projects (<code>/users/name/projects/N</code>)';

		const orDiv = addProjectContainer.createDiv();
		orDiv.textContent = 'OR';
		orDiv.style.textAlign = 'center';
		orDiv.style.margin = 'var(--size-2-2) 0';
		orDiv.style.color = 'var(--text-muted)';
		orDiv.style.fontSize = 'var(--font-ui-smaller)';

		// 手动输入区域
		const manualInputDiv = addProjectContainer.createDiv();
		manualInputDiv.style.marginTop = 'var(--size-2-2)';

		const projectNameInput = manualInputDiv.createEl('input', {
			type: 'text',
			placeholder: 'Project display name (e.g., Q3 Roadmap)'
		});
		projectNameInput.style.width = '100%';
		projectNameInput.style.marginBottom = 'var(--size-2-2)';
		projectNameInput.style.padding = 'var(--size-2-2)';
		projectNameInput.style.borderRadius = 'var(--radius-s)';
		projectNameInput.style.border = '1px solid var(--background-modifier-border)';
		projectNameInput.style.fontSize = 'var(--font-ui-small)';

		const ownerInput = manualInputDiv.createEl('input', {
			type: 'text',
			placeholder: 'Owner/Organization (e.g., myorg)'
		});
		ownerInput.style.width = '48%';
		ownerInput.style.marginRight = '4%';
		ownerInput.style.marginBottom = 'var(--size-2-2)';
		ownerInput.style.padding = 'var(--size-2-2)';
		ownerInput.style.borderRadius = 'var(--radius-s)';
		ownerInput.style.border = '1px solid var(--background-modifier-border)';
		ownerInput.style.fontSize = 'var(--font-ui-small)';

		const projectNumberInput = manualInputDiv.createEl('input', {
			type: 'number',
			placeholder: 'Project number (e.g., 1)'
		});
		projectNumberInput.style.width = '48%';
		projectNumberInput.style.marginBottom = 'var(--size-2-2)';
		projectNumberInput.style.padding = 'var(--size-2-2)';
		projectNumberInput.style.borderRadius = 'var(--radius-s)';
		projectNumberInput.style.border = '1px solid var(--background-modifier-border)';
		projectNumberInput.style.fontSize = 'var(--font-ui-small)';

		// URL 解析逻辑
		projectUrlInput.addEventListener('input', () => {
			const url = projectUrlInput.value.trim();
			const parsed = this.parseGitHubProjectUrl(url);
			if (parsed) {
				projectNameInput.value = parsed.name;
				ownerInput.value = parsed.owner;
				projectNumberInput.value = parsed.projectNumber.toString();
				
				// 成功解析时的视觉反馈
				projectNameInput.style.borderColor = 'var(--color-green)';
				ownerInput.style.borderColor = 'var(--color-green)';
				projectNumberInput.style.borderColor = 'var(--color-green)';
			} else if (url.length > 0) {
				// 重置样式
				projectNameInput.style.borderColor = '';
				ownerInput.style.borderColor = '';
				projectNumberInput.style.borderColor = '';
			}
		});

		// 手动输入时清空 URL
		[projectNameInput, ownerInput, projectNumberInput].forEach(input => {
			input.addEventListener('input', () => {
				if (input.value.trim()) {
					projectUrlInput.value = '';
				}
			});
		});

		// 添加按钮
		const addButton = addProjectContainer.createEl('button', {
			text: 'Add Project',
			cls: 'mod-cta'
		});
		addButton.addEventListener('click', async () => {
			let name = projectNameInput.value.trim();
			let owner = ownerInput.value.trim();
			let projectNumber = parseInt(projectNumberInput.value.trim());
			let type: 'user' | 'org' = 'org'; // 默认为组织项目

			// 如果有 URL，尝试解析
			const urlValue = projectUrlInput.value.trim();
			if (urlValue) {
				const parsed = this.parseGitHubProjectUrl(urlValue);
				if (parsed) {
					name = name || parsed.name;
					owner = owner || parsed.owner;
					projectNumber = projectNumber || parsed.projectNumber;
					type = parsed.type;
				}
			} else if (!name || !owner || !projectNumber) {
				// 如果没有URL且手动输入不完整
				const errorMsg = addProjectContainer.createDiv();
				errorMsg.className = 'error-message';
				errorMsg.textContent = 'Please provide a valid GitHub Project URL or fill in all fields manually.';
				errorMsg.style.color = 'var(--text-error)';
				errorMsg.style.fontSize = '12px';
				errorMsg.style.marginTop = '5px';
				setTimeout(() => errorMsg.remove(), 3000);
				return;
			}
			// 如果是手动输入且没有URL，默认保持为 'org'

			if (!name || !owner || !projectNumber) {
				const errorMsg = addProjectContainer.createDiv();
				errorMsg.className = 'error-message';
				errorMsg.textContent = 'Please provide a valid GitHub Project URL or fill in all fields manually.';
				errorMsg.style.color = 'var(--text-error)';
				errorMsg.style.fontSize = '12px';
				errorMsg.style.marginTop = '5px';
				setTimeout(() => errorMsg.remove(), 3000);
				return;
			}

			const newProject: GithubProject = {
				name,
				owner,
				projectNumber,
				isDefault: this.plugin.settings.projects.length === 0,
				isDisabled: false,
				type
			};

			this.plugin.settings.projects.push(newProject);
			await this.plugin.saveSettings();

			// 清空输入
			projectUrlInput.value = '';
			projectNameInput.value = '';
			ownerInput.value = '';
			projectNumberInput.value = '';

			// 重新渲染
			this.display();
		});

		// 显示已配置的项目
		if (this.plugin.settings.projects.length > 0) {
			containerEl.createEl('h4', { text: 'Configured Projects' });

			this.plugin.settings.projects.forEach((project, index) => {
				this.createProjectConfigCard(containerEl, project, index);
			});
		}
	}

	private createProjectConfigCard(container: HTMLElement, project: GithubProject, index: number) {
		const card = container.createDiv();
		card.style.marginBottom = '12px';
		card.style.padding = '12px';
		card.style.border = '1px solid var(--background-modifier-border)';
		card.style.borderRadius = 'var(--radius-s)';

		if (project.isDisabled) {
			card.style.backgroundColor = 'var(--background-modifier-border)';
			card.style.opacity = '0.6';
		} else if (project.isDefault) {
			card.style.backgroundColor = 'var(--background-modifier-hover)';
		} else {
			card.style.backgroundColor = 'transparent';
		}

		// 卡片头部
		const header = card.createDiv();
		header.style.display = 'flex';
		header.style.justifyContent = 'space-between';
		header.style.alignItems = 'center';
		header.style.marginBottom = '8px';

		const title = header.createEl('h5');
		let titleText = project.name;
		if (project.isDefault) titleText += ' (Default)';
		if (project.isDisabled) titleText += ' (Disabled)';
		title.textContent = titleText;
		title.style.margin = '0';
		title.style.fontSize = 'var(--font-ui-small)';
		title.style.fontWeight = 'var(--font-weight-medium)';
		if (project.isDisabled) {
			title.style.color = 'var(--text-muted)';
		}

		// 操作按钮区域
		const actions = header.createDiv();
		actions.style.display = 'flex';
		actions.style.gap = 'var(--size-2-2)';

		// 设为默认按钮
		if (!project.isDefault) {
			const defaultBtn = actions.createEl('button', {
				text: 'Set Default',
				cls: 'mod-cta'
			});
			defaultBtn.addEventListener('click', async () => {
				this.plugin.settings.projects.forEach(p => p.isDefault = false);
				project.isDefault = true;
				project.isDisabled = false;
				await this.plugin.saveSettings();
				this.display();
			});
		}

		// 启用/禁用按钮
		const toggleBtn = actions.createEl('button', {
			text: project.isDisabled ? 'Enable' : 'Disable',
			cls: project.isDisabled ? 'mod-cta' : 'mod-muted'
		});
		toggleBtn.addEventListener('click', async () => {
			project.isDisabled = !project.isDisabled;
			if (project.isDisabled && project.isDefault) {
				project.isDefault = false;
				const activeProjects = this.plugin.settings.projects.filter(p => !p.isDisabled);
				if (activeProjects.length > 0) {
					activeProjects[0].isDefault = true;
				}
			}
			await this.plugin.saveSettings();
			this.display();
		});

		// 删除按钮
		const deleteBtn = actions.createEl('button', { cls: 'mod-warning' });
		deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
		deleteBtn.title = 'Delete project';
		deleteBtn.addEventListener('click', async () => {
			this.plugin.settings.projects.splice(index, 1);
			if (project.isDefault && this.plugin.settings.projects.length > 0) {
				const activeProjects = this.plugin.settings.projects.filter(p => !p.isDisabled);
				if (activeProjects.length > 0) {
					activeProjects[0].isDefault = true;
				}
			}
			await this.plugin.saveSettings();
			this.display();
		});

		// 项目信息
		const info = card.createDiv();
		info.style.display = 'flex';
		info.style.alignItems = 'center';
		info.style.gap = 'var(--size-2-2)';

		const label = info.createEl('span');
		label.innerHTML = '<strong>Project:</strong>';
		label.style.fontSize = 'var(--font-ui-smaller)';
		label.style.color = 'var(--text-muted)';

		// 根据项目类型生成正确的URL
		const projectType = project.type || 'org'; // 为了兼容性，默认为组织项目
		const projectUrl = `https://github.com/${projectType === 'user' ? 'users' : 'orgs'}/${project.owner}/projects/${project.projectNumber}`;
		const link = info.createEl('a');
		link.textContent = projectUrl;
		link.href = projectUrl;
		link.style.color = 'var(--text-accent)';
		link.style.textDecoration = 'none';
		link.style.fontFamily = 'var(--font-monospace)';
		link.style.fontSize = 'var(--font-ui-smaller)';
		link.title = 'Click to copy URL';
		
		link.addEventListener('click', (e) => {
			e.preventDefault();
			navigator.clipboard.writeText(projectUrl).then(() => {
				new Notice('Project URL copied to clipboard');
			});
		});
	}

	private parseGitHubProjectUrl(url: string): { name: string; owner: string; projectNumber: number; type: 'user' | 'org' } | null {
		if (!url) return null;

		// 匹配各种可能的 GitHub Project URL 格式
		const patterns = [
			// https://github.com/orgs/owner/projects/123
			{ regex: /^https?:\/\/github\.com\/orgs\/([^/]+)\/projects\/(\d+)/, type: 'org' as const },
			// github.com/orgs/owner/projects/123
			{ regex: /^github\.com\/orgs\/([^/]+)\/projects\/(\d+)/, type: 'org' as const },
			// orgs/owner/projects/123
			{ regex: /^orgs\/([^/]+)\/projects\/(\d+)/, type: 'org' as const },
			// 用户项目: https://github.com/users/username/projects/123
			{ regex: /^https?:\/\/github\.com\/users\/([^/]+)\/projects\/(\d+)/, type: 'user' as const },
			{ regex: /^github\.com\/users\/([^/]+)\/projects\/(\d+)/, type: 'user' as const },
			{ regex: /^users\/([^/]+)\/projects\/(\d+)/, type: 'user' as const }
		];

		for (const pattern of patterns) {
			const match = url.match(pattern.regex);
			if (match) {
				const owner = match[1];
				const projectNumber = parseInt(match[2]);
				return {
					name: `${owner} Project ${projectNumber}`,
					owner,
					projectNumber,
					type: pattern.type
				};
			}
		}

		return null;
	}

	private parseGitHubUrl(url: string): { name: string; owner: string; repo: string } | null {
		if (!url) return null;

		// 匹配各种可能的 GitHub 仓库URL格式
		const patterns = [
			// https://github.com/username/repo
			/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/,
			// github.com/username/repo
			/^github\.com\/([^/]+)\/([^/]+)\/?$/,
			// username/repo
			/^([^/]+)\/([^/]+)\/?$/
		];

		for (const pattern of patterns) {
			const match = url.match(pattern);
			if (match) {
				const owner = match[1];
				const repo = match[2];
				return {
					name: `${repo}`,
					owner,
					repo
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
				// 更新用户信息
				if (result.user) {
					this.plugin.settings.currentUser = result.user;
					await this.plugin.saveSettings();
				}
				
				this.tokenStatus = 'valid';
				const userInfo = result.user ? ` (User: ${result.user.login})` : '';
				this.tokenTestResult = `✓ Token is valid!${userInfo} (Rate limit remaining: ${result.rateLimitRemaining || 'Unknown'})`;
			} else {
				// 清除用户信息
				this.plugin.settings.currentUser = undefined;
				await this.plugin.saveSettings();
				
				this.tokenStatus = 'invalid';
				this.tokenTestResult = `✗ ${result.error}`;
			}
		} catch (error) {
			// 清除用户信息
			this.plugin.settings.currentUser = undefined;
			await this.plugin.saveSettings();
			
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

	private displaySyncSettings(containerEl: HTMLElement): void {
		containerEl.createEl('h3', {text: 'Synchronization Options'});

		// 自动同步设置
		new Setting(containerEl)
			.setName('Auto-Sync Enabled')
			.setDesc('Automatically sync GitHub data at regular intervals.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSync)
				.onChange(async (value) => {
					this.plugin.settings.autoSync = value;
					await this.plugin.saveSettings();
					// 刷新显示以更新同步间隔设置的可见性
					this.display();
				}));

		// 仅当自动同步启用时显示同步间隔设置
		if (this.plugin.settings.autoSync) {
			new Setting(containerEl)
				.setName('Sync Interval')
				.setDesc('How often to sync data (in minutes).')
				.addSlider(slider => slider
					.setLimits(1, 60, 1)
					.setValue(this.plugin.settings.syncInterval)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.syncInterval = value;
						await this.plugin.saveSettings();
						// 如果主插件有重启同步的方法，调用它
						// 这里先注释掉，如果需要可以实现该方法
						// this.plugin.restartAutoSync();
					}))
				.addExtraButton(button => button
					.setIcon('reset')
					.setTooltip('Reset to default (5 minutes)')
					.onClick(async () => {
						this.plugin.settings.syncInterval = 5;
						await this.plugin.saveSettings();
						this.display();
						// 重启同步服务（如果主插件有这个方法）
						// this.plugin.restartAutoSync();
					}));
		}

		// 手动同步按钮
		const syncButtonContainer = containerEl.createDiv();
		syncButtonContainer.style.marginTop = '20px';
		
		const syncButton = syncButtonContainer.createEl('button', {
			text: 'Sync Now',
			cls: 'mod-cta'
		});
		
		syncButton.addEventListener('click', async () => {
			syncButton.disabled = true;
			syncButton.textContent = 'Syncing...';
			
			try {
				// 调用数据同步
				// 注意：这里需要确保主插件中有同步数据的方法
				// 如果没有 syncData 方法，你可能需要创建一个，或者修改这里的调用
				// await this.plugin.syncData();
				
				// 临时替代方案：直接创建同步器并执行
				if (this.plugin.settings.githubToken) {
					const sync = new GitHubDataSync(this.plugin.settings.githubToken);
					
					// 同步仓库 issue 数据
					const activeRepos = this.plugin.settings.repositories.filter(repo => !repo.isDisabled);
					if (activeRepos.length > 0) {
						const repoResult = await sync.syncAllRepositories(activeRepos, this.plugin.settings.issueCache);
						this.plugin.settings.issueCache = repoResult.cache;
						
						// 同步仓库项目数据
						const projectResult = await sync.syncAllRepositoriesProjects(activeRepos, this.plugin.settings.issueCache);
						this.plugin.settings.issueCache = projectResult.cache;
					}
					
					// TODO: 需要实现单独的项目同步功能
					
					// 更新设置以保存缓存
					await this.plugin.saveSettings();
				}
				
				syncButton.textContent = 'Sync Completed!';
				// 显示成功图标
				const successIcon = document.createElement('span');
				successIcon.textContent = ' ✓';
				successIcon.style.color = 'var(--color-green)';
				syncButton.appendChild(successIcon);
				
				// 3秒后恢复按钮状态
				setTimeout(() => {
					syncButton.disabled = false;
					syncButton.textContent = 'Sync Now';
				}, 3000);
			} catch (error) {
				syncButton.textContent = 'Sync Failed!';
				// 显示错误图标
				const errorIcon = document.createElement('span');
				errorIcon.textContent = ' ✗';
				errorIcon.style.color = 'var(--color-red)';
				syncButton.appendChild(errorIcon);
				
				// 显示错误信息
				const errorMsg = syncButtonContainer.createDiv();
				errorMsg.textContent = error instanceof Error ? error.message : 'Unknown error';
				errorMsg.style.color = 'var(--color-red)';
				errorMsg.style.marginTop = '5px';
				errorMsg.style.fontSize = '12px';
				
				// 3秒后恢复按钮状态
				setTimeout(() => {
					syncButton.disabled = false;
					syncButton.textContent = 'Sync Now';
					errorMsg.remove();
				}, 5000);
			}
		});

		// 添加上次同步时间信息
		const lastSyncInfo = containerEl.createDiv();
		lastSyncInfo.style.marginTop = '10px';
		lastSyncInfo.style.fontSize = '12px';
		lastSyncInfo.style.color = 'var(--text-muted)';
		
		// 查找最近的同步时间
		let lastSyncTime = 'Never';
		
		// 检查缓存中的最后同步时间
		const allCacheTimes: number[] = [];
		
		// 从仓库缓存中获取最后同步时间
		for (const repoKey in this.plugin.settings.issueCache) {
			const lastSync = this.plugin.settings.issueCache[repoKey]?.last_sync;
			if (lastSync) {
				try {
					const syncDate = new Date(lastSync);
					allCacheTimes.push(syncDate.getTime());
				} catch (e) {
					// 忽略无效日期
				}
			}
		}
		
		// 从项目缓存中获取最后同步时间
		for (const projectKey in this.plugin.settings.projectCache) {
			const lastSync = this.plugin.settings.projectCache[projectKey]?.last_sync;
			if (lastSync) {
				try {
					const syncDate = new Date(lastSync);
					allCacheTimes.push(syncDate.getTime());
				} catch (e) {
					// 忽略无效日期
				}
			}
		}
		
		// 找出最近的同步时间
		if (allCacheTimes.length > 0) {
			const mostRecent = new Date(Math.max(...allCacheTimes));
			lastSyncTime = mostRecent.toLocaleString();
		}
		
		lastSyncInfo.textContent = `Last synchronized: ${lastSyncTime}`;
	}
}
