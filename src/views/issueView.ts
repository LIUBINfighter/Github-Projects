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
	milestone?: {
		title: string;
		description?: string;
		state: 'open' | 'closed';
	};
	created_at: string;
	updated_at: string;
	html_url: string;
	comments: number;
	commits_count?: number; // 相关提交数，可选字段
	repository?: {
		owner: string;
		name: string;
	};
}

export interface FilterOptions {
	titleContains: string;
	selectedLabels: string[];
	selectedMilestone: string;
	selectedAssignee: string;
	selectedState: 'all' | 'open' | 'closed';
}

export class IssueView extends ItemView {
	plugin: GithubProjectsPlugin;
	private issues: GitHubIssue[] = [];
	private filteredIssues: GitHubIssue[] = [];
	private isLoading = false;
	private selectedRepo = '';
	private expandedIssues = new Set<number>(); // 跟踪展开的 issue
	private isFilterExpanded = false; // 默认展开筛选器
	private availableLabels: string[] = [];
	private availableMilestones: string[] = [];
	private availableAssignees: string[] = [];
	private filters: FilterOptions = {
		titleContains: '',
		selectedLabels: [],
		selectedMilestone: 'all',
		selectedAssignee: 'all',
		selectedState: 'open' // 默认显示Open状态的issue
	};

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

		// 创建过滤工具栏
		this.createFilterToolbar(container);

		// 创建Issues列表容器
		this.createIssuesList(container);
	}

	private createHeader(container: Element) {
		const header = container.createDiv('issues-header');

		// 标题
		header.createEl('h2', { text: 'GitHub Issues', cls: 'header-title' });

		// 操作按钮容器
		const actions = header.createDiv('header-actions');

		// 过滤按钮
		const filterBtn = actions.createEl('button', { 
			cls: `clickable-icon-button ${this.isFilterExpanded ? 'filter-active' : ''}`,
			attr: { 'aria-label': 'Toggle filters' }
		});
		setIcon(filterBtn, 'filter');
		filterBtn.addEventListener('click', () => this.toggleFilters());

		// 刷新按钮
		const refreshBtn = actions.createEl('button', { 
			cls: 'clickable-icon-button',
			attr: { 'aria-label': 'Sync all repositories from GitHub' }
		});
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.addEventListener('click', () => this.refreshIssues());

		// 新建Issue按钮
		const newIssueBtn = actions.createEl('button', { 
			cls: 'clickable-icon-button',
			attr: { 'aria-label': 'Create new issue' }
		});
		setIcon(newIssueBtn, 'plus');
		newIssueBtn.addEventListener('click', () => this.createNewIssue());
	}

	private createRepositorySelector(container: Element) {
		const selectorContainer = container.createDiv('repo-selector-container');

		const iconContainer = selectorContainer.createDiv('repo-icon-container');
		setIcon(iconContainer, 'folder-git-2');

		const select = selectorContainer.createEl('select', { cls: 'repo-select' });

		// 添加默认选项（不可选）
		const defaultOption = select.createEl('option', { 
			text: 'Select a repository...',
			value: ''
		});
		defaultOption.disabled = true;

		// 填充仓库选项（只显示活跃的仓库）
		const activeRepositories = this.plugin.getActiveRepositories();
		activeRepositories.forEach(repo => {
			const repoKey = `${repo.owner}/${repo.repo}`;
			select.createEl('option', {
				text: `${repo.name || repo.repo} (${repoKey})`,
				value: repoKey
			});
		});

		// 设置当前选中的仓库，如果没有选中的仓库则使用第一个可用仓库
		if (this.selectedRepo) {
			// 检查当前选中的仓库是否仍然活跃
			const selectedRepoExists = activeRepositories.some(repo => 
				`${repo.owner}/${repo.repo}` === this.selectedRepo
			);
			if (selectedRepoExists) {
				select.value = this.selectedRepo;
			} else {
				// 如果当前选中的仓库被禁用了，重置选择
				this.selectedRepo = '';
				select.value = '';
			}
		}
		
		if (!this.selectedRepo && activeRepositories.length > 0) {
			// 如果没有选中的仓库，默认选择第一个活跃仓库
			const firstRepo = activeRepositories[0];
			const firstRepoKey = `${firstRepo.owner}/${firstRepo.repo}`;
			this.selectedRepo = firstRepoKey;
			select.value = firstRepoKey;
		} else if (activeRepositories.length === 0) {
			// 如果没有活跃的仓库，选中默认选项但保持禁用状态
			select.value = '';
		}

		select.addEventListener('change', (e) => {
			const target = e.target as HTMLSelectElement;
			const newRepo = target.value;
			
			// 防止选择到空值
			if (!newRepo) {
				// 如果尝试选择空值，恢复到之前的选择
				if (this.selectedRepo) {
					target.value = this.selectedRepo;
				}
				return;
			}
			
			if (newRepo !== this.selectedRepo) {
				this.selectedRepo = newRepo;
				
				// 重置过滤器和状态
				this.resetFilters();
				this.issues = [];
				this.filteredIssues = [];
				
				// 加载新仓库的 Issues
				this.loadIssues();
			}
		});
	}

	private createIssuesList(container: Element) {
		const listContainer = container.createDiv('issues-list-container');
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
		} else {
			const issuesToRender = this.filteredIssues.length > 0 || this.hasActiveFilters() ? this.filteredIssues : this.issues;
			if (issuesToRender.length === 0) {
				this.renderEmptyState(container);
			} else {
				this.renderIssuesList(container);
			}
		}
	}

	private renderLoadingState(container: Element) {
		container.empty();
		const loading = container.createDiv('loading-state');
		
		const loadingContent = loading.createDiv('loading-content');
		
		const iconDiv = loadingContent.createDiv('loading-icon');
		setIcon(iconDiv, 'loader-2');
		
		loadingContent.createSpan({ text: 'Loading issues...' });
	}

	private renderEmptyState(container: Element) {
		container.empty();
		const empty = container.createDiv('empty-state');
		
		const emptyContent = empty.createDiv('empty-content');
		
		const iconDiv = emptyContent.createDiv('empty-icon');
		
		const messageDiv = emptyContent.createDiv('empty-message');
		
		if (!this.selectedRepo) {
			setIcon(iconDiv, 'folder-open');
			messageDiv.createEl('h3', { text: 'Select a repository' });
			messageDiv.createEl('p', { text: 'Choose a repository from the dropdown above to view its issues.' });
		} else {
			// GitHub 风格的空状态
			setIcon(iconDiv, 'check-circle');
			iconDiv.addClass('empty-icon-success');
			
			const titleEl = messageDiv.createEl('h3', { text: 'You\'re all set!' });
			titleEl.addClass('empty-title-success');
			
			const descEl = messageDiv.createEl('p', { 
				text: 'No issues found in this repository. That\'s a good thing!' 
			});
			descEl.addClass('empty-desc');
			
			// 如果有过滤器激活，显示不同的消息
			if (this.hasActiveFilters()) {
				titleEl.textContent = 'No issues match your filters';
				descEl.textContent = 'Try adjusting your search criteria or clearing the filters.';
				setIcon(iconDiv, 'search');
				iconDiv.removeClass('empty-icon-success');
			}
		}
	}

	private renderIssuesList(container: Element) {
		container.empty();
		
		const issuesToRender = this.filteredIssues.length > 0 || this.hasActiveFilters() ? this.filteredIssues : this.issues;
		
		issuesToRender.forEach(issue => {
			const issueItem = container.createDiv('issue-item-container');

			// 创建主要内容区域
			const issueContent = issueItem.createDiv('issue-content');

			// Issue 头部（状态图标、标题和编号）
			const issueHeader = issueContent.createDiv('issue-header');

			// 展开/收起图标
			const expandIcon = issueHeader.createDiv(`issue-expand-icon ${this.expandedIssues.has(issue.id) ? 'expanded' : ''}`);
			const isExpanded = this.expandedIssues.has(issue.id);
			setIcon(expandIcon, 'chevron-right');

			// 状态图标
			const statusIcon = issueHeader.createDiv(`issue-status-icon ${issue.state}`);
			setIcon(statusIcon, issue.state === 'open' ? 'circle-dot' : 'check-circle');

			// 标题容器
			const titleContainer = issueHeader.createDiv('issue-title-container');
			
			titleContainer.createEl('span', { text: issue.title, cls: 'issue-title' });

			// Issue编号
			issueHeader.createEl('span', { text: `#${issue.number}`, cls: 'issue-number' });

			// Issue 元信息
			const issueMeta = issueContent.createDiv('issue-meta');

			// 作者信息
			const authorContainer = issueMeta.createDiv('issue-meta-item');
			const authorIcon = authorContainer.createDiv('issue-meta-icon');
			setIcon(authorIcon, 'user');
			authorContainer.createSpan({ text: issue.user.login });

			// 创建时间
			const timeContainer = issueMeta.createDiv('issue-meta-item');
			const timeIcon = timeContainer.createDiv('issue-meta-icon');
			setIcon(timeIcon, 'clock');
			const createdDate = new Date(issue.created_at).toLocaleDateString();
			timeContainer.createSpan({ text: createdDate });

			// 评论数
			const commentsContainer = issueMeta.createDiv('issue-meta-item');
			const commentsIcon = commentsContainer.createDiv('issue-meta-icon');
			setIcon(commentsIcon, 'message-circle');
			commentsContainer.createSpan({ text: issue.comments.toString() });

			// 提交数（暂时显示为占位符，实际需要额外API调用）
			const commitsContainer = issueMeta.createDiv('issue-meta-item');
			const commitsIcon = commitsContainer.createDiv('issue-meta-icon');
			setIcon(commitsIcon, 'git-commit');
			// 显示提交数，如果没有则显示占位符
			const commitsCount = issue.commits_count !== undefined ? issue.commits_count.toString() : '-';
			commitsContainer.createSpan({ text: commitsCount });

			// 标签
			if (issue.labels && issue.labels.length > 0) {
				const labelsContainer = issueContent.createDiv('issue-labels');

				issue.labels.forEach(label => {
					const labelSpan = labelsContainer.createEl('span', { text: label.name, cls: 'issue-label' });
					labelSpan.style.backgroundColor = `#${label.color}15`;
					labelSpan.style.color = `#${label.color}`;
					labelSpan.style.borderColor = `#${label.color}30`;
				});
			}

			// 创建展开区域
			const expandedArea = issueItem.createDiv('issue-expanded');
			expandedArea.style.maxHeight = isExpanded ? '500px' : '0';

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
		// 首先尝试找到默认且活跃的仓库
		const activeRepositories = this.plugin.getActiveRepositories();
		const defaultRepo = activeRepositories.find(repo => repo.isDefault);
		
		if (defaultRepo) {
			this.selectedRepo = `${defaultRepo.owner}/${defaultRepo.repo}`;
		} else if (activeRepositories.length > 0) {
			// 如果没有默认仓库，选择第一个可用的活跃仓库
			const firstRepo = activeRepositories[0];
			this.selectedRepo = `${firstRepo.owner}/${firstRepo.repo}`;
		} else {
			// 如果没有任何活跃仓库，清空选择
			this.selectedRepo = '';
			this.updateRepositorySelector();
			return;
		}
		
		this.updateRepositorySelector();
		await this.loadIssues();
	}

	private async loadIssues() {
		if (!this.selectedRepo || !this.plugin.settings.githubToken) {
			new Notice('Please configure GitHub token and select a repository');
			return;
		}

		this.isLoading = true;
		this.updateIssuesList(); // 只更新Issues列表部分，不重新渲染整个视图

		try {
			// 首先尝试从缓存加载
			this.loadIssuesFromCache();
			
			// 如果缓存为空或者用户明确要求刷新，则从服务器同步
			const cache = this.plugin.getRepositoryCache(this.selectedRepo);
			const shouldSync = !cache || cache.issues.length === 0;
			
			if (shouldSync) {
				new Notice('Syncing issues from GitHub...');
				const syncResult = await this.plugin.syncRepository(this.selectedRepo);
				
				if (syncResult && syncResult.success) {
					// 同步成功后，从缓存重新加载
					this.loadIssuesFromCache();
					new Notice(`Loaded ${syncResult.issuesCount || 0} issues from GitHub`);
				} else {
					throw new Error(syncResult?.error || 'Failed to sync repository');
				}
			}
			
			// 异步加载提交数（不阻塞主要显示）
			this.loadCommitCounts();
			
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
		// 同步所有活跃仓库并刷新整个视图
		const refreshBtn = this.containerEl.querySelector('button[aria-label*="Sync all repositories"]') as HTMLButtonElement;
		
		// 禁用按钮并显示加载状态
		if (refreshBtn) {
			refreshBtn.disabled = true;
			refreshBtn.classList.add('is-loading');
		}
		
		new Notice('Syncing all repositories from GitHub...');
		
		try {
			const results = await this.plugin.syncAllRepositories();
			const successCount = Object.values(results).filter(r => r.success).length;
			const totalCount = Object.keys(results).length;
			
			if (totalCount === 0) {
				new Notice('No active repositories to sync');
				return;
			}
			
			if (successCount === totalCount) {
				const totalIssues = Object.values(results).reduce((sum, r) => sum + (r.issuesCount || 0), 0);
				new Notice(`Successfully synced all ${totalCount} repositories (${totalIssues} issues)`);
			} else {
				new Notice(`Synced ${successCount}/${totalCount} repositories. Check console for errors.`);
			}
			
			// 注意：不需要手动调用 refreshData()，因为 syncAllRepositories 完成后会自动调用 refreshIssueViews()
			
		} catch (error) {
			new Notice(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			// 恢复按钮状态
			if (refreshBtn) {
				refreshBtn.disabled = false;
				refreshBtn.classList.remove('is-loading');
			}
		}
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
			expandIcon.removeClass('expanded');
			expandedArea.style.maxHeight = '0';
			expandedArea.empty();
		} else {
			// 展开
			this.expandedIssues.add(issue.id);
			expandIcon.addClass('expanded');
			expandedArea.style.maxHeight = '500px';
			this.renderExpandedContent(expandedArea, issue);
		}
	}

	private renderExpandedContent(container: HTMLElement, issue: GitHubIssue) {
		container.empty();
		
		const content = container.createDiv('issue-expanded-content');

		// Issue 完整标题
		const titleSection = content.createDiv('issue-section');

		titleSection.createEl('h4', { text: 'Title', cls: 'issue-section-header' });

		const titleContent = titleSection.createDiv('issue-section-content');
		titleContent.textContent = issue.title;

		// Issue 描述
		if (issue.body && issue.body.trim()) {
			const descriptionSection = content.createDiv('issue-section');

			descriptionSection.createEl('h4', { text: 'Description', cls: 'issue-section-header' });

			const descContent = descriptionSection.createDiv('issue-description-content');
			
			// 限制描述长度并提供截断
			const maxLength = 500;
			const truncatedBody = issue.body.length > maxLength 
				? issue.body.substring(0, maxLength) + '...' 
				: issue.body;
			descContent.textContent = truncatedBody;
		}

		// 扩展信息
		const metaSection = content.createDiv('issue-section');

		const metaGrid = metaSection.createDiv('issue-meta-grid');

		// 受让人信息
		const assigneeInfo = metaGrid.createDiv('issue-meta-item-detail');
		const assigneeIcon = assigneeInfo.createDiv('issue-meta-icon-detail');
		setIcon(assigneeIcon, 'user-check');
		assigneeInfo.createSpan({ 
			text: issue.assignee ? issue.assignee.login : 'Unassigned' 
		});

		// 更新时间
		const updateInfo = metaGrid.createDiv('issue-meta-item-detail');
		const updateIcon = updateInfo.createDiv('issue-meta-icon-detail');
		setIcon(updateIcon, 'calendar');
		const updatedDate = new Date(issue.updated_at).toLocaleDateString();
		updateInfo.createSpan({ text: `Updated ${updatedDate}` });

		// 评论数详细信息
		const commentsDetailInfo = metaGrid.createDiv('issue-meta-item-detail');
		const commentsDetailIcon = commentsDetailInfo.createDiv('issue-meta-icon-detail');
		setIcon(commentsDetailIcon, 'message-circle');
		commentsDetailInfo.createSpan({ 
			text: `${issue.comments} comment${issue.comments !== 1 ? 's' : ''}` 
		});

		// 提交数详细信息
		const commitsDetailInfo = metaGrid.createDiv('issue-meta-item-detail');
		const commitsDetailIcon = commitsDetailInfo.createDiv('issue-meta-icon-detail');
		setIcon(commitsDetailIcon, 'git-commit');
		// 显示相关提交数
		const commitsText = issue.commits_count !== undefined 
			? `${issue.commits_count} related commit${issue.commits_count !== 1 ? 's' : ''}`
			: 'Related commits: Loading...';
		commitsDetailInfo.createSpan({ text: commitsText });

		// 操作按钮区域
		const actionsSection = content.createDiv('issue-actions');

		// 在浏览器中打开按钮
		const openButton = actionsSection.createEl('button', { cls: 'mod-secondary' });

		const openIcon = openButton.createDiv('issue-action-icon');
		setIcon(openIcon, 'external-link');
		openButton.createSpan({ text: 'Open in GitHub' });
		
		openButton.addEventListener('click', (e) => {
			e.stopPropagation();
			window.open(issue.html_url, '_blank');
		});

		// 创建 Obsidian 笔记按钮
		const createNoteButton = actionsSection.createEl('button', { cls: 'mod-cta' });

		const noteIcon = createNoteButton.createDiv('issue-action-icon');
		setIcon(noteIcon, 'file-plus');
		createNoteButton.createSpan({ text: 'Create Note' });

		createNoteButton.addEventListener('click', (e) => {
			e.stopPropagation();
			this.createIssueNote(issue);
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

	private toggleFilters() {
		this.isFilterExpanded = !this.isFilterExpanded;
		this.renderView();
	}

	private createFilterToolbar(container: Element) {
		const filterContainer = container.createDiv(`filter-toolbar-container ${this.isFilterExpanded ? 'expanded' : 'collapsed'}`);

		if (this.isFilterExpanded) {
			this.renderFilterContent(filterContainer);
		}
	}

	private renderFilterContent(container: Element) {
		const content = container.createDiv('filter-content');
		content.style.cssText = `
			padding: var(--size-4-3);
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: var(--size-4-3);
		`;

		// 标题包含过滤器
		this.createTitleFilter(content);

		// 状态过滤器
		this.createStateFilter(content);

		// 标签过滤器
		this.createLabelFilter(content);

		// 里程碑过滤器
		this.createMilestoneFilter(content);

		// 负责人过滤器
		this.createAssigneeFilter(content);

		// 重置按钮
		this.createFilterActions(content);
	}

	private createTitleFilter(container: Element) {
		const filterGroup = container.createDiv('filter-group');
		filterGroup.style.cssText = `
			display: flex;
			flex-direction: column;
			gap: var(--size-2-1);
		`;

		const label = filterGroup.createEl('label', { text: 'Title Contains' });
		label.style.cssText = `
			font-size: var(--font-ui-small);
			font-weight: var(--font-medium);
			color: var(--text-normal);
		`;

		const input = filterGroup.createEl('input', {
			type: 'text',
			placeholder: 'e.g., [FR], bug, feature...',
			value: this.filters.titleContains
		});
		input.style.cssText = `
			padding: var(--size-2-1) var(--size-2-3);
			border: var(--border-width) solid var(--background-modifier-border);
			border-radius: var(--radius-s);
			background: var(--background-primary);
			color: var(--text-normal);
			font-size: var(--font-ui-small);
		`;

		input.addEventListener('input', (e) => {
			const target = e.target as HTMLInputElement;
			this.filters.titleContains = target.value;
			this.applyFilters();
		});
	}

	private createStateFilter(container: Element) {
		const filterGroup = container.createDiv('filter-group');
		filterGroup.style.cssText = `
			display: flex;
			flex-direction: column;
			gap: var(--size-2-1);
		`;

		const label = filterGroup.createEl('label', { text: 'State' });
		label.style.cssText = `
			font-size: var(--font-ui-small);
			font-weight: var(--font-medium);
			color: var(--text-normal);
		`;

		const select = filterGroup.createEl('select');
		select.style.cssText = `
			padding: var(--size-2-1) var(--size-2-3);
			border: var(--border-width) solid var(--background-modifier-border);
			border-radius: var(--radius-s);
			background: var(--background-primary);
			color: var(--text-normal);
			font-size: var(--font-ui-small);
		`;

		const options = [
			{ value: 'all', text: 'All States' },
			{ value: 'open', text: 'Open' },
			{ value: 'closed', text: 'Closed' }
		];

		options.forEach(option => {
			const optionEl = select.createEl('option', {
				value: option.value,
				text: option.text
			});
			if (option.value === this.filters.selectedState) {
				optionEl.selected = true;
			}
		});

		select.addEventListener('change', (e) => {
			const target = e.target as HTMLSelectElement;
			this.filters.selectedState = target.value as 'all' | 'open' | 'closed';
			this.applyFilters();
		});
	}

	private createLabelFilter(container: Element) {
		const filterGroup = container.createDiv('filter-group');
		filterGroup.style.cssText = `
			display: flex;
			flex-direction: column;
			gap: var(--size-2-1);
		`;

		const label = filterGroup.createEl('label', { text: 'Labels' });
		label.style.cssText = `
			font-size: var(--font-ui-small);
			font-weight: var(--font-medium);
			color: var(--text-normal);
		`;

		const select = filterGroup.createEl('select');
		select.style.cssText = `
			padding: var(--size-2-1) var(--size-2-3);
			border: var(--border-width) solid var(--background-modifier-border);
			border-radius: var(--radius-s);
			background: var(--background-primary);
			color: var(--text-normal);
			font-size: var(--font-ui-small);
		`;

		const allOption = select.createEl('option', {
			value: 'all',
			text: 'All Labels'
		});
		if (this.filters.selectedLabels.length === 0) {
			allOption.selected = true;
		}

		this.availableLabels.forEach(labelName => {
			const option = select.createEl('option', {
				value: labelName,
				text: labelName
			});
			if (this.filters.selectedLabels.includes(labelName)) {
				option.selected = true;
			}
		});

		select.addEventListener('change', (e) => {
			const target = e.target as HTMLSelectElement;
			if (target.value === 'all') {
				this.filters.selectedLabels = [];
			} else {
				this.filters.selectedLabels = [target.value];
			}
			this.applyFilters();
		});
	}

	private createMilestoneFilter(container: Element) {
		const filterGroup = container.createDiv('filter-group');
		filterGroup.style.cssText = `
			display: flex;
			flex-direction: column;
			gap: var(--size-2-1);
		`;

		const label = filterGroup.createEl('label', { text: 'Milestone' });
		label.style.cssText = `
			font-size: var(--font-ui-small);
			font-weight: var(--font-medium);
			color: var(--text-normal);
		`;

		const select = filterGroup.createEl('select');
		select.style.cssText = `
			padding: var(--size-2-1) var(--size-2-3);
			border: var(--border-width) solid var(--background-modifier-border);
			border-radius: var(--radius-s);
			background: var(--background-primary);
			color: var(--text-normal);
			font-size: var(--font-ui-small);
		`;

		const allOption = select.createEl('option', {
			value: 'all',
			text: 'All Milestones'
		});
		if (this.filters.selectedMilestone === 'all') {
			allOption.selected = true;
		}

		const noneOption = select.createEl('option', {
			value: 'none',
			text: 'No Milestone'
		});
		if (this.filters.selectedMilestone === 'none') {
			noneOption.selected = true;
		}

		this.availableMilestones.forEach(milestone => {
			const option = select.createEl('option', {
				value: milestone,
				text: milestone
			});
			if (milestone === this.filters.selectedMilestone) {
				option.selected = true;
			}
		});

		select.addEventListener('change', (e) => {
			const target = e.target as HTMLSelectElement;
			this.filters.selectedMilestone = target.value;
			this.applyFilters();
		});
	}

	private createAssigneeFilter(container: Element) {
		const filterGroup = container.createDiv('filter-group');
		filterGroup.style.cssText = `
			display: flex;
			flex-direction: column;
			gap: var(--size-2-1);
		`;

		const label = filterGroup.createEl('label', { text: 'Assignee' });
		label.style.cssText = `
			font-size: var(--font-ui-small);
			font-weight: var(--font-medium);
			color: var(--text-normal);
		`;

		const select = filterGroup.createEl('select');
		select.style.cssText = `
			padding: var(--size-2-1) var(--size-2-3);
			border: var(--border-width) solid var(--background-modifier-border);
			border-radius: var(--radius-s);
			background: var(--background-primary);
			color: var(--text-normal);
			font-size: var(--font-ui-small);
		`;

		const allOption = select.createEl('option', {
			value: 'all',
			text: 'All Assignees'
		});
		if (this.filters.selectedAssignee === 'all') {
			allOption.selected = true;
		}

		const unassignedOption = select.createEl('option', {
			value: 'unassigned',
			text: 'Unassigned'
		});
		if (this.filters.selectedAssignee === 'unassigned') {
			unassignedOption.selected = true;
		}

		this.availableAssignees.forEach(assignee => {
			const option = select.createEl('option', {
				value: assignee,
				text: assignee
			});
			if (assignee === this.filters.selectedAssignee) {
				option.selected = true;
			}
		});

		select.addEventListener('change', (e) => {
			const target = e.target as HTMLSelectElement;
			this.filters.selectedAssignee = target.value;
			this.applyFilters();
		});
	}

	private createFilterActions(container: Element) {
		const filterGroup = container.createDiv('filter-group');
		filterGroup.style.cssText = `
			display: flex;
			flex-direction: column;
			gap: var(--size-2-1);
			justify-content: flex-end;
		`;

		const resetBtn = filterGroup.createEl('button', { 
			text: 'Reset Filters',
			cls: 'mod-cta'
		});

		resetBtn.addEventListener('click', () => {
			this.resetFilters();
		});
	}

	private applyFilters() {
		this.filteredIssues = this.issues.filter(issue => {
			// 标题包含过滤
			if (this.filters.titleContains && 
				!issue.title.toLowerCase().includes(this.filters.titleContains.toLowerCase())) {
				return false;
			}

			// 状态过滤
			if (this.filters.selectedState !== 'all' && issue.state !== this.filters.selectedState) {
				return false;
			}

			// 标签过滤
			if (this.filters.selectedLabels.length > 0) {
				const issueLabels = issue.labels.map(label => label.name);
				const hasSelectedLabel = this.filters.selectedLabels.some(selectedLabel => 
					issueLabels.includes(selectedLabel)
				);
				if (!hasSelectedLabel) {
					return false;
				}
			}

			// 里程碑过滤
			if (this.filters.selectedMilestone !== 'all') {
				if (this.filters.selectedMilestone === 'none') {
					if (issue.milestone) {
						return false;
					}
				} else {
					if (!issue.milestone || issue.milestone.title !== this.filters.selectedMilestone) {
						return false;
					}
				}
			}

			// 负责人过滤
			if (this.filters.selectedAssignee !== 'all') {
				if (this.filters.selectedAssignee === 'unassigned') {
					if (issue.assignee) {
						return false;
					}
				} else {
					if (!issue.assignee || issue.assignee.login !== this.filters.selectedAssignee) {
						return false;
					}
				}
			}

			return true;
		});

		this.updateIssuesList();
	}

	private resetFilters() {
		this.filters = {
			titleContains: '',
			selectedLabels: [],
			selectedMilestone: 'all',
			selectedAssignee: 'all',
			selectedState: 'open' // 重置时也保持显示Open状态
		};
		this.filteredIssues = [...this.issues];
		this.renderView();
	}

	private hasActiveFilters(): boolean {
		return this.filters.titleContains !== '' ||
			this.filters.selectedLabels.length > 0 ||
			this.filters.selectedMilestone !== 'all' ||
			this.filters.selectedAssignee !== 'all' ||
			this.filters.selectedState !== 'open'; // 更新判断条件，现在默认是'open'
	}

	private extractFilterData() {
		// 提取可用的标签
		const labelsSet = new Set<string>();
		this.issues.forEach(issue => {
			issue.labels.forEach(label => {
				labelsSet.add(label.name);
			});
		});
		this.availableLabels = Array.from(labelsSet).sort();

		// 提取可用的里程碑
		const milestonesSet = new Set<string>();
		this.issues.forEach(issue => {
			if (issue.milestone) {
				milestonesSet.add(issue.milestone.title);
			}
		});
		this.availableMilestones = Array.from(milestonesSet).sort();

		// 提取可用的负责人
		const assigneesSet = new Set<string>();
		this.issues.forEach(issue => {
			if (issue.assignee) {
				assigneesSet.add(issue.assignee.login);
			}
		});
		this.availableAssignees = Array.from(assigneesSet).sort();
	}

	private async fetchIssueCommits(issue: GitHubIssue): Promise<number> {
		if (!this.plugin.settings.githubToken || !issue.repository) {
			return 0;
		}

		try {
			// 搜索包含Issue编号的提交
			const searchQuery = `repo:${issue.repository.owner}/${issue.repository.name} #${issue.number}`;
			const response = await fetch(`https://api.github.com/search/commits?q=${encodeURIComponent(searchQuery)}`, {
				headers: {
					'Authorization': `Bearer ${this.plugin.settings.githubToken}`,
					'Accept': 'application/vnd.github.v3+json',
					'User-Agent': 'Obsidian-GitHub-Projects'
				}
			});

			if (!response.ok) {
				console.warn(`Failed to fetch commits for issue #${issue.number}`);
				return 0;
			}

			const data = await response.json();
			return data.total_count || 0;
		} catch (error) {
			console.warn(`Error fetching commits for issue #${issue.number}:`, error);
			return 0;
		}
	}

	private async loadCommitCounts() {
		if (this.issues.length === 0) return;

		// 为前10个Issue异步加载提交数（避免API限制）
		const issuesToProcess = this.issues.slice(0, 10);
		
		for (const issue of issuesToProcess) {
			try {
				const commitsCount = await this.fetchIssueCommits(issue);
				issue.commits_count = commitsCount;
			} catch (error) {
				console.warn(`Failed to load commits for issue #${issue.number}`, error);
				issue.commits_count = 0;
			}
		}

		// 更新显示
		this.updateIssuesList();
	}

	/**
	 * 从缓存刷新数据（当数据同步完成时调用）
	 */
	refreshData() {
		// 更新仓库选择器状态
		this.updateRepositorySelector();
		
		if (this.selectedRepo) {
			this.loadIssuesFromCache();
		}
	}

	/**
	 * 从本地缓存加载 Issues
	 */
	private loadIssuesFromCache() {
		if (!this.selectedRepo) {
			this.issues = [];
			this.filteredIssues = [];
			this.updateIssuesList();
			return;
		}

		const cache = this.plugin.getRepositoryCache(this.selectedRepo);
		if (cache && cache.issues) {
			this.issues = cache.issues;
			this.extractFilterData();
			this.applyFilters();
		} else {
			this.issues = [];
			this.filteredIssues = [];
		}
		
		this.updateIssuesList();
	}

	/**
	 * 更新仓库选择器的选中状态
	 */
	private updateRepositorySelector() {
		const select = this.containerEl.querySelector('.repo-select') as HTMLSelectElement;
		if (select) {
			if (this.selectedRepo) {
				select.value = this.selectedRepo;
			} else {
				// 如果没有选中的仓库，确保选择器显示默认的不可选选项
				select.value = '';
			}
		}
	}
}
