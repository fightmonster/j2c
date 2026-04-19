/**
 * jira list - 搜索/列出 Issues
 * 自动分页获取全量数据，大数据量自动导出 CSV
 * --stats 按字段聚合统计（支持多字段分组，如 project,assignee）
 */

import { Command } from 'commander';
import * as fs from 'fs';
import { createJiraClient } from '../../client/jira-client.js';
import { formatTable } from '../../formatter/table.js';
import type { JiraIssue } from '../../types/jira.js';

const LARGE_RESULT_THRESHOLD = 100;

const STATS_FIELDS = ['assignee', 'project', 'status', 'issuetype', 'priority'];

function csvEscape(value: string): string {
  if (!value) return '-';
  return `"${String(value).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
}

function formatIssuesCSV(issues: JiraIssue[]): string {
  const headers = ['Key', 'Type', 'Summary', 'Status', 'Assignee', 'Priority', 'Project', 'Updated'];
  const lines = [headers.join(',')];

  for (const issue of issues) {
    const fields = issue.fields;
    const row = [
      issue.key,
      fields.issuetype?.name || '-',
      csvEscape(fields.summary || ''),
      fields.status?.name || '-',
      fields.assignee?.displayName || fields.assignee?.name || '-',
      fields.priority?.name || '-',
      fields.project?.name || '-',
      fields.updated ? fields.updated.split('T')[0] : '-',
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

function formatMarkdownTable(issues: JiraIssue[]): string {
  const lines: string[] = [];
  lines.push(`| Key | Type | Summary | Status | Assignee | Priority | Project | Updated |`);
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const issue of issues) {
    const fields = issue.fields;
    const summary = (fields.summary || '').substring(0, 60) + ((fields.summary || '').length > 60 ? '...' : '');
    lines.push(
      `| ${issue.key} | ${fields.issuetype?.name || '-'} | ${summary} | ${fields.status?.name || '-'} | ${fields.assignee?.displayName || fields.assignee?.name || '-'} | ${fields.priority?.name || '-'} | ${fields.project?.name || '-'} | ${fields.updated ? fields.updated.split('T')[0] : '-'} |`
    );
  }
  return lines.join('\n');
}

/**
 * 从 issue 提取指定字段的显示值
 */
function extractFieldValue(issue: JiraIssue, field: string): string {
  const f = issue.fields as any;
  switch (field) {
    case 'assignee':
      return f.assignee?.displayName || f.assignee?.name || '(unassigned)';
    case 'project':
      return f.project?.name || f.project?.key || '-';
    case 'status':
      return f.status?.name || '-';
    case 'issuetype':
      return f.issuetype?.name || '-';
    case 'priority':
      return f.priority?.name || '-';
    default:
      return f[field]?.name || f[field]?.value || f[field] || '-';
  }
}

/**
 * 按多字段聚合统计，返回排序后的平面列表
 */
function computeStats(issues: JiraIssue[], fields: string[]): Array<{ keys: string[]; count: number }> {
  const counts = new Map<string, { keys: string[]; count: number }>();
  for (const issue of issues) {
    const keyValues = fields.map(f => extractFieldValue(issue, f));
    const compositeKey = keyValues.join('\x00');
    const existing = counts.get(compositeKey);
    if (existing) {
      existing.count++;
    } else {
      counts.set(compositeKey, { keys: keyValues, count: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

export const listCommand = new Command('list')
  .description('搜索/列出 Jira Issues')
  .option('-p, --project <name>', '项目名称')
  .option('-i, --id <issueId>', 'Issue ID')
  .option('-a, --assignee <email>', '经办人 (使用 me 表示当前用户)')
  .option('-s, --status <status>', '状态')
  .option('-t, --type <type>', 'Issue 类型 (如 SOC, Task, Bug)')
  .option('-k, --keyword <text>', '关键词 (模糊匹配)')
  .option('-e, --export <format>', '导出格式: md|csv|table', 'table')
  .option('-m, --max <number>', '最大结果数 (0=全量自动分页)', '50')
  .option('-c, --count', '只显示数量，不返回详情')
  .option('-j, --jql <query>', '直接使用 JQL 查询（会忽略其他筛选选项）')
  .option('--stats <fields>', '按字段聚合统计，支持多字段逗号分隔: project,assignee')
  .option('--top <number>', 'stats 模式下只显示前 N 名', '10')
  .action(async (options: {
    project?: string;
    id?: string;
    assignee?: string;
    status?: string;
    type?: string;
    keyword?: string;
    export: string;
    max: string;
    count: boolean;
    jql?: string;
    stats?: string;
    top: string;
  }) => {
    try {
      let jql: string;

      if (options.jql) {
        jql = options.jql;
      } else {
        const jqlParts: string[] = [];
        if (options.project) jqlParts.push(`project = "${options.project}"`);
        if (options.id) jqlParts.push(`key = "${options.id}"`);
        if (options.assignee) {
          const val = options.assignee === 'me' || options.assignee === 'currentUser()'
            ? 'currentUser()'
            : `"${options.assignee}"`;
          jqlParts.push(`assignee = ${val}`);
        }
        if (options.status) jqlParts.push(`status = "${options.status}"`);
        if (options.type) jqlParts.push(`issuetype = "${options.type}"`);
        if (options.keyword) jqlParts.push(`text ~ "${options.keyword}"`);

        jql = jqlParts.length > 0
          ? jqlParts.join(' AND ') + ' ORDER BY updated DESC'
          : 'assignee = currentUser() ORDER BY updated DESC';
      }

      const client = createJiraClient();

      if (options.count) {
        const result = await client.searchIssues(jql, { maxResults: 0 });
        console.log(result.total);
        return;
      }

      // --stats 聚合模式：只取聚合所需的轻量字段
      if (options.stats) {
        const fields = options.stats.split(',').map(f => f.trim());
        for (const f of fields) {
          if (!STATS_FIELDS.includes(f)) {
            console.error(`Error: --stats 字段 "${f}" 不支持。支持: ${STATS_FIELDS.join(', ')}`);
            process.exit(1);
          }
        }

        console.error(`JQL: ${jql}`);
        const countResult = await client.searchIssues(jql, { maxResults: 0 });
        const total = countResult.total;
        const topN = parseInt(options.top, 10);

        console.error(`  Aggregating by ${fields.join(' + ')} across ${total} issues...`);
        const issues = await client.searchAllIssues(jql, {
          fields,
          onProgress: (loaded, t) => console.error(`  Progress: ${loaded}/${t}`),
        });

        const sorted = computeStats(issues, fields);
        const top = sorted.slice(0, topN);

        // 输出结果
        if (options.export === 'csv') {
          console.log([...fields.map(f => f.charAt(0).toUpperCase() + f.slice(1)), 'Count'].join(','));
          for (const row of top) {
            console.log(row.keys.map(k => `"${k}"`).join(',') + `,${row.count}`);
          }
          console.error(`\n  ${sorted.length} unique groups, showing top ${top.length}`);
        } else {
          const labels = fields.map(f => f.charAt(0).toUpperCase() + f.slice(1));
          const maxLens = fields.map((f, i) => Math.max(...top.map(r => r.keys[i].length), labels[i].length));

          console.log(`\n  Top ${top.length} by ${fields.join(' + ')} (total ${total} issues):\n`);

          // header
          const header = fields.map((_, i) => labels[i].padEnd(maxLens[i])).join('  ');
          console.log(`  ${header}  Count`);
          console.log(`  ${maxLens.map(l => '─'.repeat(l)).join('──')}──${'─'.repeat(6)}`);

          // rows
          for (const row of top) {
            const cols = row.keys.map((k, i) => k.padEnd(maxLens[i])).join('  ');
            const bar = '█'.repeat(Math.max(1, Math.round(row.count / total * 40)));
            console.log(`  ${cols}  ${String(row.count).padStart(5)}  ${bar}`);
          }
          if (sorted.length > topN) {
            const restCount = sorted.slice(topN).reduce((s, r) => s + r.count, 0);
            const restLabel = `... and ${sorted.length - topN} more`;
            console.log(`  ${restLabel.padEnd(maxLens.reduce((a, b) => a + b + 2, -2))}  ${String(restCount).padStart(5)}`);
          }
          console.log();
        }
        return;
      }

      // 先查总数
      console.error(`JQL: ${jql}`);
      const countResult = await client.searchIssues(jql, { maxResults: 0 });
      const total = countResult.total;
      const maxRequested = parseInt(options.max, 10);

      // -m 0 表示全量获取（自动分页）
      if (maxRequested === 0) {
        console.error(`  Total: ${total} issues, fetching all (auto-paginated)...`);
        const issues = await client.searchAllIssues(jql, {
          fields: ['summary', 'status', 'issuetype', 'assignee', 'priority', 'updated', 'project'],
          onProgress: (loaded, t) => console.error(`  Progress: ${loaded}/${t}`),
        });
        outputResult(issues, options, total);
        return;
      }

      const willFetch = Math.min(maxRequested, total);

      // 大数据量自动切换：table/md 格式超过阈值时自动导出 CSV 文件
      if (willFetch > LARGE_RESULT_THRESHOLD && (options.export === 'table' || options.export === 'md')) {
        const filename = `jira_export_${Date.now()}.csv`;
        console.error(`\n  结果共 ${total} 条（本次获取 ${willFetch} 条），超过 ${LARGE_RESULT_THRESHOLD} 条，不适合终端输出。`);
        console.error(`  自动切换为 CSV 导出 → ${filename}\n`);

        // 全量获取（导出应该完整）
        const issues = total <= willFetch
          ? await client.searchAllIssues(jql, {
              fields: ['summary', 'status', 'issuetype', 'assignee', 'priority', 'updated', 'project'],
              onProgress: (loaded, t) => console.error(`  Progress: ${loaded}/${t}`),
            })
          : (await client.searchIssues(jql, {
              maxResults: willFetch,
              fields: ['summary', 'status', 'issuetype', 'assignee', 'priority', 'updated', 'project'],
            })).issues;

        fs.writeFileSync(filename, formatIssuesCSV(issues), 'utf-8');
        console.error(`  已导出 ${issues.length} 条到 ${filename}\n`);
        return;
      }

      // 正常获取
      const result = await client.searchIssues(jql, {
        maxResults: willFetch,
        fields: ['summary', 'status', 'issuetype', 'assignee', 'priority', 'updated', 'project'],
      });

      outputResult(result.issues, options, total);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

function outputResult(issues: JiraIssue[], options: { export: string }, total: number) {
  if (options.export === 'table') {
    formatTable(issues);
  } else if (options.export === 'md') {
    console.log(formatMarkdownTable(issues));
  } else if (options.export === 'csv') {
    console.log(formatIssuesCSV(issues));
  } else {
    console.log(JSON.stringify(issues, null, 2));
  }
  console.error(`\nTotal: ${total} issues (showing ${issues.length})`);
}
