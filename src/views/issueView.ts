import { ItemView, WorkspaceLeaf, Notice, setIcon } from 'obsidian';
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
	private expandedIssues = new Set<number>(); // 跟踪展开的 issue

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
			padding: var(--size-4-2) var(--size-4-3);
			border-bottom: var(--border-width) solid var(--background-modifier-border);
			background: var(--background-primary);
			min-height: var(--input-height);
		`;

		// 标题
		const title = header.createEl('h2', { text: 'GitHub Issues' });
		title.style.cssText = `
			margin: 0;
			font-size: var(--font-ui-medium);
			font-weight: var(--font-semibold);
			color: var(--text-normal);
		`;

		// 操作按钮容器
		const actions = header.createDiv('header-actions');
		actions.style.cssText = `
			display: flex;
			gap: var(--size-2-1);
		`;

		// 刷新按钮
		const refreshBtn = actions.createEl('button', { 
			cls: 'clickable-icon',
			attr: { 'aria-label': 'Refresh issues' }
		});
		refreshBtn.style.cssText = `
			width: var(--icon-size);
			height: var(--icon-size);
			padding: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			background: transparent;
			border: none;
			border-radius: var(--radius-s);
			cursor: pointer;
			color: var(--icon-color);
		`;
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.addEventListener('click', () => this.refreshIssues());

		// 新建Issue按钮
		const newIssueBtn = actions.createEl('button', { 
			cls: 'clickable-icon',
			attr: { 'aria-label': 'Create new issue' }
		});
		newIssueBtn.style.cssText = `
			width: var(--icon-size);
			height: var(--icon-size);
			padding: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			background: transparent;
			border: none;
			border-radius: var(--radius-s);
			cursor: pointer;
			color: var(--icon-color);
		`;
		setIcon(newIssueBtn, 'plus');
		newIssueBtn.addEventListener('click', () => this.createNewIssue());
	}

	private createRepositorySelector(container: Element) {
		const selectorContainer = container.createDiv('repo-selector-container');
		selectorContainer.style.cssText = `
			padding: var(--size-4-2) var(--size-4-3);
			background: var(--background-secondary);
			border-bottom: var(--border-width) solid var(--background-modifier-border);
			display: flex;
			align-items: center;
			gap: var(--size-4-2);
		`;

		const iconContainer = selectorContainer.createDiv();
		iconContainer.style.cssText = `
			width: var(--icon-size-sm);
			height: var(--icon-size-sm);
			color: var(--icon-color);
		`;
		setIcon(iconContainer, 'folder-git-2');

		const select = selectorContainer.createEl('select');
		select.style.cssText = `
			flex: 1;
			padding: var(--size-2-1) var(--size-2-3);
			border: var(--border-width) solid var(--background-modifier-border);
			border-radius: var(--radius-s);
			background: var(--background-primary);
			color: var(--text-normal);
			font-size: var(--font-ui-small);
			height: var(--input-height);
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
			padding: var(--size-4-2);
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
			padding: var(--size-4-6);
			color: var(--text-muted);
		`;
		
		const loadingContent = loading.createDiv();
		loadingContent.style.cssText = `
			display: flex;
			align-items: center;
			gap: var(--size-4-2);
			font-size: var(--font-ui-small);
		`;
		
		const iconDiv = loadingContent.createDiv();
		iconDiv.style.cssText = `
			width: var(--icon-size-sm);
			height: var(--icon-size-sm);
			color: var(--icon-color);
		`;
		setIcon(iconDiv, 'loader-2');
		iconDiv.style.animation = 'spin 1s linear infinite';
		
		loadingContent.createSpan({ text: 'Loading issues...' });
	}

	private renderEmptyState(container: Element) {
		container.empty();
		const empty = container.createDiv('empty-state');
		empty.style.cssText = `
			display: flex;
			justify-content: center;
			align-items: center;
			padding: var(--size-4-6);
			color: var(--text-muted);
			text-align: center;
		`;
		
		const emptyContent = empty.createDiv();
		emptyContent.style.cssText = `
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: var(--size-4-3);
		`;
		
		const iconDiv = emptyContent.createDiv();
		iconDiv.style.cssText = `
			width: var(--icon-size-lg);
			height: var(--icon-size-lg);
			color: var(--icon-color-hover);
		`;
		
		const messageDiv = emptyContent.createDiv();
		messageDiv.style.cssText = `
			font-size: var(--font-ui-small);
			line-height: var(--line-height-normal);
		`;
		
		if (!this.selectedRepo) {
			setIcon(iconDiv, 'folder-open');
			messageDiv.textContent = 'Select a repository to view issues';
		} else {
			setIcon(iconDiv, 'inbox');
			messageDiv.textContent = 'No issues found in this repository';
			
			const createBtn = emptyContent.createEl('button');
			createBtn.style.cssText = `
				padding: var(--size-2-1) var(--size-4-2);
				font-size: var(--font-ui-small);
				border: var(--border-width) solid var(--background-modifier-border);
				border-radius: var(--radius-s);
				background: var(--background-primary);
				color: var(--text-normal);
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: var(--size-2-1);
			`;
			
			const btnIcon = createBtn.createDiv();
			btnIcon.style.cssText = `
				width: var(--icon-size-xs);
				height: var(--icon-size-xs);
			`;
			setIcon(btnIcon, 'plus');
			
			createBtn.createSpan({ text: 'Create First Issue' });
			createBtn.addEventListener('click', () => this.createNewIssue());
		}
	}

	private renderIssuesList(container: Element) {
		container.empty();
		
		this.issues.forEach(issue => {
			const issueItem = container.createDiv('issue-item');
			issueItem.style.cssText = `
				border: var(--border-width) solid var(--background-modifier-border);
				border-radius: var(--radius-s);
				margin-bottom: var(--size-2-1);
				background: var(--background-primary);
				cursor: pointer;
				transition: all 0.2s ease;
				font-size: var(--font-ui-small);
				overflow: hidden;
			`;

			// 创建主要内容区域
			const issueContent = issueItem.createDiv('issue-content');
			issueContent.style.cssText = `
				padding: var(--size-4-2);
			`;

			// 悬停效果
			issueContent.addEventListener('mouseenter', () => {
				issueItem.style.backgroundColor = 'var(--background-modifier-hover)';
				issueItem.style.borderColor = 'var(--background-modifier-border-hover)';
			});
			issueContent.addEventListener('mouseleave', () => {
				issueItem.style.backgroundColor = 'var(--background-primary)';
				issueItem.style.borderColor = 'var(--background-modifier-border)';
			});

			// Issue 头部（状态图标、标题和编号）
			const issueHeader = issueContent.createDiv('issue-header');
			issueHeader.style.cssText = `
				display: flex;
				align-items: center;
				gap: var(--size-2-3);
				margin-bottom: var(--size-2-1);
			`;

			// 展开/收起图标
			const expandIcon = issueHeader.createDiv();
			expandIcon.style.cssText = `
				width: var(--icon-size-xs);
				height: var(--icon-size-xs);
				flex-shrink: 0;
				color: var(--icon-color);
				transition: transform 0.2s ease;
			`;
			const isExpanded = this.expandedIssues.has(issue.id);
			setIcon(expandIcon, 'chevron-right');
			if (isExpanded) {
				expandIcon.style.transform = 'rotate(90deg)';
			}

			// 状态图标
			const statusIcon = issueHeader.createDiv();
			statusIcon.style.cssText = `
				width: var(--icon-size-sm);
				height: var(--icon-size-sm);
				flex-shrink: 0;
				color: ${issue.state === 'open' ? 'var(--color-green)' : 'var(--color-red)'};
			`;
			setIcon(statusIcon, issue.state === 'open' ? 'circle-dot' : 'check-circle');

			// 标题容器
			const titleContainer = issueHeader.createDiv();
			titleContainer.style.cssText = `
				flex: 1;
				min-width: 0;
			`;
			
			const title = titleContainer.createEl('span', { text: issue.title });
			title.style.cssText = `
				font-weight: var(--font-medium);
				color: var(--text-normal);
				line-height: var(--line-height-tight);
				display: block;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			`;

			// Issue编号
			const issueNumber = issueHeader.createEl('span', { text: `#${issue.number}` });
			issueNumber.style.cssText = `
				color: var(--text-muted);
				font-weight: normal;
				flex-shrink: 0;
			`;

			// Issue 元信息
			const issueMeta = issueContent.createDiv('issue-meta');
			issueMeta.style.cssText = `
				display: flex;
				align-items: center;
				gap: var(--size-4-3);
				color: var(--text-muted);
				margin-bottom: var(--size-2-1);
			`;

			// 作者信息
			const authorContainer = issueMeta.createDiv();
			authorContainer.style.cssText = `
				display: flex;
				align-items: center;
				gap: var(--size-2-1);
			`;
			const authorIcon = authorContainer.createDiv();
			authorIcon.style.cssText = `
				width: var(--icon-size-xs);
				height: var(--icon-size-xs);
			`;
			setIcon(authorIcon, 'user');
			authorContainer.createSpan({ text: issue.user.login });

			// 创建时间
			const timeContainer = issueMeta.createDiv();
			timeContainer.style.cssText = `
				display: flex;
				align-items: center;
				gap: var(--size-2-1);
			`;
			const timeIcon = timeContainer.createDiv();
			timeIcon.style.cssText = `
				width: var(--icon-size-xs);
				height: var(--icon-size-xs);
			`;
			setIcon(timeIcon, 'clock');
			const createdDate = new Date(issue.created_at).toLocaleDateString();
			timeContainer.createSpan({ text: createdDate });

			// 标签
			if (issue.labels && issue.labels.length > 0) {
				const labelsContainer = issueContent.createDiv('issue-labels');
				labelsContainer.style.cssText = `
					display: flex;
					gap: var(--size-2-1);
					flex-wrap: wrap;
				`;

				issue.labels.forEach(label => {
					const labelSpan = labelsContainer.createEl('span', { text: label.name });
					labelSpan.style.cssText = `
						padding: var(--size-2-1) var(--size-2-1);
						font-size: var(--font-ui-smaller);
						border-radius: var(--radius-xs);
						background: #${label.color}15;
						color: #${label.color};
						border: var(--border-width) solid #${label.color}30;
						line-height: 1;
					`;
				});
			}

			// 创建展开区域
			const expandedArea = issueItem.createDiv('issue-expanded');
			expandedArea.style.cssText = `
				border-top: var(--border-width) solid var(--background-modifier-border);
				background: var(--background-secondary);
				max-height: ${isExpanded ? '500px' : '0'};
				overflow: hidden;
				transition: max-height 0.3s ease;
			`;

			if (isExpanded) {
				this.renderExpandedContent(expandedArea, issue);
			}

			// 点击事件 - 切换展开/收起
			issueContent.addEventListener('click', (e) => {
				e.stopPropagation();
				this.toggleIssueExpanded(issue, expandIcon, expandedArea);
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

	private toggleIssueExpanded(issue: GitHubIssue, expandIcon: HTMLElement, expandedArea: HTMLElement) {
		const isExpanded = this.expandedIssues.has(issue.id);
		
		if (isExpanded) {
			// 收起
			this.expandedIssues.delete(issue.id);
			expandIcon.style.transform = 'rotate(0deg)';
			expandedArea.style.maxHeight = '0';
			expandedArea.empty();
		} else {
			// 展开
			this.expandedIssues.add(issue.id);
			expandIcon.style.transform = 'rotate(90deg)';
			expandedArea.style.maxHeight = '500px';
			this.renderExpandedContent(expandedArea, issue);
		}
	}

	private renderExpandedContent(container: HTMLElement, issue: GitHubIssue) {
		container.empty();
		
		const content = container.createDiv();
		content.style.cssText = `
			padding: var(--size-4-3);
		`;

		// Issue 描述
		if (issue.body && issue.body.trim()) {
			const descriptionSection = content.createDiv();
			descriptionSection.style.cssText = `
				margin-bottom: var(--size-4-3);
			`;

			const descTitle = descriptionSection.createEl('h4', { text: 'Description' });
			descTitle.style.cssText = `
				margin: 0 0 var(--size-2-2) 0;
				font-size: var(--font-ui-small);
				font-weight: var(--font-semibold);
				color: var(--text-normal);
			`;

			const descContent = descriptionSection.createDiv();
			descContent.style.cssText = `
				background: var(--background-primary);
				border: var(--border-width) solid var(--background-modifier-border);
				border-radius: var(--radius-s);
				padding: var(--size-4-2);
				max-height: 200px;
				overflow-y: auto;
				font-size: var(--font-ui-small);
				line-height: var(--line-height-normal);
				color: var(--text-muted);
				white-space: pre-wrap;
			`;
			
			// 限制描述长度并提供截断
			const maxLength = 500;
			const truncatedBody = issue.body.length > maxLength 
				? issue.body.substring(0, maxLength) + '...' 
				: issue.body;
			descContent.textContent = truncatedBody;
		}

		// 扩展信息
		const metaSection = content.createDiv();
		metaSection.style.cssText = `
			margin-bottom: var(--size-4-3);
		`;

		const metaGrid = metaSection.createDiv();
		metaGrid.style.cssText = `
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: var(--size-4-2);
			font-size: var(--font-ui-small);
		`;

		// 受让人信息
		const assigneeInfo = metaGrid.createDiv();
		assigneeInfo.style.cssText = `
			display: flex;
			align-items: center;
			gap: var(--size-2-1);
			color: var(--text-muted);
		`;
		const assigneeIcon = assigneeInfo.createDiv();
		assigneeIcon.style.cssText = `
			width: var(--icon-size-xs);
			height: var(--icon-size-xs);
		`;
		setIcon(assigneeIcon, 'user-check');
		assigneeInfo.createSpan({ 
			text: issue.assignee ? issue.assignee.login : 'Unassigned' 
		});

		// 更新时间
		const updateInfo = metaGrid.createDiv();
		updateInfo.style.cssText = `
			display: flex;
			align-items: center;
			gap: var(--size-2-1);
			color: var(--text-muted);
		`;
		const updateIcon = updateInfo.createDiv();
		updateIcon.style.cssText = `
			width: var(--icon-size-xs);
			height: var(--icon-size-xs);
		`;
		setIcon(updateIcon, 'calendar');
		const updatedDate = new Date(issue.updated_at).toLocaleDateString();
		updateInfo.createSpan({ text: `Updated ${updatedDate}` });

		// 操作按钮区域
		const actionsSection = content.createDiv();
		actionsSection.style.cssText = `
			display: flex;
			gap: var(--size-2-2);
			flex-wrap: wrap;
		`;

		// 在浏览器中打开按钮
		const openButton = actionsSection.createEl('button');
		openButton.style.cssText = `
			padding: var(--size-2-1) var(--size-2-3);
			font-size: var(--font-ui-small);
			border: var(--border-width) solid var(--background-modifier-border);
			border-radius: var(--radius-s);
			background: var(--background-primary);
			color: var(--text-normal);
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: var(--size-2-1);
			transition: all 0.1s ease;
		`;

		const openIcon = openButton.createDiv();
		openIcon.style.cssText = `
			width: var(--icon-size-xs);
			height: var(--icon-size-xs);
		`;
		setIcon(openIcon, 'external-link');
		openButton.createSpan({ text: 'Open in GitHub' });
		
		openButton.addEventListener('click', (e) => {
			e.stopPropagation();
			window.open(issue.html_url, '_blank');
		});

		openButton.addEventListener('mouseenter', () => {
			openButton.style.backgroundColor = 'var(--background-modifier-hover)';
		});
		openButton.addEventListener('mouseleave', () => {
			openButton.style.backgroundColor = 'var(--background-primary)';
		});

		// 创建 Obsidian 笔记按钮
		const createNoteButton = actionsSection.createEl('button');
		createNoteButton.style.cssText = `
			padding: var(--size-2-1) var(--size-2-3);
			font-size: var(--font-ui-small);
			border: var(--border-width) solid var(--interactive-accent);
			border-radius: var(--radius-s);
			background: var(--interactive-accent);
			color: var(--text-on-accent);
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: var(--size-2-1);
			transition: all 0.1s ease;
		`;

		const noteIcon = createNoteButton.createDiv();
		noteIcon.style.cssText = `
			width: var(--icon-size-xs);
			height: var(--icon-size-xs);
		`;
		setIcon(noteIcon, 'file-plus');
		createNoteButton.createSpan({ text: 'Create Note' });

		createNoteButton.addEventListener('click', (e) => {
			e.stopPropagation();
			this.createIssueNote(issue);
		});

		createNoteButton.addEventListener('mouseenter', () => {
			createNoteButton.style.backgroundColor = 'var(--interactive-accent-hover)';
		});
		createNoteButton.addEventListener('mouseleave', () => {
			createNoteButton.style.backgroundColor = 'var(--interactive-accent)';
		});

		// TODO: 如果是开放状态，添加关闭按钮（暂时注释掉，功能未实现）
		/*
		if (issue.state === 'open') {
			const closeButton = actionsSection.createEl('button');
			closeButton.style.cssText = `
				padding: var(--size-2-1) var(--size-2-3);
				font-size: var(--font-ui-small);
				border: var(--border-width) solid var(--text-error);
				border-radius: var(--radius-s);
				background: transparent;
				color: var(--text-error);
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: var(--size-2-1);
				transition: all 0.1s ease;
			`;

			const closeIcon = closeButton.createDiv();
			closeIcon.style.cssText = `
				width: var(--icon-size-xs);
				height: var(--icon-size-xs);
			`;
			setIcon(closeIcon, 'x-circle');
			closeButton.createSpan({ text: 'Close Issue' });

			closeButton.addEventListener('click', (e) => {
				e.stopPropagation();
				this.closeIssue(issue);
			});

			closeButton.addEventListener('mouseenter', () => {
				closeButton.style.backgroundColor = 'var(--text-error)';
				closeButton.style.color = 'var(--text-on-accent)';
			});
			closeButton.addEventListener('mouseleave', () => {
				closeButton.style.backgroundColor = 'transparent';
				closeButton.style.color = 'var(--text-error)';
			});
		}
		*/
	}

	private createIssueNote(issue: GitHubIssue) {
		// TODO: 实现创建 Obsidian 笔记功能
		new Notice(`Creating note for issue #${issue.number}: ${issue.title}`);
	}

	private async closeIssue(issue: GitHubIssue) {
		// TODO: 实现关闭 Issue 功能
		new Notice(`Close issue #${issue.number} feature coming soon!`);
	}
}
