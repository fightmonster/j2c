/**
 * jira batch-transition - 批量更改 Issue 状态
 */

import { Command } from 'commander';
import Chalk from 'chalk';
import { createJiraClient } from '../../client/jira-client.js';
import { confirm } from '../ui-utils.js';

export const batchTransitionCommand = new Command('batch-transition')
  .description('批量更改 Issue 状态')
  .argument('[issueIds...]', 'Issue ID 列表 (用空格分隔)')
  .option('--jql <jql>', '使用 JQL 查询获取 Issue 列表')
  .option('-s, --status <status>', '目标状态')
  .option('-y, --yes', '免确认执行')
  .option('--dry-run', '只显示将执行的操作')
  .option('-c, --concurrency <number>', '并发数', '5')
  .action(async (issueIds: string[], options: {
    jql?: string;
    status?: string;
    yes?: boolean;
    dryRun?: boolean;
    concurrency: string;
  }) => {
    try {
      const client = createJiraClient();

      let targetIssueKeys: string[] = [];

      // 获取 Issue 列表
      if (options.jql) {
        console.error(`Querying JQL: ${options.jql}`);
        const result = await client.searchIssues(options.jql, { maxResults: 1000 });
        targetIssueKeys = result.issues.map(i => i.key);
        console.error(`Found ${targetIssueKeys.length} issues`);
      } else if (issueIds.length > 0) {
        targetIssueKeys = issueIds;
      } else {
        console.error('Error: must provide issue IDs or --jql');
        process.exit(1);
      }

      if (!options.status) {
        console.error('Error: must provide --status');
        process.exit(1);
      }

      if (options.dryRun) {
        console.log(`Would transition ${targetIssueKeys.length} issues to "${options.status}":`);
        for (const key of targetIssueKeys) {
          console.log(`  - ${key}`);
        }
        return;
      }

      // 确认
      if (!options.yes) {
        const confirmed = await confirm(
          `Transition ${targetIssueKeys.length} issues to "${options.status}"?`
        );
        if (!confirmed) {
          console.log('Cancelled.');
          return;
        }
      }

      // 执行
      console.error(`Transitioning ${targetIssueKeys.length} issues...`);
      const result = await client.batchTransition(
        targetIssueKeys,
        options.status,
        parseInt(options.concurrency, 10)
      );

      console.log(`\nResults:`);
      console.log(`  ${Chalk.green(`✓ Success: ${result.success.length}`)}`);
      console.log(`  ${Chalk.red(`✗ Failed: ${result.failed.length}`)}`);

      if (result.failed.length > 0) {
        console.log(`\nFailed issues:`);
        for (const f of result.failed.slice(0, 10)) {
          console.log(`  ${f.key}: ${f.error}`);
        }
        if (result.failed.length > 10) {
          console.log(`  ... and ${result.failed.length - 10} more`);
        }
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });
