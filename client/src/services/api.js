/**
 * API service for communication with JDMail backend
 */

export async function fetchConfig() {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Failed to load configuration');
  return res.json();
}

export async function saveAiProviderConfig({ providerKey, apiKey, model, baseURL, enabled }) {
  const res = await fetch('/api/config/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerKey, apiKey, model, baseURL, enabled })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to save AI configuration');
  }
  return res.json();
}

export async function setActiveAiProvider(providerKey) {
  const res = await fetch('/api/config/ai/active', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerKey })
  });
  if (!res.ok) throw new Error('Failed to set active AI provider');
  return res.json();
}

export async function testAiConnection({ providerKey, apiKey, model, baseURL }) {
  const res = await fetch('/api/config/ai/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerKey, apiKey, model, baseURL })
  });
  return res.json();
}

export async function saveSmtpProfile(profile) {
  const res = await fetch('/api/config/smtp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to save SMTP profile');
  }
  return res.json();
}

export async function deleteSmtpProfile(id) {
  const res = await fetch(`/api/config/smtp/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete SMTP profile');
  return res.json();
}

export async function setDefaultSmtpProfile(id) {
  const res = await fetch(`/api/config/smtp/${id}/default`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to set default SMTP profile');
  return res.json();
}

export async function testSmtpConnection(profile) {
  const res = await fetch('/api/config/smtp/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile)
  });
  return res.json();
}

export async function savePreferences(preferences) {
  const res = await fetch('/api/config/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences)
  });
  return res.json();
}

export async function uploadResume(file) {
  const formData = new FormData();
  formData.append('resume', file);

  const res = await fetch('/api/upload/resume', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to parse resume file');
  }
  return res.json();
}

export async function uploadRecipientsSheet(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload/recipients', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to parse spreadsheet file');
  }
  return res.json();
}

export async function generateColdEmail({
  providerKey,
  resumeText,
  jobDescription,
  recipient,
  customTone,
  senderName
}) {
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerKey,
      resumeText,
      jobDescription,
      recipient,
      customTone,
      senderName
    })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'AI generation failed');
  }
  return data;
}

export async function batchGenerateColdEmails({
  providerKey,
  resumeText,
  jobDescription,
  recipients,
  customTone,
  senderName
}) {
  const res = await fetch('/api/ai/batch-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerKey,
      resumeText,
      jobDescription,
      recipients,
      customTone,
      senderName
    })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Batch AI generation failed');
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
  delaySeconds,
  onEvent,
  onFinished,
  onError
}) {
  try {
    const response = await fetch('/api/send/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients,
        resumeFileId,
        smtpProfileId,
        delaySeconds
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
          } catch (e) {}

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

export async function fetchOutreachLogs() {
  const res = await fetch('/api/logs');
  return res.json();
}

export async function clearOutreachLogs() {
  const res = await fetch('/api/logs', { method: 'DELETE' });
  return res.json();
}

export async function startCopilotAuth() {
  const res = await fetch('/api/copilot/device-code', { method: 'POST' });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to request GitHub device code');
  }
  return res.json();
}

export async function checkCopilotStatus(deviceCode) {
  const res = await fetch('/api/copilot/check-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceCode })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to check authorization status');
  }
  return res.json();
}
