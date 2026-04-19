/**
 * jira me - 显示当前用户信息
 */

import { Command } from 'commander';
import Chalk from 'chalk';
import { createJiraClient } from '../../client/jira-client.js';

interface ProjectStat {
  total: number;
  done: number;
  open: number;
}

export const meCommand = new Command('me')
  .description('显示当前用户信息及 issue 统计')
  .action(async () => {
    try {
      const client = createJiraClient();
      const user = await client.getMyself();

      console.log('');
      console.log(Chalk.bold('Current User:'));
      console.log(`  Display Name: ${Chalk.cyan(user.displayName)}`);
      if (user.emailAddress) {
        console.log(`  Email:        ${user.emailAddress}`);
      }
      if (user.name) {
        console.log(`  Username:     ${user.name}`);
      }
      console.log('');

      // 使用 currentUser() 函数查询当前用户的 issue，避免 username/displayName 不匹配
      const allIssues: any[] = [];
      let startAt = 0;
      const maxPerPage = 500;
      while (true) {
        const result = await client.searchIssues(
          'assignee = currentUser() ORDER BY updated DESC',
          { startAt, maxResults: maxPerPage, fields: ['project', 'status'] }
        );
        allIssues.push(...result.issues);
        startAt += result.issues.length;
        if (startAt >= result.total) break;
      }

      // 按项目分组统计
      const projectStatsMap = new Map<string, ProjectStat>();
      const projectMap = new Map<string, string>();
      for (const issue of allIssues) {
        const key = issue.fields.project.key;
        const name = issue.fields.project.name;
        projectMap.set(key, name);
        if (!projectStatsMap.has(key)) {
          projectStatsMap.set(key, { total: 0, done: 0, open: 0 });
        }
        const stat = projectStatsMap.get(key)!;
        stat.total++;
        if (issue.fields.status.statusCategory.key === 'done') {
          stat.done++;
        } else {
          stat.open++;
        }
      }

      const projectStatsArray = [...projectStatsMap.entries()];

      // 计算总计
      let grandTotal = 0, grandDone = 0, grandOpen = 0;

      console.log(Chalk.bold('My Issues Statistics:'));
      console.log('');

      // 按项目名排序显示
      const sortedStats = projectStatsArray.sort((a, b) => a[0].localeCompare(b[0]));

      for (const [project, stats] of sortedStats) {
        grandTotal += stats.total;
        grandDone += stats.done;
        grandOpen += stats.open;
        const projectName = projectMap.get(project) || project;
        console.log(`  ${Chalk.bold(projectName)} (${project}):`);
        console.log(`    Total:   ${Chalk.cyan(stats.total)}`);
        console.log(`    Done:    ${Chalk.green(stats.done)}`);
        console.log(`    Open:    ${Chalk.yellow(stats.open)}`);
        console.log('');
      }

      // 显示总计
      if (sortedStats.length > 1) {
        console.log(`  ${Chalk.bold('Total:')}`);
        console.log(`    Total:   ${Chalk.cyan(grandTotal)}`);
        console.log(`    Done:    ${Chalk.green(grandDone)}`);
        console.log(`    Open:    ${Chalk.yellow(grandOpen)}`);
        console.log('');
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });