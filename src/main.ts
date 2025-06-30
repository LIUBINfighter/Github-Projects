import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface GithubProjectsSettings {
	githubToken: string;
}

const DEFAULT_SETTINGS: GithubProjectsSettings = {
	githubToken: ''
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

		new Setting(containerEl)
			.setName('GitHub Token')
			.setDesc('Enter your GitHub personal access token')
			.addText(text => text
				.setPlaceholder('ghp_xxxxxxxxxxxxxxxxxxxx')
				.setValue(this.plugin.settings.githubToken)
				.onChange(async (value) => {
					this.plugin.settings.githubToken = value;
					await this.plugin.saveSettings();
				}));
	}
}
