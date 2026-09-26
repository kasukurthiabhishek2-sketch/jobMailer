const assert = require('assert');
const {
  classifySmtpError,
  createTransporter,
  sendEmailMessageWithRetry
} = require('./services/smtpService');
const nodemailer = require('nodemailer');

async function runTests() {
  console.log('Testing SMTP Resilience, Error Classification & Retry...');

  // Test 1: Error Classification
  const authErr = new Error('Invalid login: 535-5.7.8 Username and Password not accepted');
  authErr.code = 'EAUTH';
  const classifiedAuth = classifySmtpError(authErr);
  assert.strictEqual(classifiedAuth.isAuthFailure, true, 'EAUTH must be classified as auth failure');
  assert.strictEqual(classifiedAuth.isTransient, false, 'EAUTH must NOT be classified as transient');
  console.log('✓ EAUTH classification passed.');

  const timeoutErr = new Error('Connection timeout');
  timeoutErr.code = 'ETIMEDOUT';
  const classifiedTimeout = classifySmtpError(timeoutErr);
  assert.strictEqual(classifiedTimeout.isTransient, true, 'ETIMEDOUT must be transient');
  assert.strictEqual(classifiedTimeout.isAuthFailure, false);
  console.log('✓ ETIMEDOUT classification passed.');

  const rateLimitErr = new Error('Daily user sending quota exceeded');
  rateLimitErr.code = '452';
  const classifiedRate = classifySmtpError(rateLimitErr);
  assert.strictEqual(classifiedRate.isRateLimit, true, '452 quota must be classified as rate limit');
  console.log('✓ Rate limit quota classification passed.');

  const bounceErr = new Error('550 5.1.1 The email account that you tried to reach does not exist');
  bounceErr.responseCode = 550;
  const classifiedBounce = classifySmtpError(bounceErr);
  assert.strictEqual(classifiedBounce.isTransient, false, '550 must be permanent bounce');
  assert.strictEqual(classifiedBounce.isAuthFailure, false);
  console.log('✓ Permanent bounce classification passed.');

  // Test 2: Strict TLS & Self-Signed Cert Toggle
  const standardProfile = {
    host: 'smtp.gmail.com',
    port: 587,
    encryption: 'TLS',
    username: 'test@gmail.com',
    password: 'secret'
  };
  const standardTransporter = createTransporter(standardProfile);
  assert.strictEqual(
    standardTransporter.options.tls.rejectUnauthorized,
    true,
    'Default TLS must strictly enforce rejectUnauthorized: true'
  );

  const selfSignedProfile = {
    ...standardProfile,
    allowSelfSignedCerts: true
  };
  const selfSignedTransporter = createTransporter(selfSignedProfile);
  assert.strictEqual(
    selfSignedTransporter.options.tls.rejectUnauthorized,
    false,
    'Profile with allowSelfSignedCerts: true must set rejectUnauthorized: false'
  );
  console.log('✓ TLS certificate validation settings verified.');

  // Test 3: sendEmailMessageWithRetry
  const originalCreate = nodemailer.createTransport;
  let attempts = 0;

  nodemailer.createTransport = () => ({
    sendMail: async () => {
      attempts++;
      if (attempts === 1) {
        const transient = new Error('Connection reset by peer');
        transient.code = 'ECONNRESET';
        throw transient;
      }
      return { messageId: '<success-msg-123@jdmail>', accepted: ['test@example.com'], rejected: [] };
    }
  });

  try {
    const result = await sendEmailMessageWithRetry({
      profile: standardProfile,
      to: 'test@example.com',
      subject: 'Test Subject',
      bodyText: 'Hello World'
    }, 1, 10); // 1 retry with fast 10ms backoff

    assert.strictEqual(attempts, 2, 'Should have retried once on transient failure');
    assert.strictEqual(result.messageId, '<success-msg-123@jdmail>');
    console.log('✓ Transient error retry verified.');
  } finally {
    nodemailer.createTransport = originalCreate;
  }

  console.log('ALL SMTP RESILIENCE TESTS PASSED!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
