#!/usr/bin/env node
/**
 * jira-cli CLI 入口
 */

import { Command, Help } from 'commander';
import Chalk from 'chalk';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { readCommand, viewCommand } from './commands/read.js';
import { exportCommand } from './commands/export.js';
import { listCommand } from './commands/list.js';
import { statusCommand } from './commands/status.js';
import { assignCommand } from './commands/assign.js';
import { commentCommand } from './commands/comment.js';
import { setupCommand } from './commands/setup.js';
import { meCommand } from './commands/me.js';
import { downloadCommand } from './commands/download.js';
import { batchTransitionCommand } from './commands/batch-transition.js';
import { batchCommentCommand } from './commands/batch-comment.js';
import { fieldsCommand } from './commands/fields.js';
import { fieldsUpdateCommand } from './commands/fields-update.js';
import { updateSummaryCommand } from './commands/update-summary.js';
import { updateDescriptionCommand } from './commands/update-description.js';
import { listCommentsCommand } from './commands/list-comments.js';
import { editCommentCommand } from './commands/edit-comment.js';
import { deleteCommentCommand } from './commands/delete-comment.js';
import { projectsCommand } from './commands/projects.js';
import { hasPAT, hasCFServiceToken, getJiraHost } from '../client/config.js';
import { createJiraClient } from '../client/jira-client.js';

// 非 TTY 终端禁用所有彩色输出
if (!process.stdout.isTTY) {
  Chalk.level = 0;
}

/**
 * 自定义 Help 类 — 为 --help 输出添加颜色
 */
class ColorHelp extends Help {
  styleTitle(text: string): string { return Chalk.bold(text); }
  styleCommandDescription(text: string): string { return Chalk.dim(text); }
  styleCommandText(text: string): string { return Chalk.cyan(text); }
  styleOptionTerm(text: string): string { return Chalk.cyan(text); }
  styleOptionDescription(text: string): string { return Chalk.dim(text); }
  styleSubcommandText(text: string): string { return Chalk.cyan(text); }
  styleSubcommandDescription(text: string): string { return Chalk.dim(text); }
  styleArgumentTerm(text: string): string { return Chalk.cyan(text); }
  styleArgumentDescription(text: string): string { return Chalk.dim(text); }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 登录验证缓存 — 5 分钟内不重复验证
 */
const VERIFY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let verifyCache: { ok: boolean; user?: string; reason?: any; message?: string; ts: number } | null = null;

/**
 * 清除登录验证缓存（setup 后调用，确保使用新凭证）
 */
export function clearVerifyCache(): void {
  verifyCache = null;
}

/**
 * 验证登录状态
 */
async function verifyLogin(): Promise<{
  ok: boolean;
  user?: string;
  reason?: 'cf_token_invalid' | 'pat_invalid' | 'network_error';
  message?: string;
}> {
  // 使用缓存
  if (verifyCache && (Date.now() - verifyCache.ts) < VERIFY_CACHE_TTL) {
    return { ok: verifyCache.ok, user: verifyCache.user, reason: verifyCache.reason, message: verifyCache.message };
  }

  if (!hasPAT() || !hasCFServiceToken()) {
    return { ok: false };
  }

  try {
    const client = createJiraClient();
    const result = await client.checkConnection();
    if (!result.ok) {
      verifyCache = { ...result, ts: Date.now() };
      return result;
    }
    try {
      const user = await client.getMyself();
      const cached = { ok: true, user: user.displayName || user.name, ts: Date.now() };
      verifyCache = cached;
      return cached;
    } catch {
      const cached = { ok: true, user: undefined, ts: Date.now() };
      verifyCache = cached;
      return cached;
    }
  } catch (err: any) {
    const msg = err.message || '';
    let result: any;
    if (msg.includes('CF Authorization') || msg.includes('cloudflare') || msg.includes('CF-Access')) {
      result = { ok: false, reason: 'cf_token_invalid' };
    } else if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('PAT')) {
      result = { ok: false, reason: 'pat_invalid' };
    } else {
      result = { ok: false, reason: 'network_error', message: err.message };
    }
    verifyCache = { ...result, ts: Date.now() };
    return result;
  }
}

/**
 * 检查登录状态的 hook
 */
async function checkLoginHook(command: Command) {
  const commandName = command.name();
  if (commandName === 'setup') return;

  if (!hasPAT() || !hasCFServiceToken()) {
    console.error(`\n${Chalk.red('Error:')} 未登录或登录已过期\n`);
    printSetupHint();
    process.exit(1);
  }

  process.stderr.write('Verifying credentials...\n');
  const result = await verifyLogin();

  if (!result.ok) {
    const reasonMessages = {
      cf_token_invalid: 'CF Service Token 无效',
      pat_invalid: 'Personal Access Token 无效或已过期',
      network_error: result.message || '网络连接失败',
    };
    const reasonMsg = reasonMessages[result.reason || 'network_error'];
    console.error(`\n${Chalk.red('Error:')} ${reasonMsg}\n`);
    printConnectionHelp();
    process.exit(1);
  } else {
    process.stderr.write(`OK (${result.user})\n`);
  }
}

/**
 * 打印配置提示
 */
function printSetupHint() {
  const needCf = !hasCFServiceToken();
  const needPat = !hasPAT();

  if (needCf && needPat) {
    console.error(`${Chalk.bold('需要配置以下内容:')}\n`);
  }

  if (needCf) {
    console.error(`${Chalk.bold('1. CF Service Token:')}`);
    console.error(`   运行: ${Chalk.green('jira2claw setup --cf-client-id <id> --cf-client-secret <secret>')}\n`);
  }

  if (needPat) {
    console.error(`${Chalk.bold('2. Personal Access Token (PAT):')}`);
    console.error(`   运行: ${Chalk.green('jira2claw setup --pat <token>')}`);
    console.error(`   或访问 ${Chalk.cyan('https://www.rxpim.com/secure/ViewProfile.jspa')} 创建 API Token\n`);
  }
}

/**
 * 打印连接帮助
 */
function printConnectionHelp() {
  console.error(`${Chalk.bold('配置可能已过期或无效。请重新配置:')}\n`);
  console.error(`${Chalk.bold('运行')} ${Chalk.green('jira2claw setup')} ${Chalk.bold('重新配置认证信息')}\n`);
  console.error(`${Chalk.bold('CF Service Token:')}`);
  console.error(`   ${Chalk.green('jira2claw setup --cf-client-id <id> --cf-client-secret <secret>')}\n`);
  console.error(`${Chalk.bold('Personal Access Token:')}`);
  console.error(`   ${Chalk.green('jira2claw setup --pat <token>')}\n`);
}

/**
 * 显示状态表格
 */
export async function showStatus() {
  const host = getJiraHost();
  const configPath = path.join(os.homedir(), '.jira2claw', 'config.json');
  const patOk = hasPAT();
  const cfOk = hasCFServiceToken();
  const verifyResult = await verifyLogin();

  // 状态显示逻辑
  let statusLine: string;
  if (verifyResult.ok) {
    statusLine = Chalk.green('✓ Connected');
  } else if (patOk && cfOk) {
    const reasonMap = {
      cf_token_invalid: Chalk.yellow('⚠ CF Service Token 无效'),
      pat_invalid: Chalk.yellow('⚠ Personal Access Token 无效'),
      network_error: Chalk.red('✗ 网络错误'),
    };
    statusLine = reasonMap[verifyResult.reason || 'network_error'] || Chalk.yellow('⚠ Connection failed');
  } else {
    statusLine = Chalk.red('✗ Not configured');
  }

  const line = (label: string, value: string) => {
    const padding = 20 - label.length;
    return `  ${label}: ${' '.repeat(Math.max(1, padding))}${value}`;
  };

  console.log(`
${Chalk.bold('jira2claw Status')}
${'─'.repeat(60)}
${line('Jira Host', Chalk.green('●') + ' ' + host)}
${line('Config', Chalk.green('●') + ' ' + configPath)}
${line('Jira PAT', patOk ? Chalk.green('✓ Configured') : Chalk.red('✗ Missing'))}
${line('CF Service Token', cfOk ? Chalk.green('✓ Configured') : Chalk.red('✗ Missing'))}
${line('Status', statusLine)}
${line('User', verifyResult.ok ? Chalk.green(`✓ ${verifyResult.user}`) : Chalk.gray('-'))}
${'─'.repeat(60)}
`);

  if (!verifyResult.ok) {
    if (patOk && cfOk) {
      // 凭证已配置但连接失败，提示用户重新 setup
      console.error();
      if (verifyResult.message) {
        console.error(`  ${Chalk.red('✗')} ${verifyResult.message}`);
        console.error();
      }
      printConnectionHelp();
    } else {
      printSetupHint();
    }
  }
}

/**
 * 打印 J2C Logo (仿 MiniMax CLI 风格)
 */
function printLogo(out: NodeJS.WriteStream = process.stderr): void {
  // J ── 2 ── C  (box-drawing characters)
  const LOGO = [
    '███████╗  ███████╗  ███████╗',
    '╚════██║  ╚════██║  ██╔════╝',
    '     ██║   █████╔╝  ██║     ',
    '██   ██║  ██╔════╝  ██╔════╝',
    '╚████╔╝   ███████╗  ███████╗',
    ' ╚═══╝    ╚══════╝  ╚══════╝',
  ];
  // 品牌渐变色: 蓝绿 #00B4D8 → 青色 #2EC4B6 → 绿色 #57CC99
  const GRADIENT: [number, number, number][] = [
    [0, 180, 216],
    [0, 180, 216],
    [22, 178, 200],
    [46, 196, 182],
    [69, 204, 153],
    [87, 204, 153],
  ];

  out.write('\n');
  for (let i = 0; i < LOGO.length; i++) {
    if (out.isTTY) {
      const [r, g, b] = GRADIENT[i];
      out.write(`\x1b[1;38;2;${r};${g};${b}m${LOGO[i]}\x1b[0m\n`);
    } else {
      out.write(LOGO[i] + '\n');
    }
  }
}

const colorHelp = new ColorHelp();
const helpConfig = {
  styleTitle: colorHelp.styleTitle.bind(colorHelp),
  styleCommandDescription: colorHelp.styleCommandDescription.bind(colorHelp),
  styleCommandText: colorHelp.styleCommandText.bind(colorHelp),
  styleOptionTerm: colorHelp.styleOptionTerm.bind(colorHelp),
  styleOptionDescription: colorHelp.styleOptionDescription.bind(colorHelp),
  styleSubcommandText: colorHelp.styleSubcommandText.bind(colorHelp),
  styleSubcommandDescription: colorHelp.styleSubcommandDescription.bind(colorHelp),
  styleArgumentTerm: colorHelp.styleArgumentTerm.bind(colorHelp),
  styleArgumentDescription: colorHelp.styleArgumentDescription.bind(colorHelp),
};
const program = new Command();
program.configureHelp(helpConfig);

program
  .name('jira2claw')
  .description(`Jira CLI tool for openclaw skill integration

文档: docs/jira2claw-cli.md`)
  .version('1.1.5')
  .action(async () => {
    printLogo();
    await showStatus();
    console.error(`\n  运行 ${Chalk.green('j2c --help')} 获取更多帮助信息`);
    console.error(`  完整文档: ${Chalk.green('docs/jira2claw-cli.md')}\n`);
  });

// Register commands with login check
const commands = [
  readCommand,
  viewCommand,
  exportCommand,
  listCommand,
  statusCommand,
  assignCommand,
  commentCommand,
  meCommand,
  downloadCommand,
  batchTransitionCommand,
  batchCommentCommand,
  fieldsCommand,
  fieldsUpdateCommand,
  updateSummaryCommand,
  updateDescriptionCommand,
  listCommentsCommand,
  editCommentCommand,
  deleteCommentCommand,
  projectsCommand,
];

for (const cmd of commands) {
  cmd.hook('preAction', checkLoginHook);
  cmd.configureHelp(helpConfig);
  program.addCommand(cmd);
}

program.addCommand(setupCommand);

program.parse();
