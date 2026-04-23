/**
 * jira comment - 添加评论
 * 支持三种格式:
 *   1. 纯文本: --message "text"
 *   2. Markdown: --message "**bold**" --markdown
 *   3. ADF: --adf '{"type":"doc",...}'
 *
 * Markdown 图片支持:
 *   - 本地图片自动上传为附件，并替换为 Jira 附件引用格式
 *   - 外部图片 URL 不支持（Jira 不渲染外部图片）
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { createJiraClient } from '../../client/jira-client.js';
import { markdownToWikiMarkup, textToWikiMarkup, adfToText } from '../../converter/markdown-to-adf.js';

// 支持的图片扩展名
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'];

function isImagePath(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

function resolveImagePath(ref: string): string | null {
  if (path.isAbsolute(ref)) {
    return fs.existsSync(ref) ? ref : null;
  }
  const fullPath = path.resolve(process.cwd(), ref);
  return fs.existsSync(fullPath) ? fullPath : null;
}

export const commentCommand = new Command('comment')
  .description('添加评论到 Issue (支持纯文本、Markdown、Wiki Markup)')
  .argument('<issueId>', 'Issue ID 或 Key')
  .option('-m, --message <text>', '评论内容 (纯文本或 Markdown，需配合 --markdown)')
  .option('--markdown', '内容为 Markdown 格式')
  .option('--adf <json>', 'ADF JSON 格式 (Atlassian Document Format)')
  .option('--attach <filePath>', '附加文件到评论（自动处理中文文件名）')
  .action(async (issueId: string, options: {
    message?: string;
    markdown?: boolean;
    adf?: string;
    attach?: string;
  }) => {
    try {
      if (!options.message && !options.adf) {
        console.error('Error: must provide --message or --adf');
        process.exit(1);
      }

      const client = createJiraClient();

      // 第一步：如果是 Markdown，先提取并上传本地图片
      const localImages: Array<{ originalMarkdown: string; alt: string; relativePath: string; uploadedFilename: string }> = [];

      if (options.markdown && options.message) {
        // 匹配 Markdown 图片语法: ![alt](path)
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let match;
        const processedPaths = new Set<string>();

        while ((match = imageRegex.exec(options.message)) !== null) {
          const [, alt, imagePath] = match;
          if (processedPaths.has(imagePath)) continue;
          processedPaths.add(imagePath);

          // 跳过外部 URL
          if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            console.log(`Skipping external image: ${imagePath}`);
            continue;
          }

          const fullPath = resolveImagePath(imagePath);
          if (!fullPath) {
            console.log(`Image file not found: ${imagePath}`);
            continue;
          }

          if (!isImagePath(fullPath)) {
            continue;
          }

          // 上传图片
          const result = await client.addAttachmentWithRename(issueId, fullPath);
          console.log(`Uploaded image: ${result.originalPath} → ${result.uploadedFilename}`);

          localImages.push({
            originalMarkdown: match[0], // 完整的原始 markdown 图片语法
            alt,
            relativePath: imagePath, // markdown 中的相对路径
            uploadedFilename: result.uploadedFilename
          });
        }
      }

      // 第二步：构建评论内容
      let body = '';
      if (options.adf) {
        try {
          const adf = JSON.parse(options.adf);
          body = adfToText(adf);
        } catch {
          console.error('Error: Invalid ADF JSON format');
          process.exit(1);
        }
      } else if (options.markdown) {
        // Markdown → Wiki Markup
        body = markdownToWikiMarkup(options.message!);

        // 替换本地图片引用为 Jira 附件引用
        for (const img of localImages) {
          // markdownToWikiMarkup 转换后的 wiki markup 格式
          // 例如: ![截图](test/xxx.png) → !test/xxx.png|alt=截图!
          const wikiMarkupRef = img.alt ? `!${img.relativePath}|alt=${img.alt}!` : `!${img.relativePath}!`;
          const uploadedRef = `!${img.uploadedFilename}|thumbnail!`;
          body = body.replace(wikiMarkupRef, uploadedRef);
        }
      } else {
        // 纯文本
        body = textToWikiMarkup(options.message!);
      }

      // 第三步：处理手动指定的附件
      if (options.attach) {
        if (!fs.existsSync(options.attach)) {
          console.error(`Error: file not found: ${options.attach}`);
          process.exit(1);
        }

        // 上传附件（自动处理中文文件名）
        const result = await client.addAttachmentWithRename(issueId, options.attach);
        console.log(`Uploaded attachment: ${result.originalPath} → ${result.uploadedFilename}`);

        // 如果是图片，插入缩略图引用
        if (isImagePath(options.attach)) {
          const imageRef = `!${result.uploadedFilename}|thumbnail!`;
          // 如果 body 有内容，先加换行
          body = body ? `${body}\n\n${imageRef}` : imageRef;
        }
      }

      // 添加评论
      const result = await client.addComment(issueId, body);
      console.log(`Comment added to ${issueId}: ${(result as any).id || 'success'}`);
    } catch (err: any) {
      const errorMsg = err.response?.data?.errorMessages?.join(', ') || err.message || 'Unknown error';
      console.error(`Error: ${errorMsg}`);
      process.exit(1);
    }
  });
