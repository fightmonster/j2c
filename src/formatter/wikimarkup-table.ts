/**
 * WikiMarkup Table Renderer
 * 将 Jira WikiMarkup 表格转换为终端友好的格式
 */

import Table from 'cli-table3';

/**
 * 解析 WikiMarkup 表格
 * 支持格式：
 * | 列1 | 列2 | 列3 |
 * |:---:|------|-----|
 * | 值1 | 值2 | 值3 |
 */
export function parseWikiMarkupTable(lines: string[]): {
  headers: string[];
  rows: string[][];
  alignments: ('left' | 'center' | 'right')[];
} | null {
  if (lines.length < 2) return null;

  // 检查是否是表格行
  const isTableRow = (line: string) => line.trim().startsWith('|') && line.trim().endsWith('|');
  
  // 找到表格开始
  let startIdx = 0;
  while (startIdx < lines.length && !isTableRow(lines[startIdx])) {
    startIdx++;
  }
  
  if (startIdx >= lines.length) return null;

  // 解析表头
  const headerLine = lines[startIdx].trim();
  const headers = parseTableRow(headerLine);
  
  if (headers.length === 0) return null;

  // 解析对齐行（第二行）
  const alignLine = lines[startIdx + 1]?.trim() || '';
  let alignments: ('left' | 'center' | 'right')[] = [];
  
  // Jira WikiMarkup 可能没有专门的对齐行（特别是带有 || 表头的）
  // 检查第二行是否是对齐行
  let dataStartIndex = startIdx + 1;
  if (alignLine.includes('---')) {
    alignments = parseAlignment(alignLine, headers.length);
    dataStartIndex = startIdx + 2;
  } else {
    // 默认左对齐
    alignments = Array(headers.length).fill('left');
  }

  // 解析数据行
  const rows: string[][] = [];
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!isTableRow(line)) break;
    rows.push(parseTableRow(line));
  }

  return { headers, rows, alignments };
}

/**
 * 解析表格行
 */
function parseTableRow(line: string): string[] {
  // 移除首尾的 | 或 ||
  let content = line.trim();
  if (content.startsWith('||')) {
    content = content.slice(2);
  } else if (content.startsWith('|')) {
    content = content.slice(1);
  }
  
  if (content.endsWith('||')) {
    content = content.slice(0, -2);
  } else if (content.endsWith('|')) {
    content = content.slice(0, -1);
  }

  // 按 | 或 || 分割，但保留转义的 \|
  const cells: string[] = [];
  let current = '';
  let escaped = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '|') {
      // 检查是否是 ||
      if (i + 1 < content.length && content[i + 1] === '|') {
        i++; // 跳过第二个 |
      }
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  
  return cells;
}

/**
 * 解析对齐行
 * |:---:| = center, |---:| = right, |:---| = left, |---| = left
 */
function parseAlignment(line: string, colCount: number): ('left' | 'center' | 'right')[] {
  const alignments: ('left' | 'center' | 'right')[] = [];
  const cells = line.split('|').filter(c => c.trim());
  
  for (let i = 0; i < colCount; i++) {
    const cell = cells[i]?.trim() || '';
    if (cell.startsWith(':') && cell.endsWith(':')) {
      alignments.push('center');
    } else if (cell.endsWith(':')) {
      alignments.push('right');
    } else {
      alignments.push('left');
    }
  }
  
  return alignments;
}

/**
 * 渲染 WikiMarkup 表格为终端表格
 */
export function renderWikiMarkupTable(tableText: string): string {
  const lines = tableText.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    
    // 检查是否是表格开始
    if (line.startsWith('|') && line.endsWith('|')) {
      // 收集整个表格
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      
      const parsed = parseWikiMarkupTable(tableLines);
      if (parsed) {
        result.push(renderTable(parsed));
      } else {
        result.push(...tableLines);
      }
    } else {
      result.push(lines[i]);
      i++;
    }
  }

  return result.join('\n');
}

/**
 * 使用 cli-table3 渲染表格
 */
function renderTable(parsed: { headers: string[]; rows: string[][]; alignments: ('left' | 'center' | 'right')[] }): string {
  const { headers, rows, alignments } = parsed;
  
  // 创建表格配置
  const colAligns = alignments.map(a => a === 'center' ? 'middle' : a);
  
  const table = new Table({
    head: headers.map(h => cleanWikiMarkup(h)),
    colAligns: colAligns as any,
    style: {
      'padding-left': 1,
      'padding-right': 1,
      head: ['cyan'],
      border: ['grey'],
    },
  });

  for (const row of rows) {
    table.push(row.map(cell => cleanWikiMarkup(cell)));
  }

  return table.toString();
}

/**
 * 清理 WikiMarkup 格式（移除 * 粗体、_ 斜体等）
 */
function cleanWikiMarkup(text: string): string {
  return text
    // 移除粗体 *text*
    .replace(/\*([^*]+)\*/g, '$1')
    // 移除斜体 _text_
    .replace(/_([^_]+)_/g, '$1')
    // 移除链接 [text|url]
    .replace(/\[([^|]+)\|([^\]]+)\]/g, '$1')
    // 移除简单链接 [text]
    .replace(/\[([^\]]+)\]/g, '$1')
    // 将 <br> 换为换行
    .replace(/<br\s*\/?>/gi, '\n')
    // 移除 {color} 标签
    .replace(/\{color:[^}]+\}/g, '')
    .replace(/\{color\}/g, '');
}

/**
 * 检测文本中是否包含 WikiMarkup 表格
 */
export function hasWikiMarkupTable(text: string): boolean {
  const lines = text.split('\n');
  let tableLineCount = 0;
  
  for (const line of lines) {
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      tableLineCount++;
      if (tableLineCount >= 2) return true;
    } else {
      tableLineCount = 0;
    }
  }
  
  return false;
}
