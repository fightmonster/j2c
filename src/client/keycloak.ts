import * as https from 'https';
import { URL } from 'url';
import { getConfig, writeConfig } from './config.js';

/**
 * 发送表单数据的 HTTP POST 请求
 */
function postForm(urlStr: string, data: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const postData = new URLSearchParams(data).toString();

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * 执行 Keycloak 登录获取 Access Token
 */
export async function loginKeycloak(): Promise<boolean> {
  const config = getConfig();
  if (!config.keycloakUsername || !config.keycloakPassword || !config.oauth2ClientSecret) {
    throw new Error('缺少 Keycloak 认证信息，请运行 j2c setup 配置。');
  }

  const tokenUrl = `${config.keycloakUrl}/realms/${config.keycloakRealm}/protocol/openid-connect/token`;

  try {
    const tokenData = await postForm(tokenUrl, {
      grant_type: 'password',
      client_id: config.keycloakClientId,
      client_secret: config.oauth2ClientSecret,
      username: config.keycloakUsername,
      password: config.keycloakPassword,
      scope: 'openid profile email'
    });

    if (!tokenData.access_token) {
      throw new Error('未获取到 Access Token');
    }

    writeConfig({
      kcAccessToken: tokenData.access_token,
      kcRefreshToken: tokenData.refresh_token,
      kcExpiresAt: Date.now() + (tokenData.expires_in * 1000) - 10000 // 提前10秒视为过期
    });
    return true;
  } catch (err) {
    throw new Error(`Keycloak 登录失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * 使用 Refresh Token 刷新 Access Token
 */
export async function refreshKeycloakToken(): Promise<boolean> {
  const config = getConfig();
  if (!config.kcRefreshToken || !config.oauth2ClientSecret) {
    return false;
  }

  const tokenUrl = `${config.keycloakUrl}/realms/${config.keycloakRealm}/protocol/openid-connect/token`;

  try {
    const tokenData = await postForm(tokenUrl, {
      grant_type: 'refresh_token',
      client_id: config.keycloakClientId,
      client_secret: config.oauth2ClientSecret,
      refresh_token: config.kcRefreshToken
    });

    if (!tokenData.access_token) {
      return false;
    }

    writeConfig({
      kcAccessToken: tokenData.access_token,
      kcRefreshToken: tokenData.refresh_token,
      kcExpiresAt: Date.now() + (tokenData.expires_in * 1000) - 10000
    });
    return true;
  } catch (err) {
    // 刷新失败（可能 refresh token 已过期）
    writeConfig({ kcAccessToken: null, kcRefreshToken: null, kcExpiresAt: null });
    return false;
  }
}

/**
 * 获取有效的 Access Token (自动处理缓存和刷新)
 */
export async function getValidAccessToken(): Promise<string> {
  const config = getConfig();

  // 1. 如果缓存中存在并且未过期，直接返回
  if (config.kcAccessToken && config.kcExpiresAt && Date.now() < config.kcExpiresAt) {
    return config.kcAccessToken;
  }

  // 2. 尝试使用 Refresh Token 刷新
  if (config.kcRefreshToken) {
    const refreshed = await refreshKeycloakToken();
    if (refreshed) {
      return getConfig().kcAccessToken!;
    }
  }

  // 3. 刷新失败或没有 Token，进行全新登录
  await loginKeycloak();
  return getConfig().kcAccessToken!;
}
