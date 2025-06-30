import { App, PluginSettingTab, Setting } from 'obsidian';
import type GithubProjectsPlugin from '../main';

export interface GithubRepository {
	name: string; // 显示名称
	owner: string; // GitHub用户名或组织名
	repo: string; // 仓库名
	isDefault: boolean; // 是否为默认仓库
}

export interface GithubProjectsSettings {
	githubToken: string;
	repositories: GithubRepository[]; // 多仓库列表
	autoSync: boolean;
	syncInterval: number; // in minutes
}

export const DEFAULT_SETTINGS: GithubProjectsSettings = {
	githubToken: '',
	repositories: [],
	autoSync: false,
	syncInterval: 5
}

export class GithubProjectsSettingTab extends PluginSettingTab {
	plugin: GithubProjectsPlugin;
	private activeTab = 'basic';

	constructor(app: App, plugin: GithubProjectsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		// 创建标签页导航
		const tabNav = containerEl.createDiv();
		tabNav.style.marginBottom = '20px';
		tabNav.style.borderBottom = '1px solid var(--background-modifier-border)';

		const tabs = [
			{ id: 'basic', name: 'Basic Settings' },
			{ id: 'repositories', name: 'Repositories' },
			{ id: 'sync', name: 'Sync Options' }
		];

		tabs.forEach(tab => {
			const tabButton = tabNav.createEl('button', { text: tab.name });
			tabButton.style.padding = '10px 20px';
			tabButton.style.margin = '0 5px 0 0';
			tabButton.style.border = 'none';
			tabButton.style.backgroundColor = this.activeTab === tab.id ? 'var(--interactive-accent)' : 'transparent';
			tabButton.style.color = this.activeTab === tab.id ? 'var(--text-on-accent)' : 'var(--text-normal)';
			tabButton.style.cursor = 'pointer';
			tabButton.style.borderRadius = '5px 5px 0 0';

			tabButton.addEventListener('click', () => {
				this.activeTab = tab.id;
				this.display();
			});
		});

		// 显示对应的标签页内容
		this.displayTabContent(containerEl);
	}

	private displayTabContent(containerEl: HTMLElement): void {
		switch (this.activeTab) {
			case 'basic':
				this.displayBasicSettings(containerEl);
				break;
			case 'repositories':
				this.displayRepositorySettings(containerEl);
				break;
			case 'sync':
				this.displaySyncSettings(containerEl);
				break;
		}
	}

	private displayBasicSettings(containerEl: HTMLElement): void {
		// GitHub Token 设置
		new Setting(containerEl)
			.setName('GitHub Personal Access Token')
			.setDesc('Enter your GitHub personal access token.')
			.addText(text => text
				.setPlaceholder('ghp_xxxxxxxxxxxxxxxxxxxx')
				.setValue(this.plugin.settings.githubToken)
				.onChange(async (value) => {
					this.plugin.settings.githubToken = value;
					await this.plugin.saveSettings();
				}));

		// 添加创建token的链接
		const tokenLinkDiv = containerEl.createDiv();
		tokenLinkDiv.style.marginTop = '-10px';
		tokenLinkDiv.style.marginBottom = '20px';
		tokenLinkDiv.style.fontSize = '12px';
		tokenLinkDiv.style.color = 'var(--text-muted)';
		tokenLinkDiv.innerHTML = 'Don\'t have a token? <a href="https://github.com/settings/tokens/new" target="_blank" style="color: var(--text-accent);">Create one here</a> (requires repo permissions)';

		// 添加说明文档
		const helpDiv = containerEl.createDiv();
		helpDiv.style.marginTop = '30px';
		helpDiv.createEl('h3', {text: 'Setup Instructions'});
		helpDiv.createEl('p', {text: '1. Create a GitHub Personal Access Token with repo permissions'});
		helpDiv.createEl('p', {text: '2. Enter the token above'});
		helpDiv.createEl('p', {text: '3. Switch to Repositories tab to add your repositories'});
		helpDiv.createEl('p', {text: '4. Configure sync preferences in Sync Options tab'});
	}

	private displayRepositorySettings(containerEl: HTMLElement): void {
		containerEl.createEl('h3', {text: 'Repository Management'});

		// 添加新仓库的输入框
		const addRepoContainer = containerEl.createDiv();
		addRepoContainer.style.marginBottom = '20px';
		addRepoContainer.style.padding = '15px';
		addRepoContainer.style.border = '1px solid var(--background-modifier-border)';
		addRepoContainer.style.borderRadius = '5px';

		addRepoContainer.createEl('h4', {text: 'Add New Repository'});

		const nameInput = addRepoContainer.createEl('input', {
			type: 'text',
			placeholder: 'Repository display name (e.g., My Project)'
		});
		nameInput.style.width = '100%';
		nameInput.style.marginBottom = '10px';
		nameInput.style.padding = '8px';

		const ownerInput = addRepoContainer.createEl('input', {
			type: 'text',
			placeholder: 'Owner/Organization (e.g., username)'
		});
		ownerInput.style.width = '48%';
		ownerInput.style.marginRight = '4%';
		ownerInput.style.marginBottom = '10px';
		ownerInput.style.padding = '8px';

		const repoInput = addRepoContainer.createEl('input', {
			type: 'text',
			placeholder: 'Repository name (e.g., my-repo)'
		});
		repoInput.style.width = '48%';
		repoInput.style.marginBottom = '10px';
		repoInput.style.padding = '8px';

		const addButton = addRepoContainer.createEl('button', {text: 'Add Repository'});
		addButton.style.padding = '8px 16px';
		addButton.style.backgroundColor = 'var(--interactive-accent)';
		addButton.style.color = 'var(--text-on-accent)';
		addButton.style.border = 'none';
		addButton.style.borderRadius = '3px';
		addButton.style.cursor = 'pointer';

		addButton.addEventListener('click', async () => {
			const name = nameInput.value.trim();
			const owner = ownerInput.value.trim();
			const repo = repoInput.value.trim();

			if (!name || !owner || !repo) {
				// 这里可以添加错误提示
				return;
			}

			const newRepo: GithubRepository = {
				name,
				owner,
				repo,
				isDefault: this.plugin.settings.repositories.length === 0 // 第一个仓库自动设为默认
			};

			this.plugin.settings.repositories.push(newRepo);
			await this.plugin.saveSettings();

			// 清空输入框
			nameInput.value = '';
			ownerInput.value = '';
			repoInput.value = '';

			// 重新渲染页面
			this.display();
		});

		// 显示已添加的仓库列表
		if (this.plugin.settings.repositories.length > 0) {
			containerEl.createEl('h4', {text: 'Configured Repositories'});
			
			this.plugin.settings.repositories.forEach((repository, index) => {
				const repoDiv = containerEl.createDiv();
				repoDiv.style.marginBottom = '15px';
				repoDiv.style.padding = '15px';
				repoDiv.style.border = '1px solid var(--background-modifier-border)';
				repoDiv.style.borderRadius = '5px';
				repoDiv.style.backgroundColor = repository.isDefault ? 'var(--background-modifier-hover)' : 'transparent';

				const repoHeader = repoDiv.createDiv();
				repoHeader.style.display = 'flex';
				repoHeader.style.justifyContent = 'space-between';
				repoHeader.style.alignItems = 'center';
				repoHeader.style.marginBottom = '10px';

				const repoTitle = repoHeader.createEl('h5');
				repoTitle.textContent = `${repository.name} ${repository.isDefault ? '(Default)' : ''}`;
				repoTitle.style.margin = '0';

				const actionsDiv = repoHeader.createDiv();

				// 设为默认按钮
				if (!repository.isDefault) {
					const setDefaultButton = actionsDiv.createEl('button', {text: 'Set Default'});
					setDefaultButton.style.marginRight = '10px';
					setDefaultButton.style.padding = '4px 8px';
					setDefaultButton.style.fontSize = '12px';
					setDefaultButton.addEventListener('click', async () => {
						// 取消其他仓库的默认状态
						this.plugin.settings.repositories.forEach(repo => repo.isDefault = false);
						// 设置当前仓库为默认
						repository.isDefault = true;
						await this.plugin.saveSettings();
						this.display();
					});
				}

				// 删除按钮
				const deleteButton = actionsDiv.createEl('button', {text: '×'});
				deleteButton.style.padding = '4px 8px';
				deleteButton.style.fontSize = '12px';
				deleteButton.style.backgroundColor = 'var(--text-error)';
				deleteButton.style.color = 'white';
				deleteButton.style.border = 'none';
				deleteButton.style.borderRadius = '3px';
				deleteButton.style.cursor = 'pointer';
				deleteButton.addEventListener('click', async () => {
					this.plugin.settings.repositories.splice(index, 1);
					// 如果删除的是默认仓库且还有其他仓库，设置第一个为默认
					if (repository.isDefault && this.plugin.settings.repositories.length > 0) {
						this.plugin.settings.repositories[0].isDefault = true;
					}
					await this.plugin.saveSettings();
					this.display();
				});

				// 仓库信息
				const repoInfo = repoDiv.createDiv();
				repoInfo.innerHTML = `<strong>Repository:</strong> ${repository.owner}/${repository.repo}`;
			});
		}
	}

	private displaySyncSettings(containerEl: HTMLElement): void {
		// 自动同步设置
		new Setting(containerEl)
			.setName('Auto Sync')
			.setDesc('Automatically sync issues from GitHub')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSync)
				.onChange(async (value) => {
					this.plugin.settings.autoSync = value;
					await this.plugin.saveSettings();
				}));

		// 同步间隔设置
		new Setting(containerEl)
			.setName('Sync Interval')
			.setDesc('How often to sync issues (in minutes)')
			.addSlider(slider => slider
				.setLimits(1, 60, 1)
				.setValue(this.plugin.settings.syncInterval)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.syncInterval = value;
					await this.plugin.saveSettings();
				}));

		// 同步说明
		const syncHelpDiv = containerEl.createDiv();
		syncHelpDiv.style.marginTop = '20px';
		syncHelpDiv.createEl('h4', {text: 'Sync Information'});
		syncHelpDiv.createEl('p', {text: 'Auto sync will periodically fetch issues from all configured repositories.'});
		syncHelpDiv.createEl('p', {text: 'You can also manually sync issues using plugin commands.'});
	}
}
