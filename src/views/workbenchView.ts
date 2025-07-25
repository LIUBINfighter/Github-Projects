import { ItemView, WorkspaceLeaf, Notice, setIcon } from 'obsidian';
import type GithubProjectsPlugin from '../main';
import { IssueTab } from './tabs/issueTab';
import { ProjectsTab } from './tabs/projectsTab';

export const WORKBENCH_VIEW_TYPE = 'github-workbench-view';

type WorkbenchTab = 'issues' | 'projects';

export class IssueWorkbenchView extends ItemView {
	plugin: GithubProjectsPlugin;
	private issueTab: IssueTab;
	private projectsTab: ProjectsTab;
	private isLoading = false;
	private activeTab: WorkbenchTab = 'issues';

	constructor(leaf: WorkspaceLeaf, plugin: GithubProjectsPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.issueTab = new IssueTab(plugin);
		this.projectsTab = new ProjectsTab(plugin);
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

		// 创建合并的头部导航
		this.createHeaderNavigation(container);

		// 创建主要内容区域
		this.createMainContent(container);
	}

	private createHeaderNavigation(container: Element) {
		const headerNav = container.createDiv('workbench-header-nav');

		// 最左侧标题
		const title = headerNav.createDiv('workbench-title');
		title.createEl('h3', { text: 'GitHub Workbench' });

		// 左侧标签页导航
		const tabNav = headerNav.createDiv('workbench-tab-nav');

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

		// 右侧操作按钮
		const actions = headerNav.createDiv('header-actions');

		// 刷新按钮
        const refreshBtn = actions.createEl('button', {
            cls: 'button-refresh',
            text: 'Sync All'
        });
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.addEventListener('click', () => this.syncAllRepositories());

		// 设置按钮
        const settingsBtn = actions.createEl('button', {
            cls: 'settings-icon',
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
		this.projectsTab.render(container);
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
			// 根据当前活跃的标签页加载对应数据
			if (this.activeTab === 'issues') {
				await this.issueTab.loadData();
			} else if (this.activeTab === 'projects') {
				await this.projectsTab.loadData();
			}
		} catch (error) {
			console.error('Failed to load workbench data:', error);
			new Notice('Failed to load workbench data');
		} finally {
			this.isLoading = false;
			this.renderView();
		}
	}

	private async syncAllRepositories() {
		this.isLoading = true;
		this.renderView();

		try {
			// 同步仓库数据
			await this.plugin.syncAllRepositories();
			
			// 同步项目数据
			await this.plugin.syncAllProjects();
			
			// 重新加载当前标签页的数据
			if (this.activeTab === 'issues') {
				await this.issueTab.loadData();
			} else {
				await this.projectsTab.loadData();
			}
			
			new Notice('All data synced successfully');
		} catch (error) {
			console.error('Failed to sync repositories:', error);
			new Notice('Failed to sync data');
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
}
