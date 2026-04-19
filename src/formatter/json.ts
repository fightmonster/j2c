/**
 * JSON Formatter
 * 将 Jira Issue 格式化为 JSON 格式
 */

import type { JiraIssue } from '../types/jira.js';

/**
 * 格式化单个 Issue 为 JSON
 */
export function formatIssueJSON(issue: JiraIssue): string {
  return JSON.stringify(issue, null, 2);
}

/**
 * 格式化 Issue 列表为 JSON
 */
export function formatIssuesJSON(issues: JiraIssue[]): string {
  return JSON.stringify({
    total: issues.length,
    issues,
  }, null, 2);
}
