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
 * Classify SMTP error to distinguish transient vs permanent vs auth failures
 */
function classifySmtpError(err) {
  if (!err) {
    return { isTransient: false, isAuthFailure: false, isRateLimit: false, code: null, userMessage: 'Unknown error' };
  }

  const code = err.code || (err.responseCode ? String(err.responseCode) : null);
  const response = (err.response || '').toLowerCase();
  const message = (err.message || '').toLowerCase();

  // Authentication failure
  if (code === 'EAUTH' || response.includes('535') || message.includes('authentication failed')) {
    return {
      isTransient: false,
      isAuthFailure: true,
      isRateLimit: false,
      code: 'EAUTH',
      userMessage: 'Authentication failed. Please verify username and App Password.'
    };
  }

  // Rate limit / quota exceeded
  if (
    code === '452' ||
    response.includes('4.5.3') ||
    response.includes('rate limit') ||
    response.includes('too many recipients') ||
    response.includes('quota exceeded') ||
    message.includes('quota')
  ) {
    return {
      isTransient: true,
      isAuthFailure: false,
      isRateLimit: true,
      code: 'RATE_LIMIT',
      userMessage: 'Provider rate limit or daily quota reached. Temporarily paused.'
    };
  }

  // Transient network / temporary SMTP server failures
  const transientCodes = ['ETIMEDOUT', 'ECONNRESET', 'ESOCKET', 'ECONNREFUSED', 'EHOSTUNREACH', '421', '450', '451'];
  const isTransient =
    transientCodes.includes(code) ||
    response.startsWith('421') ||
    response.startsWith('451') ||
    message.includes('timeout') ||
    message.includes('connection reset');

  return {
    isTransient,
    isAuthFailure: false,
    isRateLimit: false,
    code: code || 'UNKNOWN',
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
      code: classification.code
    };
  }
}

/**
 * Send a single email with optional attachment
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
  return {
    success: true,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected
  };
}

/**
 * Send email with automatic single retry for transient failures
 */
async function sendEmailMessageWithRetry(args, maxRetries = 1, backoffMs = 2000) {
  let attempt = 0;
  while (true) {
    try {
      return await sendEmailMessage(args);
    } catch (err) {
      attempt++;
      const classification = classifySmtpError(err);
      if (attempt <= maxRetries && classification.isTransient && !classification.isRateLimit) {
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
      err.classification = classification;
      throw err;
    }
  }
}

module.exports = {
  createTransporter,
  testSmtpConnection,
  sendEmailMessage,
  sendEmailMessageWithRetry,
  classifySmtpError
};
