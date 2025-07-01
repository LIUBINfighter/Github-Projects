import { ItemView, WorkspaceLeaf, Notice, setIcon } from 'obsidian';
import type GithubProjectsPlugin from '../main';
import { IssueTab } from './tabs/issueTab';

export const WORKBENCH_VIEW_TYPE = 'github-workbench-view';

interface GitHubProject {
	id: number;
	number: number;
	title: string;
	body: string;
	state: 'open' | 'closed';
	creator: {
		login: string;
		avatar_url: string;
	};
	created_at: string;
	updated_at: string;
	html_url: string;
	repository: {
		owner: string;
		name: string;
	};
}

interface ProjectsOverview {
	projects: GitHubProject[];
	lastSync?: string;
}

type WorkbenchTab = 'issues' | 'projects';

export class IssueWorkbenchView extends ItemView {
	plugin: GithubProjectsPlugin;
	private issueTab: IssueTab;
	private projects: ProjectsOverview = { projects: [] };
	private isLoading = false;
	private activeTab: WorkbenchTab = 'issues';

	constructor(leaf: WorkspaceLeaf, plugin: GithubProjectsPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.issueTab = new IssueTab(plugin);
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

		// 创建标签页导航
		this.createTabNavigation(container);

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

	private createTabNavigation(container: Element) {
		const tabNav = container.createDiv('workbench-tab-nav');

		const tabs = [
			{ id: 'issues' as WorkbenchTab, name: 'Issues Overview', icon: 'list' },
			{ id: 'projects' as WorkbenchTab, name: 'GitHub Projects', icon: 'kanban-square' }
		];

		tabs.forEach(tab => {
			const tabButton = tabNav.createEl('button', {
				cls: `workbench-tab ${this.activeTab === tab.id ? 'active' : ''}`,
				text: tab.name
			});

			const tabIcon = tabButton.createDiv('tab-icon');
			setIcon(tabIcon, tab.icon);

			tabButton.addEventListener('click', () => {
				if (this.activeTab !== tab.id) {
					this.activeTab = tab.id;
					this.renderView();
				}
			});
		});
	}

	private createMainContent(container: Element) {
		const mainContent = container.createDiv('workbench-main');

		if (this.isLoading) {
			this.showLoadingState(mainContent);
			return;
		}

		switch (this.activeTab) {
			case 'issues':
				this.createIssuesContent(mainContent);
				break;
			case 'projects':
				this.createProjectsContent(mainContent);
				break;
		}
	}

	private createIssuesContent(container: Element) {
		this.issueTab.render(container);
	}

	private createProjectsContent(container: Element) {
		// 创建项目概览部分
		this.createProjectsOverview(container);

		// 创建项目列表部分
		this.createProjectsList(container);
	}

	private showLoadingState(container: Element) {
		const loadingDiv = container.createDiv('loading-state');
		loadingDiv.createEl('div', { cls: 'loading-spinner' });
		loadingDiv.createEl('p', { text: 'Loading workbench data...' });
	}

	private async loadWorkbenchData() {
		this.isLoading = true;
		this.renderView();

		try {
			// 加载 Issues 数据
			if (this.activeTab === 'issues') {
				await this.issueTab.loadData();
			}

			// 加载 Projects 数据
			if (this.activeTab === 'projects') {
				await this.loadProjectsData();
			}
		} catch (error) {
			console.error('Failed to load workbench data:', error);
			new Notice('Failed to load workbench data');
		} finally {
			this.isLoading = false;
			this.renderView();
		}
	}

	private async loadProjectsData() {
		// 确保用户信息已经加载
		if (!this.plugin.getCurrentUser() && this.plugin.settings.githubToken) {
			await this.plugin.validateAndUpdateUserInfo();
		}

		const activeRepos = this.plugin.getActiveRepositories();
		const allProjects: GitHubProject[] = [];
		let lastProjectSync: string | undefined;

		for (const repo of activeRepos) {
			const repoKey = `${repo.owner}/${repo.repo}`;
			const cache = this.plugin.getRepositoryCache(repoKey);

			if (cache) {
				// 聚合所有仓库的 Projects 数据
				if (cache.projects && cache.projects.length > 0) {
					// 为每个项目添加仓库信息
					const projectsWithRepo = cache.projects.map(p => ({
						...p,
						repository: {
							owner: repo.owner,
							name: repo.repo
						}
					}));
					allProjects.push(...projectsWithRepo);
				}
				
				// 找到最近的同步时间
				if (cache.last_sync && (!lastProjectSync || new Date(cache.last_sync) > new Date(lastProjectSync))) {
					lastProjectSync = cache.last_sync;
				}
			}
		}

		// 更新总的项目数据
		this.projects = {
			projects: allProjects,
			lastSync: lastProjectSync
		};
	}

	private async syncAllRepositories() {
		this.isLoading = true;
		this.renderView();

		try {
			await this.plugin.syncAllRepositories();
			if (this.activeTab === 'issues') {
				await this.issueTab.loadData();
			} else {
				await this.loadProjectsData();
			}
			new Notice('All repositories synced successfully');
		} catch (error) {
			console.error('Failed to sync repositories:', error);
			new Notice('Failed to sync repositories');
		} finally {
			this.isLoading = false;
			this.renderView();
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

	private createStatCard(container: Element, title: string, value: number, icon: string, type?: string) {
		const card = container.createDiv(`stat-card ${type ? `stat-${type}` : ''}`);
		
		const cardIcon = card.createDiv('stat-icon');
		setIcon(cardIcon, icon);
		
		const cardContent = card.createDiv('stat-content');
		cardContent.createEl('div', { text: value.toString(), cls: 'stat-value' });
		cardContent.createEl('div', { text: title, cls: 'stat-title' });
	}

	private createProjectsOverview(container: Element) {
		const projectsSection = container.createDiv('projects-overview');
		projectsSection.createEl('h3', { text: 'GitHub Projects Overview', cls: 'section-title' });

		const projectsGrid = projectsSection.createDiv('stats-grid');

		// 计算项目统计
		const openProjects = this.projects.projects.filter(p => p.state === 'open').length;
		const closedProjects = this.projects.projects.filter(p => p.state === 'closed').length;
		const totalProjects = this.projects.projects.length;

		// 创建统计卡片
		this.createStatCard(projectsGrid, 'Total Projects', totalProjects, 'kanban-square');
		this.createStatCard(projectsGrid, 'Open Projects', openProjects, 'circle-dot', 'open');
		this.createStatCard(projectsGrid, 'Closed Projects', closedProjects, 'check-circle', 'closed');

		// 最后同步时间
		if (this.projects.lastSync) {
			const lastSyncDate = new Date(this.projects.lastSync);
			const timeAgo = this.getTimeAgo(lastSyncDate);
			
			const syncInfo = projectsSection.createDiv('sync-info');
			syncInfo.createEl('span', { 
				text: `Last synced: ${timeAgo}`,
				cls: 'sync-time-info'
			});
		}
	}

	private createProjectsList(container: Element) {
		const projectsSection = container.createDiv('projects-section');
		projectsSection.createEl('h3', { text: 'Projects', cls: 'section-title' });

		if (this.projects.projects.length === 0) {
			// 显示空白状态，移除悬浮效果
			const emptyState = projectsSection.createDiv('projects-empty-state');
			const iconDiv = emptyState.createDiv('empty-icon');
			setIcon(iconDiv, 'kanban-square');
			
			emptyState.createEl('h3', { text: 'No GitHub Projects found' });
			emptyState.createEl('p', { text: 'GitHub Projects are not available or no projects have been created in the configured repositories.' });
			
			const docsBtn = emptyState.createEl('button', {
				cls: 'mod-cta',
				text: 'Learn about GitHub Projects'
			});
			docsBtn.addEventListener('click', () => {
				window.open('https://docs.github.com/en/issues/planning-and-tracking-with-projects', '_blank');
			});
		} else {
			const projectsList = projectsSection.createDiv('projects-list');

			this.projects.projects.forEach(project => {
				this.createProjectCard(projectsList, project);
			});
		}
	}

	private createProjectCard(container: Element, project: GitHubProject) {
		const card = container.createDiv('project-card');

		// 卡片头部
		const cardHeader = card.createDiv('card-header');
		const titleDiv = cardHeader.createDiv('card-title');
		
		const iconDiv = titleDiv.createDiv('project-icon');
		setIcon(iconDiv, 'kanban-square');
		
		titleDiv.createEl('h4', { text: project.title });

		// 项目状态
		const statusDiv = cardHeader.createDiv('project-status');
		const statusBadge = statusDiv.createDiv(`status-badge status-${project.state}`);
		statusBadge.createEl('span', { text: project.state.charAt(0).toUpperCase() + project.state.slice(1) });

		// 项目信息
		const projectInfo = card.createDiv('project-info');
		
		// 创建者信息
		const creatorDiv = projectInfo.createDiv('project-meta-item');
		const creatorIcon = creatorDiv.createDiv('project-meta-icon');
		setIcon(creatorIcon, 'user');
		creatorDiv.createEl('span', { text: `Created by ${project.creator.login}` });

		// 仓库信息
		const repoDiv = projectInfo.createDiv('project-meta-item');
		const repoIcon = repoDiv.createDiv('project-meta-icon');
		setIcon(repoIcon, 'folder-git-2');
		repoDiv.createEl('span', { text: `${project.repository.owner}/${project.repository.name}` });

		// 创建时间
		const dateDiv = projectInfo.createDiv('project-meta-item');
		const dateIcon = dateDiv.createDiv('project-meta-icon');
		setIcon(dateIcon, 'calendar');
		const createdDate = new Date(project.created_at).toLocaleDateString();
		dateDiv.createEl('span', { text: `Created ${createdDate}` });

		// 项目描述（如果有的话）
		if (project.body && project.body.trim()) {
			const descDiv = card.createDiv('project-description');
			const maxLength = 150;
			const description = project.body.length > maxLength 
				? project.body.substring(0, maxLength) + '...' 
				: project.body;
			descDiv.createEl('p', { text: description });
		}

		// 卡片操作
		const cardActions = card.createDiv('card-actions');
		
		const viewBtn = cardActions.createEl('button', {
			cls: 'mod-cta',
			text: 'View Project'
		});
		viewBtn.addEventListener('click', () => {
			window.open(project.html_url, '_blank');
		});

		const copyBtn = cardActions.createEl('button', {
			text: 'Copy URL'
		});
		setIcon(copyBtn, 'copy');
		copyBtn.addEventListener('click', () => {
			navigator.clipboard.writeText(project.html_url).then(() => {
				new Notice('Project URL copied to clipboard');
			});
		});
	}
}
