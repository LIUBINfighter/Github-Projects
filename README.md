# Obsidian GitHub Projects

Manage and view GitHub Issues and Projects directly within workspace. Jump to your ide. Gain insights from workbench in the main view.

<!-- ![beta-preview](./assets/beta.png) -->

![v0.1.0](./assets/v0.1.0.png)

<!-- > A Note on the Screenshot: The image above showcases the beta vision for this plugin, including the main workbench view. The initial release focuses on the powerful sidebar functionality (shown on the right). The workbench and other features are already in development(branch:dev) and will be rolled out in upcoming versions! -->

## Roadmap


| Module / Feature         |      **Pull**<br>*(View & Fetch)*                                      |  **Jump**<br>*(Navigate)*                                           |                                  **Push**<br>*(Create/Edit)*                                   |   **Link**<br>*(Note Integration)*                                      |
| ------------------------ | :--------------------------------------------------------------------: | :-----------------------------------------------------------------: | :--------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------: |
| **UI / UX & Core**       |    🚀 **Dashboard Workbench**<br>🚀 **Modern Card Layout**             |  🚀 **Tab Navigation**<br>✅ **Unified Header Bar**                  |                  🚧🤔 **Theme/Appearance Customization**<br>🚧🤔 Drag & Drop                   |                                    -                                    |
| **Issues**               | ✅ Fetch & View Issues<br>✅ Filter, Expand, Sync<br>🚀 Cross-repo Stats | ✅ Jump to GitHub Issue<br>🚀 **Open Repo in IDE via Command**       | 🚧 Create New Issue<br>🚧 Comment, Close, Edit Issue <br>🚧 (vscode-like developer experience) | 🚀 **Create Note from Issue (button exists)**<br>🚧🤔Link Existing Note |
| **Projects**             |             🚀🤔 **Fetch & View Projects (Repo/Org/User)**             |                 🚀 **Jump to GitHub Project Board**                 |                   🚧 Create/Edit Project Item<br>🚧 Move Project Item State                    |                        🚧🤔 Link Project to Note                        |
| **Workbench**            |         🚀 Multi-repo/Project Aggregation<br>🚀🤔 Global Stats         |                      🚀 Quick Nav to Settings                       |                                  🚧🤔 Custom Workbench Layout                                  |    🚧🤔 Embed Stats Block in Note (like `wakatime` or `dataview.js`)    |
| **Settings Tab**         |       ✅Repo Config <br>✅Token Testing<br>🚀 Projects Management        |                    🚀 Project/IDE Command Config                    |                                               -                                                |                                    -                                    |

**Legend:** ✅ = Completed 🚀 = In-Dev/Beta 🚧 = Planned 🤔 = Idea Wanted

> For developers, you can checkout branch `dev` to get a clear view of development. View issues for ideas and discussions!

## Getting Started

1.  Install the plugin from the Obsidian Community Plugins store.
2.  Go to `Settings` -> `Community Plugins` and enable "GitHub Projects".
3.  Open the plugin settings (`Settings` -> `GitHub Projects`).
4.  **Token Setup**: Navigate to the "Token Setup" tab. Create a new GitHub Personal Access Token with the `repo` scope (for private repositories) or `public_repo` (for public repositories only). Paste it into the input field and click "Test Token" to verify it.
5.  **Add Repositories**: Switch to the "Repositories" tab. Add the GitHub repositories you want to manage by providing their URL or manually entering the owner and repository name.
6.  **Configure Sync (Optional)**: In the "Sync Options" tab, you can enable automatic synchronization and set the interval.
7.  **Start Managing**: Click the GitHub icon in the ribbon or use the "GitHub Projects: Open Issues View" command to open the issues panel and start managing your projects!

## Features

- **Effortless Setup**: A guided settings tab for your GitHub Token, repositories, and sync options, including a token validation feature.
- **Focused Issues View**: A dedicated sidebar to browse your GitHub Issues with powerful filtering (title, state, labels, etc.) and a one-click refresh.
- **Quick Access**: Open the view from the sidebar ribbon or a command palette command.
- **Smart Sync**: Automatic and manual synchronization with related commit counts for some issues.

## Design Philosophy

This plugin is built on a few core principles:

- **Remote-First**: GitHub is the single source of truth. This plugin provides a powerful, enhanced window into that truth, not a local mirror.
- **Local Enhancement**: We focus on connecting your project management to your knowledge base. The goal is to make Obsidian the ultimate starting point for your development workflow.
- **Focused Actions**: The plugin helps you view issues, link them to your notes, and transform them into new notes. It does not perform two-way synchronization of Markdown content between GitHub and Obsidian.

Additionally, I want to experience similar to that in this extension [vscode-pull-request-github](https://github.com/microsoft/vscode-pull-request-github).

## Vision

To seamlessly bridge the gap between ideation and execution. We believe that a great idea captured in Obsidian should effortlessly transition into a trackable task in your development workflow. This plugin aims to make Obsidian the most efficient and intuitive entry point for any issue-driven development style.

## Inspired By

-   [Githobs](https://github.com/GabAlpha/obsidian-githobs)
-   [vscode-pull-request-github](https://github.com/microsoft/vscode-pull-request-github)

## License

This project is licensed under the Mozilla Public License 2.0 (MPL-2.0). See the [LICENSE](./LICENSE) file for details.

<!--## Vision(outdated)

How do I want to use this plugin?

"Within an Obsidian workspace, an idea is refined into a task note with acceptance criteria and then created as a GitHub Issue with a single click. Subsequently, in VS Code, a branch is created from the Issue, a failing test is written, and then an MCP service is invoked to automatically package the Issue description, relevant ADRs, and code into a rich context, driving Copilot to efficiently code until the test passes. Finally, the creation, self-review, and CI triggering of a PR are completed within VS Code, and delivery is accomplished through a standardized release script."

0.引导设置github token
1.同步并查看远程仓库的 Issues
2.编写issue并推送

## Inspired by

- githobs
- vscode extension

## 功能特性

### 🎯 GitHub Workbench (主工作界面)
- **统计概览** - 查看所有仓库的 Issue 总体情况
- **仓库卡片** - 每个仓库的详细状态和快速操作
- **一键同步** - 批量同步所有配置的仓库
- **快速导航** - 便捷访问详细 Issue 视图和设置

### 📋 Issue 管理
- **多仓库支持** - 同时管理多个 GitHub 仓库
- **智能过滤** - 按状态、标签、里程碑、被分配人筛选
- **实时同步** - 自动或手动同步 GitHub 数据
- **离线查看** - 缓存数据支持离线使用

### ⚙️ 配置管理
- **Token 验证** - 安全的 GitHub 访问令牌管理
- **仓库配置** - 灵活的多仓库配置选项
- **同步设置** - 可自定义的自动同步策略

## 使用指南

### 1. 初始设置
1. 在插件设置中配置 GitHub Personal Access Token
2. 添加要管理的仓库
3. 选择同步偏好设置

### 2. 使用 Workbench

Workbench 提供两个主要标签页：

#### Issues Overview
- 显示所有仓库的 Issue 统计概览
- 按仓库分类查看最新 Issues
- 快速访问和同步功能

#### GitHub Projects
- 查看所有项目看板
- 项目状态和进度追踪
- 快速访问项目详情

### 3. 快捷操作
- 点击功能区的 GitHub 图标 → "Open Workbench"
- 使用命令面板：`GitHub Projects: Open GitHub Workbench`
- 在任意视图中通过设置图标快速访问配置
