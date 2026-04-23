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
  saveCFServiceToken,
  getCFClientId,
  getCFClientSecret,
  hasCFServiceToken,
} from '../../client/config.js';
import { createJiraClient } from '../../client/jira-client.js';

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
  .description('设置认证（CF Service Token + API Token）')
  .option('--pat <token>', 'Personal Access Token')
  .option('--cf-client-id <id>', 'CF Access Client ID')
  .option('--cf-client-secret <secret>', 'CF Access Client Secret')
  .action(async (options: { pat?: string; cfClientId?: string; cfClientSecret?: string }) => {
    try {
      // 非交互模式：通过参数直接配置
      if (options.pat || options.cfClientId || options.cfClientSecret) {
        if (options.cfClientId && options.cfClientSecret) {
          saveCFServiceToken(options.cfClientId, options.cfClientSecret);
          console.log('CF Service Token saved.');
        } else if (options.cfClientId || options.cfClientSecret) {
          console.error('Error: --cf-client-id 和 --cf-client-secret 必须同时提供');
          process.exit(1);
        }
        if (options.pat) {
          savePAT(options.pat);
          console.log('PAT saved.');
        }

        // 验证连接
        console.log('Verifying connection...');
        try {
          const client = createJiraClient();
          const user = await client.getMyself();
          console.log(`Connected as: ${user.displayName} (${user.emailAddress || user.name})`);
        } catch (err: any) {
          console.error(`Verification failed: ${err.message}`);
        }

        const { showStatus, clearVerifyCache } = await import('../index.js');
        clearVerifyCache();
        await showStatus();
        return;
      }

      // 交互模式
      // 1. CF Service Token
      const existingClientId = getCFClientId();
      const existingClientSecret = getCFClientSecret();

      if (existingClientId && existingClientSecret) {
        console.log(`\nCF Service Token: ${Chalk.gray('configured')}`);
        const change = await confirm('Change CF Service Token?', false);
        if (change) {
          const clientId = await prompt('Enter CF Access Client ID: ');
          const clientSecret = await prompt('Enter CF Access Client Secret: ');
          if (clientId && clientSecret) {
            saveCFServiceToken(clientId, clientSecret);
            console.log('CF Service Token updated.');
          }
        }
      } else {
        console.log('\nCF Service Token not configured.');
        const clientId = await prompt('Enter CF Access Client ID (press Enter to skip): ');
        if (clientId) {
          const clientSecret = await prompt('Enter CF Access Client Secret: ');
          if (clientId && clientSecret) {
            saveCFServiceToken(clientId, clientSecret);
            console.log('CF Service Token saved.');
          }
        }
      }

      // 2. PAT
      const existingPAT = getPAT();
      let pat: string | null = null;

      if (existingPAT) {
        const keep = await confirm('PAT already configured. Keep existing?', true);
        if (!keep) {
          pat = await prompt('Enter new PAT (press Enter to skip): ');
          if (pat) {
            savePAT(pat);
            console.log('PAT updated.');
          } else {
            console.log('Keeping existing PAT.');
          }
        } else {
          console.log('Keeping existing PAT.');
        }
      } else {
        pat = await prompt('Enter PAT: ');
        if (pat) {
          savePAT(pat);
          console.log('PAT saved.');
        }
      }

      if (!pat && !existingPAT) {
        console.log(`
${Chalk.bold('How to get JIRA API Token:')}

1. Visit https://www.rxpim.com/secure/ViewProfile.jspa
2. Click ${Chalk.cyan('Security')} → ${Chalk.cyan('API tokens')}
3. Click ${Chalk.green('Create API token')}
`);
        return;
      }

      // 3. 验证连接
      console.log('\nVerifying connection...');
      try {
        const client = createJiraClient();
        const user = await client.getMyself();
        console.log(`Connected as: ${user.displayName} (${user.emailAddress || user.name})`);
      } catch (err: any) {
        console.error(`Verification failed: ${err.message}`);
        console.error('Please check your PAT and CF Service Token configuration.');
        return;
      }

      // 4. 打印状态
      console.log('');
      const { showStatus } = await import('../index.js');
      await showStatus();
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });
