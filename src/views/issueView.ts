import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import type GithubProjectsPlugin from '../main';

export const ISSUE_VIEW_TYPE = 'github-issues-view';

export interface GitHubIssue {
	id: number;
	number: number;
	title: string;
	body: string;
	state: 'open' | 'closed';
	user: {
		login: string;
		avatar_url: string;
	};
	labels: Array<{
		name: string;
		color: string;
	}>;
	assignee?: {
		login: string;
		avatar_url: string;
	};
	created_at: string;
	updated_at: string;
	html_url: string;
	repository?: {
		owner: string;
		name: string;
	};
}

export class IssueView extends ItemView {
	plugin: GithubProjectsPlugin;
	private issues: GitHubIssue[] = [];
	private isLoading = false;
	private selectedRepo = '';

	constructor(leaf: WorkspaceLeaf, plugin: GithubProjectsPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return ISSUE_VIEW_TYPE;
	}

	getDisplayText() {
		return 'GitHub Issues';
	}

	getIcon() {
		return 'github';
	}

	async onOpen() {
		this.renderView();
		// 在视图渲染完成后再加载默认仓库
		await this.loadDefaultRepository();
	}

	async onClose() {
		// 清理工作
	}

	private renderView() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('github-issues-view');

		// 创建头部工具栏
		this.createHeader(container);

		// 创建仓库选择器
		this.createRepositorySelector(container);

		// 创建Issues列表容器
		this.createIssuesList(container);
	}

	private createHeader(container: Element) {
		const header = container.createDiv('issues-header');
		header.style.cssText = `
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 16px;
			border-bottom: 1px solid var(--background-modifier-border);
		`;

		// 标题
		const title = header.createEl('h2', { text: 'GitHub Issues' });
		title.style.cssText = `
			margin: 0;
			font-size: 18px;
			font-weight: 600;
		`;

		// 操作按钮容器
		const actions = header.createDiv('header-actions');
		actions.style.cssText = `
			display: flex;
			gap: 8px;
		`;

		// 刷新按钮
		const refreshBtn = actions.createEl('button', { text: '🔄 Refresh' });
		refreshBtn.style.cssText = `
			padding: 6px 12px;
			font-size: 12px;
			background: var(--interactive-accent);
			color: var(--text-on-accent);
			border: none;
			border-radius: 4px;
			cursor: pointer;
			transition: all 0.2s ease;
		`;
		refreshBtn.addEventListener('click', () => this.refreshIssues());

		// 新建Issue按钮
		const newIssueBtn = actions.createEl('button', { text: '➕ New Issue' });
		newIssueBtn.style.cssText = `
			padding: 6px 12px;
			font-size: 12px;
			background: var(--color-green);
			color: white;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			transition: all 0.2s ease;
		`;
		newIssueBtn.addEventListener('click', () => this.createNewIssue());
	}

	private createRepositorySelector(container: Element) {
		const selectorContainer = container.createDiv('repo-selector-container');
		selectorContainer.style.cssText = `
			padding: 12px 16px;
			background: var(--background-secondary);
			border-bottom: 1px solid var(--background-modifier-border);
		`;

		const label = selectorContainer.createEl('label', { text: 'Repository: ' });
		label.style.cssText = `
			font-size: 12px;
			font-weight: 500;
			color: var(--text-muted);
			margin-right: 8px;
		`;

		const select = selectorContainer.createEl('select');
		select.style.cssText = `
			padding: 4px 8px;
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			background: var(--background-primary);
			color: var(--text-normal);
			font-size: 12px;
			min-width: 200px;
		`;

		// 添加默认选项
		select.createEl('option', { 
			text: 'Select a repository...',
			value: ''
		});

		// 填充仓库选项
		this.plugin.settings.repositories.forEach(repo => {
			const option = select.createEl('option', {
				text: `${repo.owner}/${repo.repo}`,
				value: `${repo.owner}/${repo.repo}`
			});
			if (repo.isDefault) {
				option.selected = true;
				this.selectedRepo = `${repo.owner}/${repo.repo}`;
			}
		});

		select.addEventListener('change', (e) => {
			const target = e.target as HTMLSelectElement;
			this.selectedRepo = target.value;
			if (this.selectedRepo) {
				this.loadIssues();
			}
		});
	}

	private createIssuesList(container: Element) {
		const listContainer = container.createDiv('issues-list-container');
		listContainer.style.cssText = `
			flex: 1;
			overflow-y: auto;
			padding: 16px;
		`;

		this.updateIssuesListContent(listContainer);
	}

	private updateIssuesList() {
		const container = this.containerEl.children[1];
		const listContainer = container.querySelector('.issues-list-container');
		if (listContainer) {
			this.updateIssuesListContent(listContainer);
		}
	}

	private updateIssuesListContent(container: Element) {
		if (this.isLoading) {
			this.renderLoadingState(container);
		} else if (this.issues.length === 0) {
			this.renderEmptyState(container);
		} else {
			this.renderIssuesList(container);
		}
	}

	private renderLoadingState(container: Element) {
		container.empty();
		const loading = container.createDiv('loading-state');
		loading.style.cssText = `
			display: flex;
			justify-content: center;
			align-items: center;
			padding: 40px;
			color: var(--text-muted);
		`;
		loading.innerHTML = `
			<div style="text-align: center;">
				<div style="font-size: 24px; margin-bottom: 8px;">⏳</div>
				<div>Loading issues...</div>
			</div>
		`;
	}

	private renderEmptyState(container: Element) {
		container.empty();
		const empty = container.createDiv('empty-state');
		empty.style.cssText = `
			display: flex;
			justify-content: center;
			align-items: center;
			padding: 40px;
			color: var(--text-muted);
			text-align: center;
		`;
		
		if (!this.selectedRepo) {
			empty.innerHTML = `
				<div>
					<div style="font-size: 24px; margin-bottom: 8px;">📁</div>
					<div>Select a repository to view issues</div>
				</div>
			`;
		} else {
			empty.innerHTML = `
				<div>
					<div style="font-size: 24px; margin-bottom: 8px;">📭</div>
					<div>No issues found in this repository</div>
					<button onclick="this.createNewIssue()" style="margin-top: 12px; padding: 6px 12px; border: none; border-radius: 4px; background: var(--interactive-accent); color: var(--text-on-accent); cursor: pointer;">Create First Issue</button>
				</div>
			`;
		}
	}

	private renderIssuesList(container: Element) {
		container.empty();
		
		this.issues.forEach(issue => {
			const issueItem = container.createDiv('issue-item');
			issueItem.style.cssText = `
				border: 1px solid var(--background-modifier-border);
				border-radius: 6px;
				padding: 16px;
				margin-bottom: 12px;
				background: var(--background-primary);
				cursor: pointer;
				transition: all 0.2s ease;
			`;

			// 悬停效果
			issueItem.addEventListener('mouseenter', () => {
				issueItem.style.backgroundColor = 'var(--background-secondary)';
				issueItem.style.borderColor = 'var(--background-modifier-border-hover)';
			});
			issueItem.addEventListener('mouseleave', () => {
				issueItem.style.backgroundColor = 'var(--background-primary)';
				issueItem.style.borderColor = 'var(--background-modifier-border)';
			});

			// Issue 头部（标题和状态）
			const issueHeader = issueItem.createDiv('issue-header');
			issueHeader.style.cssText = `
				display: flex;
				justify-content: space-between;
				align-items: flex-start;
				margin-bottom: 8px;
			`;

			const titleContainer = issueHeader.createDiv();
			const title = titleContainer.createEl('h3', { text: issue.title });
			title.style.cssText = `
				margin: 0 0 4px 0;
				font-size: 14px;
				font-weight: 600;
				color: var(--text-normal);
				line-height: 1.3;
			`;

			const issueNumber = titleContainer.createEl('span', { text: `#${issue.number}` });
			issueNumber.style.cssText = `
				font-size: 12px;
				color: var(--text-muted);
				font-weight: normal;
			`;

			// 状态标签
			const statusBadge = issueHeader.createEl('span', { text: issue.state });
			statusBadge.style.cssText = `
				padding: 2px 8px;
				font-size: 11px;
				font-weight: 500;
				border-radius: 12px;
				text-transform: uppercase;
				${issue.state === 'open' ? 
					'background: var(--color-green); color: white;' : 
					'background: var(--color-red); color: white;'}
			`;

			// Issue 元信息
			const issueMeta = issueItem.createDiv('issue-meta');
			issueMeta.style.cssText = `
				display: flex;
				align-items: center;
				gap: 12px;
				font-size: 12px;
				color: var(--text-muted);
				margin-bottom: 8px;
			`;

			// 作者信息
			const authorSpan = issueMeta.createEl('span');
			authorSpan.innerHTML = `👤 ${issue.user.login}`;

			// 创建时间
			const createdSpan = issueMeta.createEl('span');
			const createdDate = new Date(issue.created_at).toLocaleDateString();
			createdSpan.innerHTML = `📅 ${createdDate}`;

			// 标签
			if (issue.labels && issue.labels.length > 0) {
				const labelsContainer = issueItem.createDiv('issue-labels');
				labelsContainer.style.cssText = `
					display: flex;
					gap: 4px;
					flex-wrap: wrap;
					margin-top: 8px;
				`;

				issue.labels.forEach(label => {
					const labelSpan = labelsContainer.createEl('span', { text: label.name });
					labelSpan.style.cssText = `
						padding: 2px 6px;
						font-size: 10px;
						border-radius: 4px;
						background: #${label.color}20;
						color: #${label.color};
						border: 1px solid #${label.color}40;
					`;
				});
			}

			// 点击事件 - 打开Issue详情
			issueItem.addEventListener('click', () => {
				this.openIssueDetail(issue);
			});
		});
	}

	private async loadDefaultRepository() {
		const defaultRepo = this.plugin.settings.repositories.find(repo => repo.isDefault);
		if (defaultRepo) {
			this.selectedRepo = `${defaultRepo.owner}/${defaultRepo.repo}`;
			await this.loadIssues();
		}
	}

	private async loadIssues() {
		if (!this.selectedRepo || !this.plugin.settings.githubToken) {
			new Notice('Please configure GitHub token and select a repository');
			return;
		}

		this.isLoading = true;
		this.updateIssuesList(); // 只更新Issues列表部分，不重新渲染整个视图

		try {
			const [owner, repo] = this.selectedRepo.split('/');
			const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
				headers: {
					'Authorization': `Bearer ${this.plugin.settings.githubToken}`,
					'Accept': 'application/vnd.github.v3+json',
					'User-Agent': 'Obsidian-GitHub-Projects'
				}
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch issues: ${response.status} ${response.statusText}`);
			}

			this.issues = await response.json();
			// 添加仓库信息到每个issue
			this.issues.forEach(issue => {
				issue.repository = { owner, name: repo };
			});
			
		} catch (error) {
			console.error('Error loading issues:', error);
			new Notice(`Failed to load issues: ${error instanceof Error ? error.message : 'Unknown error'}`);
			this.issues = [];
		} finally {
			this.isLoading = false;
			this.updateIssuesList(); // 重新更新Issues列表以显示结果
		}
	}

	private async refreshIssues() {
		await this.loadIssues();
		new Notice('Issues refreshed');
	}

	private createNewIssue() {
		// TODO: 实现创建新Issue的功能
		new Notice('Create new issue feature coming soon!');
	}

	private openIssueDetail(issue: GitHubIssue) {
		// TODO: 实现打开Issue详情的功能
		window.open(issue.html_url, '_blank');
	}
}
