import { setIcon, Notice } from 'obsidian';
import type GithubProjectsPlugin from '../../main';

export interface GitHubProject {
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

export interface ProjectsOverview {
	projects: GitHubProject[];
	lastSync?: string;
}

export class ProjectsTab {
	private plugin: GithubProjectsPlugin;
	private projects: ProjectsOverview = { projects: [] };
	private isLoading = false;

	constructor(plugin: GithubProjectsPlugin) {
		this.plugin = plugin;
	}

	/**
	 * 渲染 Projects 标签页内容
	 */
	render(container: Element): void {
		if (this.isLoading) {
			this.showLoadingState(container);
			return;
		}

		this.createProjectsContent(container);
	}

	/**
	 * 加载 Projects 数据
	 */
	async loadData(): Promise<void> {
		this.isLoading = true;

		try {
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
		} catch (error) {
			console.error('Failed to load projects data:', error);
			new Notice('Failed to load projects data');
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * 获取项目数据
	 */
	getProjects(): ProjectsOverview {
		return this.projects;
	}

	/**
	 * 检查是否正在加载
	 */
	getIsLoading(): boolean {
		return this.isLoading;
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
		loadingDiv.createEl('p', { text: 'Loading projects data...' });
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
			// 显示空白状态
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

	private createStatCard(container: Element, title: string, value: number, icon: string, type?: string) {
		const card = container.createDiv(`stat-card ${type ? `stat-${type}` : ''}`);
		
		const cardIcon = card.createDiv('stat-icon');
		setIcon(cardIcon, icon);
		
		const cardContent = card.createDiv('stat-content');
		cardContent.createEl('div', { text: value.toString(), cls: 'stat-value' });
		cardContent.createEl('div', { text: title, cls: 'stat-title' });
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
