/**
 * jira delete-comment - 删除 Issue 的评论
 */

import { Command } from 'commander';
import Chalk from 'chalk';
import { createJiraClient } from '../../client/jira-client.js';

export const deleteCommentCommand = new Command('delete-comment')
  .description('删除 Issue 的评论')
  .argument('<issueId>', 'Issue ID 或 Key')
  .argument('[commentId]', '评论 ID (不带 --last 时必填)')
  .option('--last', '删除最后一条评论')
  .option('-y, --yes', '免确认删除')
  .action(async (issueId: string, commentId: string | undefined, options: {
    last?: boolean;
    yes?: boolean;
  }) => {
    try {
      if (!options.last && !commentId) {
        console.error(`${Chalk.red('Error:')} 必须提供评论 ID 或使用 --last`);
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

      if (!options.yes) {
        console.log(`Delete comment ${targetCommentId} for ${issueId}?`);
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

      await client.deleteComment(issueId, targetCommentId!);
      console.log(`${Chalk.green('✓')} 已删除评论 ${targetCommentId}`);
    } catch (err: any) {
      console.error(`${Chalk.red('Error:')} ${err.message}`);
      process.exit(1);
    }
  });
