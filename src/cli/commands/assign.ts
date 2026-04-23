/**
 * jira assign - 分配 Issue
 */

import { Command } from 'commander';
import { createJiraClient } from '../../client/jira-client.js';

export const assignCommand = new Command('assign')
  .description('分配 Issue 给用户')
  .argument('<issueId>', 'Issue ID 或 Key')
  .argument('<username>', '用户名')
  .action(async (issueId: string, username: string) => {
    try {
      const client = createJiraClient();
      await client.assignIssue(issueId, username);
      console.log(`Assigned ${issueId} to ${username}`);
    } catch (err: any) {
      console.error(`Error: ${err?.message || err}`);
      process.exit(1);
    }
  });
