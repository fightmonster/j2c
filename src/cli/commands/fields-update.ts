/**
 * jira fields-update - 更新 Issue 的自定义字段
 */

import { Command } from 'commander';
import Chalk from 'chalk';
import { createJiraClient } from '../../client/jira-client.js';
import { extractCustomFields, setFieldNameCache } from '../../formatter/markdown.js';

export const fieldsUpdateCommand = new Command('fields-update')
  .description('更新 Issue 的自定义字段')
  .argument('<issueId>', 'Issue ID 或 Key')
  .argument('<field>', '字段名称')
  .argument('<value>', '新值')
  .action(async (issueId: string, fieldName: string, newValue: string) => {
    try {
      const client = createJiraClient();

      // 获取字段元数据以解析自定义字段名
      try {
        const fields = await client.getFields();
        setFieldNameCache(fields);
      } catch {
        // 忽略字段元数据获取失败，使用 key 作为名称
      }

      // 先获取 issue，确认字段存在
      const issue = await client.getIssue(issueId);
      const customFields = extractCustomFields(issue.fields);

      // 查找字段
      const field = customFields.find(
        f => f.name.toLowerCase() === fieldName.toLowerCase() ||
             f.key.toLowerCase() === fieldName.toLowerCase()
      );

      if (!field) {
        console.error(`\n${Chalk.red('Error:')} 字段 "${fieldName}" 不存在\n`);
        console.log(`${Chalk.bold('可用字段:')}`);
        for (const f of customFields) {
          console.log(`  ${Chalk.cyan(f.name)}`);
        }
        console.log('');
        process.exit(1);
      }

      // 更新字段
      await client.updateIssueField(issueId, field.key, newValue);

      console.log(`\n${Chalk.green('✓')} 已更新 ${Chalk.cyan(field.name)}: ${field.value || '-'} → ${newValue}\n`);
    } catch (err: any) {
      console.error(`\n${Chalk.red('Error:')} ${err.message}\n`);
      process.exit(1);
    }
  });
