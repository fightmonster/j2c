/**
 * jira update-description - 更新 Issue 的 Description
 */

import { Command } from 'commander';
import Chalk from 'chalk';
import { createJiraClient } from '../../client/jira-client.js';

export const updateDescriptionCommand = new Command('update-description')
  .description('更新 Issue 的 Description (描述)')
  .argument('<issueId>', 'Issue ID 或 Key')
  .argument('<description>', '新的 Description 文本')
  .option('-d, --dry-run', '只显示将执行的操作，不实际更新')
  .option('-y, --yes', '免确认执行')
  .action(async (issueId: string, description: string, options: { dryRun?: boolean; yes?: boolean }) => {
    try {
      const client = createJiraClient();

      if (options.dryRun) {
        console.log(`Would update description for ${issueId} to: "${description.substring(0, 50)}..."`);
        return;
      }

      if (!options.yes) {
        console.log(`Update description for ${issueId}?`);
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

      await client.updateIssueDescription(issueId, description);
      console.log(`${Chalk.green('✓')} 已更新 ${issueId} 的 Description`);
    } catch (err: any) {
      console.error(`${Chalk.red('Error:')} ${err.message}`);
      process.exit(1);
    }
  });
