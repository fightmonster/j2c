/**
 * jira edit-comment - 编辑 Issue 的评论
 */

import { Command } from 'commander';
import Chalk from 'chalk';
import { createJiraClient } from '../../client/jira-client.js';

export const editCommentCommand = new Command('edit-comment')
  .description('编辑 Issue 的评论')
  .argument('<issueId>', 'Issue ID 或 Key')
  .argument('[commentId]', '评论 ID (不带 --last 时必填)')
  .argument('[body]', '新的评论内容 (使用 --file 时可省略)')
  .option('--last', '编辑最后一条评论')
  .option('-f, --file <path>', '从文件读取评论内容')
  .option('-d, --dry-run', '只显示将执行的操作，不实际更新')
  .option('-y, --yes', '免确认执行')
  .action(async (issueId: string, commentId: string | undefined, body: string | undefined, options: {
    last?: boolean;
    file?: string;
    dryRun?: boolean;
    yes?: boolean;
  }) => {
    try {
      if (!options.last && !commentId) {
        console.error(`${Chalk.red('Error:')} 必须提供评论 ID 或使用 --last`);
        process.exit(1);
      }

      if (!options.file && !body) {
        console.error(`${Chalk.red('Error:')} 必须提供评论内容或使用 --file`);
        process.exit(1);
      }

      const client = createJiraClient();

      let targetCommentId = commentId;
      if (options.last) {
        const comments = await client.getComments(issueId);
        if (comments.length === 0) {
          console.error('No comments found.');
          process.exit(1);
        }
        // 按时间排序，取最新的
        const sorted = [...comments].sort((a, b) =>
          new Date(b.created).getTime() - new Date(a.created).getTime()
        );
        targetCommentId = sorted[0].id;
      }

      // 获取评论内容
      let commentBody = body || '';
      if (options.file) {
        const fs = await import('fs');
        commentBody = fs.readFileSync(options.file, 'utf-8');
      }

      if (options.dryRun) {
        console.log(`Would edit comment ${targetCommentId} for ${issueId}`);
        console.log(`New body (${commentBody.length} chars): "${commentBody.substring(0, 50)}..."`);
        return;
      }

      if (!options.yes) {
        console.log(`Edit comment ${targetCommentId} for ${issueId}?`);
        const readline = await import('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise<string>((resolve) => {
          rl.question('Confirm? (y/N) ', resolve);
        });
        rl.close();
        if (answer.toLowerCase() !== 'y') {
          console.log('Cancelled.');
          return;
        }
      }

      await client.editComment(issueId, targetCommentId!, commentBody);
      console.log(`${Chalk.green('✓')} 已编辑评论 ${targetCommentId}`);
    } catch (err: any) {
      console.error(`${Chalk.red('Error:')} ${err.message}`);
      process.exit(1);
    }
  });
