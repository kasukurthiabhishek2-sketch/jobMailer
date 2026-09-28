const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

/**
 * Build a Nodemailer transporter from profile config
 */
function createTransporter(profile) {
  const isSecure = profile.encryption === 'SSL' || Number(profile.port) === 465;

  const transportOptions = {
    host: profile.host,
    port: Number(profile.port) || 587,
    secure: isSecure, // true for 465, false for other ports
    auth: {
      user: profile.username,
      pass: profile.password
    },
    // Connection timeout safety
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  };

  if (profile.encryption === 'STARTTLS' || profile.encryption === 'TLS') {
    transportOptions.requireTLS = true;
    transportOptions.tls = {
      // Default to strict certificate verification; only allow self-signed if explicitly configured
      rejectUnauthorized: profile.allowSelfSignedCerts === true ? false : true
    };
  }

  return nodemailer.createTransport(transportOptions);
}

/**
 * Extract 3-digit numeric SMTP response code or standard error code
 */
function extractSmtpCode(err) {
  if (!err) return null;
  if (typeof err.responseCode === 'number') return err.responseCode;
  if (typeof err.responseCode === 'string' && /^\d{3}$/.test(err.responseCode.trim())) {
    return parseInt(err.responseCode.trim(), 10);
  }
  if (typeof err.code === 'number') return err.code;
  if (typeof err.code === 'string' && /^\d{3}$/.test(err.code.trim())) {
    return parseInt(err.code.trim(), 10);
  }
  if (typeof err.response === 'string') {
    const match = err.response.match(/\b([245]\d{2})\b/);
    if (match) return parseInt(match[1], 10);
  }
  if (typeof err.message === 'string') {
    const match = err.message.match(/\b([245]\d{2})\b/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Classify SMTP error to distinguish transient (4xx / network) vs permanent (5xx) vs auth failures
 * RFC 5321:
 * - 250: Successful
 * - 4xx: Temporary problem -> pause/retry (421, 450, 451, 452, 454)
 * - 5xx: Permanent rejection -> don't blindly retry (500-504, 535, 550, 551, 552, 553, 554)
 */
function classifySmtpError(err) {
  if (!err) {
    return {
      isTransient: false,
      isPermanent: false,
      shouldRetry: false,
      isAuthFailure: false,
      isRateLimit: false,
      code: null,
      smtpCode: null,
      smtpResponse: '',
      userMessage: 'Unknown error'
    };
  }

  const numericCode = extractSmtpCode(err);
  const code = err.code || (numericCode ? String(numericCode) : null);
  const rawResponse = err.response || err.message || '';
  const responseLower = (err.response || '').toLowerCase();
  const messageLower = (err.message || '').toLowerCase();

  // 1. Authentication failure (535 or EAUTH)
  if (
    code === 'EAUTH' ||
    numericCode === 535 ||
    responseLower.includes('535') ||
    messageLower.includes('authentication failed') ||
    messageLower.includes('username and password not accepted')
  ) {
    return {
      isTransient: false,
      isPermanent: true,
      shouldRetry: false,
      isAuthFailure: true,
      isRateLimit: false,
      code: 'EAUTH',
      smtpCode: 535,
      smtpResponse: rawResponse || '535 Authentication credentials invalid',
      userMessage: 'Authentication failed (535). Please verify username and App Password.'
    };
  }

  // 2. Rate limit / quota exceeded (452 or explicit quota messages)
  if (
    numericCode === 452 ||
    code === '452' ||
    responseLower.includes('4.5.3') ||
    responseLower.includes('rate limit') ||
    responseLower.includes('too many recipients') ||
    responseLower.includes('quota exceeded') ||
    messageLower.includes('quota')
  ) {
    return {
      isTransient: true,
      isPermanent: false,
      shouldRetry: true,
      isAuthFailure: false,
      isRateLimit: true,
      code: 'RATE_LIMIT',
      smtpCode: numericCode || 452,
      smtpResponse: rawResponse || '452 4.5.3 Rate limit or daily quota reached',
      userMessage: 'Provider rate limit or quota reached (452). Temporarily paused.'
    };
  }

  // 3. 4xx Transient errors (temporary problem -> pause/retry)
  const transientNetworkCodes = ['ETIMEDOUT', 'ECONNRESET', 'ESOCKET', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENOTFOUND', 'EPIPE'];
  const is4xxCode = numericCode !== null && numericCode >= 400 && numericCode < 500;
  const isTransientNetwork =
    transientNetworkCodes.includes(code) ||
    messageLower.includes('timeout') ||
    messageLower.includes('connection reset') ||
    messageLower.includes('socket closed');

  if (is4xxCode || isTransientNetwork || responseLower.startsWith('421') || responseLower.startsWith('451')) {
    let descriptiveMsg = 'Temporary SMTP failure (4xx).';
    if (numericCode === 421) descriptiveMsg = 'Service temporarily unavailable (421).';
    else if (numericCode === 450) descriptiveMsg = 'Mailbox temporarily busy or unavailable (450).';
    else if (numericCode === 451) descriptiveMsg = 'Local server processing error (451).';
    else if (isTransientNetwork) descriptiveMsg = `Temporary network issue (${code || 'connection interrupted'}).`;

    return {
      isTransient: true,
      isPermanent: false,
      shouldRetry: true,
      isAuthFailure: false,
      isRateLimit: false,
      code: code || String(numericCode) || 'TRANSIENT',
      smtpCode: numericCode || (code === 'ETIMEDOUT' ? 'ETIMEDOUT' : (code || 451)),
      smtpResponse: rawResponse || `${numericCode || 451} Temporary problem`,
      userMessage: descriptiveMsg
    };
  }

  // 4. 5xx Permanent errors (permanent rejection -> don't blindly retry)
  const is5xxCode = numericCode !== null && numericCode >= 500 && numericCode < 600;
  if (is5xxCode || responseLower.startsWith('550') || responseLower.startsWith('554')) {
    let descriptiveMsg = 'Permanent delivery rejection (5xx).';
    if (numericCode === 550) descriptiveMsg = 'Recipient mailbox unavailable or does not exist (550).';
    else if (numericCode === 551) descriptiveMsg = 'Recipient not local (551).';
    else if (numericCode === 552) descriptiveMsg = 'Storage allocation exceeded (552).';
    else if (numericCode === 553) descriptiveMsg = 'Mailbox name invalid (553).';
    else if (numericCode === 554) descriptiveMsg = 'Transaction rejected by server policy or spam filter (554).';

    return {
      isTransient: false,
      isPermanent: true,
      shouldRetry: false,
      isAuthFailure: false,
      isRateLimit: false,
      code: code || String(numericCode) || 'PERMANENT_REJECTION',
      smtpCode: numericCode || 550,
      smtpResponse: rawResponse || `${numericCode || 550} Permanent rejection`,
      userMessage: descriptiveMsg
    };
  }

  // 5. Fallback for unclassified errors — fail closed without blind retry
  return {
    isTransient: false,
    isPermanent: true,
    shouldRetry: false,
    isAuthFailure: false,
    isRateLimit: false,
    code: code || 'UNKNOWN',
    smtpCode: numericCode || 500,
    smtpResponse: rawResponse || 'SMTP delivery failure',
    userMessage: err.message || 'SMTP delivery failure'
  };
}

/**
 * Test SMTP connection and credentials
 */
async function testSmtpConnection(profile) {
  if (!profile.host || !profile.username || !profile.password) {
    return {
      success: false,
      error: 'Host, username, and password/app password are required to test SMTP connection.'
    };
  }

  try {
    const transporter = createTransporter(profile);
    await transporter.verify();
    return {
      success: true,
      message: `Successfully authenticated with ${profile.host}:${profile.port} (${profile.username})`
    };
  } catch (err) {
    console.error('SMTP test error:', err);
    const classification = classifySmtpError(err);
    return {
      success: false,
      error: classification.userMessage,
      code: classification.code,
      smtpResponse: classification.smtpResponse
    };
  }
}

/**
 * Send a single email with optional attachment and record SMTP server response
 */
async function sendEmailMessage({
  profile,
  to,
  recipientName,
  subject,
  bodyText,
  attachmentPath,
  attachmentName
}) {
  const transporter = createTransporter(profile);

  const fromName = profile.fromName || 'Job Candidate';
  const fromEmail = profile.fromEmail || profile.username;
  const fromHeader = `"${fromName}" <${fromEmail}>`;

  // Convert plain text with newlines to clean HTML paragraphs
  const htmlContent = bodyText
    .split(/\n\n+/)
    .map(para => `<p style="margin: 0 0 14px 0; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #1e293b;">${para.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  const mailOptions = {
    from: fromHeader,
    to: recipientName ? `"${recipientName}" <${to}>` : to,
    subject: subject,
    text: bodyText,
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        ${htmlContent}
      </div>
    `,
    attachments: []
  };

  if (attachmentPath && fs.existsSync(attachmentPath)) {
    mailOptions.attachments.push({
      filename: attachmentName || path.basename(attachmentPath),
      path: attachmentPath
    });
  }

  const info = await transporter.sendMail(mailOptions);
  const rawResponse = info.response || '250 2.0.0 OK';
  let smtpResponseCode = 250;
  const match = rawResponse.match(/\b([245]\d{2})\b/);
  if (match) {
    smtpResponseCode = parseInt(match[1], 10);
  }

  return {
    success: true,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
    smtpResponse: rawResponse,
    smtpResponseCode: smtpResponseCode
  };
}

/**
 * Send email with automatic pause & retry for transient/temporary failures (4xx).
 * Permanent failures (5xx) fail fast immediately without blind retry.
 */
async function sendEmailMessageWithRetry(args, maxRetries = 2, backoffMs = 2000, onRetry = null) {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const result = await sendEmailMessage(args);
      return {
        ...result,
        attempts: attempt
      };
    } catch (err) {
      const classification = classifySmtpError(err);
      err.classification = classification;
      err.attempts = attempt;
      err.smtpResponse = classification.smtpResponse || err.message;
      err.smtpResponseCode = classification.smtpCode || 500;

      // 4xx -> temporary problem -> pause/retry
      // 5xx -> permanent rejection -> don't blindly retry
      if (attempt <= maxRetries && classification.shouldRetry) {
        const pauseDelay = backoffMs * attempt;
        if (typeof onRetry === 'function') {
          onRetry({
            attempt,
            maxRetries,
            backoffMs: pauseDelay,
            classification,
            error: err
          });
        }
        await new Promise(resolve => setTimeout(resolve, pauseDelay));
        continue;
      }

      throw err;
    }
  }
}

/**
 * Dispatch an email campaign either sequentially (concurrency: 1) or with controlled concurrency.
 * Features:
 * - Records SMTP response for every message (250, 4xx, 5xx)
 * - Retries only appropriate temporary failures (4xx)
 * - Avoids blind retries on permanent rejections (5xx)
 * - Stops or slows down when transient errors occur (dynamic delay slowdown + circuit breaker)
 */
async function dispatchCampaign({
  recipients,
  profile,
  attachmentPath = null,
  attachmentName = null,
  delaySeconds = 3,
  concurrency = 1,
  sendEvent = () => {},
  sendEmailFn = sendEmailMessageWithRetry
}) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return { results: [], campaignLogs: [] };
  }

  const boundedConcurrency = Math.max(1, Math.min(Number(concurrency) || 1, 5));
  const results = Array(recipients.length);
  const campaignLogs = [];

  const isPacingEnabled = Number(delaySeconds) > 0;
  const campaignState = {
    effectiveDelay: isPacingEnabled ? Math.max(1, Number(delaySeconds) || 3) : 0,
    consecutiveTransientErrors: 0,
    consecutiveSuccesses: 0,
    isAborted: false,
    abortReason: null
  };

  sendEvent('start', {
    total: recipients.length,
    fromEmail: profile.fromEmail || profile.username,
    smtpProfileName: profile.name,
    concurrency: boundedConcurrency,
    delaySeconds: campaignState.effectiveDelay
  });

  let nextIndex = 0;

  async function worker(workerId) {
    while (nextIndex < recipients.length && !campaignState.isAborted) {
      const i = nextIndex++;
      const item = recipients[i];
      const currentIndex = i + 1;

      sendEvent('progress', {
        current: currentIndex,
        total: recipients.length,
        recipientEmail: item.email,
        recipientName: item.name,
        status: 'sending',
        workerId
      });

      try {
        const sendResult = await sendEmailFn({
          profile,
          to: item.email,
          recipientName: item.name,
          subject: item.subject || `Application / Discussion - ${profile.fromName || 'Candidate'}`,
          bodyText: item.body || item.text,
          attachmentPath,
          attachmentName
        });

        // 250 -> successful
        campaignState.consecutiveTransientErrors = 0;
        campaignState.consecutiveSuccesses++;

        // Gradually ease delay back towards base if successful
        if (isPacingEnabled && campaignState.effectiveDelay > delaySeconds && campaignState.consecutiveSuccesses >= 2) {
          campaignState.effectiveDelay = Math.max(delaySeconds, campaignState.effectiveDelay - 1);
        }

        const logItem = {
          id: 'log_' + Date.now() + '_' + i,
          timestamp: new Date().toISOString(),
          recipientEmail: item.email,
          recipientName: item.name,
          company: item.company,
          subject: item.subject,
          status: 'sent',
          messageId: sendResult.messageId,
          smtpResponse: sendResult.smtpResponse || '250 2.0.0 OK',
          smtpResponseCode: sendResult.smtpResponseCode || 250,
          attempts: sendResult.attempts || 1,
          smtpAccount: profile.name
        };

        results[i] = logItem;
        campaignLogs.push(logItem);

        sendEvent('item_complete', {
          current: currentIndex,
          total: recipients.length,
          recipientEmail: item.email,
          status: 'sent',
          smtpResponse: logItem.smtpResponse,
          smtpResponseCode: logItem.smtpResponseCode,
          attempts: logItem.attempts,
          logItem
        });
      } catch (err) {
        console.error(`Failed sending to ${item.email}:`, err);
        const classification = err.classification || classifySmtpError(err);

        const logItem = {
          id: 'log_' + Date.now() + '_' + i,
          timestamp: new Date().toISOString(),
          recipientEmail: item.email,
          recipientName: item.name,
          company: item.company,
          subject: item.subject,
          status: 'failed',
          error: classification.userMessage || err.message || 'SMTP delivery failure',
          smtpResponse: classification.smtpResponse || `${classification.smtpCode || 500} Error`,
          smtpResponseCode: classification.smtpCode || 500,
          attempts: err.attempts || 1,
          isTransient: classification.isTransient,
          isPermanent: classification.isPermanent,
          smtpAccount: profile.name
        };

        results[i] = logItem;
        campaignLogs.push(logItem);

        sendEvent('item_complete', {
          current: currentIndex,
          total: recipients.length,
          recipientEmail: item.email,
          status: 'failed',
          error: classification.userMessage,
          smtpResponse: logItem.smtpResponse,
          smtpResponseCode: logItem.smtpResponseCode,
          attempts: logItem.attempts,
          isAuthFailure: classification.isAuthFailure,
          isTransient: classification.isTransient,
          logItem
        });

        // 1. Auth failure (535) -> Abort immediately to prevent account lockout
        if (classification.isAuthFailure) {
          campaignState.isAborted = true;
          campaignState.abortReason = 'SMTP Authentication failed. Aborting remaining queue to protect account.';
          sendEvent('auth_error', {
            error: campaignState.abortReason,
            smtpProfile: profile.name
          });
          break;
        }

        // 2. Transient error (4xx) -> Stop or slow down
        if (classification.isTransient) {
          campaignState.consecutiveTransientErrors++;
          campaignState.consecutiveSuccesses = 0;

          // Slow down: dynamically increase inter-message delay
          const baseDelay = campaignState.effectiveDelay || Number(delaySeconds) || 3;
          const newDelay = Math.min(30, Math.max(Math.round(baseDelay * 1.5), baseDelay + 3));
          if (isPacingEnabled) {
            campaignState.effectiveDelay = newDelay;
          }

          sendEvent('slowdown', {
            currentDelay: newDelay,
            reason: `Transient SMTP error (${classification.smtpCode || '4xx'}) encountered. Slowing down sending pace to ${newDelay}s.`
          });

          // Circuit breaker: stop if consecutive transient failures reach threshold
          if (campaignState.consecutiveTransientErrors >= 3 || (classification.isRateLimit && campaignState.consecutiveTransientErrors >= 2)) {
            campaignState.isAborted = true;
            campaignState.abortReason = `Campaign stopped: ${campaignState.consecutiveTransientErrors} consecutive transient errors or rate limits (${classification.smtpCode || '4xx'}). Aborting remaining queue to preserve sender reputation.`;
            sendEvent('circuit_breaker', {
              error: campaignState.abortReason,
              smtpProfile: profile.name,
              consecutiveFailures: campaignState.consecutiveTransientErrors
            });
            break;
          }
        } else {
          // 5xx permanent error: reset success streak, but do not slow down general queue
          campaignState.consecutiveSuccesses = 0;
        }
      }

      // Inter-message pacing delay with anti-spam jitter (omitted after last recipient, when aborted, or when 0)
      if (nextIndex < recipients.length && !campaignState.isAborted && isPacingEnabled && campaignState.effectiveDelay > 0) {
        const jitterFactor = 0.85 + Math.random() * 0.35;
        const actualWaitSeconds = Math.max(1, Math.round(campaignState.effectiveDelay * jitterFactor * 10) / 10);

        sendEvent('throttling', {
          waitingSeconds: actualWaitSeconds,
          nextIndex: nextIndex + 1,
          effectiveDelay: campaignState.effectiveDelay
        });
        await new Promise(resolve => setTimeout(resolve, actualWaitSeconds * 1000));
      }
    }
  }

  // Launch controlled concurrency workers (or 1 worker for sequential)
  const numWorkers = Math.min(boundedConcurrency, recipients.length);
  const workers = [];
  for (let w = 0; w < numWorkers; w++) {
    workers.push(worker(w + 1));
  }
  await Promise.all(workers);

  const cleanResults = results.filter(Boolean);
  const sentCount = cleanResults.filter(l => l.status === 'sent').length;
  const failedCount = cleanResults.filter(l => l.status === 'failed').length;

  sendEvent('finished', {
    total: recipients.length,
    sentCount,
    failedCount,
    aborted: campaignState.isAborted,
    abortReason: campaignState.abortReason,
    logs: cleanResults
  });

  return { results: cleanResults, campaignLogs };
}

module.exports = {
  createTransporter,
  testSmtpConnection,
  sendEmailMessage,
  sendEmailMessageWithRetry,
  classifySmtpError,
  dispatchCampaign,
  extractSmtpCode
};
