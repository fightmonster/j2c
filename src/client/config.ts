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
  keycloakUrl: string;
  keycloakRealm: string;
  keycloakClientId: string;
  keycloakUsername: string | null;
  keycloakPassword: string | null;
  oauth2ClientSecret: string | null;
  kcAccessToken: string | null;
  kcRefreshToken: string | null;
  kcExpiresAt: number | null;
}

const DEFAULT_CONFIG: CLIConfig = {
  jiraHost: 'https://jira.rxpim.com',
  pat: null,
  keycloakUrl: 'https://auth.rxpim.com',
  keycloakRealm: 'jira',
  keycloakClientId: 'jira-client',
  keycloakUsername: null,
  keycloakPassword: null,
  oauth2ClientSecret: null,
  kcAccessToken: null,
  kcRefreshToken: null,
  kcExpiresAt: null,
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
export function writeConfig(config: Partial<CLIConfig>): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  const current = readConfig();
  const merged = { ...current, ...config };
  
  const clean: CLIConfig = {
    jiraHost: merged.jiraHost,
    pat: merged.pat,
    keycloakUrl: merged.keycloakUrl,
    keycloakRealm: merged.keycloakRealm,
    keycloakClientId: merged.keycloakClientId,
    keycloakUsername: merged.keycloakUsername,
    keycloakPassword: merged.keycloakPassword,
    oauth2ClientSecret: merged.oauth2ClientSecret,
    kcAccessToken: merged.kcAccessToken,
    kcRefreshToken: merged.kcRefreshToken,
    kcExpiresAt: merged.kcExpiresAt,
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
  // 强制使用最新的 jiraHost 默认值，忽略旧的 https://www.rxpim.com
  if (!config.jiraHost || config.jiraHost === 'https://www.rxpim.com') {
    return DEFAULT_CONFIG.jiraHost;
  }
  return config.jiraHost;
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
 * 检查是否已登录（具备全部必备认证信息）
 */
export function isLoggedIn(): boolean {
  const config = readConfig();
  return !!config.pat && !!config.keycloakUsername && !!config.keycloakPassword && !!config.oauth2ClientSecret;
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
 * 清除所有认证信息
 */
export function clearAuth(): void {
  writeConfig({
    pat: null,
    keycloakUsername: null,
    keycloakPassword: null,
    oauth2ClientSecret: null,
    kcAccessToken: null,
    kcRefreshToken: null,
    kcExpiresAt: null
  });
}
