/**
 * Table Formatter
 * 将 Jira Issue 格式化为 CLI 表格
 */

import Chalk from 'chalk';
import Table from 'cli-table3';
import type { JiraIssue } from '../types/jira.js';
import { formatSize, extractTextFromADF } from './format-utils.js';

/**
 * 状态颜色
 */
function colorStatus(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('done') || s.includes('resolved') || s.includes('closed')) {
    return Chalk.green(status);
  }
  if (s.includes('progress') || s.includes('review')) {
    return Chalk.yellow(status);
  }
  if (s.includes('open') || s.includes('new') || s.includes('to do')) {
    return Chalk.red(status);
  }
  return Chalk.white(status);
}

/**
 * 格式化 Issue 详情为 CLI 输出
 */
export function formatIssueDetail(issue: JiraIssue): void {
  const fields = issue.fields;

  console.log('');
  console.log(Chalk.bold(`${issue.key}  `) + Chalk.gray('─'.repeat(60)));
  console.log(Chalk.bold.cyan(fields.summary));
  console.log('');

  // 基本信息
  console.log(`  ${Chalk.gray('状态:')} ${colorStatus(fields.status?.name || '-')}`);
  console.log(`  ${Chalk.gray('类型:')} ${fields.issuetype?.name || '-'}`);
  if (fields.priority) {
    console.log(`  ${Chalk.gray('优先级:')} ${fields.priority.name}`);
  }
  console.log(`  ${Chalk.gray('经办人:')} ${fields.assignee?.displayName || fields.assignee?.name || '-'}`);
  console.log(`  ${Chalk.gray('报告人:')} ${fields.reporter?.displayName || fields.reporter?.name || '-'}`);
  console.log(`  ${Chalk.gray('创建:')} ${fields.created || '-'}`);
  console.log(`  ${Chalk.gray('更新:')} ${fields.updated || '-'}`);

  // 描述
  if (fields.description) {
    console.log('');
    console.log(Chalk.gray('描述:'));
    const desc = typeof fields.description === 'string'
      ? fields.description
      : extractTextFromADF(fields.description);
    const descLines = desc.split('\n').slice(0, 10);
    for (const line of descLines) {
      console.log(`  ${line}`);
    }
    if (desc.split('\n').length > 10) {
      console.log(`  ${Chalk.gray('...(更多内容)...')}`);
    }
  }

  // 评论
  if (fields.comment?.comments?.length) {
    console.log('');
    console.log(Chalk.gray('评论:'));
    for (const c of fields.comment.comments.slice(0, 5)) {
      const author = c.author?.displayName || c.author?.name || 'Unknown';
      const body = typeof c.body === 'string' ? c.body : '[Rich text]';
      console.log(`  ${Chalk.cyan(author)} - ${c.created}`);
      const bodyLines = body.split('\n').slice(0, 3);
      for (const line of bodyLines) {
        console.log(`    ${line}`);
      }
      console.log('');
    }
  }

  // 附件
  if (fields.attachment?.length) {
    console.log('');
    console.log(Chalk.gray('附件:'));
    for (const att of fields.attachment) {
      console.log(`  - ${att.filename} (${formatSize(att.size)})`);
    }
  }

  console.log('');
}

/**
 * 格式化 Issue 列表为表格
 */
export function formatTable(issues: JiraIssue[]): void {
  if (issues.length === 0) {
    console.log('No issues found.');
    return;
  }

  const table = new Table({
    head: ['Key', 'Type', 'Summary', 'Status', 'Assignee', 'Priority', 'Updated'],
    colWidths: [10, 12, 36, 10, 13, 8, 14],
  });

  for (const issue of issues) {
    const fields = issue.fields;
    const summary = fields.summary || '';
    table.push([
      Chalk.cyan(issue.key),
      fields.issuetype?.name?.substring(0, 10) || '-',
      summary.substring(0, 34) + (summary.length > 34 ? '...' : ''),
      colorStatus(fields.status?.name || '-'),
      fields.assignee?.displayName?.substring(0, 11) || '-',
      fields.priority?.name || '-',
      (fields.updated || '-').substring(0, 10),
    ]);
  }

  console.log(table.toString());
}
