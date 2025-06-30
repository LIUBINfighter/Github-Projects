# Obsidian Github Projects

愿景

“在 Obsidian 工作库中，将一个想法细化为带验收标准的任务笔记并一键创建为 GitHub Issue；接着在 VS Code 中，从 Issue 创建分支，编写一个失败的测试，然后调用 MCP 服务将 Issue 描述、相关 ADR 和代码自动打包成富上下文，驱动 Copilot 高效编码直至测试通过；最后，在 VS Code 内闭环完成 PR 的创建、自查和 CI 触发，通过标准化的发版脚本完成交付。”

这个插件是为了高效桥接 Obsidian 和 Github 而设计的

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

我们不会试图维护github和本地markdown的实时双向同步。

markdown转issue的意义在于创意设计的时候可以直接发issue

issue转markdown的意义更多的在于链接本地内容和你的工作区

## mvp阶段

0.引导设置github token
1.同步并查看远程仓库的 Issues
2.编写issue并推送

## Inspired by

- githobs
- vscode extension

## 开发计划

### "Issue Workbench" 工作区视图设计

**核心理念:**

1. **工作台 (Workbench) 而非浏览器 (Browser):** 一个交互式的工作空间，将 GitHub Issue “本地化”，与个人知识库深度融合。
2. **草稿与发布分离 (Draft vs. Published):** 明确区分 Issue 的本地草稿（纯 Markdown）和已发布链接（指向远端的归档快照）。
3. **上下文为王 (Context is King):** 视图的核心是展示一个 Issue 在个人知识库中的全部上下文。

**功能与布局:**

这是一个三面板视图 (`ItemView`)，旨在提供与侧边栏不同的强大工作流。

#### 面板一：智能队列 (The Smart Queue) - 左侧

动态的任务收件箱，取代简单的 Issue 列表。

- **分组视图:**
  - `📥 未处理 (Inbox)`: 未在本地操作的新 Issue。
  - `📝 起草中 (Drafts)`: 已创建本地 Markdown 草稿但未推送的 Issue。
  - `🔗 已链接 (Linked)`: 已推送到 GitHub 且在知识库中有关联的 Issue。
  - `📦 归档 (Archived)`: 手动标记为完成或无需关注的 Issue。
- **高级过滤:**
  - 按“本地上下文”过滤（如：是否包含本地文件链接）。
  - 按“草稿状态”排序。

#### 面板二：核心编辑区 (The Core Editor) - 中心

根据所选 Issue 类型呈现不同内容。

- **起草中 (Draft):**
  - **完整 Obsidian Markdown 编辑器。**
  - **元数据面板:** 用于编辑 `Title`, `Labels`, `Assignees` 等的表单。
  - **特色功能:**
    - `🔗 引用本地笔记/文件`: 快速插入 `[[...]]` 或 `obsidian://` 链接。
    - `📋 使用模板`: 从预设模板创建 Issue。
    - `🚀 推送到 GitHub`: 将草稿和元数据发布到 GitHub。
- **已链接 (Linked) / 未处理 (Inbox):**
  - **增强的只读视图**，显示从 GitHub 同步的最新内容。
  - 自动渲染并增强内容，如将 `obsidian://` 链接变为可点击，将 `repo#123` 渲染为悬浮预览卡片。

#### 面板三：本地上下文 (The Local Context) - 右侧

展示 Issue 与 Obsidian 知识库的关联，这是与 Web 视图差异化的关键。

- **关联笔记:**
  - **显式链接:** `[[...]]`
  - **隐式链接（反向链接）:** 提及 Issue 编号 (`GH-123`) 的笔记。
- **本地引用:**
  - 清晰的“附件列表”，展示 Issue 中引用的所有 `obsidian://` 链接。
- **相关任务:**
  - 汇总知识库中所有包含此 Issue 编号的待办事项。
- **操作中心:**
  - `📝 创建关联笔记`: 一键创建链接好的新笔记。
  - `💬 起草回复`: 快速切换到草稿模式为 Issue 编写评论。
