import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface GithubProjectsSettings {
	githubToken: string;
	defaultRepo: string;
	autoSync: boolean;
	syncInterval: number; // in minutes
}

const DEFAULT_SETTINGS: GithubProjectsSettings = {
	githubToken: '',
	defaultRepo: '',
	autoSync: false,
	syncInterval: 5
}

export default class GithubProjectsPlugin extends Plugin {
	settings: GithubProjectsSettings;

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new GithubProjectsSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class GithubProjectsSettingTab extends PluginSettingTab {
	plugin: GithubProjectsPlugin;

	constructor(app: App, plugin: GithubProjectsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		// 创建标题
		containerEl.createEl('h2', {text: 'GitHub Projects Settings'});

		// GitHub Token 设置
		new Setting(containerEl)
			.setName('GitHub Personal Access Token')
			.setDesc('Enter your GitHub personal access token. You can create one at github.com/settings/tokens')
			.addText(text => text
				.setPlaceholder('ghp_xxxxxxxxxxxxxxxxxxxx')
				.setValue(this.plugin.settings.githubToken)
				.onChange(async (value) => {
					this.plugin.settings.githubToken = value;
					await this.plugin.saveSettings();
				}));

		// 默认仓库设置
		new Setting(containerEl)
			.setName('Default Repository')
			.setDesc('Default GitHub repository in format: owner/repo (e.g., username/my-project)')
			.addText(text => text
				.setPlaceholder('username/repository')
				.setValue(this.plugin.settings.defaultRepo)
				.onChange(async (value) => {
					this.plugin.settings.defaultRepo = value;
					await this.plugin.saveSettings();
				}));

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

		// 添加说明文档链接
		const helpDiv = containerEl.createDiv();
		helpDiv.createEl('h3', {text: 'Setup Instructions'});
		helpDiv.createEl('p', {text: '1. Create a GitHub Personal Access Token with repo permissions'});
		helpDiv.createEl('p', {text: '2. Enter the token above'});
		helpDiv.createEl('p', {text: '3. Set your default repository'});
		helpDiv.createEl('p', {text: '4. Configure sync preferences'});
	}
}
