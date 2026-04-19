/**
 * jira fields - 列出 Issue 的所有自定义字段
 */

import { Command } from 'commander';
import Chalk from 'chalk';
import { createJiraClient } from '../../client/jira-client.js';
import { extractCustomFields, setFieldNameCache } from '../../formatter/markdown.js';

export const fieldsCommand = new Command('fields')
  .description('列出 Issue 的所有自定义字段')
  .argument('<issueId>', 'Issue ID 或 Key')
  .action(async (issueId: string) => {
    try {
      const client = createJiraClient();

      // 获取字段元数据以解析自定义字段名
      try {
        const fields = await client.getFields();
        setFieldNameCache(fields);
      } catch {
        // 忽略字段元数据获取失败，使用 key 作为名称
      }

      const issue = await client.getIssue(issueId);
      const customFields = extractCustomFields(issue.fields);

      console.log(`\n${Chalk.bold('Issue:')} ${issue.key}`);
      console.log(`${Chalk.bold('自定义字段 (' + customFields.length + '个):')}\n`);

      if (customFields.length === 0) {
        console.log('  (无自定义字段)');
      } else {
        for (const field of customFields) {
          console.log(`  ${Chalk.cyan(field.name)}: ${field.value || Chalk.gray('-')}`);
        }
      }
      console.log('');
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });
