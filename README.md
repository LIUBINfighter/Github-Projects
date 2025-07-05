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
