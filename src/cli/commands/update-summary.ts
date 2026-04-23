/**
 * jira update-summary - 更新 Issue 的 Summary
 */

import { Command } from 'commander';
import Chalk from 'chalk';
import { createJiraClient } from '../../client/jira-client.js';

export const updateSummaryCommand = new Command('update-summary')
  .description('更新 Issue 的 Summary (标题)')
  .argument('<issueId>', 'Issue ID 或 Key')
  .argument('<summary>', '新的 Summary 文本')
  .option('-d, --dry-run', '只显示将执行的操作，不实际更新')
  .option('-y, --yes', '免确认执行')
  .action(async (issueId: string, summary: string, options: { dryRun?: boolean; yes?: boolean }) => {
    try {
      const client = createJiraClient();

      if (options.dryRun) {
        console.log(`Would update summary for ${issueId} to: "${summary}"`);
        return;
      }

      if (!options.yes) {
        console.log(`Update summary for ${issueId} to: "${summary}"?`);
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

      await client.updateIssueSummary(issueId, summary);
      console.log(`${Chalk.green('✓')} 已更新 ${issueId} 的 Summary`);
    } catch (err: any) {
      console.error(`${Chalk.red('Error:')} ${err.message}`);
      process.exit(1);
    }
  });
