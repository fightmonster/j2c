/**
 * jira read/view - 读取 Issue 详情
 */

import { Command } from 'commander';
import * as fs from 'fs';
import { createJiraClient } from '../../client/jira-client.js';
import { formatIssueMarkdown, setFieldNameCache } from '../../formatter/markdown.js';
import { formatIssueJSON } from '../../formatter/json.js';
import { formatIssueDetail } from '../../formatter/table.js';

async function readIssue(issueId: string, options: { format: string; output?: string }) {
  const client = createJiraClient();

  try {
    const fields = await client.getFields();
    setFieldNameCache(fields);
  } catch {}

  const issue = await client.getIssue(issueId);

  if (options.format === 'table') {
    formatIssueDetail(issue);
    return;
  }

  let output: string;
  if (options.format === 'json') {
    output = formatIssueJSON(issue);
  } else {
    output = formatIssueMarkdown(issue);
  }

  if (options.output) {
    fs.writeFileSync(options.output, output, 'utf-8');
    console.error(`Written to ${options.output}`);
  } else {
    console.log(output);
  }
}

export const readCommand = new Command('read')
  .description('读取 Issue 详情')
  .argument('<issueId>', 'Issue ID 或 Key (如 XOS-730)')
  .option('-f, --format <format>', '输出格式: md|json|table', 'md')
  .option('-o, --output <file>', '输出到文件')
  .action(async (issueId: string, options: { format: string; output?: string }) => {
    try { await readIssue(issueId, options); }
    catch (err: any) { console.error(`Error: ${err.message}`); process.exit(1); }
  });

export const viewCommand = new Command('view')
  .description('查看 Issue 详情 (read 默认 table 格式)')
  .argument('<issueId>', 'Issue ID 或 Key')
  .option('-f, --format <format>', '输出格式: md|json|table', 'table')
  .option('-o, --output <file>', '输出到文件')
  .action(async (issueId: string, options: { format: string; output?: string }) => {
    try { await readIssue(issueId, options); }
    catch (err: any) { console.error(`Error: ${err.message}`); process.exit(1); }
  });
