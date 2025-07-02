# Obsidian Github Projects

愿景

“在 Obsidian 工作库中，将一个想法细化为带验收标准的任务笔记并一键创建为 GitHub Issue；接着在 VS Code 中，从 Issue 创建分支，编写一个失败的测试，然后调用 MCP 服务将 Issue 描述、相关 ADR 和代码自动打包成富上下文，驱动 Copilot 高效编码直至测试通过；最后，在 VS Code 内闭环完成 PR 的创建、自查和 CI 触发，通过标准化的发版脚本完成交付。”

这个插件是为了高效桥接 Obsidian 和 Github 而设计的


## 开发状态 / Development Status

**中文：**

- 已实现：
  - 插件设置页，支持引导用户配置 GitHub Token、管理多仓库、设置自动同步选项，并可测试 Token 有效性。
  - 支持在 Obsidian 侧边栏以视图方式浏览 GitHub Issues，支持仓库切换、筛选（标题、状态、标签、里程碑、负责人）、刷新、展开详情。
  - 支持通过命令和功能区图标快速打开 Issues 视图。
  - 支持自动/手动同步远程仓库的 Issues，部分 Issue 支持显示相关提交数。
- 计划中/未实现：
  - 创建新 Issue（按钮已预留，功能待开发）。
  - 将 Issue 转化为 Obsidian 笔记（按钮已预留，功能待开发）。
  - 关闭 Issue、更多 Issue 操作。
  - Issue 与本地笔记的深度联动、MCP 服务集成等高级功能。

**English:**

- Implemented:
  - Settings tab for guiding users to set up GitHub Token, manage multiple repositories, configure auto-sync, and test token validity.
  - GitHub Issues can be browsed in a dedicated Obsidian sidebar view, with repository switching, filtering (title, state, labels, milestone, assignee), refresh, and expandable details.
  - Quick access to Issues view via command and ribbon icon.
  - Supports auto/manual sync of remote repository issues, and displays related commit count for some issues.
- Planned/Not yet implemented:
  - Creating new Issues (UI present, logic not yet implemented).
  - Converting Issues to Obsidian notes (UI present, logic not yet implemented).
  - Closing Issues and more advanced issue operations.
  - Deep integration between Issues and local notes, MCP service integration, and other advanced features.

## 哲学

以远端仓库为唯一真相 Single source of truth

本地增强管理能力和与obsidian的联动能力

我们做什么：

查看

联系

将issue转化为笔记

patch而非edit

我们不做什么

双向同步

github issue <-> obsidian markdown


## mvp阶段

0.引导设置github token
1.同步并查看远程仓库的 Issues
2.编写issue并推送

## Inspired by

- githobs
- vscode extension
