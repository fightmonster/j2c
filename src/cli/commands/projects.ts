/**
 * jira projects - 列出所有项目 / 查看项目详情
 */

import { Command } from 'commander';
import Chalk from 'chalk';
import { createJiraClient } from '../../client/jira-client.js';

export const projectsCommand = new Command('projects')
  .description('列出所有 Jira 项目，或查看指定项目详情')
  .argument('[projectKey]', '项目 Key，不传则列出所有项目')
  .option('-e, --export <format>', '输出格式: table|json', 'table')
  .action(async (projectKey: string | undefined, options: { export: string }) => {
    const client = createJiraClient();

    if (projectKey) {
      // 单个项目详情 + issue 统计
      const counts = await client.getProjectIssueCounts(projectKey);
      const open = (counts['To Do'] ?? 0) + (counts['In Progress'] ?? 0);

      if (options.export === 'json') {
        console.log(JSON.stringify({ key: projectKey, issueCounts: counts }, null, 2));
        return;
      }

      console.log(`\n${Chalk.bold(`Project: ${projectKey}`)}\n`);
      console.log(`  Total:        ${Chalk.bold(String(counts['Total'] ?? 0))}`);
      console.log(`  To Do:        ${counts['To Do'] ?? 0}`);
      console.log(`  In Progress:  ${counts['In Progress'] ?? 0}`);
      console.log(`  Done:         ${Chalk.green(String(counts['Done'] ?? 0))}`);
      console.log(`  Open:         ${open > 0 ? Chalk.yellow(String(open)) : Chalk.green('0')}`);
      console.log();
      return;
    }

    // 列出所有项目
    const projects = await client.getProjects();

    if (options.export === 'json') {
      console.log(JSON.stringify(projects, null, 2));
      return;
    }

    if (projects.length === 0) {
      console.log('No projects found.');
      return;
    }

    console.log(`\n${Chalk.bold(`Projects (${projects.length})`)}\n`);

    const maxKey = Math.max(...projects.map(p => p.key.length));
    const maxName = Math.max(...projects.map(p => p.name.length));

    for (const p of projects) {
      const key = p.key.padEnd(maxKey);
      const name = p.name.padEnd(maxName);
      console.log(`  ${Chalk.cyan(key)}  ${name}`);
    }

    console.log(`\n  ${Chalk.gray(`Total: ${projects.length} projects`)}  ${Chalk.gray('Use `j2c projects <KEY>` for issue stats')}\n`);
  });
