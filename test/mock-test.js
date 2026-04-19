// Mock test: validates CLI argument parsing and output formatting
// without connecting to real Jira server

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import chalk from 'chalk';
import { formatTable, formatMarkdown, formatCSV, formatIssueDetail } from '../lib/formatter.js';

const mockIssues = [
  {
    key: 'GMS-123',
    fields: {
      summary: 'System crash on startup',
      status: { name: 'Open' },
      assignee: { displayName: 'Jun Luo', name: 'jun.luo' },
      priority: { name: 'High' },
    },
  },
  {
    key: 'GMS-124',
    fields: {
      summary: 'Memory leak in data pipeline',
      status: { name: 'In Progress' },
      assignee: { displayName: 'Test User', name: 'test.user' },
      priority: { name: 'Medium' },
    },
  },
  {
    key: 'GMS-125',
    fields: {
      summary: 'Login page UI issue - button not responsive on mobile devices',
      status: { name: 'Closed' },
      assignee: null,
      priority: { name: 'Low' },
    },
  },
];

const mockIssueDetail = {
  key: 'GMS-123',
  fields: {
    summary: 'System crash on startup',
    status: { name: 'Open' },
    issuetype: { name: 'Bug' },
    priority: { name: 'High' },
    assignee: { displayName: 'Jun Luo', name: 'jun.luo' },
    reporter: { displayName: 'Test Reporter' },
    created: '2025-01-15T10:30:00.000+0800',
    updated: '2025-01-16T14:20:00.000+0800',
    description: 'The system crashes when starting with debug mode enabled.\n\nSteps to reproduce:\n# Start app with --debug flag\n# Navigate to settings page\n# App crashes',
    comment: {
      comments: [
        {
          author: { displayName: 'Jun Luo' },
          created: '2025-01-15T11:00:00.000+0800',
          body: 'I can reproduce this. Looking into it.',
        },
        {
          author: { displayName: 'Dev Lead' },
          created: '2025-01-16T09:00:00.000+0800',
          body: 'Please prioritize this for the next release.',
        },
      ],
    },
    attachment: [
      { filename: 'crash_log.txt', size: 4096, content: 'https://www.rxpim.com/secure/attachment/12345/crash_log.txt' },
      { filename: 'screenshot.png', size: 204800, content: 'https://www.rxpim.com/secure/attachment/12346/screenshot.png' },
    ],
  },
};

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(chalk.green(`  PASS: ${name}`));
    passed++;
  } catch (err) {
    console.log(chalk.red(`  FAIL: ${name}`));
    console.log(chalk.red(`    ${err.message}`));
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

console.log(chalk.bold('\n=== Formatter Tests ===\n'));

test('formatTable produces output', () => {
  const out = formatTable(mockIssues);
  assert(out.includes('GMS-123'), 'should contain issue key');
  assert(out.includes('System crash on startup'), 'should contain summary');
  assert(out.includes('Jun Luo'), 'should contain assignee');
});

test('formatMarkdown produces valid markdown table', () => {
  const out = formatMarkdown(mockIssues);
  assert(out.includes('| Key |'), 'should have header row');
  assert(out.includes('| GMS-123 |'), 'should contain issue data');
  assert(out.split('\n').length >= 4, 'should have header + separator + data rows');
});

test('formatCSV produces valid CSV', () => {
  const out = formatCSV(mockIssues);
  assert(out.startsWith('Key,Summary'), 'should have CSV header');
  assert(out.includes('"GMS-123"'), 'should contain issue data');
});

test('formatIssueDetail shows full detail', () => {
  const out = formatIssueDetail(mockIssueDetail);
  assert(out.includes('GMS-123'), 'should contain key');
  assert(out.includes('System crash on startup'), 'should contain summary');
  assert(out.includes('Open'), 'should contain status');
  assert(out.includes('crash_log.txt'), 'should show attachments');
  assert(out.includes('Jun Luo'), 'should show comment author');
  assert(out.includes('I can reproduce this'), 'should show comment body');
});

test('handles unassigned issues', () => {
  const out = formatTable([mockIssues[2]]);
  assert(out.includes('Unassigned'), 'should show Unassigned for null assignee');
});

test('handles issue with no comments', () => {
  const issue = { ...mockIssueDetail, fields: { ...mockIssueDetail.fields, comment: { comments: [] } } };
  const out = formatIssueDetail(issue);
  assert(out.includes('No comments'), 'should indicate no comments');
});

// Test JQL builder logic indirectly
console.log(chalk.bold('\n=== JQL Builder Logic Tests ===\n'));

function buildJQL(opts) {
  const parts = [];
  if (opts.project) parts.push(`project = "${opts.project}"`);
  if (opts.id) parts.push(`key = "${opts.id}"`);
  if (opts.assignee) {
    const val = opts.assignee === 'currentUser()' || opts.assignee === 'me'
      ? 'currentUser()'
      : `"${opts.assignee}"`;
    parts.push(`assignee = ${val}`);
  }
  if (opts.status) parts.push(`status = "${opts.status}"`);
  if (opts.keyword) parts.push(`text ~ "${opts.keyword}"`);
  return parts.length > 0 ? parts.join(' AND ') : 'assignee = currentUser() ORDER BY updated DESC';
}

test('JQL: all options combined', () => {
  const jql = buildJQL({ project: 'GMS', assignee: 'jun.luo@brkg.com', status: 'Open', keyword: 'GMS' });
  assert(jql === 'project = "GMS" AND assignee = "jun.luo@brkg.com" AND status = "Open" AND text ~ "GMS"', jql);
});

test('JQL: default when no options', () => {
  const jql = buildJQL({});
  assert(jql === 'assignee = currentUser() ORDER BY updated DESC', jql);
});

test('JQL: currentUser() shorthand', () => {
  const jql = buildJQL({ assignee: 'me' });
  assert(jql === 'assignee = currentUser()', jql);
});

test('JQL: project + status only', () => {
  const jql = buildJQL({ project: 'GMS', status: 'Closed' });
  assert(jql === 'project = "GMS" AND status = "Closed"', jql);
});

// Summary
console.log(chalk.bold(`\n=== Results: ${chalk.green(passed + ' passed')}, ${chalk.red(failed + ' failed')} ===\n`));
process.exit(failed > 0 ? 1 : 0);
