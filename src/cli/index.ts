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
import { getPAT, getJiraHost, isLoggedIn, getConfig } from '../client/config.js';
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
let verifyCache: {
  ok: boolean;
  user?: string;
  reason?: 'kc_token_invalid' | 'pat_invalid' | 'network_error';
  message?: string;
  ts: number;
} | null = null;

/**
 * 清除登录验证缓存（setup 后调用，确保使用新凭证）
 */
export function clearVerifyCache(): void {
  verifyCache = null;
}

/**
 * 验证登录状态
 */
export async function verifyLogin(): Promise<{
  ok: boolean;
  user?: string;
  reason?: 'kc_token_invalid' | 'pat_invalid' | 'network_error';
  message?: string;
}> {
  if (verifyCache && Date.now() - verifyCache.ts < VERIFY_CACHE_TTL) {
    const { ts, ...result } = verifyCache;
    return result as { ok: boolean; user?: string; reason?: 'kc_token_invalid' | 'pat_invalid' | 'network_error'; message?: string };
  }

  if (!isLoggedIn()) {
    return { ok: false };
  }

  try {
    const client = createJiraClient();
    const user = await client.getMyself();
    const result = { ok: true, user: user.displayName || user.name };
    verifyCache = { ...result, ts: Date.now() };
    return result;
  } catch (err: any) {
    const msg = err?.message || String(err);
    let result: { ok: boolean; reason?: 'kc_token_invalid' | 'pat_invalid' | 'network_error'; message?: string };
    if (msg.includes('Keycloak') || msg.includes('keycloak') || msg.includes('403')) {
      result = { ok: false, reason: 'kc_token_invalid' };
    } else if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('PAT')) {
      result = { ok: false, reason: 'pat_invalid' };
    } else {
      result = { ok: false, reason: 'network_error', message: msg };
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

  if (!isLoggedIn()) {
    console.error(`\n${Chalk.red('Error:')} 未登录或登录已过期\n`);
    printSetupHint();
    process.exit(1);
  }

  process.stderr.write('Verifying credentials...\n');
  const result = await verifyLogin();

  if (!result.ok) {
    const reasonMessages = {
      kc_token_invalid: 'Keycloak Auth 无效',
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
  const config = getConfig();
  const needKc = !config.keycloakUsername || !config.keycloakPassword;
  const needPat = !config.pat;

  if (needKc && needPat) {
    console.error(`${Chalk.bold('需要配置以下内容:')}\n`);
  }

  if (needKc) {
    console.error(`${Chalk.bold('1. Keycloak Account:')}`);
    console.error(`   运行: ${Chalk.green('jira2claw setup --kc-username <username> --kc-password <password>')}\n`);
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
  console.error(`${Chalk.bold('Keycloak Account:')}`);
  console.error(`   ${Chalk.green('jira2claw setup --kc-username <username> --kc-password <password>')}\n`);
  console.error(`${Chalk.bold('Personal Access Token:')}`);
  console.error(`   ${Chalk.green('jira2claw setup --pat <token>')}\n`);
}

/**
 * 显示状态表格
 */
export async function showStatus() {
  const host = getJiraHost();
  const configPath = path.join(os.homedir(), '.jira2claw', 'config.json');
  const config = getConfig();
  const patOk = !!config.pat;
  const kcOk = !!(config.keycloakUsername && config.keycloakPassword && config.oauth2ClientSecret);
  const verifyResult = await verifyLogin();

  // 状态显示逻辑
  let statusLine: string;
  if (verifyResult.ok) {
    statusLine = Chalk.green('✓ Connected');
  } else if (patOk && kcOk) {
    const reasonMap = {
      kc_token_invalid: Chalk.yellow('⚠ Keycloak Auth 无效'),
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
${line('Keycloak Auth', kcOk ? Chalk.green('✓ Configured') : Chalk.red('✗ Missing'))}
${line('Status', statusLine)}
${line('User', verifyResult.ok ? Chalk.green(`✓ ${verifyResult.user}`) : Chalk.gray('-'))}
${'─'.repeat(60)}
`);

  if (!verifyResult.ok) {
    if (patOk && kcOk) {
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

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

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
  .version(pkg.version)
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
