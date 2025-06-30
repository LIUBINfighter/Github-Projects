import { Plugin } from 'obsidian';
import { GithubProjectsSettingTab, GithubProjectsSettings, DEFAULT_SETTINGS } from './views/settingTab';

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
