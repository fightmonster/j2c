/**
 * Markdown Formatter
 * 将 Jira Issue 格式化为 Markdown 格式
 */

import type { JiraIssue, JiraComment } from '../types/jira.js';
import { formatSize, extractTextFromADF } from './format-utils.js';

/**
 * 格式化单个 Issue 为 Markdown
 */
export function formatIssueMarkdown(issue: JiraIssue): string {
  const fields = issue.fields;

  const lines: string[] = [];

  // 标题
  lines.push(`# ${issue.key}: ${fields.summary || 'No summary'}`);
  lines.push('');

  // 元信息
  lines.push('## 基本信息');
  lines.push('');
  lines.push(`- **状态**: ${fields.status?.name || '-'}`);
  lines.push(`- **类型**: ${fields.issuetype?.name || '-'}`);
  if (fields.priority) {
    lines.push(`- **优先级**: ${fields.priority.name}`);
  }
  if (fields.assignee) {
    lines.push(`- **经办人**: ${fields.assignee.displayName || fields.assignee.name || '-'}`);
  }
  if (fields.reporter) {
    lines.push(`- **报告人**: ${fields.reporter.displayName || fields.reporter.name || '-'}`);
  }
  if (fields.created) {
    lines.push(`- **创建时间**: ${formatDate(fields.created)}`);
  }
  if (fields.updated) {
    lines.push(`- **更新时间**: ${formatDate(fields.updated)}`);
  }
  lines.push('');

  // 描述
  if (fields.description) {
    lines.push('## 描述');
    lines.push('');
    lines.push(extractDescription(fields.description));
    lines.push('');
  }

  // 自定义字段
  const customFields = extractCustomFields(fields);
  if (customFields.length > 0) {
    lines.push('## 详细信息');
    lines.push('');
    for (const { key, name, value } of customFields) {
      lines.push(`- **${name}**: ${value || '-'}`);
    }
    lines.push('');
  }

  // 评论
  if (fields.comment?.comments?.length) {
    lines.push('## 评论');
    lines.push('');
    for (const c of fields.comment.comments) {
      lines.push(formatComment(c));
    }
    lines.push('');
  }

  // 附件
  if (fields.attachment?.length) {
    lines.push('## 附件');
    lines.push('');
    for (const att of fields.attachment) {
      lines.push(`- [${att.filename}](${att.content}) (${formatSize(att.size)})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 格式化 Issue 列表为 Markdown
 */
export function formatIssuesMarkdown(issues: JiraIssue[]): string {
  if (issues.length === 0) {
    return 'No issues found.';
  }

  const lines: string[] = [];

  lines.push(`# Jira Issues (${issues.length} issues)`);
  lines.push('');
  lines.push('| Key | Summary | Status | Assignee | Priority | Updated |');
  lines.push('|-----|---------|--------|----------|----------|---------|');

  for (const issue of issues) {
    const fields = issue.fields;
    lines.push(
      `| ${issue.key} | ${(fields.summary || '').substring(0, 50)}${(fields.summary || '').length > 50 ? '...' : ''} ` +
      `| ${fields.status?.name || '-'} ` +
      `| ${fields.assignee?.displayName || fields.assignee?.name || '-'} ` +
      `| ${fields.priority?.name || '-'} ` +
      `| ${fields.updated ? formatDate(fields.updated) : '-'} |`
    );
  }

  lines.push('');

  // 详细内容
  for (const issue of issues) {
    lines.push(formatIssueMarkdown(issue));
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 格式化评论
 */
function formatComment(comment: JiraComment): string {
  const author = comment.author?.displayName || comment.author?.name || 'Unknown';
  const date = formatDate(comment.created);
  const body = typeof comment.body === 'string'
    ? comment.body
    : '*[Rich text comment]*';

  return `### ${author} (${date})\n\n${body}\n`;
}

/**
 * 提取描述文本
 */
function extractDescription(description: string | object): string {
  if (typeof description === 'string') {
    return description;
  }

  try {
    const adf = description as any;
    return extractTextFromADF(adf);
  } catch {
    return '*[Rich text description]*';
  }
}

/**
 * 提取自定义字段
 */
interface CustomField {
  key: string;
  name: string;
  value: any;
}

// 字段名缓存（模块级，通过 setFieldNameCache 设置）
let fieldNameCache: Map<string, string> = new Map();

export function setFieldNameCache(fields: Array<{ id: string; name: string; key?: string }>): void {
  fieldNameCache = new Map();
  for (const field of fields) {
    if (field.id.startsWith('customfield_')) {
      fieldNameCache.set(field.id, field.name);
    }
  }
}

export function clearFieldNameCache(): void {
  fieldNameCache = new Map();
}

export function extractCustomFields(fields: any): CustomField[] {
  const customFields: CustomField[] = [];

  // 跳过的标准字段
  const standardFields = new Set([
    'summary', 'status', 'priority', 'assignee', 'reporter',
    'created', 'updated', 'description', 'comment', 'attachment',
    'issuetype', 'project', 'issuekey', 'security', 'votes', 'watches'
  ]);

  // 跳过的内部字段（包含复杂对象或无用数据）
  const skipPatterns = [
    'customfield_10000', // Development Summary
    'customfield_10001', // Flags
  ];

  for (const [key, value] of Object.entries(fields)) {
    // 只处理 customfield_ 开头的字段
    if (!key.startsWith('customfield_')) continue;
    if (standardFields.has(key)) continue;
    if (skipPatterns.includes(key)) continue;

    // 跳过空值
    if (value === null || value === undefined) continue;

    // 获取字段名称
    let name = fieldNameCache.get(key) || key;

    // 如果缓存没有，尝试从 value 对象获取
    if (name === key && value && typeof value === 'object') {
      if ((value as any).name) {
        name = (value as any).name;
      }
    }

    // 格式化值
    let displayValue = formatFieldValue(value);

    // 跳过 Jira 时间戳格式 (如 "0|i00dlr:")
    if (displayValue && /^\d+\|i[\w]+:$/.test(displayValue)) continue;

    // 跳过空值
    if (!displayValue) continue;

    customFields.push({ key, name, value: displayValue });
  }

  // 按名称排序
  customFields.sort((a, b) => a.name.localeCompare(b.name));

  return customFields;
}

/**
 * 格式化字段值
 */
function formatFieldValue(value: any): string {
  if (value === null || value === undefined) return '';

  // 简单类型直接返回
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  // 对象有 name 属性
  if (value.name) return value.name;

  // 对象有 value 属性
  if (value.value !== undefined) return String(value.value);

  // 数组
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    return value.map(v => formatFieldValue(v)).join(', ');
  }

  // 其他对象返回 JSON（限制长度）
  const str = JSON.stringify(value);
  return str.length > 100 ? str.substring(0, 100) + '...' : str;
}

/**
 * 格式化日期
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
