/**
 * jira download - 下载 Issue 附件
 */

import { Command } from 'commander';
import Chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { createJiraClient } from '../../client/jira-client.js';

export const downloadCommand = new Command('download')
  .description('下载 Issue 的附件')
  .argument('<issueId>', 'Issue ID 或 Key')
  .option('-d, --dir <directory>', '下载目录', './downloads')
  .option('-n, --filename <name>', '只下载匹配此文件名的附件')
  .action(async (issueId: string, options: {
    dir: string;
    filename?: string;
  }) => {
    try {
      const client = createJiraClient();
      const issue = await client.getIssue(issueId);
      const attachments = issue.fields.attachment || [];

      if (attachments.length === 0) {
        console.log(`No attachments found for ${issueId}`);
        return;
      }

      // 过滤文件名
      const toDownload = options.filename
        ? attachments.filter(a => a.filename.includes(options.filename!))
        : attachments;

      if (toDownload.length === 0) {
        console.log(`No attachments matching "${options.filename}" found`);
        return;
      }

      // 创建下载目录
      const downloadDir = path.resolve(options.dir);
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
      }

      console.log(`Downloading ${toDownload.length} attachment(s) to ${downloadDir}`);

      for (const att of toDownload) {
        const destPath = path.join(downloadDir, `${issueId}_${att.filename}`);
        console.error(`  Downloading: ${att.filename}...`);
        await client.downloadAttachment(att.content, destPath);
        console.error(`  Saved: ${destPath}`);
      }

      console.log(`\nDownloaded ${toDownload.length} file(s)`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });
