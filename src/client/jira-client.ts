/**
 * Jira Client - jira.js SDK 封装
 * 支持 OAuth2/Bearer Token 认证 + CF Access Service Token
 */

import https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as stream from 'stream';
import { Readable } from 'stream';
import { Version2Client } from 'jira.js';
import { getPAT, getJiraHost, getConfig } from './config.js';
import { getValidAccessToken } from './keycloak.js';
import type {
  JiraIssue,
  JiraSearchResult,
  JiraTransition,
  JiraComment,
  JiraUser,
} from '../types/jira.js';

export interface JiraClientConfig {
  host: string;
  token?: string;
}

interface HttpRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: string | Buffer;
  headers?: Record<string, string>;
  timeout?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
}

interface HttpResponse<T = any> {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: T;
}

export class JiraClient {
  private client: Version2Client | null = null;
  private token: string;
  private clientHost: string;
  private parsedUrl: URL;

  constructor(config: JiraClientConfig) {
    this.token = config.token || this.getToken();
    this.clientHost = config.host;
    this.parsedUrl = new URL(config.host);
  }

  private getToken(): string {
    const token = getPAT();
    if (token) return token;
    throw new Error('No Jira PAT found. Run: j2c setup');
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const kcToken = await getValidAccessToken();
    const pat = this.getToken();
    const config = getConfig();

    return {
      'Authorization': `Bearer ${kcToken}`, // 用于通过 Nginx / Keycloak 层认证
      'X-Jira-Auth': `Bearer ${pat}`,       // 用于通过 Jira 层认证
      'X-Atlassian-Token': 'no-check',
      'Origin': config.jiraHost,
      'Referer': config.jiraHost,
    };
  }

  private async ensureClient(): Promise<Version2Client> {
    if (!this.client) {
      const headers = await this.getAuthHeaders();
      this.client = new Version2Client({
        host: this.clientHost,
        baseRequestConfig: {
          headers: {
            ...headers,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        },
      });
    }
    return this.client;
  }

  /**
   * 通用 HTTP 请求方法
   * 统一处理 headers、timeout、error handling
   */
  private async httpRequest<T = any>(options: HttpRequestOptions): Promise<HttpResponse<T>> {
    const { method, path: reqPath, body, headers: extraHeaders, timeout = 10000, followRedirects = false, maxRedirects = 5 } = options;

    const authHeaders = await this.getAuthHeaders();
    const reqHeaders: Record<string, string> = {
      ...authHeaders,
      'Accept': 'application/json',
      ...extraHeaders,
    };

    if (body && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }
    if (typeof body === 'string') {
      reqHeaders['Content-Length'] = String(Buffer.byteLength(body));
    } else if (Buffer.isBuffer(body)) {
      reqHeaders['Content-Length'] = String(body.length);
    }

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: this.parsedUrl.hostname,
        port: this.parsedUrl.port || 443,
        path: reqPath,
        method,
        headers: reqHeaders,
      }, (res) => {
        let responseBody = '';
        res.on('data', (chunk: string) => responseBody += chunk);
        res.on('end', () => {
          // Handle redirects
          if (followRedirects && (res.statusCode === 301 || res.statusCode === 302) && maxRedirects > 0) {
            const location = res.headers.location;
            if (location) {
              const redirectUrl = new URL(location, `${this.clientHost}${reqPath}`);
              this.httpRequest<T>({
                method: 'GET',
                path: redirectUrl.pathname + redirectUrl.search,
                headers: extraHeaders,
                timeout,
                followRedirects,
                maxRedirects: maxRedirects - 1,
              }).then(resolve).catch(reject);
              return;
            }
          }
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers as Record<string, string | string[] | undefined>,
            body: responseBody as T,
          });
        });
      });

      req.on('error', reject);
      req.setTimeout(timeout, () => {
        req.destroy();
        reject(new Error(`Request timeout: ${method} ${reqPath}`));
      });

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  /**
   * GET 请求快捷方法
   */
  private async httpGet<T = any>(reqPath: string, extraHeaders?: Record<string, string>): Promise<T> {
    const res = await this.httpRequest<string>({ method: 'GET', path: reqPath, headers: extraHeaders, followRedirects: true });
    if (res.statusCode === 200) {
      try {
        return JSON.parse(res.body);
      } catch {
        throw new Error(`Failed to parse response from ${reqPath}`);
      }
    }
    throw new Error(`GET ${reqPath} failed: ${res.statusCode} ${res.body}`);
  }

  // Issue Operations
  async getIssue(issueIdOrKey: string): Promise<JiraIssue> {
    const client = await this.ensureClient();
    return this.withRetry(() =>
      client.issues.getIssue({ issueIdOrKey })
    ) as Promise<JiraIssue>;
  }

  async updateIssueField(issueIdOrKey: string, fieldKey: string, value: any): Promise<void> {
    const res = await this.httpRequest({
      method: 'PUT',
      path: `/rest/api/2/issue/${encodeURIComponent(issueIdOrKey)}`,
      body: JSON.stringify({ fields: { [fieldKey]: value } }),
    });
    if (res.statusCode !== 204) {
      throw new Error(res.body || `Update failed: ${res.statusCode}`);
    }
  }

  async getProjects(): Promise<Array<{ key: string; name: string; projectTypeKey?: string }>> {
    return this.httpGet('/rest/api/2/project');
  }

  async getProjectIssueCounts(projectKey: string): Promise<Record<string, number>> {
    const categories = ['Done', 'In Progress', 'To Do'];
    const counts: Record<string, number> = {};

    const jqlBase = `project = ${projectKey}`;
    const totalResult = await this.searchIssues(jqlBase, { maxResults: 0, fields: [] });
    counts['Total'] = totalResult.total;

    for (const cat of categories) {
      try {
        const result = await this.searchIssues(`${jqlBase} AND statusCategory = "${cat}"`, { maxResults: 0, fields: [] });
        counts[cat] = result.total;
      } catch {
        counts[cat] = 0;
      }
    }

    return counts;
  }

  async getFields(): Promise<Array<{ id: string; name: string; key?: string }>> {
    return this.httpGet('/rest/api/2/field');
  }

  /**
   * 自动分页获取所有匹配 issue
   * Jira Server 单次最多返回约 1000 条，此方法自动循环分页
   */
  async searchAllIssues(jql: string, options?: {
    fields?: string[];
    pageSize?: number;
    onProgress?: (loaded: number, total: number) => void;
  }): Promise<JiraIssue[]> {
    const pageSize = options?.pageSize || 100;
    const fields = options?.fields || ['summary', 'status', 'issuetype', 'assignee', 'priority', 'updated'];
    const allIssues: JiraIssue[] = [];
    let startAt = 0;
    let total = Infinity;

    const client = await this.ensureClient();

    while (startAt < total) {
      const result = await this.withRetry(() =>
        client.issueSearch.searchForIssuesUsingJql({
          jql,
          startAt,
          maxResults: pageSize,
          fields,
        })
      ) as JiraSearchResult;

      total = result.total;
      const issues = result.issues || [];
      allIssues.push(...issues);
      startAt += issues.length;

      options?.onProgress?.(allIssues.length, total);

      if (issues.length === 0) break; // 安全退出
    }

    return allIssues;
  }

  async searchIssues(jql: string, options?: {
    startAt?: number;
    maxResults?: number;
    fields?: string[];
  }): Promise<JiraSearchResult> {
    const client = await this.ensureClient();
    return this.withRetry(() =>
      client.issueSearch.searchForIssuesUsingJql({
        jql,
        startAt: options?.startAt || 0,
        maxResults: options?.maxResults || 50,
        fields: options?.fields || ['summary', 'status', 'issuetype', 'assignee', 'priority', 'updated'],
      })
    ) as Promise<JiraSearchResult>;
  }

  // Transition Operations
  async getTransitions(issueIdOrKey: string): Promise<JiraTransition[]> {
    const client = await this.ensureClient();
    const result = await this.withRetry(() =>
      client.issues.getTransitions({ issueIdOrKey })
    ) as { transitions?: JiraTransition[] };
    return result.transitions || [];
  }

  async doTransition(issueIdOrKey: string, transitionId: string): Promise<void> {
    const client = await this.ensureClient();
    await this.withRetry(() =>
      client.issues.doTransition({
        issueIdOrKey,
        transition: { id: transitionId },
      })
    );
  }

  // Comment Operations
  async addComment(issueIdOrKey: string, body: string | object): Promise<JiraComment> {
    const client = await this.ensureClient();
    const commentBody = typeof body === 'string' ? body : JSON.stringify(body);
    const result = await this.withRetry(() =>
      client.issueComments.addComment({
        issueIdOrKey,
        comment: commentBody,
      })
    );
    return result as unknown as JiraComment;
  }

  async getComments(issueIdOrKey: string): Promise<JiraComment[]> {
    const client = await this.ensureClient();
    const result = await this.withRetry(() =>
      client.issueComments.getComments({ issueIdOrKey })
    ) as { comments?: JiraComment[] };
    return result.comments || [];
  }

  async editComment(issueIdOrKey: string, commentId: string, body: string): Promise<void> {
    const res = await this.httpRequest({
      method: 'PUT',
      path: `/rest/api/2/issue/${encodeURIComponent(issueIdOrKey)}/comment/${encodeURIComponent(commentId)}`,
      body: JSON.stringify({ body }),
    });
    if (res.statusCode !== 200) {
      throw new Error(res.body || `Edit comment failed: ${res.statusCode}`);
    }
  }

  async deleteComment(issueIdOrKey: string, commentId: string): Promise<void> {
    const res = await this.httpRequest({
      method: 'DELETE',
      path: `/rest/api/2/issue/${encodeURIComponent(issueIdOrKey)}/comment/${encodeURIComponent(commentId)}`,
    });
    if (res.statusCode !== 204) {
      throw new Error(res.body || `Delete comment failed: ${res.statusCode}`);
    }
  }

  async updateIssueSummary(issueIdOrKey: string, summary: string): Promise<void> {
    return this.updateIssueField(issueIdOrKey, 'summary', summary);
  }

  async updateIssueDescription(issueIdOrKey: string, description: string): Promise<void> {
    return this.updateIssueField(issueIdOrKey, 'description', description);
  }

  // Assignment
  async assignIssue(issueIdOrKey: string, name: string): Promise<void> {
    // Jira Server uses /assignee endpoint
    // Official API: https://docs.atlassian.com/software/jira/docs/api/REST/9.12.10/#api/2/issue-assign
    // For Jira Server/DC, use 'name' parameter (username)
    // Note: Official docs say 'name' is deprecated and should use 'key', but 'name' still works
    const res = await this.httpRequest({
      method: 'PUT',
      path: `/rest/api/2/issue/${encodeURIComponent(issueIdOrKey)}/assignee`,
      body: JSON.stringify({ name }),
    });
    if (res.statusCode !== 204) {
      let errorMsg = `Assign failed: ${res.statusCode}`;
      try {
        const errorDetails = res.body ? JSON.parse(res.body) : {};
        if (errorDetails.errorMessages) {
          errorMsg = errorDetails.errorMessages.join(', ');
        } else if (res.body) {
          errorMsg += ` ${res.body}`;
        }
      } catch {
        if (res.body) errorMsg += ` ${res.body}`;
      }
      throw new Error(errorMsg);
    }
  }

  // Attachments - uses stream for memory safety
  async addAttachment(issueIdOrKey: string, filePath: string): Promise<any[]> {
    return this.addAttachmentDirect(issueIdOrKey, filePath);
  }

  /**
   * 将非 ASCII 字符转换为 Unicode 转义序列，避免中文文件名上传问题
   * 例如: "截图.png" → "u622Au56FE.png"
   */
  private sanitizeChineseFilename(filename: string): string {
    const space = '　';
    const result = filename.split('').map(char => {
      if (char === ' ' || char === space) return '_';
      if (/[\x00-\x7F]/.test(char)) return char;
      // Unicode 转义: 每个非 ASCII 字符转为 uXXXX 形式
      return 'u' + char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
    }).join('');

    return result.replace(/_+/g, '_').replace(/^_|_$/g, '');
  }

  async addAttachmentWithRename(issueIdOrKey: string, filePath: string): Promise<{ originalPath: string; uploadedFilename: string; attachment: any }> {
    const originalFilename = path.basename(filePath);
    let uploadFilename = originalFilename;
    let tempFilePath: string | null = null;

    if (/[^\x00-\x7F]/.test(originalFilename)) {
      uploadFilename = this.sanitizeChineseFilename(originalFilename);
      tempFilePath = path.join(os.tmpdir(), uploadFilename);
      fs.copyFileSync(filePath, tempFilePath);
      console.log(`Renamed: ${originalFilename} → ${uploadFilename}`);
      filePath = tempFilePath;
    }

    const attachment = await this.addAttachmentDirect(issueIdOrKey, filePath);

    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    return { originalPath: originalFilename, uploadedFilename: uploadFilename, attachment };
  }

  /**
   * Stream-based attachment upload - avoids reading entire file into memory
   */
  private async addAttachmentDirect(issueIdOrKey: string, filePath: string, maxRedirects: number = 5): Promise<any> {
    const filename = path.basename(filePath);
    const boundary = `----JiraCLI${Date.now()}`;
    const fileSize = fs.statSync(filePath).size;
    const authHeaders = await this.getAuthHeaders();

    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
      'utf-8'
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
    const totalLength = header.length + fileSize + footer.length;

    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(filePath);
      const req = https.request({
        hostname: this.parsedUrl.hostname,
        port: this.parsedUrl.port || 443,
        path: `/rest/api/2/issue/${encodeURIComponent(issueIdOrKey)}/attachments`,
        method: 'POST',
        headers: {
          ...authHeaders,
          'X-Atlassian-Token': 'no-check',
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': totalLength,
        },
      }, (res) => {
        let body = '';
        res.on('data', (chunk: string) => body += chunk);
        res.on('end', () => {
          if ((res.statusCode === 301 || res.statusCode === 302) && maxRedirects > 0) {
            const redirectUrl = res.headers.location;
            if (redirectUrl) {
              this.addAttachmentDirect(issueIdOrKey, filePath, maxRedirects - 1).then(resolve).catch(reject);
              return;
            }
          }
          if ((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300) {
            try { resolve(JSON.parse(body)); } catch { resolve(body); }
          } else {
            reject(new Error(`Upload failed: ${res.statusCode} ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(60000, () => {  // 60s for uploads
        req.destroy();
        reject(new Error('Upload timeout'));
      });

      // Stream: header + file + footer
      req.write(header);
      fileStream.pipe(req, { end: false });
      fileStream.on('end', () => {
        req.write(footer);
        req.end();
      });
      fileStream.on('error', (err) => {
        req.destroy();
        reject(err);
      });
    });
  }

  async downloadAttachment(url: string, destPath: string, maxRedirects: number = 5): Promise<void> {
    const authHeaders = await this.getAuthHeaders();
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      const request = https.get(url, {
        headers: {
          ...authHeaders,
        },
      }, (res) => {
        if ((res.statusCode === 301 || res.statusCode === 302) && maxRedirects > 0) {
          file.close();
          const location = res.headers.location;
          if (location) {
            this.downloadAttachment(location, destPath, maxRedirects - 1).then(resolve).catch(reject);
          } else {
            reject(new Error('Redirect without location'));
          }
          return;
        }
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          reject(new Error('Too many redirects'));
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      });

      request.on('error', (err: Error) => {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        reject(err);
      });
    });
  }

  async getAttachmentContent(contentUrl: string): Promise<Buffer> {
    const parsedUrl = new URL(contentUrl);
    const authHeaders = await this.getAuthHeaders();
    
    return this.withRetry(() => new Promise((resolve, reject) => {
      const req = https.get(
        contentUrl,
        {
          headers: {
            ...authHeaders,
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Failed to get attachment: HTTP ${res.statusCode}`));
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        }
      );

      req.on('error', reject);
    }));
  }

  // User
  async getMyself(): Promise<JiraUser> {
    const client = await this.ensureClient();
    return this.withRetry(() =>
      client.myself.getCurrentUser()
    ) as Promise<JiraUser>;
  }

  /**
   * 检查连接状态，区分具体失败原因
   */
  async checkConnection(): Promise<{
    ok: boolean;
    reason?: 'cf_token_invalid' | 'pat_invalid' | 'network_error';
    message?: string;
  }> {
    try {
      const res = await this.httpRequest({ method: 'GET', path: '/rest/api/2/serverInfo' });
      const contentType = String(res.headers['content-type'] || '');

      if (res.statusCode === 200) {
        if (contentType.includes('application/json')) {
          try { JSON.parse(res.body); return { ok: true }; } catch {}
        }
        return { ok: false, reason: 'cf_token_invalid', message: 'CF Service Token 无效' };
      }

      if (res.statusCode === 401 || res.statusCode === 403) {
        return { ok: false, reason: 'pat_invalid', message: 'Personal Access Token 无效或已过期' };
      }

      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = String(res.headers['location'] || '');
        if (location.includes('cloudflareaccess.com') || location.includes('cloudflare')) {
          return { ok: false, reason: 'cf_token_invalid', message: 'CF Service Token 无效' };
        }
        return { ok: false, reason: 'network_error', message: `重定向到未知地址: ${res.statusCode}` };
      }

      return { ok: false, reason: 'network_error', message: `服务器返回错误: ${res.statusCode}` };
    } catch (err: any) {
      return { ok: false, reason: 'network_error', message: err.message || '网络连接失败' };
    }
  }

  // Batch operations with concurrency control
  async batchTransition(
    issueKeys: string[],
    targetStatus: string,
    concurrency: number = 5
  ): Promise<{ success: string[]; failed: Array<{ key: string; error: string }> }> {
    const success: string[] = [];
    const failed: Array<{ key: string; error: string }> = [];

    for (let i = 0; i < issueKeys.length; i += concurrency) {
      const batch = issueKeys.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map(async (key) => {
          const transitions = await this.getTransitions(key);
          const matched = transitions.find(
            t => t.name.toLowerCase() === targetStatus.toLowerCase() ||
                 t.to.name.toLowerCase() === targetStatus.toLowerCase()
          );
          if (matched) {
            await this.doTransition(key, matched.id);
            return { key, ok: true as const };
          }
          return { key, ok: false as const, error: `No transition found for status: ${targetStatus}` };
        })
      );
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled') {
          if (r.value.ok) success.push(r.value.key);
          else failed.push({ key: r.value.key, error: r.value.error });
        } else {
          failed.push({ key: batch[j], error: r.reason?.message || String(r.reason) });
        }
      }
    }

    return { success, failed };
  }

  async batchComment(
    issueKeys: string[],
    body: string | object,
    concurrency: number = 5
  ): Promise<{ success: string[]; failed: Array<{ key: string; error: string }> }> {
    const success: string[] = [];
    const failed: Array<{ key: string; error: string }> = [];

    for (let i = 0; i < issueKeys.length; i += concurrency) {
      const batch = issueKeys.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map(async (key) => {
          await this.addComment(key, body);
          return key;
        })
      );
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled') {
          success.push(r.value);
        } else {
          failed.push({ key: batch[j], error: r.reason?.message || String(r.reason) });
        }
      }
    }

    return { success, failed };
  }

  /**
   * Enhanced retry with exponential backoff
   * Covers: ECONNRESET, ETIMEDOUT, ECONNREFUSED, socket errors
   * HTTP status: 429 (rate limit), 502, 503, 504
   */
  private async withRetry<T>(fn: () => Promise<T>, attempt: number = 0, maxRetries: number = 3): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt >= maxRetries) throw err;

      const shouldRetry =
        // Network errors
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNREFUSED' ||
        err.message?.includes('socket') ||
        // HTTP status codes in error message (jira.js throws with statusCode)
        err.statusCode === 429 ||
        err.statusCode === 502 ||
        err.statusCode === 503 ||
        err.statusCode === 504 ||
        // Check message for status codes (raw https requests)
        /status[:\s]+(429|502|503|504)/i.test(err.message || '');

      if (!shouldRetry) throw err;

      // Exponential backoff: 500ms, 1s, 2s
      const delay = Math.min(500 * Math.pow(2, attempt), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));

      return this.withRetry(fn, attempt + 1, maxRetries);
    }
  }
}

export function createJiraClient(host?: string): JiraClient {
  return new JiraClient({
    host: host || getJiraHost(),
  });
}
