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
      rejectUnauthorized: false // Helps avoid local certificate issues
    };
  }

  return nodemailer.createTransport(transportOptions);
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
    let errorMsg = err.message || 'SMTP Authentication failed';
    if (err.response) {
      errorMsg += ` (${err.response})`;
    }
    if (err.code === 'EAUTH') {
      errorMsg = 'Authentication failed. Please verify username and ensure you are using an App Password instead of your regular password.';
    } else if (err.code === 'ESOCKET' || err.code === 'ETIMEDOUT') {
      errorMsg = `Connection timed out or failed to reach host ${profile.host}:${profile.port}. Please check port and encryption settings.`;
    }
    return {
      success: false,
      error: errorMsg
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

module.exports = {
  createTransporter,
  testSmtpConnection,
  sendEmailMessage
};
