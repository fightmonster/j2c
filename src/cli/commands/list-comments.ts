/**
 * jira list-comments - 列出 Issue 的评论
 */

import { Command } from 'commander';
import Chalk from 'chalk';
import { createJiraClient } from '../../client/jira-client.js';

export const listCommentsCommand = new Command('list-comments')
  .description('列出 Issue 的所有评论')
  .argument('<issueId>', 'Issue ID 或 Key')
  .option('--last', '只显示最后一条评论')
  .option('-o, --output <file>', '输出到文件（方便编辑后通过 edit-comment 写回）')
  .action(async (issueId: string, options: { last?: boolean; output?: string }) => {
    try {
      const client = createJiraClient();
      const comments = await client.getComments(issueId);

      if (comments.length === 0) {
        console.log('No comments found.');
        return;
      }

      if (options.last) {
        // 按时间排序，显示最后一条
        const sorted = [...comments].sort((a, b) =>
          new Date(b.created).getTime() - new Date(a.created).getTime()
        );
        const last = sorted[0];
        const body = typeof last.body === 'string' ? last.body : '[Rich text]';

        if (options.output) {
          // 输出到文件
          const fs = await import('fs');
          fs.writeFileSync(options.output, body, 'utf-8');
          console.error(`Written to ${options.output}`);
          console.error(`Comment ID: ${last.id}`);
        } else {
          console.log(`\n${Chalk.bold('Last Comment:')}\n`);
          console.log(`  ${Chalk.cyan('ID:')} ${last.id}`);
          console.log(`  ${Chalk.cyan('Author:')} ${last.author?.displayName || last.author?.name || '-'}`);
          console.log(`  ${Chalk.cyan('Created:')} ${last.created}`);
          console.log(`  ${Chalk.cyan('Body:')}`);
          body.split('\n').forEach((line: string) => console.log(`    ${line}`));
          console.log('');
        }
      } else {
        console.log(`\n${Chalk.bold('Comments:')}\n`);
        // 按时间从新到旧显示
        const sorted = [...comments].sort((a, b) =>
          new Date(b.created).getTime() - new Date(a.created).getTime()
        );
        for (const c of sorted) {
          console.log(`  ${Chalk.cyan(`[${c.id}]`)} ${c.author?.displayName || c.author?.name || '-'} - ${c.created}`);
          const body = typeof c.body === 'string' ? c.body.substring(0, 100) : '[Rich text]';
          console.log(`    ${body}${c.body && (typeof c.body !== 'string' || c.body.length > 100) ? '...' : ''}`);
          console.log('');
        }
      }
    } catch (err: any) {
      console.error(`${Chalk.red('Error:')} ${err.message}`);
      process.exit(1);
    }
  });
