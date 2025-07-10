# Obsidian GitHub Projects

Manage and view GitHub Issues and Projects directly within workspace.Jump to your ide. Gain insights from workbench in the main view.

## Vision

Authenticated by a GitHub token, this plugin currently focuses on two core capabilities:

-   **Pull**: Fetching issues and related information from GitHub, allowing you to conveniently browse, filter, and manage them within Obsidian.
-   **Jump**: Instantly jumping to the corresponding GitHub web page, so you can quickly view and operate on issues in your browser.

In the future, the plugin plans to gradually support:

-   **Push**: Creating new issues and posting comments directly within Obsidian, with the experience moving closer to VS Code’s GitHub integration.

Our goal is to make Obsidian an efficient entry point for managing your GitHub projects—starting with “pull” and “jump,” and then gradually improving “push” and deeper interactive experiences.

## Features

### Implemented

-   **Settings Management**: A comprehensive settings tab to guide you through configuring your GitHub Token, managing multiple repositories, and setting sync options. It also includes a feature to test the validity of your token.
-   **GitHub Issues View**: Browse your GitHub Issues in a dedicated sidebar view within Obsidian. This view supports:
    -   Switching between different repositories.
    -   Advanced filtering by title, state, labels, milestone, and assignee.
    -   A refresh button to fetch the latest updates.
    -   Expanding issues to see their full details.
-   **Quick Access**: Easily open the Issues view using a command from the palette or a ribbon icon in the sidebar.
-   **Synchronization**: Supports both automatic and manual synchronization of issues from your remote repositories. For some issues, it can even display the count of related commits.

### Planned Features

-   **Create New Issue**: The UI button is in place, and the functionality is under development.
-   **Convert Issue to Note**: A button has been reserved for this feature, which will allow you to turn any GitHub issue into a new note in your vault.
-   **Advanced Issue Actions**: Functionality to close, edit, and perform other operations on issues directly from Obsidian.
-   **Deep Integration**: Stronger connections between issues and your local notes, including linking and context sharing.

## Getting Started

1.  Install the plugin from the Obsidian Community Plugins store.
2.  Go to `Settings` -> `Community Plugins` and enable "GitHub Projects".
3.  Open the plugin settings (`Settings` -> `GitHub Projects`).
4.  **Token Setup**: Navigate to the "Token Setup" tab. Create a new GitHub Personal Access Token with the `repo` scope (for private repositories) or `public_repo` (for public repositories only). Paste it into the input field and click "Test Token" to verify it.
5.  **Add Repositories**: Switch to the "Repositories" tab. Add the GitHub repositories you want to manage by providing their URL or manually entering the owner and repository name.
6.  **Configure Sync (Optional)**: In the "Sync Options" tab, you can enable automatic synchronization and set the interval.
7.  **Start Managing**: Click the GitHub icon in the ribbon or use the "GitHub Projects: Open Issues View" command to open the issues panel and start managing your projects!

## Design Philosophy

This plugin is built on a few core principles:

-   **Remote-First**: The GitHub repository is treated as the single source of truth. The plugin provides a window into that truth.
-   **Local Enhancement**: It enhances your ability to manage projects and integrate them with your knowledge base, all from the comfort of Obsidian.
-   **Focused Actions**:
    -   **What this plugin does**: It allows you to **view** issues, **link** them to your notes, and **convert** them into new notes for further work.
    -   **What this plugin does NOT do**: It does not perform two-way synchronization between GitHub issue content and Obsidian Markdown files. The goal is to link and transform, not to create a mirror.

## Inspired By

-   [Githobs](https://github.com/GabAlpha/obsidian-githobs)
-   [vscode-pull-request-github](https://github.com/microsoft/vscode-pull-request-github)

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
