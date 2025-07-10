import { Plugin } from 'obsidian';
import { GithubProjectsSettingTab, GithubProjectsSettings, DEFAULT_SETTINGS } from './views/settingTab';
import { IssueView, ISSUE_VIEW_TYPE } from './views/issueView';

export default class GithubProjectsPlugin extends Plugin {
	settings: GithubProjectsSettings;

	async onload() {
		await this.loadSettings();

		// 注册 Issue 视图
		this.registerView(
			ISSUE_VIEW_TYPE,
			(leaf) => new IssueView(leaf, this)
		);

		// 添加打开 Issue 视图的命令
		this.addCommand({
			id: 'open-github-issues',
			name: 'Open GitHub Issues',
			callback: () => {
				this.activateView();
			}
		});

		// 添加功能区图标
		this.addRibbonIcon('github', 'GitHub Issues', (evt: MouseEvent) => {
			this.activateView();
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new GithubProjectsSettingTab(this.app, this));
	}

	onunload() {
		// 不再主动 detach leaves，遵循 Obsidian 官方插件规范
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(ISSUE_VIEW_TYPE)[0];

		if (!leaf) {
			// 如果视图不存在，在右侧面板创建新的视图
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				leaf = rightLeaf;
				await leaf.setViewState({ type: ISSUE_VIEW_TYPE, active: true });
			} else {
				// 如果无法获取右侧面板，创建新的分割面板
				leaf = workspace.getLeaf('split');
				await leaf.setViewState({ type: ISSUE_VIEW_TYPE, active: true });
			}
		}

		// 激活视图
		workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
