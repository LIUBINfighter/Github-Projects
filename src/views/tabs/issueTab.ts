import { setIcon, Notice, Platform } from 'obsidian';
import type GithubProjectsPlugin from '../../main';
import { GitHubIssue } from '../issueView';

export interface WorkbenchStats {
	totalIssues: number;
	openIssues: number;
	closedIssues: number;
	assignedToMe: number;
	recentlyUpdated: number;
	createdToday: number;
	resolvedToday: number;
	createdThisWeek: number;
	resolvedThisWeek: number;
}

export interface RepositoryOverview {
	name: string;
	key: string;
	stats: WorkbenchStats;
	lastSync?: string;
	issues: GitHubIssue[];
}

export class IssueTab {
	private plugin: GithubProjectsPlugin;
	private repositories: RepositoryOverview[] = [];
	private isLoading = false;

	constructor(plugin: GithubProjectsPlugin) {
		this.plugin = plugin;
	}

	/**
	 * 渲染 Issues 标签页内容
	 */
	render(container: Element): void {
		if (this.isLoading) {
			this.showLoadingState(container);
			return;
		}

		this.createIssuesContent(container);
	}

	/**
	 * 加载 Issues 数据
	 */
	async loadData(): Promise<void> {
		this.isLoading = true;

		try {
			// 确保用户信息已经加载
			if (!this.plugin.getCurrentUser() && this.plugin.settings.githubToken) {
				await this.plugin.validateAndUpdateUserInfo();
			}

			const activeRepos = this.plugin.getActiveRepositories();
			this.repositories = [];

			for (const repo of activeRepos) {
				const repoKey = `${repo.owner}/${repo.repo}`;
				const cache = this.plugin.getRepositoryCache(repoKey);

				if (cache) {
					// 处理 Issues 数据
					const stats = this.calculateStats(cache.issues || []);
					this.repositories.push({
						name: repo.name,
						key: repoKey,
						stats,
						lastSync: cache.last_sync,
						issues: (cache.issues || []).slice(0, 5)
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
							recentlyUpdated: 0,
							createdToday: 0,
							resolvedToday: 0,
							createdThisWeek: 0,
							resolvedThisWeek: 0
						},
						issues: []
					});
				}
			}
		} catch (error) {
			console.error('Failed to load issues data:', error);
			new Notice('Failed to load issues data');
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * 获取仓库数据
	 */
	getRepositories(): RepositoryOverview[] {
		return this.repositories;
	}

	/**
	 * 检查是否正在加载
	 */
	getIsLoading(): boolean {
		return this.isLoading;
	}

	private createIssuesContent(container: Element) {
		if (this.repositories.length === 0) {
			this.showEmptyState(container);
			return;
		}

		// 创建统计概览
		this.createStatsOverview(container);

		// 创建仓库卡片网格
		this.createRepositoryGrid(container);
	}

	private showLoadingState(container: Element) {
		const loadingDiv = container.createDiv('loading-state');
		loadingDiv.createEl('div', { cls: 'loading-spinner' });
		loadingDiv.createEl('p', { text: 'Loading issues data...' });
	}

	private showEmptyState(container: Element) {
		// 创建一个包装容器，用于更好的布局控制
		const emptyWrapper = container.createDiv('issues-empty-wrapper');
		
		const emptyDiv = emptyWrapper.createDiv('empty-state');
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
			this.plugin.app.setting.open();
			// @ts-ignore
			this.plugin.app.setting.openTabById(this.plugin.manifest.id);
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
			acc.createdToday += repo.stats.createdToday;
			acc.resolvedToday += repo.stats.resolvedToday;
			acc.createdThisWeek += repo.stats.createdThisWeek;
			acc.resolvedThisWeek += repo.stats.resolvedThisWeek;
			return acc;
		}, {
			totalIssues: 0,
			openIssues: 0,
			closedIssues: 0,
			assignedToMe: 0,
			recentlyUpdated: 0,
			createdToday: 0,
			resolvedToday: 0,
			createdThisWeek: 0,
			resolvedThisWeek: 0
		});

		// 创建统计卡片
		this.createStatCard(statsGrid, 'Total Issues', totalStats.totalIssues, 'list');
		this.createStatCard(statsGrid, 'Open Issues', totalStats.openIssues, 'circle-dot', 'open');
		this.createStatCard(statsGrid, 'Closed Issues', totalStats.closedIssues, 'check-circle', 'closed');
		this.createStatCard(statsGrid, 'Assigned to Me', totalStats.assignedToMe, 'user');
		this.createStatCard(statsGrid, 'Recently Updated', totalStats.recentlyUpdated, 'clock');

		// 创建细化的活动统计
		const activitySection = container.createDiv('stats-overview');
		activitySection.createEl('h3', { text: 'Recent Activity', cls: 'section-title' });
		const activityGrid = activitySection.createDiv('stats-grid');
		this.createStatCard(activityGrid, 'Created Today', totalStats.createdToday, 'calendar-plus', 'created');
		this.createStatCard(activityGrid, 'Resolved Today', totalStats.resolvedToday, 'calendar-check', 'resolved');
		this.createStatCard(activityGrid, 'Created This Week', totalStats.createdThisWeek, 'calendar-plus', 'created');
		this.createStatCard(activityGrid, 'Resolved This Week', totalStats.resolvedThisWeek, 'calendar-check', 'resolved');
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

		// 添加 IDE 按钮（仅在桌面端显示）
		if (!Platform.isMobile) {
			// 查找这个仓库的配置
			const repoConfig = this.plugin.settings.repositories.find(r => 
				`${r.owner}/${r.repo}` === repo.key
			);

			// 只有配置了 IDE 命令的仓库才显示 IDE 按钮
				if (repoConfig?.ideCommand) {
					const ideBtn = cardActions.createEl('button', {
						text: 'Open in IDE'
					});
					// 统一使用“play”图标
					ideBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
					ideBtn.addEventListener('click', () => {
						if (repoConfig.ideCommand) {
							this.plugin.executeIdeCommand(repoConfig.ideCommand);
						} else {
							new Notice('IDE command is not configured.');
						}
					});
				}
		}
	}

	private createMiniStat(container: Element, value: number, label: string, type?: string) {
		const stat = container.createDiv(`mini-stat ${type ? `stat-${type}` : ''}`);
		stat.createEl('span', { text: value.toString(), cls: 'mini-stat-value' });
		stat.createEl('span', { text: label, cls: 'mini-stat-label' });
	}

	private calculateStats(issues: GitHubIssue[]): WorkbenchStats {
		const now = new Date();
		const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		const currentUser = this.plugin.getCurrentUser();

		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		const weekStart = new Date();
		const dayOfWeek = weekStart.getDay(); // Sunday - 0, Monday - 1, ...
		const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // adjust when day is sunday
		weekStart.setDate(diff);
		weekStart.setHours(0, 0, 0, 0);

		let createdToday = 0;
		let resolvedToday = 0;
		let createdThisWeek = 0;
		let resolvedThisWeek = 0;

		for (const issue of issues) {
			const createdAt = new Date(issue.created_at);
			const updatedAt = new Date(issue.updated_at);

			// Created stats
			if (createdAt >= todayStart) {
				createdToday++;
			}
			if (createdAt >= weekStart) {
				createdThisWeek++;
			}

			// Resolved stats (state is closed and updated within the period)
			if (issue.state === 'closed') {
				if (updatedAt >= todayStart) {
					resolvedToday++;
				}
				if (updatedAt >= weekStart) {
					resolvedThisWeek++;
				}
			}
		}

		return {
			totalIssues: issues.length,
			openIssues: issues.filter(issue => issue.state === 'open').length,
			closedIssues: issues.filter(issue => issue.state === 'closed').length,
			assignedToMe: issues.filter(issue =>
				issue.assignee?.login === currentUser?.login
			).length,
			recentlyUpdated: issues.filter(issue =>
				new Date(issue.updated_at) > oneDayAgo
			).length,
			createdToday,
			resolvedToday,
			createdThisWeek,
			resolvedThisWeek
		};
	}

	private async syncRepository(repoKey: string) {
		try {
			await this.plugin.syncRepository(repoKey);
			await this.loadData(); // 重新加载数据
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
