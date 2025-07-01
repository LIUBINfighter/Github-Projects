import { GitHubIssue } from '../views/issueView';
import { GithubRepository } from '../views/settingTab';

export interface GitHubSyncResult {
	success: boolean;
	error?: string;
	issuesCount?: number;
	rateLimitRemaining?: number;
	issues?: GitHubIssue[];
	user?: {
		login: string;
		name?: string;
		avatar_url: string;
	};
}

export interface GitHubRepoCache {
	last_sync: string; // ISO 8601 格式的时间戳
	issues: GitHubIssue[];
	projects?: {
		id: number;
		number: number;
		title: string;
		body: string;
		state: 'open' | 'closed';
		creator: {
			login: string;
			avatar_url: string;
		};
		created_at: string;
		updated_at: string;
		html_url: string;
	}[]; // 仓库关联的项目列表
}

export interface GitHubIssueCache {
	[repoKey: string]: GitHubRepoCache; // repoKey 格式: "owner/repo"
}

export interface GitHubProjectCache {
	[projectKey: string]: {
		last_sync: string;
		project: {
			id: number;
			number: number;
			title: string;
			body: string | null;
			state: 'open' | 'closed';
			creator: {
				login: string;
				avatar_url: string;
			};
			created_at: string;
			updated_at: string;
			html_url: string;
		};
	};
}

// GitHub API Project 响应类型定义
interface GitHubApiProject {
	id: number;
	number: number;
	name: string;
	body: string | null;
	state: 'open' | 'closed';
	creator: {
		login: string;
		avatar_url: string;
	};
	created_at: string;
	updated_at: string;
	html_url: string;
}

// GitHub API Issue 响应类型定义
interface GitHubApiIssue {
	id: number;
	number: number;
	title: string;
	body: string | null;
	state: 'open' | 'closed';
	user: {
		login: string;
		avatar_url: string;
	};
	labels: Array<{
		name: string;
		color: string;
	}>;
	assignee: {
		login: string;
		avatar_url: string;
	} | null;
	milestone: {
		title: string;
		description: string | null;
		state: 'open' | 'closed';
	} | null;
	created_at: string;
	updated_at: string;
	html_url: string;
	comments: number;
	pull_request?: unknown; // 用于检测是否是 PR
}

export class GitHubDataSync {
	private token: string;

	constructor(token: string) {
		this.token = token;
	}

	/**
	 * 获取仓库的唯一标识符
	 */
	private getRepoKey(repo: GithubRepository): string {
		return `${repo.owner}/${repo.repo}`;
	}

	/**
	 * 验证 GitHub Token 是否有效
	 */
	async validateToken(): Promise<GitHubSyncResult> {
		try {
			const response = await fetch('https://api.github.com/user', {
				headers: {
					'Authorization': `token ${this.token}`,
					'User-Agent': 'Obsidian-GitHub-Projects'
				}
			});

			if (response.ok) {
				const userData = await response.json();
				const rateLimitRemaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');
				return {
					success: true,
					rateLimitRemaining,
					user: {
						login: userData.login,
						name: userData.name,
						avatar_url: userData.avatar_url
					}
				};
			} else {
				return {
					success: false,
					error: `Token validation failed: ${response.status} ${response.statusText}`
				};
			}
		} catch (error) {
			return {
				success: false,
				error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
		}
	}

	/**
	 * 从 GitHub API 获取指定仓库的 Issues
	 */
	async fetchRepositoryIssues(repo: GithubRepository, since?: string): Promise<GitHubSyncResult> {
		try {
			// 构建 API URL
			let url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/issues`;
			
			const params = new URLSearchParams({
				state: 'all', // 获取所有状态的 issues
				per_page: '100', // 每页最多 100 个
				sort: 'updated',
				direction: 'desc'
			});

			// 如果提供了 since 参数，则只获取在此时间之后更新的 issues
			if (since) {
				params.append('since', since);
			}

			url += `?${params.toString()}`;

			const response = await fetch(url, {
				headers: {
					'Authorization': `token ${this.token}`,
					'User-Agent': 'Obsidian-GitHub-Projects',
					'Accept': 'application/vnd.github.v3+json'
				}
			});

			if (!response.ok) {
				return {
					success: false,
					error: `Failed to fetch issues: ${response.status} ${response.statusText}`
				};
			}

			const issues = await response.json() as GitHubApiIssue[];
			const rateLimitRemaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');

			// 转换 GitHub API 响应到我们的 Issue 格式
			const transformedIssues: GitHubIssue[] = issues
				.filter((issue: GitHubApiIssue) => !issue.pull_request) // 过滤掉 Pull Requests
				.map((issue: GitHubApiIssue) => this.transformGitHubIssue(issue, repo));

			return {
				success: true,
				issuesCount: transformedIssues.length,
				rateLimitRemaining,
				issues: transformedIssues
			};
		} catch (error) {
			return {
				success: false,
				error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
		}
	}

	/**
	 * 将 GitHub API 返回的 Issue 数据转换为我们的格式
	 */
	private transformGitHubIssue(apiIssue: GitHubApiIssue, repo: GithubRepository): GitHubIssue {
		return {
			id: apiIssue.id,
			number: apiIssue.number,
			title: apiIssue.title,
			body: apiIssue.body || '',
			state: apiIssue.state as 'open' | 'closed',
			user: {
				login: apiIssue.user.login,
				avatar_url: apiIssue.user.avatar_url
			},
			labels: (apiIssue.labels || []).map((label) => ({
				name: label.name,
				color: label.color
			})),
			assignee: apiIssue.assignee ? {
				login: apiIssue.assignee.login,
				avatar_url: apiIssue.assignee.avatar_url
			} : undefined,
			milestone: apiIssue.milestone ? {
				title: apiIssue.milestone.title,
				description: apiIssue.milestone.description || undefined,
				state: apiIssue.milestone.state as 'open' | 'closed'
			} : undefined,
			created_at: apiIssue.created_at,
			updated_at: apiIssue.updated_at,
			html_url: apiIssue.html_url,
			comments: apiIssue.comments,
			repository: {
				owner: repo.owner,
				name: repo.repo
			}
		};
	}

	/**
	 * 同步单个仓库的 Issues
	 * @param repo 要同步的仓库
	 * @param existingCache 现有的缓存数据
	 * @returns 更新后的缓存数据和同步结果
	 */
	async syncRepository(
		repo: GithubRepository, 
		existingCache?: GitHubRepoCache
	): Promise<{ cache: GitHubRepoCache | null; result: GitHubSyncResult }> {
		const repoKey = this.getRepoKey(repo);
		
		// 确定是否进行增量同步
		const since = existingCache?.last_sync;
		
		console.log(`Syncing repository ${repoKey}${since ? ` (since ${since})` : ' (full sync)'}`);
		
		const fetchResult = await this.fetchRepositoryIssues(repo, since);
		
		if (!fetchResult.success || !fetchResult.issues) {
			return {
				cache: null,
				result: fetchResult
			};
		}

		// 如果是增量同步，需要合并新旧数据
		let allIssues = fetchResult.issues;
		
		if (since && existingCache) {
			// 创建一个 Map 用于快速查找现有 issues
			const existingIssuesMap = new Map(
				existingCache.issues.map(issue => [issue.id, issue])
			);
			
			// 更新或添加新的 issues
			fetchResult.issues.forEach(issue => {
				existingIssuesMap.set(issue.id, issue);
			});
			
			allIssues = Array.from(existingIssuesMap.values());
		}
		
		const updatedCache: GitHubRepoCache = {
			last_sync: new Date().toISOString(),
			issues: allIssues,
			// 保留现有的 projects 数据（如果有）
			...(existingCache?.projects ? { projects: existingCache.projects } : {})
		};

		return {
			cache: updatedCache,
			result: {
				success: true,
				issuesCount: allIssues.length,
				rateLimitRemaining: fetchResult.rateLimitRemaining
			}
		};
	}

	/**
	 * 同步所有配置的仓库
	 * @param repositories 要同步的仓库列表
	 * @param existingCache 现有的缓存数据
	 * @returns 更新后的完整缓存数据
	 */
	async syncAllRepositories(
		repositories: GithubRepository[], 
		existingCache: GitHubIssueCache = {}
	): Promise<{ cache: GitHubIssueCache; results: Record<string, GitHubSyncResult> }> {
		const updatedCache: GitHubIssueCache = { ...existingCache };
		const results: Record<string, GitHubSyncResult> = {};

		// 串行同步所有仓库（避免并行请求导致的 rate limit 问题）
		for (const repo of repositories) {
			const repoKey = this.getRepoKey(repo);
			
			try {
				const { cache, result } = await this.syncRepository(repo, existingCache[repoKey]);
				
				if (cache) {
					updatedCache[repoKey] = cache;
				}
				
				results[repoKey] = result;
				
				// 如果遇到错误，记录但继续同步其他仓库
				if (!result.success) {
					console.error(`Failed to sync repository ${repoKey}:`, result.error);
				}
				
				// 在请求之间添加小延迟，避免触发 rate limit
				await new Promise(resolve => setTimeout(resolve, 100));
				
			} catch (error) {
				results[repoKey] = {
					success: false,
					error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
				};
			}
		}

		return {
			cache: updatedCache,
			results
		};
	}

	/**
	 * 获取指定 Issue 的关联提交数量
	 */
	async fetchIssueCommits(repo: GithubRepository, issueNumber: number): Promise<number> {
		try {
			// 搜索与该 Issue 相关的提交
			const searchQuery = `repo:${repo.owner}/${repo.repo} ${issueNumber}`;
			const url = `https://api.github.com/search/commits?q=${encodeURIComponent(searchQuery)}`;

			const response = await fetch(url, {
				headers: {
					'Authorization': `token ${this.token}`,
					'User-Agent': 'Obsidian-GitHub-Projects',
					'Accept': 'application/vnd.github.cloak-preview'
				}
			});

			if (response.ok) {
				const data = await response.json();
				return data.total_count || 0;
			}
			
			return 0;
		} catch (error) {
			console.error(`Failed to fetch commits for issue #${issueNumber}:`, error);
			return 0;
		}
	}

	/**
	 * 获取GitHub仓库关联的项目数据
	 * @param repo GitHub仓库
	 * @returns 获取结果
	 */
	async fetchRepositoryProjects(repo: GithubRepository): Promise<{
		success: boolean;
		error?: string;
		projects?: {
			id: number;
			number: number;
			title: string;
			body: string;
			state: 'open' | 'closed';
			creator: {
				login: string;
				avatar_url: string;
			};
			created_at: string;
			updated_at: string;
			html_url: string;
		}[];
		rateLimitRemaining?: number;
	}> {
		try {
			const repoKey = this.getRepoKey(repo);
			console.log(`Fetching projects for repository ${repoKey}`);
			
			// GitHub Classic Projects API (仓库级项目)
			const repoProjectsUrl = `https://api.github.com/repos/${repo.owner}/${repo.repo}/projects`;
			
			const response = await fetch(repoProjectsUrl, {
				headers: {
					'Authorization': `token ${this.token}`,
					'User-Agent': 'Obsidian-GitHub-Projects',
					'Accept': 'application/vnd.github.inertia-preview+json'
				}
			});
			
			const rateLimitRemaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');
			
			if (!response.ok) {
				return {
					success: false,
					error: `Failed to fetch repository projects: ${response.status} ${response.statusText}`,
					rateLimitRemaining
				};
			}
			
			const projects = await response.json();
			
			// 格式化返回的项目数据
			const formattedProjects = projects.map((project: GitHubApiProject) => ({
				id: project.id,
				number: project.number,
				title: project.name,
				body: project.body || '',
				state: project.state,
				creator: {
					login: project.creator.login,
					avatar_url: project.creator.avatar_url
				},
				created_at: project.created_at,
				updated_at: project.updated_at,
				html_url: project.html_url
			}));
			
			return {
				success: true,
				projects: formattedProjects,
				rateLimitRemaining
			};
		} catch (error) {
			console.error('Error fetching repository projects:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * 获取GitHub组织或用户级项目数据
	 * @param owner 组织或用户名
	 * @param projectNumber 项目编号
	 * @param type 项目类型 ('org' | 'user')
	 * @returns 获取结果
	 */
	async fetchGitHubProject(owner: string, projectNumber: number, type: 'org' | 'user' = 'org'): Promise<{
		success: boolean;
		error?: string;
		project?: {
			id: number;
			number: number;
			title: string;
			body: string;
			state: 'open' | 'closed';
			creator: {
				login: string;
				avatar_url: string;
			};
			created_at: string;
			updated_at: string;
			html_url: string;
		};
		rateLimitRemaining?: number;
	}> {
		try {
			console.log(`Fetching ${type} project ${projectNumber} for ${owner}`);
			
			// GitHub Classic Projects API (组织或用户级项目)
			const projectUrl = type === 'org' 
				? `https://api.github.com/orgs/${owner}/projects`
				: `https://api.github.com/users/${owner}/projects`;
			
			const response = await fetch(projectUrl, {
				headers: {
					'Authorization': `token ${this.token}`,
					'User-Agent': 'Obsidian-GitHub-Projects',
					'Accept': 'application/vnd.github.inertia-preview+json'
				}
			});
			
			const rateLimitRemaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');
			
			if (!response.ok) {
				return {
					success: false,
					error: `Failed to fetch ${type} projects: ${response.status} ${response.statusText}`,
					rateLimitRemaining
				};
			}
			
			const projects = await response.json();
			
			// 查找指定编号的项目
			const targetProject = projects.find((p: GitHubApiProject) => p.number === projectNumber);
			
			if (!targetProject) {
				return {
					success: false,
					error: `Project #${projectNumber} not found in ${type}/${owner}`,
					rateLimitRemaining
				};
			}
			
			// 格式化项目数据
			const formattedProject = {
				id: targetProject.id,
				number: targetProject.number,
				title: targetProject.name,
				body: targetProject.body || '',
				state: targetProject.state,
				creator: {
					login: targetProject.creator.login,
					avatar_url: targetProject.creator.avatar_url
				},
				created_at: targetProject.created_at,
				updated_at: targetProject.updated_at,
				html_url: targetProject.html_url
			};
			
			return {
				success: true,
				project: formattedProject,
				rateLimitRemaining
			};
		} catch (error) {
			console.error(`Error fetching ${type} project:`, error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}
	
	/**
	 * 同步仓库的项目数据
	 * @param repo GitHub仓库
	 * @param existingCache 现有的仓库缓存
	 * @returns 更新后的缓存及结果
	 */
	async syncRepositoryProjects(
		repo: GithubRepository,
		existingCache?: GitHubRepoCache
	): Promise<{ cache: GitHubRepoCache | null; result: { success: boolean; error?: string } }> {
		const repoKey = this.getRepoKey(repo);
		console.log(`Syncing projects for repository ${repoKey}`);
		
		const fetchResult = await this.fetchRepositoryProjects(repo);
		
		if (!fetchResult.success || !fetchResult.projects) {
			return {
				cache: null,
				result: fetchResult
			};
		}
		
		// 准备更新缓存
		const issues = existingCache?.issues || [];
		const lastSync = existingCache?.last_sync || new Date().toISOString();
		
		const updatedCache: GitHubRepoCache = {
			last_sync: lastSync,
			issues: issues,
			projects: fetchResult.projects
		};
		
		return {
			cache: updatedCache,
			result: {
				success: true
			}
		};
	}
	
	/**
	 * 为所有仓库同步项目数据
	 * @param repositories 要同步的仓库列表
	 * @param existingCache 现有的缓存数据
	 * @returns 更新后的完整缓存数据
	 */
	async syncAllRepositoriesProjects(
		repositories: GithubRepository[],
		existingCache: GitHubIssueCache = {}
	): Promise<{ cache: GitHubIssueCache; results: Record<string, { success: boolean; error?: string }> }> {
		const updatedCache: GitHubIssueCache = { ...existingCache };
		const results: Record<string, { success: boolean; error?: string }> = {};
		
		for (const repo of repositories) {
			if (repo.isDisabled) {
				continue; // 跳过禁用的仓库
			}
			
			const repoKey = this.getRepoKey(repo);
			
			try {
				// 使用现有缓存，如果存在的话
				const { cache, result } = await this.syncRepositoryProjects(repo, existingCache[repoKey]);
				
				if (result.success && cache) {
					// 更新缓存
					updatedCache[repoKey] = {
						...updatedCache[repoKey], // 保留现有数据（如issues）
						projects: cache.projects // 更新项目数据
					};
					results[repoKey] = { success: true };
				} else {
					results[repoKey] = { 
						success: false, 
						error: result.error || 'Unknown error during project sync' 
					};
					console.error(`Failed to sync projects for repository ${repoKey}:`, result.error);
				}
			} catch (error) {
				results[repoKey] = { 
					success: false, 
					error: error instanceof Error ? error.message : 'Unknown error' 
				};
				console.error(`Error syncing projects for repository ${repoKey}:`, error);
			}
		}
		
		return { cache: updatedCache, results };
	}
	
	/**
	 * 为配置的项目进行同步
	 * @param projects 配置的项目列表  
	 * @param existingCache 现有的项目缓存
	 * @returns 更新后的项目缓存数据
	 */
	async syncConfiguredProjects(
		projects: Array<{ owner: string; projectNumber: number; type: 'org' | 'user' }>,
		existingCache: GitHubProjectCache = {}
	): Promise<{ cache: GitHubProjectCache; results: Record<string, { success: boolean; error?: string }> }> {
		const updatedCache: GitHubProjectCache = { ...existingCache };
		const results: Record<string, { success: boolean; error?: string }> = {};
		
		for (const projectConfig of projects) {
			const projectKey = `${projectConfig.type}/${projectConfig.owner}/${projectConfig.projectNumber}`;
			
			try {
				const fetchResult = await this.fetchGitHubProject(
					projectConfig.owner, 
					projectConfig.projectNumber, 
					projectConfig.type
				);
				
				if (fetchResult.success && fetchResult.project) {
					updatedCache[projectKey] = {
						last_sync: new Date().toISOString(),
						project: fetchResult.project
					};
					results[projectKey] = { success: true };
				} else {
					results[projectKey] = { 
						success: false, 
						error: fetchResult.error || 'Unknown error during project sync' 
					};
					console.error(`Failed to sync project ${projectKey}:`, fetchResult.error);
				}
			} catch (error) {
				results[projectKey] = { 
					success: false, 
					error: error instanceof Error ? error.message : 'Unknown error' 
				};
				console.error(`Error syncing project ${projectKey}:`, error);
			}
			
			// 在请求之间添加小延迟，避免触发 rate limit
			await new Promise(resolve => setTimeout(resolve, 100));
		}
		
		return { cache: updatedCache, results };
	}
}
