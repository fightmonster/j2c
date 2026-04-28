/**
 * jira setup - 交互式或命令行认证设置
 * CF 认证方式: 直接在请求头中携带 CF-Access-Client-Id / CF-Access-Client-Secret
 */

import { Command } from 'commander';
import Chalk from 'chalk';
import * as readline from 'readline';
import {
  savePAT,
  getPAT,
  writeConfig,
  getConfig,
} from '../../client/config.js';
import { createJiraClient } from '../../client/jira-client.js';
import { loginKeycloak } from '../../client/keycloak.js';

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function confirm(question: string, defaultYes: boolean = false): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const suffix = defaultYes ? '[Y/n]' : '[y/N]';
    rl.question(`${question} ${Chalk.gray(suffix)}: `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === 'y' || trimmed === 'yes') {
        resolve(true);
      } else if (trimmed === 'n' || trimmed === 'no') {
        resolve(false);
      } else {
        resolve(defaultYes);
      }
    });
  });
}

export const setupCommand = new Command('setup')
  .description('设置认证（Keycloak + API Token）')
  .option('--kc-username <username>', 'Keycloak Username (通常是邮箱)')
  .option('--kc-password <password>', 'Keycloak Password')
  .option('--pat <token>', 'Jira Personal Access Token')
  .option('--oauth-secret <secret>', 'OAuth2 Client Secret')
  .action(async (options: { pat?: string; kcUsername?: string; kcPassword?: string; oauthSecret?: string }) => {
    try {
      const config = getConfig();

      // 交互模式（如果没有提供任何参数）
      if (!options.pat && !options.kcUsername && !options.kcPassword) {
        console.log(Chalk.bold('\n=== 配置 Jira CLI 双层认证 ===\n'));

        // 1. PAT
        const existingPAT = getPAT();
        let pat = options.pat;
        if (!pat) {
          if (existingPAT) {
            const keep = await confirm('PAT already configured. Keep existing?', true);
            if (!keep) pat = await prompt('Enter new PAT (press Enter to skip): ');
          } else {
            console.log(Chalk.cyan('\n[1/4] Jira Personal Access Token (PAT)'));
            console.log(`How to get: Visit https://www.rxpim.com/secure/ViewProfile.jspa -> Security -> API tokens`);
            pat = await prompt('Enter PAT: ');
          }
        }
        if (pat) savePAT(pat);

        // 2. Keycloak Username
        console.log(Chalk.cyan('\n[2/4] Keycloak Username'));
        const kcUsername = await prompt(`Enter Keycloak Username ${config.keycloakUsername ? `(${config.keycloakUsername})` : ''}: `);
        if (kcUsername) writeConfig({ keycloakUsername: kcUsername });
        else if (!config.keycloakUsername) throw new Error('Username is required');

        // 3. Keycloak Password
        console.log(Chalk.cyan('\n[3/4] Keycloak Password'));
        const kcPassword = await prompt(`Enter Keycloak Password ${config.keycloakPassword ? '(已配置，按回车保留)' : ''}: `);
        if (kcPassword) writeConfig({ keycloakPassword: kcPassword });
        else if (!config.keycloakPassword) throw new Error('Password is required');

        // 4. OAuth2 Client Secret
          console.log(Chalk.cyan('\n[4/4] OAuth2 Client Secret'));
          const oauthSecret = await prompt(`Enter OAuth2 Client Secret ${config.oauth2ClientSecret ? '(已配置，按回车保留)' : ''}: `);
          if (oauthSecret) writeConfig({ oauth2ClientSecret: oauthSecret });
          else if (!config.oauth2ClientSecret) throw new Error('OAuth2 Client Secret is required');

        } else {
          // 命令行参数模式
          if (options.pat) savePAT(options.pat);
          if (options.kcUsername) writeConfig({ keycloakUsername: options.kcUsername });
          if (options.kcPassword) writeConfig({ keycloakPassword: options.kcPassword });
          if (options.oauthSecret) writeConfig({ oauth2ClientSecret: options.oauthSecret });
        }

      // 5. 验证连接
      console.log('\nVerifying Keycloak login...');
      try {
        await loginKeycloak();
        console.log(Chalk.green('✓ Keycloak login successful!'));
      } catch (err: any) {
        console.error(Chalk.red(`\n✗ Keycloak login failed: ${err.message}`));
        process.exit(1);
      }

      console.log('Verifying Jira connection...');
      try {
        const client = createJiraClient();
        const user = await client.getMyself();
        console.log(Chalk.green(`✓ Connected to Jira as: ${user.displayName} (${user.emailAddress || user.name})`));
      } catch (err: any) {
        console.error(Chalk.red(`\n✗ Jira connection failed: ${err.message}`));
        console.error('Please check your PAT configuration.');
        process.exit(1);
      }

      // 6. 打印状态
      console.log('');
      const { showStatus, clearVerifyCache } = await import('../index.js');
      clearVerifyCache();
      await showStatus();
    } catch (err: any) {
      console.error(Chalk.red(`\nError: ${err.message}`));
      process.exit(1);
    }
  });
