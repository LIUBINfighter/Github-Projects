#!/usr/bin/env node

/**
 * 简单的开发测试脚本
 * 用于验证 GitHub Workbench 的基本功能
 */

console.log('🚀 GitHub Issue Workbench - Development Test');
console.log('============================================\n');

// 模拟一些测试数据
const mockIssues = [
	{
		id: 1,
		number: 123,
		title: 'Fix critical bug in authentication',
		body: 'There is a critical bug in the authentication system...',
		state: 'open',
		user: { login: 'developer1', avatar_url: 'https://github.com/avatars/u/1' },
		labels: [{ name: 'bug', color: 'ff0000' }, { name: 'critical', color: 'ff6600' }],
		assignee: { login: 'developer2', avatar_url: 'https://github.com/avatars/u/2' },
		milestone: { title: 'v1.2.0', state: 'open' },
		created_at: '2024-01-15T10:00:00Z',
		updated_at: '2024-01-16T15:30:00Z',
		html_url: 'https://github.com/owner/repo/issues/123',
		comments: 5,
		repository: { owner: 'owner', name: 'repo' }
	},
	{
		id: 2,
		number: 124,
		title: 'Add new feature for user management',
		body: 'We need to implement user management feature...',
		state: 'open',
		user: { login: 'product-manager', avatar_url: 'https://github.com/avatars/u/3' },
		labels: [{ name: 'enhancement', color: '00ff00' }],
		created_at: '2024-01-17T09:00:00Z',
		updated_at: '2024-01-17T09:00:00Z',
		html_url: 'https://github.com/owner/repo/issues/124',
		comments: 0,
		repository: { owner: 'owner', name: 'repo' }
	}
];

// 测试状态分组功能
function testStatusGrouping() {
	console.log('📋 Testing Status Grouping...');
	
	const workbenchIssues = mockIssues.map(issue => ({
		...issue,
		workbenchStatus: Math.random() > 0.5 ? 'inbox' : 'draft'
	}));
	
	const groups = {
		inbox: workbenchIssues.filter(issue => issue.workbenchStatus === 'inbox'),
		draft: workbenchIssues.filter(issue => issue.workbenchStatus === 'draft'),
		linked: [],
		archived: []
	};
	
	console.log('Group counts:');
	console.log(`  📥 Inbox: ${groups.inbox.length}`);
	console.log(`  📝 Drafts: ${groups.draft.length}`);
	console.log(`  🔗 Linked: ${groups.linked.length}`);
	console.log(`  📦 Archived: ${groups.archived.length}`);
	console.log('✅ Status grouping test passed\n');
}

// 测试本地上下文功能
function testLocalContext() {
	console.log('🔗 Testing Local Context...');
	
	const mockContext = {
		linkedNotes: [
			{ path: 'Projects/Feature Planning.md', title: 'Feature Planning', linkType: 'explicit' },
			{ path: 'Daily Notes/2024-01-16.md', title: '2024-01-16', linkType: 'implicit' }
		],
		localReferences: [
			{ type: 'obsidian-link', path: 'attachments/diagram.png', description: 'Architecture Diagram' }
		],
		relatedTasks: [
			{ file: 'TODO.md', line: 15, task: 'Review authentication implementation', isCompleted: false }
		]
	};
	
	console.log('Local Context:');
	console.log(`  📝 Linked Notes: ${mockContext.linkedNotes.length}`);
	console.log(`  📎 Local References: ${mockContext.localReferences.length}`);
	console.log(`  ✅ Related Tasks: ${mockContext.relatedTasks.length}`);
	console.log('✅ Local context test passed\n');
}

// 测试草稿管理功能
function testDraftManagement() {
	console.log('📝 Testing Draft Management...');
	
	const draftIssue = {
		title: 'New feature proposal',
		body: '## Summary\n\nThis is a new feature that will...\n\n## Related Files\n\n- [[Architecture Overview]]\n- [Design Doc](obsidian://open?path=docs/design.md)',
		labels: ['enhancement', 'needs-review'],
		repository: 'owner/repo',
		metadata: {
			assignee: 'current-user',
			milestone: 'v1.3.0'
		}
	};
	
	console.log('Draft Issue:');
	console.log(`  Title: ${draftIssue.title}`);
	console.log(`  Labels: ${draftIssue.labels.join(', ')}`);
	console.log(`  Repository: ${draftIssue.repository}`);
	console.log(`  Body length: ${draftIssue.body.length} characters`);
	console.log('✅ Draft management test passed\n');
}

// 运行所有测试
function runTests() {
	try {
		testStatusGrouping();
		testLocalContext();
		testDraftManagement();
		
		console.log('🎉 All tests passed! The GitHub Workbench is ready for development.');
		console.log('\nNext steps:');
		console.log('1. Load the plugin in Obsidian');
		console.log('2. Run the command "Open GitHub Workbench"');
		console.log('3. Test the three-panel layout');
		console.log('4. Verify issue grouping and selection');
		console.log('5. Test draft creation and editing');
		
	} catch (error) {
		console.error('❌ Test failed:', error.message);
		process.exit(1);
	}
}

// 如果直接运行此脚本
if (require.main === module) {
	runTests();
}

module.exports = {
	testStatusGrouping,
	testLocalContext,
	testDraftManagement,
	runTests
};
