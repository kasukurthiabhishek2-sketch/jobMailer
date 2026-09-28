/**
 * GitHub Copilot Device Authorization and Completion Service
 * Uses GitHub OAuth Device Flow (RFC 8628) to authenticate without needing an API key.
 */

const CLIENT_ID = 'Iv1.b507a08c87ecfe98'; // Official public Copilot Client ID
let defaultCache = {
  copilotToken: null,
  expiresAt: 0
};
const tokenCaches = new Map();
let pendingDeviceFlow = null;

/**
 * Initiate Device Code Authorization
 */
async function startDeviceFlow() {
  const response = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'GitHub-Copilot-App'
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      scope: 'read:user'
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to request GitHub device code: ${text}`);
  }

  const data = await response.json();
  const flow = {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri || 'https://github.com/login/device',
    expiresIn: data.expires_in,
    expiresAt: Date.now() + ((data.expires_in || 900) * 1000),
    interval: data.interval || 5
  };
  pendingDeviceFlow = flow;
  return flow;
}

/**
 * Poll GitHub to check if user has approved the device code
 */
async function checkDeviceStatus(deviceCode) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'GitHub-Copilot-App'
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    })
  });

  const data = await response.json();

  if (data.error) {
    if (data.error === 'authorization_pending') {
      return { status: 'pending' };
    }
    if (data.error === 'slow_down') {
      return { status: 'slow_down', interval: data.interval || 5 };
    }
    if (data.error === 'expired_token') {
      clearPendingDeviceFlow();
      return { status: 'expired', error: 'Verification code expired. Please try again.' };
    }
    if (data.error === 'access_denied') {
      clearPendingDeviceFlow();
      return { status: 'denied', error: 'User canceled the authorization request.' };
    }
    return { status: 'error', error: data.error_description || data.error };
  }

  if (data.access_token) {
    clearPendingDeviceFlow();
    return {
      status: 'authorized',
      accessToken: data.access_token,
      tokenType: data.token_type
    };
  }

  return { status: 'pending' };
}

/**
 * Retrieve Copilot Session Token from GitHub API
 */
async function getCopilotSessionToken(githubAccessToken) {
  const cache = githubAccessToken ? getSessionCache(githubAccessToken) : defaultCache;
  const now = Math.floor(Date.now() / 1000);
  if (cache.copilotToken && cache.expiresAt > now + 60) {
    return cache.copilotToken;
  }

  const response = await fetch('https://api.github.com/copilot_internal/v2/token', {
    headers: {
      'Authorization': `token ${githubAccessToken}`,
      'Accept': 'application/json',
      'Editor-Version': 'vscode/1.85.1',
      'Editor-Plugin-Version': 'copilot/1.144.0',
      'User-Agent': 'GithubCopilot/1.144.0'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    let msg = 'Failed to get Copilot token';
    try {
      const j = JSON.parse(text);
      msg = j.message || msg;
    } catch (e) {}

    if (response.status === 403 || response.status === 404) {
      throw new Error(`Copilot subscription not found for this GitHub account (${msg}). Please verify you have an active GitHub Copilot subscription.`);
    }
    throw new Error(`GitHub Copilot auth error (${response.status}): ${msg}`);
  }

  const data = await response.json();
  if (!data.token) {
    throw new Error('No token returned by Copilot endpoint.');
  }

  cache.copilotToken = data.token;
  cache.expiresAt = data.expires_at || (now + 1800);

  return data.token;
}

/**
 * Test Copilot Connection
 */
async function testCopilotConnection(githubAccessToken) {
  if (!githubAccessToken) {
    return { success: false, error: 'No GitHub Copilot authorization found. Click "Connect GitHub Copilot" to verify via GitHub.' };
  }

  try {
    const sessionToken = await getCopilotSessionToken(githubAccessToken);
    return {
      success: true,
      message: 'GitHub Copilot authorization verified successfully! Ready to generate emails.'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Call Copilot Chat Completions API
 */
async function callCopilotChat({ githubAccessToken, model = 'gpt-4o', systemPrompt, userPrompt }) {
  const sessionToken = await getCopilotSessionToken(githubAccessToken);

  const payload = {
    model: model || 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 1200
  };

  const response = await fetch('https://api.githubcopilot.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`,
      'Editor-Version': 'vscode/1.85.1',
      'Editor-Plugin-Version': 'copilot/1.144.0',
      'User-Agent': 'GithubCopilot/1.144.0'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    let msg = `Copilot API error (${response.status})`;
    try {
      const j = JSON.parse(text);
      if ((j.error?.code === 'model_not_supported' || j.error?.message?.toLowerCase().includes('not supported') || text.includes('not supported')) && model !== 'gpt-4o') {
        console.warn(`[Copilot] Model '${model}' not supported by GitHub Copilot. Automatically falling back to 'gpt-4o'.`);
        return await callCopilotChat({ githubAccessToken, model: 'gpt-4o', systemPrompt, userPrompt });
      }
      msg = j.error?.message || j.message || msg;
    } catch (e) {
      if (text.includes('not supported') && model !== 'gpt-4o') {
        console.warn(`[Copilot] Model '${model}' not supported by GitHub Copilot. Automatically falling back to 'gpt-4o'.`);
        return await callCopilotChat({ githubAccessToken, model: 'gpt-4o', systemPrompt, userPrompt });
      }
    }
    throw new Error(msg);
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error('Copilot returned an empty response.');
  }

  const { cleanJsonOutput } = require('./aiService');
  const parsed = cleanJsonOutput(rawText);
  if (!parsed || !parsed.body) {
    return {
      subject: 'Inquiry & Introduction',
      body: (rawText || '').replace(/^```(?:json)?\s*/gi, '').replace(/\s*```\s*$/gi, '').trim()
    };
  }
  return parsed;
}

/**
 * Get current pending device flow if active and unexpired
 */
function getPendingDeviceFlow() {
  if (pendingDeviceFlow && pendingDeviceFlow.expiresAt > Date.now()) {
    return pendingDeviceFlow;
  }
  pendingDeviceFlow = null;
  return null;
}

/**
 * Clear pending device flow
 */
function clearPendingDeviceFlow() {
  pendingDeviceFlow = null;
}

/**
 * Clear in-memory token cache (used by Danger Zone data purge)
 */
function clearSessionCache() {
  defaultCache.copilotToken = null;
  defaultCache.expiresAt = 0;
  tokenCaches.clear();
  clearPendingDeviceFlow();
}

function getSessionCache(userKey) {
  if (userKey) {
    if (!tokenCaches.has(userKey)) {
      tokenCaches.set(userKey, { copilotToken: null, expiresAt: 0 });
    }
    return tokenCaches.get(userKey);
  }
  return defaultCache;
}

module.exports = {
  startDeviceFlow,
  checkDeviceStatus,
  getCopilotSessionToken,
  testCopilotConnection,
  callCopilotChat,
  clearSessionCache,
  getSessionCache,
  getPendingDeviceFlow,
  clearPendingDeviceFlow
};
