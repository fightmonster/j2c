/**
 * 统一配置文件管理
 * 配置存储在用户目录下 ~/.jira2claw/config.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 配置文件放在用户目录下
const CONFIG_DIR = path.join(os.homedir(), '.jira2claw');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface CLIConfig {
  jiraHost: string;
  pat: string | null;
  cfClientId: string | null;
  cfClientSecret: string | null;
}

const DEFAULT_CONFIG: CLIConfig = {
  jiraHost: 'https://www.rxpim.com',
  pat: null,
  cfClientId: null,
  cfClientSecret: null,
};

/**
 * 读取配置文件
 */
function readConfig(): CLIConfig {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * 写入配置文件（自动清理废弃字段）
 */
function writeConfig(config: CLIConfig): void {
  // 确保目录存在
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  // 只保留 CLIConfig 定义的键，自动删除 cfCookie 等废弃字段
  const clean: CLIConfig = {
    jiraHost: config.jiraHost,
    pat: config.pat,
    cfClientId: config.cfClientId,
    cfClientSecret: config.cfClientSecret,
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(clean, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

/**
 * 获取 JIRA Host
 */
export function getJiraHost(): string {
  // 环境变量优先
  if (process.env.JIRA_HOST) return process.env.JIRA_HOST;

  const config = readConfig();
  return config.jiraHost || DEFAULT_CONFIG.jiraHost;
}

/**
 * 设置 JIRA Host
 */
export function setJiraHost(host: string): void {
  const config = readConfig();
  config.jiraHost = host;
  writeConfig(config);
}

/**
 * 获取 PAT
 */
export function getPAT(): string | null {
  // 环境变量优先
  if (process.env.JIRA_PAT) return process.env.JIRA_PAT;

  const config = readConfig();
  return config.pat;
}

/**
 * 检查是否有 PAT
 */
export function hasPAT(): boolean {
  return getPAT() !== null;
}

/**
 * 保存 PAT
 */
export function savePAT(token: string): void {
  const config = readConfig();
  config.pat = token;
  writeConfig(config);
}

/**
 * 检查是否已登录（CF Service Token + PAT 都存在）
 */
export function isLoggedIn(): boolean {
  return hasCFServiceToken() && hasPAT();
}

/**
 * 获取完整配置（用于调试）
 */
export function getConfig(): CLIConfig {
  return readConfig();
}

/**
 * 删除配置项
 */
export function clearPAT(): void {
  const config = readConfig();
  config.pat = null;
  writeConfig(config);
}

/**
 * 获取 CF Service Token Client ID
 */
export function getCFClientId(): string | null {
  if (process.env.CF_ACCESS_CLIENT_ID) return process.env.CF_ACCESS_CLIENT_ID;
  const config = readConfig();
  return config.cfClientId;
}

/**
 * 获取 CF Service Token Client Secret
 */
export function getCFClientSecret(): string | null {
  if (process.env.CF_ACCESS_CLIENT_SECRET) return process.env.CF_ACCESS_CLIENT_SECRET;
  const config = readConfig();
  return config.cfClientSecret;
}

/**
 * 检查是否有 CF Service Token
 */
export function hasCFServiceToken(): boolean {
  return getCFClientId() !== null && getCFClientSecret() !== null;
}

/**
 * 保存 CF Service Token
 */
export function saveCFServiceToken(clientId: string, clientSecret: string): void {
  const config = readConfig();
  config.cfClientId = clientId;
  config.cfClientSecret = clientSecret;
  writeConfig(config);
}
