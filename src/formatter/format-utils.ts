/**
 * 格式化工具函数（统一导出，避免重复定义）
 */

/**
 * 格式化文件大小
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 从 ADF 节点提取纯文本（简化版，用于格式化输出）
 */
export function extractTextFromADF(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (node.text !== undefined) return String(node.text);
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextFromADF).join('');
  }
  return '';
}
