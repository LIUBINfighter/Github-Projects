import { ItemView, WorkspaceLeaf, Notice, setIcon } from 'obsidian';
import type GithubProjectsPlugin from '../main';
import { GitHubIssue } from './issueView';

export const WORKBENCH_VIEW_TYPE = 'github-workbench-view';

interface WorkbenchStats {
	totalIssues: number;
	openIssues: number;
	closedIssues: number;
	assignedToMe: number;
	recentlyUpdated: number;
}

interface RepositoryOverview {
	name: string;
	key: string;
	stats: WorkbenchStats;
	lastSync?: string;
	issues: GitHubIssue[];
}

export class IssueWorkbenchView extends ItemView {
	plugin: GithubProjectsPlugin;
	private repositories: RepositoryOverview[] = [];
	private isLoading = false;
	private currentUser = '';

	constructor(leaf: WorkspaceLeaf, plugin: GithubProjectsPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return WORKBENCH_VIEW_TYPE;
	}

	getDisplayText() {
		return 'GitHub Workbench';
	}

	getIcon() {
		return 'layout-dashboard';
	}

	async onOpen() {
		this.renderView();
		await this.loadWorkbenchData();
	}

	async onClose() {
		// 清理工作
	}

	/**
	 * 刷新数据（由主插件调用）
	 */
	refreshData() {
		this.loadWorkbenchData();
	}

	private renderView() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('github-workbench-view');

		// 创建头部
		this.createHeader(container);

		// 创建主要内容区域
		this.createMainContent(container);
	}

	private createHeader(container: Element) {
		const header = container.createDiv('workbench-header');

		// 标题和描述
		const titleSection = header.createDiv('title-section');
		titleSection.createEl('h2', { text: 'GitHub Workbench', cls: 'header-title' });
		titleSection.createEl('p', { 
			text: 'Overview of all your GitHub repositories and issues',
			cls: 'header-description'
		});

		// 操作按钮
		const actions = header.createDiv('header-actions');

		// 刷新按钮
		const refreshBtn = actions.createEl('button', {
			cls: 'mod-cta',
			text: 'Sync All'
		});
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.addEventListener('click', () => this.syncAllRepositories());

		// 设置按钮
		const settingsBtn = actions.createEl('button', {
			cls: 'clickable-icon-button',
			attr: { 'aria-label': 'Open settings' }
		});
		setIcon(settingsBtn, 'settings');
		settingsBtn.addEventListener('click', () => {
			// @ts-ignore
			this.app.setting.open();
			// @ts-ignore
			this.app.setting.openTabById(this.plugin.manifest.id);
		});
	}

	private createMainContent(container: Element) {
		const mainContent = container.createDiv('workbench-main');

		if (this.isLoading) {
			this.showLoadingState(mainContent);
			return;
		}

		if (this.repositories.length === 0) {
			this.showEmptyState(mainContent);
			return;
		}

		// 创建统计概览
		this.createStatsOverview(mainContent);

		// 创建仓库卡片网格
		this.createRepositoryGrid(mainContent);
	}

	private showLoadingState(container: Element) {
		const loadingDiv = container.createDiv('loading-state');
		loadingDiv.createEl('div', { cls: 'loading-spinner' });
		loadingDiv.createEl('p', { text: 'Loading workbench data...' });
	}

	private showEmptyState(container: Element) {
		const emptyDiv = container.createDiv('empty-state');
		const iconDiv = emptyDiv.createDiv('empty-icon');
		setIcon(iconDiv, 'folder-git-2');
		
		emptyDiv.createEl('h3', { text: 'No repositories configured' });
		emptyDiv.createEl('p', { text: 'Add some repositories in the settings to get started.' });
		
		const settingsBtn = emptyDiv.createEl('button', {
			cls: 'mod-cta',
			text: 'Open Settings'
		});
		settingsBtn.addEventListener('click', () => {
			// @ts-ignore
			this.app.setting.open();
			// @ts-ignore
			this.app.setting.openTabById(this.plugin.manifest.id);
		});
	}

	private createStatsOverview(container: Element) {
		const statsSection = container.createDiv('stats-overview');
		statsSection.createEl('h3', { text: 'Overview', cls: 'section-title' });

		const statsGrid = statsSection.createDiv('stats-grid');

		// 计算总体统计
		const totalStats = this.repositories.reduce((acc, repo) => {
			acc.totalIssues += repo.stats.totalIssues;
			acc.openIssues += repo.stats.openIssues;
			acc.closedIssues += repo.stats.closedIssues;
			acc.assignedToMe += repo.stats.assignedToMe;
			acc.recentlyUpdated += repo.stats.recentlyUpdated;
			return acc;
		}, {
			totalIssues: 0,
			openIssues: 0,
			closedIssues: 0,
			assignedToMe: 0,
			recentlyUpdated: 0
		});

		// 创建统计卡片
		this.createStatCard(statsGrid, 'Total Issues', totalStats.totalIssues, 'list');
		this.createStatCard(statsGrid, 'Open Issues', totalStats.openIssues, 'circle-dot', 'open');
		this.createStatCard(statsGrid, 'Closed Issues', totalStats.closedIssues, 'check-circle', 'closed');
		this.createStatCard(statsGrid, 'Assigned to Me', totalStats.assignedToMe, 'user');
		this.createStatCard(statsGrid, 'Recently Updated', totalStats.recentlyUpdated, 'clock');
	}

	private createStatCard(container: Element, title: string, value: number, icon: string, type?: string) {
		const card = container.createDiv(`stat-card ${type ? `stat-${type}` : ''}`);
		
		const cardIcon = card.createDiv('stat-icon');
		setIcon(cardIcon, icon);
		
		const cardContent = card.createDiv('stat-content');
		cardContent.createEl('div', { text: value.toString(), cls: 'stat-value' });
		cardContent.createEl('div', { text: title, cls: 'stat-title' });
	}

	private createRepositoryGrid(container: Element) {
		const repoSection = container.createDiv('repository-section');
		repoSection.createEl('h3', { text: 'Repositories', cls: 'section-title' });

		const repoGrid = repoSection.createDiv('repository-grid');

		this.repositories.forEach(repo => {
			this.createRepositoryCard(repoGrid, repo);
		});
	}

	private createRepositoryCard(container: Element, repo: RepositoryOverview) {
		const card = container.createDiv('repository-card');

		// 卡片头部
		const cardHeader = card.createDiv('card-header');
		const titleDiv = cardHeader.createDiv('card-title');
		
		const iconDiv = titleDiv.createDiv('repo-icon');
		setIcon(iconDiv, 'folder-git-2');
		
		titleDiv.createEl('h4', { text: repo.name });

		// 同步状态
		const syncStatus = cardHeader.createDiv('sync-status');
		if (repo.lastSync) {
			const lastSyncDate = new Date(repo.lastSync);
			const timeAgo = this.getTimeAgo(lastSyncDate);
			syncStatus.createEl('span', { 
				text: `Synced ${timeAgo}`,
				cls: 'sync-time'
			});
		} else {
			syncStatus.createEl('span', { 
				text: 'Never synced',
				cls: 'sync-time sync-never'
			});
		}

		// 统计信息
		const statsDiv = card.createDiv('card-stats');
		this.createMiniStat(statsDiv, repo.stats.openIssues, 'Open', 'open');
		this.createMiniStat(statsDiv, repo.stats.closedIssues, 'Closed', 'closed');
		this.createMiniStat(statsDiv, repo.stats.assignedToMe, 'Assigned');

		// 最近的 Issues（如果有的话）
		if (repo.issues.length > 0) {
			const recentIssues = card.createDiv('recent-issues');
			recentIssues.createEl('h5', { text: 'Recent Issues' });

			const issuesList = recentIssues.createDiv('issues-list');
			repo.issues.slice(0, 3).forEach(issue => {
				const issueItem = issuesList.createDiv('issue-item');
				
				const stateIcon = issueItem.createDiv(`issue-state issue-${issue.state}`);
				setIcon(stateIcon, issue.state === 'open' ? 'circle-dot' : 'check-circle');
				
				const issueTitle = issueItem.createDiv('issue-title');
				issueTitle.createEl('span', { text: `#${issue.number}` });
				issueTitle.createEl('span', { text: issue.title });
			});

			if (repo.issues.length > 3) {
				const moreLink = recentIssues.createDiv('more-issues');
				moreLink.createEl('a', { 
					text: `+${repo.issues.length - 3} more issues`,
					href: '#'
				});
				moreLink.addEventListener('click', (e) => {
					e.preventDefault();
					this.openIssueView(repo.key);
				});
			}
		}

		// 卡片操作
		const cardActions = card.createDiv('card-actions');
		
		const viewBtn = cardActions.createEl('button', {
			cls: 'mod-cta',
			text: 'View Issues'
		});
		viewBtn.addEventListener('click', () => this.openIssueView(repo.key));

		const syncBtn = cardActions.createEl('button', {
			text: 'Sync'
		});
		setIcon(syncBtn, 'refresh-cw');
		syncBtn.addEventListener('click', () => this.syncRepository(repo.key));
	}

	private createMiniStat(container: Element, value: number, label: string, type?: string) {
		const stat = container.createDiv(`mini-stat ${type ? `stat-${type}` : ''}`);
		stat.createEl('span', { text: value.toString(), cls: 'mini-stat-value' });
		stat.createEl('span', { text: label, cls: 'mini-stat-label' });
	}

	private async loadWorkbenchData() {
		this.isLoading = true;
		this.renderView();

		try {
			const activeRepos = this.plugin.getActiveRepositories();
			this.repositories = [];

			for (const repo of activeRepos) {
				const repoKey = `${repo.owner}/${repo.repo}`;
				const cache = this.plugin.getRepositoryCache(repoKey);
				
				if (cache) {
					const stats = this.calculateStats(cache.issues || []);
					this.repositories.push({
						name: repo.name,
						key: repoKey,
						stats,
						lastSync: cache.last_sync,
						issues: (cache.issues || []).slice(0, 5) // 只保留前5个用于显示
					});
				} else {
					// 没有缓存数据，创建空的统计
					this.repositories.push({
						name: repo.name,
						key: repoKey,
						stats: {
							totalIssues: 0,
							openIssues: 0,
							closedIssues: 0,
							assignedToMe: 0,
							recentlyUpdated: 0
						},
						issues: []
					});
				}
			}
		} catch (error) {
			console.error('Failed to load workbench data:', error);
			new Notice('Failed to load workbench data');
		} finally {
			this.isLoading = false;
			this.renderView();
		}
	}

	private calculateStats(issues: GitHubIssue[]): WorkbenchStats {
		const now = new Date();
		const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

		return {
			totalIssues: issues.length,
			openIssues: issues.filter(issue => issue.state === 'open').length,
			closedIssues: issues.filter(issue => issue.state === 'closed').length,
			assignedToMe: issues.filter(issue => 
				issue.assignee?.login === this.currentUser
			).length,
			recentlyUpdated: issues.filter(issue => 
				new Date(issue.updated_at) > oneDayAgo
			).length
		};
	}

	private async syncAllRepositories() {
		this.isLoading = true;
		this.renderView();

		try {
			await this.plugin.syncAllRepositories();
			await this.loadWorkbenchData();
			new Notice('All repositories synced successfully');
		} catch (error) {
			console.error('Failed to sync repositories:', error);
			new Notice('Failed to sync repositories');
		}
	}

	private async syncRepository(repoKey: string) {
		try {
			await this.plugin.syncRepository(repoKey);
			await this.loadWorkbenchData();
			new Notice(`Repository ${repoKey} synced successfully`);
		} catch (error) {
			console.error(`Failed to sync repository ${repoKey}:`, error);
			new Notice(`Failed to sync repository ${repoKey}`);
		}
	}

	private async openIssueView(repoKey?: string) {
		await this.plugin.activateView();
		// 如果需要，可以传递仓库信息给 Issue 视图
	}

	private getTimeAgo(date: Date): string {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffSecs = Math.floor(diffMs / 1000);
		const diffMins = Math.floor(diffSecs / 60);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffDays > 0) {
			return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
		} else if (diffHours > 0) {
			return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
		} else if (diffMins > 0) {
			return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
		} else {
			return 'Just now';
		}
	}
}
