import { App, PluginSettingTab, Setting } from "obsidian";
import type GithubProjectsPlugin from "../main";

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
	githubToken: "",
	repositories: [],
	autoSync: false,
	syncInterval: 5,
};

export class GithubProjectsSettingTab extends PluginSettingTab {
	plugin: GithubProjectsPlugin;
	private activeTab = "basic";
	private tokenStatus: "untested" | "testing" | "valid" | "invalid" =
		"untested";
	private tokenTestResult = "";

	constructor(app: App, plugin: GithubProjectsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();


// 创建标签页导航
const tabNav = containerEl.createDiv();
tabNav.classList.add("gp-tab-nav");

		const tabs = [
			{ id: "basic", name: "Token setup" },
			{ id: "repositories", name: "Repositories" },
			{ id: "sync", name: "Sync options" },
		];

	tabs.forEach((tab) => {
		const tabButton = tabNav.createEl("button", { text: tab.name });
		tabButton.classList.add("gp-tab-btn");
		if (this.activeTab === tab.id) {
			tabButton.classList.add("active");
		}
		tabButton.addEventListener("click", () => {
			this.activeTab = tab.id;
			this.display();
		});
	});

		// 显示对应的标签页内容
		this.displayTabContent(containerEl);
	}

	private displayTabContent(containerEl: HTMLElement): void {
		switch (this.activeTab) {
			case "basic":
				this.displayBasicSettings(containerEl);
				break;
			case "repositories":
				this.displayRepositorySettings(containerEl);
				break;
			case "sync":
				this.displaySyncSettings(containerEl);
				break;
		}
	}

	private displayBasicSettings(containerEl: HTMLElement): void {
		// GitHub Token 设置容器
		const tokenContainer = containerEl.createDiv();
		tokenContainer.style.marginBottom = "20px";

		// GitHub Token 设置
		new Setting(tokenContainer)
			.setName("GitHub Personal Access Token")
			.setDesc("Enter your GitHub personal access token.")
			.addText((text) =>
				text
					.setPlaceholder("ghp_xxxxxxxxxxxxxxxxxxxx")
					.setValue(this.plugin.settings.githubToken)
					.onChange(async (value) => {
						this.plugin.settings.githubToken = value;
						await this.plugin.saveSettings();
						// Token 改变时重置状态
						this.tokenStatus = "untested";
						this.tokenTestResult = "";
						this.updateTokenStatus(tokenContainer);
					})
			);

		// 测试按钮和状态指示器容器
		const testContainer = tokenContainer.createDiv();
		testContainer.classList.add("gp-test-token-row");

		// 测试按钮
		const testButton = testContainer.createEl("button", {
			text: "Test Token",
		});
		testButton.classList.add("gp-btn", "gp-btn-accent");

		// 状态指示灯
		const statusIndicator = testContainer.createDiv();
		statusIndicator.classList.add("gp-token-status-indicator");

		// 状态文本
		const statusText = testContainer.createDiv();
		statusText.classList.add("gp-token-status-text");

		// 绑定测试按钮事件
		testButton.addEventListener("click", async () => {
			await this.testGitHubToken(tokenContainer);
		});

		// 初始化状态显示
		this.updateTokenStatus(tokenContainer);

		// 添加创建token的链接和权限说明
		const tokenInfoDiv = containerEl.createDiv();
		tokenInfoDiv.classList.add("gp-token-info-box");

		// 替换 innerHTML: tokenLinkP
		const tokenLinkP = tokenInfoDiv.createEl("p");
		tokenLinkP.classList.add("gp-token-link");
		tokenLinkP.appendChild(document.createTextNode("Don't have a token? "));
		const link = tokenLinkP.createEl("a", {
			text: "Create one here",
			href: "https://github.com/settings/tokens/new",
		});
		link.setAttr("target", "_blank");
		link.addClass("gp-token-link-a");

		// 权限说明（scopes）
		const permissionHint = tokenInfoDiv.createEl("p");
		permissionHint.classList.add("gp-token-permission-hint");
		const strong1 = permissionHint.createEl("strong", { text: "Required scopes: " });
		permissionHint.appendChild(strong1);
		permissionHint.createEl("code", { text: "repo" });
		permissionHint.appendChild(document.createTextNode(" (for private repos) or "));
		permissionHint.createEl("code", { text: "public_repo" });
		permissionHint.appendChild(document.createTextNode(" (for public repos only)"));

		// 权限说明（permissions）
		const permissionP = tokenInfoDiv.createEl("p");
		permissionP.style.margin = "0";
		const strong2 = permissionP.createEl("strong", { text: "Required permissions: " });
		permissionP.appendChild(strong2);
		permissionP.appendChild(document.createTextNode("repo (for private repos) or public_repo (for public repos only)"));

		// 令牌格式说明
		const formatP = tokenInfoDiv.createEl("p");
		formatP.style.margin = "8px 0 0 0";
		const strong3 = formatP.createEl("strong", { text: "Token format: " });
		formatP.appendChild(strong3);
		formatP.appendChild(document.createTextNode('Should start with "ghp_" followed by 36 characters'));

		// 添加说明文档
		const helpDiv = containerEl.createDiv();
		helpDiv.style.marginTop = "30px";
		helpDiv.createEl("h3", { text: "Setup Instructions" });
		helpDiv.createEl("p", {
			text: "1. Create a GitHub Personal Access Token with repo permissions",
		});
		helpDiv.createEl("p", { text: "2. Enter the token above and test it" });
		helpDiv.createEl("p", {
			text: "3. Switch to Repositories tab to add your repositories",
		});
		helpDiv.createEl("p", {
			text: "4. Configure sync preferences in Sync Options tab",
		});
	}

	private displayRepositorySettings(containerEl: HTMLElement): void {
		// 只在有多个部分时使用标题，这里只保留“Repository management”
		containerEl.createEl("h3", { text: "Repository management" });

		// 添加新仓库的输入框
		const addRepoContainer = containerEl.createDiv();
		addRepoContainer.classList.add("gp-add-repo-box");

		addRepoContainer.createEl("h4", { text: "Add new repository" });

		// URL 输入框
		const urlInput = addRepoContainer.createEl("input", {
			type: "text",
			placeholder:
				"GitHub URL (e.g., https://github.com/username/reponame)",
		});
		urlInput.classList.add("gp-input", "gp-input-full");

		// 或分隔线
		const orDiv = addRepoContainer.createDiv();
		orDiv.textContent = "OR";
		orDiv.classList.add("gp-or-divider");

		// 手动输入区域
		const manualDiv = addRepoContainer.createDiv();
		manualDiv.classList.add("gp-manual-repo-fields");

		const nameInput = manualDiv.createEl("input", {
			type: "text",
			placeholder: "Repository display name (e.g., My Project)",
		});
		nameInput.classList.add("gp-input", "gp-input-full");

		const ownerInput = manualDiv.createEl("input", {
			type: "text",
			placeholder: "Owner/Organization (e.g., username)",
		});
		ownerInput.classList.add("gp-input", "gp-input-half", "gp-input-owner");

		const repoInput = manualDiv.createEl("input", {
			type: "text",
			placeholder: "Repository name (e.g., my-repo)",
		});
		repoInput.classList.add("gp-input", "gp-input-half", "gp-input-repo");

		// URL 自动解析功能
		urlInput.addEventListener("input", () => {
			const url = urlInput.value.trim();
			const parsed = this.parseGitHubUrl(url);

			if (parsed) {
				nameInput.value = parsed.name;
				ownerInput.value = parsed.owner;
				repoInput.value = parsed.repo;

				// 给手动输入框添加视觉提示
				nameInput.style.backgroundColor =
					"var(--background-modifier-success)";
				ownerInput.style.backgroundColor =
					"var(--background-modifier-success)";
				repoInput.style.backgroundColor =
					"var(--background-modifier-success)";
			} else if (url.length > 0) {
				// 如果有输入但解析失败，显示错误提示
				nameInput.style.backgroundColor = "";
				ownerInput.style.backgroundColor = "";
				repoInput.style.backgroundColor = "";
			} else {
				// 清空时重置样式
				nameInput.style.backgroundColor = "";
				ownerInput.style.backgroundColor = "";
				repoInput.style.backgroundColor = "";
			}
		});

		// 当手动输入框被修改时，清除 URL 输入框
		[nameInput, ownerInput, repoInput].forEach((input) => {
			input.addEventListener("input", () => {
				if (input.value.trim()) {
					urlInput.value = "";
				}
			});
		});

		const addButton = addRepoContainer.createEl("button", {
			text: "Add Repository",
		});
		addButton.classList.add("gp-btn", "gp-btn-accent");

		addButton.addEventListener("click", async () => {
			let name = nameInput.value.trim();
			let owner = ownerInput.value.trim();
			let repo = repoInput.value.trim();

			// 如果没有手动输入，尝试从URL解析
			if ((!name || !owner || !repo) && urlInput.value.trim()) {
				const parsed = this.parseGitHubUrl(urlInput.value.trim());
				if (parsed) {
					name = name || parsed.name;
					owner = owner || parsed.owner;
					repo = repo || parsed.repo;
				}
			}

			if (!name || !owner || !repo) {
				// 创建错误提示
				const errorDiv = addRepoContainer.querySelector(
					".error-message"
				) as HTMLElement;
				if (errorDiv) {
					errorDiv.remove();
				}

				const newErrorDiv = addRepoContainer.createDiv();
				newErrorDiv.className = "error-message";
				newErrorDiv.textContent =
					"Please provide a valid GitHub URL or fill in all fields manually.";
				newErrorDiv.classList.add("gp-error-message");

				// 3秒后自动删除错误提示
				setTimeout(() => {
					newErrorDiv.remove();
				}, 3000);

				return;
			}

			const newRepo: GithubRepository = {
				name,
				owner,
				repo,
				isDefault: this.plugin.settings.repositories.length === 0, // 第一个仓库自动设为默认
			};

			this.plugin.settings.repositories.push(newRepo);
			await this.plugin.saveSettings();

			// 清空输入框
			urlInput.value = "";
			nameInput.value = "";
			ownerInput.value = "";
			repoInput.value = "";

			// 重置输入框样式
			nameInput.style.backgroundColor = "";
			ownerInput.style.backgroundColor = "";
			repoInput.style.backgroundColor = "";

			// 重新渲染页面
			this.display();
		});

		// 显示已添加的仓库列表
		if (this.plugin.settings.repositories.length > 0) {
			containerEl.createEl("h4", { text: "Configured repositories" });

			this.plugin.settings.repositories.forEach((repository, index) => {
				const repoDiv = containerEl.createDiv();
				repoDiv.classList.add("gp-repo-item");
				if (repository.isDefault) repoDiv.classList.add("default");

				const repoHeader = repoDiv.createDiv();
				repoHeader.classList.add("gp-repo-header");

				const repoTitle = repoHeader.createEl("h5");
				repoTitle.textContent = `${repository.name} ${
					repository.isDefault ? "(Default)" : ""
				}`;
				repoTitle.classList.add("gp-repo-title");

				const actionsDiv = repoHeader.createDiv();

				// 设为默认按钮
				if (!repository.isDefault) {
					const setDefaultButton = actionsDiv.createEl("button", {
						text: "Set Default",
					});
					setDefaultButton.classList.add("gp-btn", "gp-btn-default");
					setDefaultButton.addEventListener("click", async () => {
						// 取消其他仓库的默认状态
						this.plugin.settings.repositories.forEach(
							(repo) => (repo.isDefault = false)
						);
						// 设置当前仓库为默认
						repository.isDefault = true;
						await this.plugin.saveSettings();
						this.display();
					});
				}

				// 删除按钮
				const deleteButton = actionsDiv.createEl("button", {
					text: "×",
				});
				deleteButton.classList.add("gp-btn", "gp-btn-danger");
				deleteButton.addEventListener("click", async () => {
					this.plugin.settings.repositories.splice(index, 1);
					// 如果删除的是默认仓库且还有其他仓库，设置第一个为默认
					if (
						repository.isDefault &&
						this.plugin.settings.repositories.length > 0
					) {
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
		// 只在有多个部分时使用标题，这里不添加“设置”或“Sync settings”标题

		// 自动同步
		new Setting(containerEl)
			.setName("Auto sync")
			.setDesc("Automatically sync issues from GitHub")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoSync)
					.onChange(async (value) => {
						this.plugin.settings.autoSync = value;
						await this.plugin.saveSettings();
					})
			);

		// 同步间隔
		new Setting(containerEl)
			.setName("Sync interval")
			.setDesc("How often to sync issues (in minutes)")
			.addSlider((slider) =>
				slider
					.setLimits(1, 60, 1)
					.setValue(this.plugin.settings.syncInterval)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.syncInterval = value;
						await this.plugin.saveSettings();
					})
			);

		// 同步说明
		const syncHelpDiv = containerEl.createDiv();
		syncHelpDiv.style.marginTop = "20px";
		syncHelpDiv.createEl("h4", { text: "Sync information" });
		syncHelpDiv.createEl("p", {
			text: "Auto sync will periodically fetch issues from all configured repositories.",
		});
		syncHelpDiv.createEl("p", {
			text: "You can also manually sync issues using plugin commands.",
		});
	}

	private parseGitHubUrl(
		url: string
	): { name: string; owner: string; repo: string } | null {
		if (!url) return null;

		// 支持多种 GitHub URL 格式
		const patterns = [
			// https://github.com/owner/repo
			/^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)/,
			// github.com/owner/repo
			/^github\.com\/([^/]+)\/([^/?#]+)/,
			// owner/repo
			/^([^/]+)\/([^/?#]+)$/,
		];

		for (const pattern of patterns) {
			const match = url.match(pattern);
			if (match) {
				const owner = match[1];
				const repo = match[2];

				// 移除常见的后缀
				const cleanRepo = repo.replace(/\.(git|zip)$/, "");

				// 生成显示名称（首字母大写，替换连字符为空格）
				const displayName = cleanRepo
					.split(/[-_]/)
					.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
					.join(" ");

				return {
					name: displayName,
					owner: owner,
					repo: cleanRepo,
				};
			}
		}

		return null;
	}

	private async testGitHubToken(containerEl: HTMLElement): Promise<void> {
		const token = this.plugin.settings.githubToken.trim();

		if (!token) {
			this.tokenStatus = "invalid";
			this.tokenTestResult = "Please enter a token first";
			this.updateTokenStatus(containerEl);
			return;
		}

		// 基本格式验证
		if (!token.startsWith("ghp_") || token.length !== 40) {
			this.tokenStatus = "invalid";
			this.tokenTestResult =
				'✗ Invalid token format (should start with "ghp_" and be 40 characters long)';
			this.updateTokenStatus(containerEl);
			return;
		}

		this.tokenStatus = "testing";
		this.tokenTestResult = "Testing token...";
		this.updateTokenStatus(containerEl);

		try {
			const response = await fetch("https://api.github.com/user", {
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: "application/vnd.github.v3+json",
					"User-Agent": "Obsidian-GitHub-Projects",
				},
			});

			if (response.ok) {
				const userData = await response.json();
				this.tokenStatus = "valid";
				this.tokenTestResult = `✓ Token valid! Authenticated as: ${userData.login}`;

				// 检查权限
				const scopes = response.headers.get("X-OAuth-Scopes");
				if (
					scopes &&
					(scopes.includes("repo") || scopes.includes("public_repo"))
				) {
					this.tokenTestResult += " (✓ Has repository permissions)";
				} else {
					this.tokenTestResult +=
						" (⚠ May lack repository permissions)";
				}
			} else if (response.status === 401) {
				this.tokenStatus = "invalid";
				this.tokenTestResult = "✗ Invalid token or expired";
			} else if (response.status === 403) {
				this.tokenStatus = "invalid";
				this.tokenTestResult =
					"✗ Rate limit exceeded or insufficient permissions";
			} else {
				this.tokenStatus = "invalid";
				this.tokenTestResult = `✗ Error: ${response.status} ${response.statusText}`;
			}
		} catch (error) {
			this.tokenStatus = "invalid";
			if (error instanceof TypeError && error.message.includes("fetch")) {
				this.tokenTestResult =
					"✗ Network error: Please check your internet connection";
			} else {
				this.tokenTestResult = `✗ Network error: ${
					error instanceof Error ? error.message : "Unknown error"
				}`;
			}
		}

		this.updateTokenStatus(containerEl);
	}

	private updateTokenStatus(containerEl: HTMLElement): void {
		const testContainer = containerEl.querySelector(
			'div[style*="display: flex"]'
		) as HTMLElement;
		if (!testContainer) return;

		const testButton = testContainer.querySelector(
			"button"
		) as HTMLButtonElement;
		const statusIndicator = testContainer.children[1] as HTMLElement;
		const statusText = testContainer.children[2] as HTMLElement;

		if (!statusIndicator || !statusText || !testButton) return;

		// 更新按钮状态
		if (this.tokenStatus === "testing") {
			testButton.disabled = true;
			testButton.textContent = "Testing...";
			testButton.style.backgroundColor = "var(--text-muted)";
			testButton.style.cursor = "not-allowed";
		} else {
			testButton.disabled = false;
			testButton.textContent = "Test Token";
			testButton.style.backgroundColor = "var(--interactive-accent)";
			testButton.style.cursor = "pointer";
		}

		// 更新状态指示灯和文本
		switch (this.tokenStatus) {
			case "untested":
				statusIndicator.style.backgroundColor = "var(--text-muted)";
				statusIndicator.style.boxShadow = "none";
				statusText.textContent = 'Click "Test Token" to verify';
				statusText.style.color = "var(--text-muted)";
				break;
			case "testing":
				statusIndicator.style.backgroundColor = "var(--text-accent)";
				statusIndicator.style.boxShadow = "0 0 8px var(--text-accent)";
				statusIndicator.style.animation = "pulse 1.5s infinite";
				statusText.textContent = "Testing token...";
				statusText.style.color = "var(--text-accent)";
				break;
			case "valid":
				statusIndicator.style.backgroundColor = "#10b981"; // 使用固定的绿色
				statusIndicator.style.boxShadow = "0 0 8px #10b981";
				statusIndicator.style.animation = "none";
				statusText.textContent = this.tokenTestResult;
				statusText.style.color = "#10b981";
				break;
			case "invalid":
				statusIndicator.style.backgroundColor = "#ef4444"; // 使用固定的红色
				statusIndicator.style.boxShadow = "none";
				statusIndicator.style.animation = "none";
				statusText.textContent = this.tokenTestResult;
				statusText.style.color = "#ef4444";
				break;
		}
	}
}
