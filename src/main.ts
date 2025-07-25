import { Plugin, Menu, Platform, Notice } from 'obsidian';
import { GithubProjectsSettingTab, GithubProjectsSettings, DEFAULT_SETTINGS } from './views/settingTab';
import { IssueView, ISSUE_VIEW_TYPE } from './views/issueView';
import { IssueWorkbenchView, WORKBENCH_VIEW_TYPE } from './views/workbenchView';
import { GitHubDataSync, GitHubSyncResult, GitHubProjectCache } from './github/dataSync';
import { IdeCommandTool } from './utils/ideCommandTool';

export default class GithubProjectsPlugin extends Plugin {
	settings: GithubProjectsSettings;
	private syncTimer?: number;

	async onload() {
		await this.loadSettings();

		// 注册 Issue 视图
		this.registerView(
			ISSUE_VIEW_TYPE,
			(leaf) => new IssueView(leaf, this)
		);

		// 注册 Workbench 视图
		this.registerView(
			WORKBENCH_VIEW_TYPE,
			(leaf) => new IssueWorkbenchView(leaf, this)
		);

		// 添加打开 Issue 视图的命令
		this.addCommand({
			id: 'open-github-issues',
			name: 'Open GitHub Issues',
			callback: () => {
				this.activateView();
			}
		});

		// 添加打开 Workbench 视图的命令
		this.addCommand({
			id: 'open-github-workbench',
			name: 'Open GitHub Workbench',
			callback: () => {
				this.activateWorkbenchView();
			}
		});

		// 添加同步命令
		this.addCommand({
			id: 'sync-github-issues',
			name: 'Sync GitHub Issues',
			callback: () => {
				this.syncAllRepositories();
			}
		});

		// 添加同步所有数据命令
		this.addCommand({
			id: 'sync-all-data',
			name: 'Sync All GitHub Data',
			callback: () => {
				this.syncAllData();
			}
		});

		// 添加同步项目命令
		this.addCommand({
			id: 'sync-github-projects',
			name: 'Sync GitHub Projects',
			callback: () => {
				this.syncAllProjects();
			}
		});

		// 添加功能区图标
		this.addRibbonIcon('github', 'GitHub Issues', (evt: MouseEvent) => {
			// 创建菜单
			const menu = new Menu();

			menu.addItem((item) => {
				item.setTitle('Open Issues Panel')
					.setIcon('list')
					.onClick(() => {
						this.activateView();
					});
			});

			menu.addItem((item) => {
				item.setTitle('Open Workbench')
					.setIcon('layout-dashboard')
					.onClick(() => {
						this.activateWorkbenchView();
					});
			});

			// 1. 固定命令区
			// 已有的 Issues/Workbench 两项

			// 2. 分割线（仅当有 IDE 动态项时）
			let hasIde = false;
			if (!Platform.isMobile) {
				const activeRepositories = this.getActiveRepositories();
				if (activeRepositories.some(r => r.ideCommand)) {
					menu.addSeparator();
					hasIde = true;
				}
				// 3. 动态 IDE 命令项
				activeRepositories.forEach(repo => {
					if (repo.ideCommand) {
						menu.addItem((item) => {
							item.setTitle(`Open in IDE: ${repo.name}`)
								.setIcon('monitor')
								.onClick(async () => {
									if (repo.ideCommand) {
										await this.executeIdeCommand(repo.ideCommand);
									}
								});
						});
					}
				});
			}

			// 4. 再加一条分割线，区分下方的同步命令
			menu.addSeparator();

			menu.addItem((item) => {
				item.setTitle('Sync All Repositories')
					.setIcon('refresh-cw')
					.onClick(() => {
						this.syncAllRepositories();
					});
			});

			menu.showAtMouseEvent(evt);
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new GithubProjectsSettingTab(this.app, this));

		// 启动自动同步（如果启用）
		this.startAutoSync();
	}

	onunload() {
		// 不再主动 detach leaves，遵循 Obsidian 官方插件规范
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(ISSUE_VIEW_TYPE)[0];

		if (!leaf) {
			// 如果视图不存在，在右侧面板创建新的视图
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				leaf = rightLeaf;
				await leaf.setViewState({ type: ISSUE_VIEW_TYPE, active: true });
			} else {
				// 如果无法获取右侧面板，创建新的分割面板
				leaf = workspace.getLeaf('split');
				await leaf.setViewState({ type: ISSUE_VIEW_TYPE, active: true });
			}
		}

		// 激活视图
		workspace.revealLeaf(leaf);
	}

	async activateWorkbenchView() {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE)[0];

		if (!leaf) {
			// Workbench 视图适合作为主要工作区，创建在中心面板
			leaf = workspace.getLeaf('tab');
			await leaf.setViewState({ type: WORKBENCH_VIEW_TYPE, active: true });
		}

		// 激活视图
		workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * 验证 GitHub Token 并获取用户信息
	 */
	async validateAndUpdateUserInfo(): Promise<boolean> {
		if (!this.settings.githubToken) {
			return false;
		}

		const sync = new GitHubDataSync(this.settings.githubToken);
		const result = await sync.validateToken();

		if (result.success && result.user) {
			this.settings.currentUser = result.user;
			await this.saveSettings();
			return true;
		}

		return false;
	}

	/**
	 * 获取当前用户信息
	 */
	getCurrentUser() {
		return this.settings.currentUser;
	}

	/**
	 * 同步所有配置的仓库（包括Issues和Projects）
	 */
	async syncAllRepositories(): Promise<Record<string, GitHubSyncResult>> {
		if (!this.settings.githubToken) {
			console.error('GitHub token not configured');
			return {};
		}

		// 过滤出未禁用的仓库
		const activeRepositories = this.settings.repositories.filter(repo => !repo.isDisabled);
		
		if (activeRepositories.length === 0) {
			console.warn('No active repositories configured');
			return {};
		}

		const sync = new GitHubDataSync(this.settings.githubToken);
		
		try {
			// 同步仓库的Issues
			const { cache, results } = await sync.syncAllRepositories(
				activeRepositories,
				this.settings.issueCache
			);

			// 更新Issues缓存数据
			this.settings.issueCache = cache;

			// 同步仓库关联的Projects
			const { cache: projectCache } = await sync.syncAllRepositoriesProjects(
				activeRepositories,
				this.settings.issueCache
			);

			// 更新Projects缓存数据
			this.settings.issueCache = projectCache;
			await this.saveSettings();

			// 通知视图刷新数据
			this.refreshIssueViews();
			this.refreshWorkbenchViews();

			console.log('Repository sync completed:', results);
			return results;
		} catch (error) {
			console.error('Failed to sync repositories:', error);
			return {};
		}
	}

	/**
	 * 同步单个仓库
	 */
	async syncRepository(repoKey: string): Promise<GitHubSyncResult | null> {
		if (!this.settings.githubToken) {
			console.error('GitHub token not configured');
			return null;
		}

		const repo = this.settings.repositories.find(r => `${r.owner}/${r.repo}` === repoKey);
		if (!repo) {
			console.error(`Repository ${repoKey} not found in configuration`);
			return null;
		}

		const sync = new GitHubDataSync(this.settings.githubToken);
		
		try {
			const { cache, result } = await sync.syncRepository(
				repo,
				this.settings.issueCache[repoKey]
			);

			if (cache) {
				this.settings.issueCache[repoKey] = cache;
				await this.saveSettings();
				this.refreshIssueViews();
			}

			return result;
		} catch (error) {
			console.error(`Failed to sync repository ${repoKey}:`, error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * 同步所有配置的项目
	 */
	async syncAllProjects(): Promise<Record<string, { success: boolean; error?: string }>> {
		if (!this.settings.githubToken) {
			console.error('GitHub token not configured');
			return {};
		}

		// 获取所有配置的项目
		const activeProjects = this.settings.projects.filter(project => !project.isDisabled);
		
		if (activeProjects.length === 0) {
			console.warn('No active projects configured');
			return {};
		}

		const sync = new GitHubDataSync(this.settings.githubToken);
		
		try {
			const projectConfigs = activeProjects.map(project => ({
				owner: project.owner,
				projectNumber: project.projectNumber,
				type: project.type || 'org' as 'org' | 'user'
			}));

			const { cache, results } = await sync.syncConfiguredProjects(
				projectConfigs,
				this.settings.projectCache
			);

			// 更新缓存数据
			this.settings.projectCache = cache;
			await this.saveSettings();

			// 通知 Workbench 视图刷新数据
			this.refreshWorkbenchViews();

			console.log('Project sync completed:', results);
			return results;
		} catch (error) {
			console.error('Failed to sync projects:', error);
			return {};
		}
	}

	/**
	 * 同步所有数据（Issues 和 Projects）
	 */
	async syncAllData(): Promise<{
		repositories: Record<string, GitHubSyncResult>;
		projects: Record<string, { success: boolean; error?: string }>;
	}> {
		const [repoResults, projectResults] = await Promise.all([
			this.syncAllRepositories(),
			this.syncAllProjects()
		]);

		return {
			repositories: repoResults,
			projects: projectResults
		};
	}

	/**
	 * 获取所有活跃（未禁用）的仓库
	 */
	getActiveRepositories() {
		return this.settings.repositories.filter(repo => !repo.isDisabled);
	}

	/**
	 * 获取所有活跃（未禁用）的项目
	 */
	getActiveProjects() {
		return this.settings.projects.filter(project => !project.isDisabled);
	}

	/**
	 * 获取项目缓存数据
	 */
	getProjectCache(projectKey?: string) {
		if (projectKey) {
			return this.settings.projectCache[projectKey];
		}
		return this.settings.projectCache;
	}

	/**
	 * 获取仓库缓存数据
	 */
	getRepositoryCache(repoKey: string) {
		return this.settings.issueCache[repoKey];
	}

	/**
	 * 刷新所有 Issue 视图
	 */
	private refreshIssueViews() {
		// 刷新传统的 Issue 视图
		const issueLeaves = this.app.workspace.getLeavesOfType(ISSUE_VIEW_TYPE);
		issueLeaves.forEach(leaf => {
			const view = leaf.view as IssueView;
			if (view && view.refreshData) {
				view.refreshData();
			}
		});
	}

	/**
	 * 刷新 Workbench 视图数据
	 */
	private refreshWorkbenchViews() {
		const workbenchLeaves = this.app.workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE);
		workbenchLeaves.forEach(leaf => {
			const view = leaf.view as IssueWorkbenchView;
			if (view && view.refreshData) {
				view.refreshData();
			}
		});
	}

	/**
	 * 启动自动同步
	 */
	private startAutoSync() {
		if (!this.settings.autoSync || this.settings.syncInterval <= 0) {
			return;
		}

		// 清理现有的定时器
		this.stopAutoSync();

		// 设置新的定时器
		const intervalMs = this.settings.syncInterval * 60 * 1000; // 转换为毫秒
		this.syncTimer = window.setInterval(() => {
			this.syncAllRepositories();
		}, intervalMs);

		console.log(`Auto sync started with interval: ${this.settings.syncInterval} minutes`);
	}

	/**
	 * 停止自动同步
	 */
	private stopAutoSync() {
		if (this.syncTimer) {
			window.clearInterval(this.syncTimer);
			this.syncTimer = undefined;
		}
	}

	/**
	 * 重新启动自动同步（当设置变更时调用）
	 */
	restartAutoSync() {
		this.stopAutoSync();
		this.startAutoSync();
	}

	/**
	 * 测试 IDE 命令是否可以执行
	 */
	async testIdeCommand(command: string): Promise<boolean> {
		return IdeCommandTool.testCommand(command);
	}

	/**
	 * 执行 IDE 命令打开仓库
	 */
	async executeIdeCommand(command: string): Promise<boolean> {
		return IdeCommandTool.executeCommand(command);
	}
}
