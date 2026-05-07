/**
 * jira batch-comment - 批量添加评论
 */

import { Command } from 'commander';
import Chalk from 'chalk';
import { createJiraClient } from '../../client/jira-client.js';
import { markdownToWikiMarkup, textToWikiMarkup, detectContentFormat } from '../../converter/markdown-to-adf.js';
import { confirm } from '../ui-utils.js';

export const batchCommentCommand = new Command('batch-comment')
  .description('批量添加评论到 Issues')
  .argument('[issueIds...]', 'Issue ID 列表')
  .option('--jql <jql>', '使用 JQL 查询获取 Issue 列表')
  .option('-m, --message <text>', '评论内容 (自动检测格式: 纯文本/Markdown)')
  .option('--markdown', '强制指定内容为 Markdown 格式')
  .option('-y, --yes', '免确认执行')
  .option('--dry-run', '只显示将执行的操作')
  .option('-c, --concurrency <number>', '并发数', '5')
  .action(async (issueIds: string[], options: {
    jql?: string;
    message?: string;
    markdown?: boolean;
    yes?: boolean;
    dryRun?: boolean;
    concurrency: string;
  }) => {
    try {
      if (!options.message) {
        console.error('Error: must provide --message');
        process.exit(1);
      }

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

      if (options.dryRun) {
        console.log(`Would comment on ${targetIssueKeys.length} issues:`);
        for (const key of targetIssueKeys) {
          console.log(`  - ${key}`);
        }
        console.log(`\nComment preview:`);
        console.log(options.message);
        return;
      }

      // 确认
      if (!options.yes) {
        const confirmed = await confirm(
          `Add comment to ${targetIssueKeys.length} issues?`
        );
        if (!confirmed) {
          console.log('Cancelled.');
          return;
        }
      }

      // 构建评论
      const isMarkdown = options.markdown || detectContentFormat(options.message) === 'markdown';
      const body = isMarkdown
        ? markdownToWikiMarkup(options.message)
        : textToWikiMarkup(options.message);

      // 执行
      console.error(`Adding comment to ${targetIssueKeys.length} issues...`);
      const result = await client.batchComment(
        targetIssueKeys,
        body,
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
