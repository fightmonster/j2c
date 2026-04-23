/**
 * jira export - 批量导出 Issues 为 Markdown/JSON/CSV
 * CSV 全量导出包含所有 navigable 字段
 */

import { Command } from 'commander';
import * as fs from 'fs';
import { createJiraClient } from '../../client/jira-client.js';
import { formatIssuesMarkdown } from '../../formatter/markdown.js';
import { formatIssuesJSON } from '../../formatter/json.js';
import type { JiraIssue } from '../../types/jira.js';

// CSV 基础列（标准字段）
const CSV_BASE_COLUMNS: Array<{ key: string; label: string; extract: (f: any, issue?: any) => string }> = [
  { key: 'key', label: 'Key', extract: (_f, issue?) => issue?.key || '-' },
  { key: 'issuetype', label: 'Type', extract: (f) => f.issuetype?.name || '-' },
  { key: 'summary', label: 'Summary', extract: (f) => csvEscape(f.summary) },
  { key: 'status', label: 'Status', extract: (f) => f.status?.name || '-' },
  { key: 'priority', label: 'Priority', extract: (f) => f.priority?.name || '-' },
  { key: 'assignee', label: 'Assignee', extract: (f) => f.assignee?.displayName || f.assignee?.name || '-' },
  { key: 'reporter', label: 'Reporter', extract: (f) => f.reporter?.displayName || f.reporter?.name || '-' },
  { key: 'created', label: 'Created', extract: (f) => (f.created || '-').split('T')[0] },
  { key: 'updated', label: 'Updated', extract: (f) => (f.updated || '-').split('T')[0] },
  { key: 'resolution', label: 'Resolution', extract: (f) => f.resolution?.name || '-' },
  { key: 'labels', label: 'Labels', extract: (f) => (f.labels || []).join('; ') || '-' },
  { key: 'description', label: 'Description', extract: (f) => csvEscape(typeof f.description === 'string' ? f.description : '-') },
];

/**
 * 从 issue 数据中动态发现自定义字段列
 * @param fieldNames 可选的 key→显示名 映射（来自 getFields() API）
 */
function discoverCustomColumns(issues: JiraIssue[], fieldNames?: Map<string, string>): Array<{ key: string; label: string; extract: (f: any) => string }> {
  const customKeys = new Set<string>();
  for (const issue of issues) {
    for (const key of Object.keys(issue.fields)) {
      if (key.startsWith('customfield_') && issue.fields[key] != null) {
        customKeys.add(key);
      }
    }
  }
  return [...customKeys].sort().map(key => {
    const displayName = fieldNames?.get(key);
    const label = displayName ? `${displayName} (${key})` : key;
    return {
      key,
      label,
      extract: (f: any) => {
        const val = f[key];
        if (val == null) return '-';
        if (typeof val === 'object' && val.value !== undefined) return String(val.value);
        if (typeof val === 'object' && val.name !== undefined) return val.name;
        if (typeof val === 'string' || typeof val === 'number') return csvEscape(String(val));
        return '-';
      },
    };
  });
}

function csvEscape(value: string): string {
  if (!value) return '-';
  return `"${String(value).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
}

function formatIssuesCSVFull(issues: JiraIssue[], fieldNames?: Map<string, string>): string {
  const customColumns = discoverCustomColumns(issues, fieldNames);
  const allColumns = [...CSV_BASE_COLUMNS, ...customColumns];
  const header = allColumns.map(c => c.label).join(',');
  const lines = [header];

  for (const issue of issues) {
    const f = issue.fields;
    const row = allColumns.map(c => {
      if (c.key === 'key') return c.extract(f, issue);
      return c.extract(f);
    });
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

// 全量导出用的字段列表（*navigable = 所有可导航字段，比 *all 轻量）
const EXPORT_FIELDS = ['*navigable'];

export const exportCommand = new Command('export')
  .description('批量导出 Issues 为 Markdown/JSON/CSV（自动分页获取全量）')
  .requiredOption('--jql <jql>', 'JQL 查询语句')
  .option('-f, --format <format>', '输出格式: md|json|csv', 'csv')
  .option('-o, --output <file>', '输出到文件 (默认 stdout)')
  .option('-m, --max <number>', '最大结果数 (0=全量)', '0')
  .option('--all-fields', '获取所有字段（含不可导航字段），默认只取 navigable 字段')
  .option('-y, --yes', '免确认执行')
  .action(async (options: {
    jql: string;
    format: string;
    output?: string;
    max: string;
    allFields: boolean;
    yes: boolean;
  }) => {
    try {
      const client = createJiraClient();
      const maxResults = parseInt(options.max, 10);
      const fields = options.allFields ? ['*all'] : EXPORT_FIELDS;

      // 获取字段元数据（用于 CSV 列头显示名）
      let fieldNames: Map<string, string> | undefined;
      try {
        const allFields = await client.getFields();
        fieldNames = new Map<string, string>();
        for (const f of allFields) {
          if (f.id && f.name) {
            fieldNames.set(f.id, f.name);
          }
        }
      } catch {
        // getFields 失败不影响导出，降级为 key 做列头
      }

      let issues: JiraIssue[];
      if (maxResults === 0) {
        console.error(`Exporting all issues with JQL: ${options.jql}`);
        issues = await client.searchAllIssues(options.jql, {
          fields,
          onProgress: (loaded, total) => {
            console.error(`  Progress: ${loaded}/${total}`);
          },
        });
        console.error(`Fetched ${issues.length} issues.`);
      } else {
        console.error(`Exporting up to ${maxResults} issues with JQL: ${options.jql}`);
        const result = await client.searchIssues(options.jql, {
          maxResults,
          fields,
        });
        console.error(`Fetched ${result.issues.length}/${result.total} issues.`);
        issues = result.issues;
      }
      outputResult(issues, options, fieldNames);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

function outputResult(issues: JiraIssue[], options: { format: string; output?: string }, fieldNames?: Map<string, string>) {
  let output: string;
  if (options.format === 'json') {
    output = formatIssuesJSON(issues);
  } else if (options.format === 'csv') {
    output = formatIssuesCSVFull(issues, fieldNames);
  } else {
    output = formatIssuesMarkdown(issues);
  }

  if (options.output) {
    fs.writeFileSync(options.output, output, 'utf-8');
    console.error(`Exported ${issues.length} issues to ${options.output}`);
  } else {
    console.log(output);
  }
}
