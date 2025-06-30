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
}

export interface GitHubIssueCache {
	[repoKey: string]: GitHubRepoCache; // repoKey 格式: "owner/repo"
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
			issues: allIssues
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
}
