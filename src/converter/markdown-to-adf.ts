/**
 * Markdown → Wiki Markup Converter
 * Jira Server v9 REST API v2 支持 Wiki Markup 格式
 *
 * Wiki Markup 参考:
 *   - Confluence Wiki Markup: https://confluence.atlassian.com/doc/confluence-wiki-markup-251003035.html
 *   - 转换库参考: https://github.com/kenchan0130/markdown-to-atlassian-wiki-markup
 *
 * 支持的 Markdown 语法:
 *   - 标题: h1. ~ h6. (行首)
 *   - 粗体: **text** → *text*
 *   - 斜体: *text* → _text_
 *   - 删除线: ~~text~~ → -text-
 *   - 行内代码: `code` → {{code}}
 *   - 代码块: ```language → {code:language=xxx}\n...\n{code}
 *   - 链接: [text](url) → [text|url]
 *   - 图片: ![alt](url) → !url|alt!
 *   - 无序列表: - item → * item
 *   - 有序列表: 1. item → # item
 *   - 引用块: > quote → {quote}quote{Quote}
 *   - 水平线: --- → ----
 *   - 表格: 透传（Wiki Markup 原生支持）
 */

/**
 * Markdown → Wiki Markup 转换
 */
export function markdownToWikiMarkup(input: string): string {
  let result = input;

  // 1. 先处理多行代码块 (``` ... ```) → {code:language}\n...\n{code}
  result = result.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
    const language = lang ? `language=${lang}` : '';
    return `{code:${language}}\n${code.trim()}\n{code}\n`;
  });

  // 2. 处理行内代码 (`code`) → {{code}}
  //    在代码块已处理之后，剩余的反引号对都是行内代码
  result = result.replace(/`([^`]+)`/g, '{{$1}}');

  // 3. 处理标题 (h1 ~ h6)
  result = result.replace(/^###### (.+)$/gm, 'h6. $1');
  result = result.replace(/^##### (.+)$/gm, 'h5. $1');
  result = result.replace(/^#### (.+)$/gm, 'h4. $1');
  result = result.replace(/^### (.+)$/gm, 'h3. $1');
  result = result.replace(/^## (.+)$/gm, 'h2. $1');
  result = result.replace(/^# (.+)$/gm, 'h1. $1');

  // 4. 处理删除线 ~~text~~ → -text-
  result = result.replace(/~~(.+?)~~/g, '-$1-');

  // 5. 处理粗体 **text** → 使用占位符避免被斜体处理
  //    使用 Unicode 私用区字符 U+E000 作为占位符，不会与正常文本冲突
  const BOLD_OPEN = '\uE000';
  const BOLD_CLOSE = '\uE001';
  result = result.replace(/\*\*(.+?)\*\*/g, `${BOLD_OPEN}$1${BOLD_CLOSE}`);

  // 6. 处理斜体 *text* (但不是 ** 或 *)
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '_$1_');

  // 7. 还原粗体占位符 → *text*
  result = result.replace(new RegExp(`${BOLD_OPEN}(.+?)${BOLD_CLOSE}`, 'g'), '*$1*');

  // 8. 处理图片: ![alt](url) → !url|alt=xxx! (必须在链接之前)
  // 支持空 alt: ![]() → !url!
  result = result.replace(/!\[(.*?)\]\((.+?)\)/g, (_m, alt, url) => {
    const altPart = alt ? `|alt=${alt}` : '';
    return `!${url}${altPart}!`;
  });

  // 9. 处理链接: [text](url) → [text|url]
  result = result.replace(/\[(.+?)\]\((.+?)\)/g, '[$1|$2]');

  // 10. 处理无序列表: - item → * item (支持缩进)
  result = result.replace(/^(\s*)- (.+)$/gm, (_m, indent, content) => `${indent}* ${content}`);

  // 11. 处理有序列表: 1. item → # item (支持缩进)
  result = result.replace(/^(\s*)\d+\. (.+)$/gm, (_m, indent, content) => `${indent}# ${content}`);

  // 12. 处理引用块: > quote → bq. quote (单行引用，符合 WikiMarkup 规范)
  result = result.replace(/^> (.+)$/gm, 'bq. $1');

  // 13. 处理水平线: --- → ----
  result = result.replace(/^---$/gm, '----');

  // 14. 处理表格对齐行: 移除 Markdown 表格对齐语法，同时将上一行的表头转换为 WikiMarkup 表头格式 (||)
  //     Jira WikiMarkup 表格不支持 |:---:| 对齐语法，需要移除
  //     匹配类似 | Header | 加上下一行的 |:---:|--------|------| (包括带有空格、缺失前后管道符的情况)
  //     移除后需要清理表格标题行和数据行之间的空行，否则 Jira 渲染会出问题
  result = result.replace(/^([ \t]*\|?.*\|.*)\r?\n[ \t]*\|?(?:[ \t]*:?-+:?[ \t]*\|)+[ \t]*(?::?-+:?[ \t]*\|?)?[ \t]*$/gm, (_match, headerRow) => {
    let cleaned = headerRow.trim();
    if (!cleaned.startsWith('|')) {
      cleaned = '|' + cleaned;
    }
    if (!cleaned.endsWith('|')) {
      cleaned = cleaned + '|';
    }
    return cleaned.replace(/(?<!\\)\|/g, '||');
  });

  // 15. 清理表格区域的多余空行（表格标题行和数据行之间不能有空行）
  //     匹配: 表格行 + 空行 + 表格行 → 移除中间空行
  result = result.replace(/^(\|.*\|)\n\n(\|.*\|)$/gm, '$1\n$2');

  // 16. 将 <br> 转换为 WikiMarkup 换行
  //     表格单元格内: <br> → \\ (WikiMarkup 换行符)
  //     连续 <br><br> → \\ \\ (官方规范: 多个换行之间必须用空格分隔)
  //     \\ 后直接跟非空格字符时需补空格: \\• → \\ •
  //     非表格区域: <br> → \n (普通换行)
  result = result.split('\n').map(line => {
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      // 表格行：先替换每个 <br> 为 \\
      let replaced = line.replace(/<br\s*\/?>/gi, '\\\\');
      // 确保连续 \\ 之间有空格: \\\\ → \\ \\
      replaced = replaced.replace(/(\\\\)(\\\\)/g, '$1 $2');
      // 确保 \\ 后面不是空白时补空格: \\• → \\ •
      replaced = replaced.replace(/\\\\([^\s\\])/g, '\\\\ $1');
      return replaced;
    } else {
      // 非表格行：使用普通换行
      return line.replace(/<br\s*\/?>/gi, '\n');
    }
  }).join('\n');

  // 17. 清理多余空行
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

/**
 * 纯文本 → Wiki Markup 单行
 */
export function textToWikiMarkup(input: string): string {
  return input
    .replace(/\n/g, ' ')
    .trim();
}

/**
 * ADF → 纯文本 (提取 ADF 中的文本内容)
 * 用于 Jira Server (不支持 ADF 视觉评论)
 */
export function adfToText(adf: any): string {
  if (!adf || !adf.content) {
    return '';
  }

  const lines: string[] = [];

  function processNode(node: any) {
    if (!node) return;

    switch (node.type) {
      case 'text':
        lines.push(node.text || '');
        break;

      case 'paragraph':
        if (node.content) {
          node.content.forEach(processNode);
        }
        lines.push('');
        break;

      case 'heading':
        if (node.content) {
          const level = node.attrs?.level || 1;
          const prefix = 'h' + level + '. ';
          lines.push(prefix + node.content.map((n: any) => n.text || '').join(''));
        }
        lines.push('');
        break;

      case 'bulletList':
      case 'orderedList':
        if (node.content) {
          node.content.forEach((item: any, idx: number) => {
            if (item.content) {
              const prefix = node.type === 'orderedList' ? `${idx + 1}. ` : '* ';
              const text = item.content.map((n: any) => n.text || '').join('');
              lines.push(prefix + text);
            }
          });
        }
        lines.push('');
        break;

      case 'listItem':
        if (node.content) {
          node.content.forEach(processNode);
        }
        break;

      case 'codeBlock':
        if (node.content) {
          const language = node.attrs?.language || '';
          lines.push(`{code:${language ? `language=${language}` : ''}}`);
          node.content.forEach((n: any) => {
            if (n.content) {
              lines.push(n.content.map((c: any) => c.text || '').join(''));
            }
          });
          lines.push('{code}');
        }
        lines.push('');
        break;

      case 'blockquote':
        if (node.content) {
          lines.push('{quote}');
          node.content.forEach(processNode);
          lines.push('{quote}');
        }
        lines.push('');
        break;

      case 'hardBreak':
        lines.push('\n');
        break;

      default:
        if (node.content && Array.isArray(node.content)) {
          node.content.forEach(processNode);
        }
        break;
    }
  }

  adf.content.forEach(processNode);

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * 自动检测内容格式
 *   - ADF JSON: 以 { 开头且包含 "type": "doc"
 *   - Markdown: 包含 Markdown 特有语法标记
 *   - Plain Text: 无特殊格式标记
 */
export function detectContentFormat(content: string): 'adf' | 'markdown' | 'text' {
  const trimmed = content.trim();

  // ADF JSON: 以 { 开头且包含 "type": "doc"
  if (trimmed.startsWith('{') && /"type"\s*:\s*"doc"/.test(trimmed)) {
    return 'adf';
  }

  // Markdown 特有语法标记
  const markdownPatterns = [
    /^#{1,6}\s/m,                    // 标题 # ~ ######
    /\*\*[^*]+\*\*/,                 // 粗体 **text**
    /```[\s\S]*?```/,                // 代码块 ```
    /\[[^\]]+\]\([^)]+\)/,           // 链接 [text](url)
    /^>\s/m,                         // 引用 > quote
    /^\|.*\|.*\|/m,                  // 表格 | a | b |
    /^---$/m,                        // 水平线 ---
    /^[-*]\s/m,                      // 无序列表 - item / * item
    /^\d+\.\s/m,                     // 有序列表 1. item
    /!\[[^\]]*\]\([^)]+\)/,          // 图片 ![alt](url)
    /^```/m,                         // 代码块开始
    /<br\s*\/?>/i,                   // HTML <br> 标签
  ];

  for (const pattern of markdownPatterns) {
    if (pattern.test(trimmed)) {
      return 'markdown';
    }
  }

  return 'text';
}
