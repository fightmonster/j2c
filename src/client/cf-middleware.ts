/**
 * Cloudflare Access Middleware
 * 直接在请求头中携带 CF-Access-Client-Id / CF-Access-Client-Secret
 */

export { getCFClientId, getCFClientSecret, hasCFServiceToken, saveCFServiceToken } from './config.js';
export { getJiraHost } from './config.js';

/**
 * 检测响应是否为 CF Block
 */
export function isCFBlock(res: any): boolean {
  if (res.statusCode === 302 || res.statusCode === 301) {
    const location = res.headers?.location || '';
    return location.includes('cloudflareaccess.com') || location.includes('cloudflare');
  }
  return false;
}

/**
 * 检查是否是 CF 错误
 */
export function isCFError(err: any): boolean {
  return err?.message?.includes('Cloudflare Access') ||
         err?.message?.includes('CF_Authorization');
}
