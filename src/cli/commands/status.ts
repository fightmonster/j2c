/**
 * jira status - 查看或更改 Issue 状态
 */

import { Command } from 'commander';
import { createJiraClient } from '../../client/jira-client.js';
import Chalk from 'chalk';

export const statusCommand = new Command('status')
  .description('查看或更改 Issue 状态')
  .argument('<issueId>', 'Issue ID 或 Key')
  .argument('[targetStatus]', '目标状态 (不提供则显示可用状态)')
  .option('-d, --dry-run', '只显示将执行的操作，不实际更改')
  .action(async (issueId: string, targetStatus: string | undefined, options: { dryRun?: boolean }) => {
    try {
      const client = createJiraClient();

      if (!targetStatus) {
        // 显示可用状态
        const transitions = await client.getTransitions(issueId);
        console.log(`\nAvailable transitions for ${issueId}:\n`);
        for (const t of transitions) {
          console.log(`  ${Chalk.cyan(t.name)} → ${Chalk.green(t.to.name)}`);
        }
        console.log('');
        return;
      }

      // 执行状态切换
      const transitions = await client.getTransitions(issueId);
      const matched = transitions.find(
        t => t.name.toLowerCase() === targetStatus.toLowerCase() ||
             t.to.name.toLowerCase() === targetStatus.toLowerCase()
      );

      if (!matched) {
        console.error(`No transition found for status: ${targetStatus}`);
        console.error('Available transitions:');
        for (const t of transitions) {
          console.error(`  ${t.name} → ${t.to.name}`);
        }
        process.exit(1);
      }

      if (options.dryRun) {
        console.log(`Would transition ${issueId} to ${matched.to.name}`);
        return;
      }

      await client.doTransition(issueId, matched.id);
      console.log(`Transitioned ${issueId} to ${matched.to.name}`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });
