import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import GithubProjectsPlugin from '../main';
import { GitHubIssue } from './issueView';

export const WORKBENCH_VIEW_TYPE = 'github-workbench-view';

/**
 * Issue 在工作台中的状态
 */
export type IssueWorkbenchStatus = 'inbox' | 'draft' | 'linked' | 'archived';

/**
 * 工作台中的 Issue 数据结构
 */
export interface WorkbenchIssue extends GitHubIssue {
	workbenchStatus: IssueWorkbenchStatus;
	draftFile?: string; // 本地草稿文件路径
	linkedNotes?: string[]; // 关联的笔记文件路径
	lastLocalUpdate?: string; // 最后本地更新时间
}

/**
 * 本地上下文信息
 */
export interface LocalContext {
	linkedNotes: Array<{
		path: string;
		title: string;
		linkType: 'explicit' | 'implicit'; // 显式链接或隐式引用
	}>;
	localReferences: Array<{
		type: 'obsidian-link' | 'file-attachment';
		path: string;
		description: string;
	}>;
	relatedTasks: Array<{
		file: string;
		line: number;
		task: string;
		isCompleted: boolean;
	}>;
}

/**
 * GitHub Issue Workbench - 主工作区视图
 * 提供三面板布局：智能队列 + 核心编辑区 + 本地上下文
 */
export class IssueWorkbenchView extends ItemView {
	plugin: GithubProjectsPlugin;
	private workbenchIssues: WorkbenchIssue[] = [];
	private selectedIssue: WorkbenchIssue | null = null;
	private selectedRepo = '';
	private isLoading = false;

	// UI 元素引用
	private queueContainer: HTMLElement;
	private editorContainer: HTMLElement;
	private contextContainer: HTMLElement;

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

	private renderView() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('github-workbench-view');

		// 创建主布局容器
		const mainLayout = container.createDiv('workbench-main-layout');

		// 面板一：智能队列 (左侧)
		this.queueContainer = mainLayout.createDiv('workbench-queue-panel');
		this.renderQueuePanel();

		// 面板二：核心编辑区 (中心)
		this.editorContainer = mainLayout.createDiv('workbench-editor-panel');
		this.renderEditorPanel();

		// 面板三：本地上下文 (右侧)
		this.contextContainer = mainLayout.createDiv('workbench-context-panel');
		this.renderContextPanel();
	}

	/**
	 * 渲染智能队列面板
	 */
	private renderQueuePanel() {
		this.queueContainer.empty();

		// 队列标题和操作
		const queueHeader = this.queueContainer.createDiv('queue-header');
		queueHeader.createEl('h3', { text: 'Smart Queue', cls: 'queue-title' });

		const queueActions = queueHeader.createDiv('queue-actions');
		
		// 刷新按钮
		const refreshBtn = queueActions.createEl('button', { 
			cls: 'clickable-icon-button',
			attr: { 'aria-label': 'Refresh issues' }
		});
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.addEventListener('click', () => this.refreshWorkbenchData());

		// 新建 Issue 按钮
		const newIssueBtn = queueActions.createEl('button', { 
			cls: 'clickable-icon-button',
			attr: { 'aria-label': 'Create new issue draft' }
		});
		setIcon(newIssueBtn, 'plus');
		newIssueBtn.addEventListener('click', () => this.createNewIssueDraft());

		// 仓库选择器
		this.renderRepositorySelector();

		// 分组列表
		this.renderGroupedIssues();
	}

	/**
	 * 渲染仓库选择器
	 */
	private renderRepositorySelector() {
		const selectorContainer = this.queueContainer.createDiv('repo-selector-container');

		const iconContainer = selectorContainer.createDiv('repo-icon-container');
		setIcon(iconContainer, 'folder-git-2');

		const select = selectorContainer.createEl('select', { cls: 'repo-select' });

		// 添加默认选项
		select.createEl('option', { 
			text: 'All repositories',
			value: ''
		});

		// 填充仓库选项
		const activeRepositories = this.plugin.getActiveRepositories();
		activeRepositories.forEach(repo => {
			const repoKey = `${repo.owner}/${repo.repo}`;
			select.createEl('option', {
				text: `${repo.owner}/${repo.repo}`,
				value: repoKey
			});
		});

		select.value = this.selectedRepo;
		select.addEventListener('change', (e) => {
			this.selectedRepo = (e.target as HTMLSelectElement).value;
			this.renderGroupedIssues();
		});
	}

	/**
	 * 渲染分组的 Issue 列表
	 */
	private renderGroupedIssues() {
		// 清除现有的分组列表
		const existingGroups = this.queueContainer.querySelector('.grouped-issues');
		if (existingGroups) {
			existingGroups.remove();
		}

		const groupedContainer = this.queueContainer.createDiv('grouped-issues');

		// 按状态分组
		const groups = this.groupIssuesByStatus();

		// 渲染各个分组
		this.renderIssueGroup(groupedContainer, 'inbox', '📥 未处理', groups.inbox);
		this.renderIssueGroup(groupedContainer, 'draft', '📝 起草中', groups.draft);
		this.renderIssueGroup(groupedContainer, 'linked', '🔗 已链接', groups.linked);
		this.renderIssueGroup(groupedContainer, 'archived', '📦 归档', groups.archived);
	}

	/**
	 * 按状态分组 Issues
	 */
	private groupIssuesByStatus() {
		const filteredIssues = this.selectedRepo ? 
			this.workbenchIssues.filter(issue => 
				issue.repository && `${issue.repository.owner}/${issue.repository.name}` === this.selectedRepo
			) : this.workbenchIssues;

		return {
			inbox: filteredIssues.filter(issue => issue.workbenchStatus === 'inbox'),
			draft: filteredIssues.filter(issue => issue.workbenchStatus === 'draft'),
			linked: filteredIssues.filter(issue => issue.workbenchStatus === 'linked'),
			archived: filteredIssues.filter(issue => issue.workbenchStatus === 'archived')
		};
	}

	/**
	 * 渲染单个 Issue 分组
	 */
	private renderIssueGroup(
		container: HTMLElement, 
		groupId: string, 
		title: string, 
		issues: WorkbenchIssue[]
	) {
		const groupContainer = container.createDiv(`issue-group issue-group-${groupId}`);

		// 分组标题
		const groupHeader = groupContainer.createDiv('issue-group-header');
		groupHeader.createSpan({ text: `${title} (${issues.length})` });

		// 分组内容（可折叠）
		const groupContent = groupContainer.createDiv('issue-group-content');

		if (issues.length === 0) {
			const emptyState = groupContent.createDiv('group-empty-state');
			emptyState.createSpan({ 
				text: groupId === 'draft' ? 'No drafts yet' : 'No issues',
				cls: 'empty-text'
			});
		} else {
			issues.forEach(issue => {
				this.renderIssueItem(groupContent, issue);
			});
		}

		// 添加折叠功能
		groupHeader.addEventListener('click', () => {
			groupContent.toggleClass('collapsed', !groupContent.hasClass('collapsed'));
		});
	}

	/**
	 * 渲染单个 Issue 项目
	 */
	private renderIssueItem(container: HTMLElement, issue: WorkbenchIssue) {
		const itemContainer = container.createDiv('queue-issue-item');
		
		if (this.selectedIssue?.id === issue.id) {
			itemContainer.addClass('selected');
		}

		// Issue 状态图标
		const statusIcon = itemContainer.createDiv('issue-status-icon');
		setIcon(statusIcon, issue.state === 'open' ? 'circle-dot' : 'check-circle');
		statusIcon.addClass(issue.state);

		// Issue 信息
		const issueInfo = itemContainer.createDiv('issue-info');
		
		issueInfo.createSpan({ 
			text: issue.title,
			cls: 'issue-title'
		});

		const metaSpan = issueInfo.createDiv('issue-meta');
		metaSpan.createSpan({ 
			text: `#${issue.number}`,
			cls: 'issue-number'
		});

		if (issue.repository) {
			metaSpan.createSpan({ 
				text: ` • ${issue.repository.owner}/${issue.repository.name}`,
				cls: 'issue-repo'
			});
		}

		// 草稿状态指示器
		if (issue.workbenchStatus === 'draft' && issue.draftFile) {
			const draftIndicator = itemContainer.createDiv('draft-indicator');
			setIcon(draftIndicator, 'edit-3');
		}

		// 点击选择
		itemContainer.addEventListener('click', () => {
			this.selectIssue(issue);
		});
	}

	/**
	 * 渲染核心编辑区面板
	 */
	private renderEditorPanel() {
		this.editorContainer.empty();

		if (!this.selectedIssue) {
			this.renderEditorEmptyState();
			return;
		}

		if (this.selectedIssue.workbenchStatus === 'draft') {
			this.renderDraftEditor();
		} else {
			this.renderIssueViewer();
		}
	}

	/**
	 * 渲染编辑区空状态
	 */
	private renderEditorEmptyState() {
		const emptyState = this.editorContainer.createDiv('editor-empty-state');
		
		const emptyContent = emptyState.createDiv('empty-content');
		
		const iconDiv = emptyContent.createDiv('empty-icon');
		setIcon(iconDiv, 'layout-dashboard');
		
		emptyContent.createEl('h3', { text: 'Welcome to GitHub Workbench' });
		emptyContent.createEl('p', { 
			text: 'Select an issue from the queue to start working, or create a new draft.'
		});
		
		const createButton = emptyContent.createEl('button', {
			text: 'Create New Issue Draft',
			cls: 'mod-cta'
		});
		createButton.addEventListener('click', () => this.createNewIssueDraft());
	}

	/**
	 * 渲染草稿编辑器
	 */
	private renderDraftEditor() {
		if (!this.selectedIssue) return;

		const editorHeader = this.editorContainer.createDiv('editor-header');
		editorHeader.createEl('h2', { text: 'Draft Editor' });

		// 元数据面板
		this.renderMetadataPanel();

		// Markdown 编辑器区域
		this.renderMarkdownEditor();

		// 操作按钮
		this.renderDraftActions();
	}

	/**
	 * 渲染元数据面板
	 */
	private renderMetadataPanel() {
		if (!this.selectedIssue) return;

		const metadataPanel = this.editorContainer.createDiv('metadata-panel');
		
		// 标题输入
		const titleGroup = metadataPanel.createDiv('metadata-group');
		titleGroup.createEl('label', { text: 'Title' });
		const titleInput = titleGroup.createEl('input', { 
			type: 'text',
			value: this.selectedIssue.title,
			cls: 'metadata-input'
		});
		titleInput.addEventListener('input', (e) => {
			if (this.selectedIssue) {
				this.selectedIssue.title = (e.target as HTMLInputElement).value;
			}
		});

		// 仓库选择
		const repoGroup = metadataPanel.createDiv('metadata-group');
		repoGroup.createEl('label', { text: 'Repository' });
		const repoSelect = repoGroup.createEl('select', { cls: 'metadata-select' });
		
		const activeRepositories = this.plugin.getActiveRepositories();
		activeRepositories.forEach(repo => {
			const repoKey = `${repo.owner}/${repo.repo}`;
			const option = repoSelect.createEl('option', {
				text: repoKey,
				value: repoKey
			});
			
			if (this.selectedIssue?.repository && 
				`${this.selectedIssue.repository.owner}/${this.selectedIssue.repository.name}` === repoKey) {
				option.selected = true;
			}
		});

		// 标签输入（简化版，之后可以改进为多选）
		const labelsGroup = metadataPanel.createDiv('metadata-group');
		labelsGroup.createEl('label', { text: 'Labels (comma-separated)' });
		labelsGroup.createEl('input', { 
			type: 'text',
			value: this.selectedIssue.labels.map(l => l.name).join(', '),
			cls: 'metadata-input'
		});
	}

	/**
	 * 渲染 Markdown 编辑器
	 */
	private renderMarkdownEditor() {
		const editorArea = this.editorContainer.createDiv('markdown-editor-area');
		
		const editorHeader = editorArea.createDiv('editor-toolbar');
		editorHeader.createEl('h4', { text: 'Content' });

		// 工具栏按钮
		const toolbar = editorHeader.createDiv('editor-toolbar-buttons');
		
		// 引用本地笔记按钮
		const linkNotesBtn = toolbar.createEl('button', {
			cls: 'clickable-icon-button',
			attr: { 'aria-label': 'Link local notes' }
		});
		setIcon(linkNotesBtn, 'link');
		linkNotesBtn.addEventListener('click', () => this.insertLocalNoteLink());

		// 使用模板按钮
		const templateBtn = toolbar.createEl('button', {
			cls: 'clickable-icon-button',
			attr: { 'aria-label': 'Use template' }
		});
		setIcon(templateBtn, 'file-text');
		templateBtn.addEventListener('click', () => this.useTemplate());

		// Markdown 文本区域
		const textArea = editorArea.createEl('textarea', {
			cls: 'markdown-editor',
			value: this.selectedIssue?.body || ''
		});
		textArea.placeholder = 'Write your issue description in Markdown...';
		
		textArea.addEventListener('input', (e) => {
			if (this.selectedIssue) {
				this.selectedIssue.body = (e.target as HTMLTextAreaElement).value;
			}
		});
	}

	/**
	 * 渲染草稿操作按钮
	 */
	private renderDraftActions() {
		const actionsPanel = this.editorContainer.createDiv('draft-actions-panel');
		
		// 推送到 GitHub 按钮
		const publishBtn = actionsPanel.createEl('button', {
			text: 'Publish to GitHub',
			cls: 'mod-cta'
		});
		setIcon(publishBtn, 'upload');
		publishBtn.addEventListener('click', () => this.publishDraftToGitHub());

		// 保存草稿按钮
		const saveDraftBtn = actionsPanel.createEl('button', {
			text: 'Save Draft',
			cls: 'mod-secondary'
		});
		setIcon(saveDraftBtn, 'save');
		saveDraftBtn.addEventListener('click', () => this.saveDraftLocally());

		// 删除草稿按钮
		const deleteBtn = actionsPanel.createEl('button', {
			text: 'Delete Draft',
			cls: 'mod-warning'
		});
		setIcon(deleteBtn, 'trash-2');
		deleteBtn.addEventListener('click', () => this.deleteDraft());
	}

	/**
	 * 渲染 Issue 查看器（非草稿状态）
	 */
	private renderIssueViewer() {
		if (!this.selectedIssue) return;

		const viewerHeader = this.editorContainer.createDiv('viewer-header');
		
		// 标题和状态
		const titleSection = viewerHeader.createDiv('viewer-title-section');
		titleSection.createEl('h2', { text: this.selectedIssue.title });
		
		const statusBadge = titleSection.createDiv(`issue-status-badge ${this.selectedIssue.state}`);
		statusBadge.createSpan({ text: this.selectedIssue.state.toUpperCase() });

		// 元信息
		const metaSection = viewerHeader.createDiv('viewer-meta-section');
		metaSection.createSpan({ 
			text: `#${this.selectedIssue.number} • opened by ${this.selectedIssue.user.login}`,
			cls: 'issue-meta-text'
		});

		// 标签
		if (this.selectedIssue.labels.length > 0) {
			const labelsContainer = viewerHeader.createDiv('viewer-labels');
			this.selectedIssue.labels.forEach(label => {
				const labelElement = labelsContainer.createSpan({
					text: label.name,
					cls: 'issue-label'
				});
				labelElement.style.backgroundColor = `#${label.color}`;
			});
		}

		// 内容区域
		const contentArea = this.editorContainer.createDiv('viewer-content-area');
		
		// 渲染 Markdown 内容
		const contentDiv = contentArea.createDiv('issue-content');
		// 这里简化处理，实际应该使用 Obsidian 的 Markdown 渲染器
		contentDiv.createEl('div', { text: this.selectedIssue.body });

		// 操作按钮
		this.renderViewerActions();
	}

	/**
	 * 渲染查看器操作按钮
	 */
	private renderViewerActions() {
		const actionsPanel = this.editorContainer.createDiv('viewer-actions-panel');
		
		// 创建关联笔记按钮
		const createNoteBtn = actionsPanel.createEl('button', {
			text: 'Create Note',
			cls: 'mod-cta'
		});
		setIcon(createNoteBtn, 'file-plus');
		createNoteBtn.addEventListener('click', () => this.createLinkedNote());

		// 起草回复按钮
		const replyBtn = actionsPanel.createEl('button', {
			text: 'Draft Reply',
			cls: 'mod-secondary'
		});
		setIcon(replyBtn, 'message-circle');
		replyBtn.addEventListener('click', () => this.draftReply());

		// 在浏览器中打开按钮
		const openBtn = actionsPanel.createEl('button', {
			text: 'Open in Browser',
			cls: 'mod-secondary'
		});
		setIcon(openBtn, 'external-link');
		openBtn.addEventListener('click', () => {
			if (this.selectedIssue) {
				window.open(this.selectedIssue.html_url, '_blank');
			}
		});
	}

	/**
	 * 渲染本地上下文面板
	 */
	private renderContextPanel() {
		this.contextContainer.empty();

		if (!this.selectedIssue) {
			const emptyState = this.contextContainer.createDiv('context-empty-state');
			emptyState.createEl('p', { 
				text: 'Select an issue to see its local context',
				cls: 'empty-text'
			});
			return;
		}

		const contextHeader = this.contextContainer.createDiv('context-header');
		contextHeader.createEl('h3', { text: 'Local Context' });

		// 获取并渲染本地上下文
		this.renderLocalContext();
	}

	/**
	 * 渲染本地上下文内容
	 */
	private async renderLocalContext() {
		if (!this.selectedIssue) return;

		const context = await this.getLocalContext(this.selectedIssue);

		// 关联笔记部分
		this.renderLinkedNotesSection(context.linkedNotes);

		// 本地引用部分
		this.renderLocalReferencesSection(context.localReferences);

		// 相关任务部分
		this.renderRelatedTasksSection(context.relatedTasks);
	}

	/**
	 * 渲染关联笔记部分
	 */
	private renderLinkedNotesSection(linkedNotes: LocalContext['linkedNotes']) {
		const section = this.contextContainer.createDiv('context-section');
		
		const sectionHeader = section.createDiv('context-section-header');
		sectionHeader.createEl('h4', { text: `🔗 Linked Notes (${linkedNotes.length})` });

		const sectionContent = section.createDiv('context-section-content');

		if (linkedNotes.length === 0) {
			sectionContent.createEl('p', { 
				text: 'No linked notes found',
				cls: 'empty-text'
			});
		} else {
			linkedNotes.forEach(note => {
				const noteItem = sectionContent.createDiv('context-item');
				noteItem.createSpan({ 
					text: note.title,
					cls: 'context-item-title'
				});
				noteItem.createSpan({ 
					text: ` (${note.linkType})`,
					cls: 'context-item-meta'
				});

				noteItem.addEventListener('click', () => {
					// 打开笔记文件
					this.app.workspace.openLinkText(note.path, '');
				});
			});
		}
	}

	/**
	 * 渲染本地引用部分
	 */
	private renderLocalReferencesSection(localReferences: LocalContext['localReferences']) {
		const section = this.contextContainer.createDiv('context-section');
		
		const sectionHeader = section.createDiv('context-section-header');
		sectionHeader.createEl('h4', { text: `📄 Local References (${localReferences.length})` });

		const sectionContent = section.createDiv('context-section-content');

		if (localReferences.length === 0) {
			sectionContent.createEl('p', { 
				text: 'No local references found',
				cls: 'empty-text'
			});
		} else {
			localReferences.forEach(ref => {
				const refItem = sectionContent.createDiv('context-item');
				refItem.createSpan({ 
					text: ref.description,
					cls: 'context-item-title'
				});
				refItem.createSpan({ 
					text: ` (${ref.type})`,
					cls: 'context-item-meta'
				});

				refItem.addEventListener('click', () => {
					// 打开文件引用
					if (ref.type === 'obsidian-link') {
						this.app.workspace.openLinkText(ref.path, '');
					}
				});
			});
		}
	}

	/**
	 * 渲染相关任务部分
	 */
	private renderRelatedTasksSection(relatedTasks: LocalContext['relatedTasks']) {
		const section = this.contextContainer.createDiv('context-section');
		
		const sectionHeader = section.createDiv('context-section-header');
		sectionHeader.createEl('h4', { text: `✅ Related Tasks (${relatedTasks.length})` });

		const sectionContent = section.createDiv('context-section-content');

		if (relatedTasks.length === 0) {
			sectionContent.createEl('p', { 
				text: 'No related tasks found',
				cls: 'empty-text'
			});
		} else {
			relatedTasks.forEach(task => {
				const taskItem = sectionContent.createDiv('context-item');
				
				const checkbox = taskItem.createEl('input', { type: 'checkbox' });
				checkbox.checked = task.isCompleted;
				checkbox.addEventListener('change', () => {
					// 处理任务状态变更
					this.toggleTaskStatus(task);
				});

				taskItem.createSpan({ 
					text: task.task,
					cls: task.isCompleted ? 'context-item-title completed' : 'context-item-title'
				});
				taskItem.createSpan({ 
					text: ` (${task.file}:${task.line})`,
					cls: 'context-item-meta'
				});

				taskItem.addEventListener('click', (e) => {
					if (e.target !== checkbox) {
						// 跳转到任务所在位置
						this.app.workspace.openLinkText(`${task.file}#L${task.line}`, '');
					}
				});
			});
		}
	}

	// ===== 数据操作方法 =====

	/**
	 * 加载工作台数据
	 */
	private async loadWorkbenchData() {
		this.isLoading = true;
		
		try {
			// 从现有的 Issue 数据转换为工作台格式
			const issueView = this.app.workspace.getLeavesOfType('github-issues-view')[0]?.view;
			if (issueView && 'issues' in issueView) {
				// 获取 issues 数据，先转换为 unknown 再转换为目标类型
				const issues = (issueView as unknown as { issues: GitHubIssue[] }).issues;
				
				this.workbenchIssues = issues.map(issue => ({
					...issue,
					workbenchStatus: this.determineIssueStatus(issue),
					draftFile: undefined,
					linkedNotes: [],
					lastLocalUpdate: undefined
				}));
			}

			this.renderGroupedIssues();
		} catch (error) {
			console.error('Failed to load workbench data:', error);
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * 刷新工作台数据
	 */
	private async refreshWorkbenchData() {
		await this.plugin.syncAllRepositories();
		await this.loadWorkbenchData();
	}

	/**
	 * 确定 Issue 的工作台状态
	 */
	private determineIssueStatus(issue: GitHubIssue): IssueWorkbenchStatus {
		// 简化的状态判断逻辑，后续需要基于实际的本地数据
		
		// 检查是否有草稿文件
		// TODO: 实现草稿文件检查逻辑
		
		// 检查是否有关联笔记
		// TODO: 实现关联笔记检查逻辑
		
		// 默认为 inbox 状态
		return 'inbox';
	}

	/**
	 * 选择一个 Issue
	 */
	private selectIssue(issue: WorkbenchIssue) {
		this.selectedIssue = issue;
		
		// 更新队列中的选中状态
		this.queueContainer.querySelectorAll('.queue-issue-item').forEach(item => {
			item.removeClass('selected');
		});
		
		this.queueContainer.querySelectorAll('.queue-issue-item').forEach(item => {
			const titleElement = item.querySelector('.issue-title');
			if (titleElement?.textContent === issue.title) {
				item.addClass('selected');
			}
		});

		// 重新渲染编辑区和上下文面板
		this.renderEditorPanel();
		this.renderContextPanel();
	}

	/**
	 * 获取 Issue 的本地上下文
	 */
	private async getLocalContext(issue: WorkbenchIssue): Promise<LocalContext> {
		// TODO: 实现实际的本地上下文搜索逻辑
		
		return {
			linkedNotes: [],
			localReferences: [],
			relatedTasks: []
		};
	}

	// ===== 操作方法 =====

	/**
	 * 创建新的 Issue 草稿
	 */
	private async createNewIssueDraft() {
		// TODO: 实现创建新草稿的逻辑
		console.log('Create new issue draft');
	}

	/**
	 * 插入本地笔记链接
	 */
	private insertLocalNoteLink() {
		// TODO: 实现插入本地笔记链接的逻辑
		console.log('Insert local note link');
	}

	/**
	 * 使用模板
	 */
	private useTemplate() {
		// TODO: 实现使用模板的逻辑
		console.log('Use template');
	}

	/**
	 * 发布草稿到 GitHub
	 */
	private async publishDraftToGitHub() {
		// TODO: 实现发布草稿的逻辑
		console.log('Publish draft to GitHub');
	}

	/**
	 * 本地保存草稿
	 */
	private async saveDraftLocally() {
		// TODO: 实现本地保存草稿的逻辑
		console.log('Save draft locally');
	}

	/**
	 * 删除草稿
	 */
	private async deleteDraft() {
		// TODO: 实现删除草稿的逻辑
		console.log('Delete draft');
	}

	/**
	 * 创建关联笔记
	 */
	private async createLinkedNote() {
		// TODO: 实现创建关联笔记的逻辑
		console.log('Create linked note');
	}

	/**
	 * 起草回复
	 */
	private draftReply() {
		// TODO: 实现起草回复的逻辑
		console.log('Draft reply');
	}

	/**
	 * 切换任务状态
	 */
	private async toggleTaskStatus(task: LocalContext['relatedTasks'][0]) {
		// TODO: 实现切换任务状态的逻辑
		console.log('Toggle task status:', task);
	}

	/**
	 * 从缓存刷新数据（当数据同步完成时调用）
	 */
	refreshData() {
		this.loadWorkbenchData();
	}
}
