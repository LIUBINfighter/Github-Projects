# Obsidian GitHub Projects

Manage and view GitHub Issues and Projects directly within workspace.Jump to your ide. Gain insights from workbench in the main view.

![beta-preview](./assets/beta.png)

> A Note on the Screenshot: The image above showcases the beta vision for this plugin, including the main workbench view. The initial release focuses on the powerful sidebar functionality (shown on the right). The workbench and other features are already in development(branch:dev) and will be rolled out in upcoming versions!

## Roadmap

| Module / Feature         |      **Pull**<br>*(View & Fetch)*                                      |  **Jump**<br>*(Navigate)*                                           |                    **Push**<br>*(Create/Edit)*                     |   **Link**<br>*(Note Integration)*                                     |
| ------------------------ | :--------------------------------------------------------------------: | :-----------------------------------------------------------------: | :----------------------------------------------------------------: | :--------------------------------------------------------------------: |
| **UI / UX & Core**       |    🚀 **Dashboard Workbench**<br>🚀 **Modern Card Layout**             |  🚀 **Tab Navigation**<br>✅ **Unified Header Bar**                  | 🚧 **Theme/Appearance Customization**<br>🚧 Drag & Drop            |                                   🤔                                   |
| **Issues**               | ✅ Fetch & View Issues<br>✅ Filter, Expand, Sync<br>🚀 Cross-repo Stats | ✅ Jump to GitHub Issue<br>🚀 **Open Repo in IDE via Command**       |        🚧 Create New Issue<br>🚧 Comment, Close, Edit Issue        | 🚀 **Create Note from Issue (button exists)**<br>🚧 Link Existing Note |
| **Projects**             |              🚀 **Fetch & View Projects (Repo/Org/User)**              |                 🚀 **Jump to GitHub Project Board**                 |     🚧 Create/Edit Project Item<br>🚧 Move Project Item State      |                        🚧 Link Project to Note                         |
| **Workbench**            |     🚀 Multi-repo/Project Aggregation<br>🚀 Global Stats               |                      🚀 Quick Nav to Settings                       |                     🚧 Custom Workbench Layout                     |  🚧 Embed Stats Block in Note (like `wakatime` or `dataview.js`)       |
| **Settings Tab**         |       ✅Repo Config <br>✅Token Testing<br>🚀 Projects Management        |                    🚀 Project/IDE Command Config                    | 🤔                                                                 |   🤔                                                                   |

**Legend:** ✅ = Completed 🚀 = In-Dev/Beta 🚧 = Planned/Idea Wanted 🤔 = Idea Wanted

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



<!--## Vision(outdated)

How do I want to use this plugin?

"Within an Obsidian workspace, an idea is refined into a task note with acceptance criteria and then created as a GitHub Issue with a single click. Subsequently, in VS Code, a branch is created from the Issue, a failing test is written, and then an MCP service is invoked to automatically package the Issue description, relevant ADRs, and code into a rich context, driving Copilot to efficiently code until the test passes. Finally, the creation, self-review, and CI triggering of a PR are completed within VS Code, and delivery is accomplished through a standardized release script."

This plugin is designed to efficiently bridge the gap between Obsidian and GitHub.
-->
