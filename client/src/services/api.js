import { getIdToken } from '../lib/firebase';

/**
 * Authenticated fetch wrapper that automatically attaches Firebase ID token
 * to the Authorization header if the user is authenticated.
 */
async function authFetch(url, options = {}) {
  let token = null;
  try {
    token = await getIdToken();
  } catch {
    // Non-blocking fallback if Firebase is still initializing or unauthenticated
  }

  const headers = { ...(options.headers || {}) };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers
  });
}

/**
 * Safely parse JSON from fetch response with graceful fallback on non-JSON responses.
 */
async function parseJsonResponse(res, fallbackErrorMsg = 'Server error — check logs') {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || fallbackErrorMsg);
      }
      return data;
    } catch (err) {
      if (!res.ok || (err.message && !err.message.includes('JSON'))) {
        throw err;
      }
    }
  }
  const text = await res.text();
  console.error('[API Non-JSON Response]', res.status, text.slice(0, 300));
  throw new Error(fallbackErrorMsg);
}


export async function fetchMigrationConfig() {
  try {
    const res = await authFetch('/api/config/migration-export');
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function saveAiProviderConfig({ providerKey, apiKey, model, baseURL, enabled }) {
  const res = await authFetch('/api/config/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerKey, apiKey, model, baseURL, enabled })
  });
  return parseJsonResponse(res, 'Failed to save AI configuration');
}

export async function setActiveAiProvider(providerKey) {
  const res = await authFetch('/api/config/ai/active', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerKey })
  });
  if (!res.ok) throw new Error('Failed to set active AI provider');
  return parseJsonResponse(res, 'Failed to set active AI provider');
}

export async function testAiConnection({ providerKey, apiKey, model, baseURL }) {
  try {
    const res = await authFetch('/api/config/ai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerKey, apiKey, model, baseURL })
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const data = await res.json();
        if (!res.ok && data.success === undefined) {
          return { success: false, error: data.error || `Server error (${res.status})` };
        }
        return data;
      } catch (err) {
        console.error('[testAiConnection] JSON parse failure:', err);
      }
    }

    const text = await res.text();
    console.error('[testAiConnection] Non-JSON response received:', res.status, text.slice(0, 300));
    return {
      success: false,
      error: 'Server error — check logs'
    };
  } catch (err) {
    console.error('[testAiConnection] Network error:', err);
    return {
      success: false,
      error: err.message || 'Server error — check logs'
    };
  }
}

export async function saveSmtpProfile(profile) {
  const res = await authFetch('/api/config/smtp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile)
  });
  return parseJsonResponse(res, 'Failed to save SMTP profile');
}

export async function deleteSmtpProfile(id) {
  const res = await authFetch(`/api/config/smtp/${id}`, { method: 'DELETE' });
  return parseJsonResponse(res, 'Failed to delete SMTP profile');
}

export async function setDefaultSmtpProfile(id) {
  const res = await authFetch(`/api/config/smtp/${id}/default`, { method: 'POST' });
  return parseJsonResponse(res, 'Failed to set default SMTP profile');
}

export async function testSmtpConnection(profile) {
  try {
    const res = await authFetch('/api/config/smtp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return res.json();
    }
    const text = await res.text();
    console.error('[testSmtpConnection] Non-JSON response:', res.status, text.slice(0, 300));
    return { success: false, error: 'Server error — check logs' };
  } catch (err) {
    return { success: false, error: err.message || 'Server error — check logs' };
  }
}

export async function savePreferences(preferences) {
  const res = await authFetch('/api/config/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences)
  });
  return res.json();
}

export async function uploadResume(file) {
  const formData = new FormData();
  formData.append('resume', file);
  const res = await authFetch('/api/upload/resume', { method: 'POST', body: formData });
  return parseJsonResponse(res, 'Failed to parse resume file');
}

export async function uploadRecipientsSheet(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await authFetch('/api/upload/recipients', { method: 'POST', body: formData });
  return parseJsonResponse(res, 'Failed to parse spreadsheet file');
}

export async function generateColdEmail({
  providerKey,
  providerConfig,
  resumeText,
  jobDescription,
  recipient,
  customTone,
  senderName
}) {
  const res = await authFetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerKey,
      providerConfig,
      resumeText,
      jobDescription,
      recipient,
      customTone,
      senderName
    })
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    console.error('[generateColdEmail] Non-JSON error:', res.status, text.slice(0, 300));
    throw new Error('Server error — check logs');
  }

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'AI generation failed');
  }
  return data;
}

export async function batchGenerateColdEmails({
  providerKey,
  providerConfig,
  resumeText,
  jobDescription,
  recipients,
  customTone,
  senderName
}) {
  const res = await authFetch('/api/ai/batch-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerKey,
      providerConfig,
      resumeText,
      jobDescription,
      recipients,
      customTone,
      senderName
    })
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    console.error('[batchGenerateColdEmails] Non-JSON error:', res.status, text.slice(0, 300));
    throw new Error('Server error — check logs');
  }

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'AI batch generation failed');
  }
  return data;
}


/**
 * Send emails via SSE stream with live progress updates
 */
export async function streamEmailSending({
  recipients,
  resumeFileId,
  smtpProfileId,
  smtpProfile,
  delaySeconds,
  concurrency = 1,
  onEvent,
  onFinished,
  onError
}) {
  try {
    const response = await authFetch('/api/send/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients,
        resumeFileId,
        smtpProfileId,
        smtpProfile,
        delaySeconds,
        concurrency
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to start email sending session');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop(); // keep last incomplete chunk

      for (const block of lines) {
        if (!block.trim()) continue;
        const eventMatch = block.match(/^event:\s*(\w+)/m);
        const dataMatch = block.match(/^data:\s*(.*)/m);

        if (eventMatch && dataMatch) {
          const eventType = eventMatch[1];
          let eventData = {};
          try {
            eventData = JSON.parse(dataMatch[1]);
          } catch {
            eventData = {};
          }

          onEvent(eventType, eventData);

          if (eventType === 'finished') {
            if (onFinished) onFinished(eventData);
          }
        }
      }
    }
  } catch (err) {
    if (onError) onError(err);
  }
}

export async function listAiModels({ providerKey, apiKey }) {
  try {
    const res = await authFetch('/api/config/ai/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerKey, apiKey })
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return res.json();
    }
    return { success: false, error: 'Non-JSON response from server' };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to list models' };
  }
}

export async function fetchOutreachLogs() {
  const res = await authFetch('/api/logs');
  return res.json();
}

export async function clearOutreachLogs() {
  const res = await authFetch('/api/logs', { method: 'DELETE' });
  return res.json();
}

export async function startCopilotAuth() {
  const res = await authFetch('/api/copilot/device-code', { method: 'POST' });
  return parseJsonResponse(res, 'Failed to request GitHub device code');
}

export async function getCurrentCopilotFlow() {
  try {
    const res = await authFetch('/api/copilot/current-flow');
    if (!res.ok) return { active: false, flow: null };
    return res.json();
  } catch {
    return { active: false, flow: null };
  }
}

export async function checkCopilotStatus(deviceCode, autoActivate = true) {
  const res = await authFetch('/api/copilot/check-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceCode, autoActivate })
  });
  return parseJsonResponse(res, 'Failed to check authorization status');
}

export async function resetAllData() {
  const res = await authFetch('/api/config/reset', { method: 'POST' });
  return parseJsonResponse(res, 'Failed to reset all data');
}

export async function fetchDailySendingStats(smtpProfileId = null) {
  const query = smtpProfileId ? `?smtpProfileId=${encodeURIComponent(smtpProfileId)}` : '';
  const res = await authFetch(`/api/send/daily-stats${query}`);
  return parseJsonResponse(res, 'Failed to fetch daily sending statistics');
}

export async function deleteEphemeralResume(fileId) {
  const res = await authFetch('/api/upload/resume', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId })
  });
  return parseJsonResponse(res, 'Failed to delete resume');
}

