const assert = require('assert');
const {
  classifySmtpError,
  sendEmailMessageWithRetry,
  dispatchCampaign,
  extractSmtpCode
} = require('./services/smtpService');

async function runTests() {
  console.log('Testing SMTP Pipeline: Sequential/Concurrency, Response Recording, Slowdown & Smart Retries...');

  // -------------------------------------------------------------
  // Test 1: RFC 5321 Response Code Classification
  // -------------------------------------------------------------
  console.log('\n--- 1. SMTP Response Code Classification ---');

  // 1A: 250 Successful
  assert.strictEqual(extractSmtpCode({ response: '250 2.0.0 OK 1727400123 abc' }), 250);

  // 1B: 4xx Temporary Failures (pause & retry)
  const err421 = new Error('Service unavailable, closing transmission channel');
  err421.responseCode = 421;
  const c421 = classifySmtpError(err421);
  assert.strictEqual(c421.isTransient, true, '421 must be transient');
  assert.strictEqual(c421.shouldRetry, true, '421 must be retryable');
  assert.strictEqual(c421.isPermanent, false, '421 is NOT permanent');
  assert.strictEqual(c421.smtpCode, 421);

  const err450 = new Error('Mailbox busy');
  err450.responseCode = 450;
  const c450 = classifySmtpError(err450);
  assert.strictEqual(c450.isTransient, true, '450 must be transient');
  assert.strictEqual(c450.shouldRetry, true, '450 must be retryable');
  assert.strictEqual(c450.isPermanent, false);
  assert.strictEqual(c450.smtpCode, 450);

  const err451 = new Error('Local error in processing');
  err451.response = '451 4.3.0 Temporary local problem';
  const c451 = classifySmtpError(err451);
  assert.strictEqual(c451.isTransient, true, '451 must be transient');
  assert.strictEqual(c451.shouldRetry, true, '451 must be retryable');
  assert.strictEqual(c451.smtpCode, 451);

  const err452 = new Error('Too many recipients / storage exceeded');
  err452.code = '452';
  const c452 = classifySmtpError(err452);
  assert.strictEqual(c452.isTransient, true, '452 must be transient');
  assert.strictEqual(c452.isRateLimit, true, '452 must be flagged as rate limit');
  assert.strictEqual(c452.shouldRetry, true, '452 rate limit should retry after pause');

  const errTimeout = new Error('Connection timeout');
  errTimeout.code = 'ETIMEDOUT';
  const cTimeout = classifySmtpError(errTimeout);
  assert.strictEqual(cTimeout.isTransient, true, 'Network timeout must be transient');
  assert.strictEqual(cTimeout.shouldRetry, true, 'Network timeout should be retryable');

  // 1C: 5xx Permanent Rejections (don't blindly retry)
  const err550 = new Error('550 5.1.1 The email account that you tried to reach does not exist');
  err550.responseCode = 550;
  const c550 = classifySmtpError(err550);
  assert.strictEqual(c550.isPermanent, true, '550 must be permanent');
  assert.strictEqual(c550.isTransient, false, '550 must NOT be transient');
  assert.strictEqual(c550.shouldRetry, false, '550 must NOT be retried');
  assert.strictEqual(c550.smtpCode, 550);

  const err554 = new Error('554 5.7.1 Message rejected due to spam content');
  err554.responseCode = 554;
  const c554 = classifySmtpError(err554);
  assert.strictEqual(c554.isPermanent, true, '554 must be permanent');
  assert.strictEqual(c554.shouldRetry, false, '554 policy rejection must NOT be blindly retried');

  const err535 = new Error('Invalid login: 535-5.7.8 Username and Password not accepted');
  err535.code = 'EAUTH';
  const c535 = classifySmtpError(err535);
  assert.strictEqual(c535.isAuthFailure, true, '535 must be auth failure');
  assert.strictEqual(c535.isPermanent, true, 'Auth failure is permanent');
  assert.strictEqual(c535.shouldRetry, false, 'Auth failure must NOT be retried');

  console.log('✓ Response code classification verified (250 success, 4xx transient retryable, 5xx permanent non-retryable).');

  // -------------------------------------------------------------
  // Test 2: Smart Retry: 4xx Retries vs 5xx Fail-Fast (No Blind Retry)
  // -------------------------------------------------------------
  console.log('\n--- 2. Smart Retry Verification ---');

  // Test 2A: 4xx Temporary Problem Retries and Recovers
  let attempts4xx = 0;
  const mockSend4xx = async () => {
    attempts4xx++;
    if (attempts4xx === 1) {
      const err = new Error('450 4.2.1 Mailbox busy, try again later');
      err.responseCode = 450;
      throw err;
    }
    return {
      messageId: '<recovered-4xx@jdmail>',
      accepted: ['test@example.com'],
      rejected: [],
      response: '250 2.0.0 OK queued as 12345',
      smtpResponse: '250 2.0.0 OK queued as 12345',
      smtpResponseCode: 250
    };
  };

  // Re-route sendEmailMessage via dependency injection in sendEmailMessageWithRetry
  // by testing the retry logic
  let recordedRetries = [];
  const nodemailer = require('nodemailer');
  const origCreate = nodemailer.createTransport;

  try {
    nodemailer.createTransport = () => ({
      sendMail: async () => mockSend4xx()
    });

    const result4xx = await sendEmailMessageWithRetry(
      { profile: { host: 'smtp.test', username: 'u', password: 'p' }, to: 'test@example.com', subject: 'Sub', bodyText: 'Body' },
      2,
      5, // fast 5ms backoff for testing
      (retryInfo) => recordedRetries.push(retryInfo)
    );

    assert.strictEqual(attempts4xx, 2, 'Should have retried once on 450 temporary problem');
    assert.strictEqual(result4xx.attempts, 2);
    assert.strictEqual(result4xx.smtpResponseCode, 250, 'Recorded 250 on recovery');
    assert.strictEqual(recordedRetries.length, 1);
    assert.strictEqual(recordedRetries[0].classification.smtpCode, 450);
    console.log('✓ 4xx temporary error successfully paused and retried.');

    // Test 2B: 5xx Permanent Rejection Fails Immediately without Blind Retry
    let attempts5xx = 0;
    nodemailer.createTransport = () => ({
      sendMail: async () => {
        attempts5xx++;
        const err = new Error('550 5.1.1 User unknown');
        err.responseCode = 550;
        throw err;
      }
    });

    let caughtError = null;
    try {
      await sendEmailMessageWithRetry(
        { profile: { host: 'smtp.test', username: 'u', password: 'p' }, to: 'bad@example.com', subject: 'Sub', bodyText: 'Body' },
        3, // maxRetries = 3
        5
      );
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError, '550 error must be thrown');
    assert.strictEqual(attempts5xx, 1, '5xx error must NOT be retried (attempt count must be 1)');
    assert.strictEqual(caughtError.attempts, 1);
    assert.strictEqual(caughtError.classification.isPermanent, true);
    assert.strictEqual(caughtError.classification.shouldRetry, false);
    console.log('✓ 5xx permanent rejection failed fast on attempt 1 without blind retries.');
  } finally {
    nodemailer.createTransport = origCreate;
  }

  // -------------------------------------------------------------
  // Test 3: Record SMTP Response for Every Message
  // -------------------------------------------------------------
  console.log('\n--- 3. SMTP Response Recording for Every Message ---');

  const testRecipients = [
    { id: 'r1', email: 'alice@co.com', name: 'Alice', subject: 'Sub1', body: 'Body1' },
    { id: 'r2', email: 'bob@co.com', name: 'Bob', subject: 'Sub2', body: 'Body2' },
    { id: 'r3', email: 'carol@co.com', name: 'Carol', subject: 'Sub3', body: 'Body3' }
  ];

  const mockSender = async ({ to }) => {
    if (to === 'alice@co.com') {
      return {
        messageId: '<msg-alice@jdmail>',
        accepted: [to],
        rejected: [],
        response: '250 2.0.0 OK dkim=pass',
        smtpResponse: '250 2.0.0 OK dkim=pass',
        smtpResponseCode: 250,
        attempts: 1
      };
    }
    if (to === 'bob@co.com') {
      const err = new Error('550 5.1.1 Mailbox does not exist');
      err.responseCode = 550;
      err.classification = classifySmtpError(err);
      err.attempts = 1;
      throw err;
    }
    if (to === 'carol@co.com') {
      return {
        messageId: '<msg-carol@jdmail>',
        accepted: [to],
        rejected: [],
        response: '250 2.1.5 Recipient OK',
        smtpResponse: '250 2.1.5 Recipient OK',
        smtpResponseCode: 250,
        attempts: 1
      };
    }
  };

  const recordedEvents = [];
  const campaignOutput = await dispatchCampaign({
    recipients: testRecipients,
    profile: { name: 'Work SMTP', username: 'sender@jdmail.com' },
    delaySeconds: 0, // fast testing
    concurrency: 1,
    sendEvent: (ev, data) => recordedEvents.push({ ev, data }),
    sendEmailFn: mockSender
  });

  const { results, campaignLogs } = campaignOutput;
  assert.strictEqual(results.length, 3, 'All 3 recipients processed');

  // Verify Alice (250)
  assert.strictEqual(results[0].status, 'sent');
  assert.strictEqual(results[0].smtpResponseCode, 250);
  assert.ok(results[0].smtpResponse.includes('250 2.0.0 OK'));

  // Verify Bob (550)
  assert.strictEqual(results[1].status, 'failed');
  assert.strictEqual(results[1].smtpResponseCode, 550);
  assert.ok(results[1].smtpResponse.includes('550'));
  assert.strictEqual(results[1].isPermanent, true);

  // Verify Carol (250)
  assert.strictEqual(results[2].status, 'sent');
  assert.strictEqual(results[2].smtpResponseCode, 250);
  assert.ok(results[2].smtpResponse.includes('250 2.1.5'));

  // Verify event stream emitted SMTP response fields
  const completeEvents = recordedEvents.filter(e => e.ev === 'item_complete');
  assert.strictEqual(completeEvents.length, 3);
  assert.strictEqual(completeEvents[0].data.smtpResponseCode, 250);
  assert.strictEqual(completeEvents[1].data.smtpResponseCode, 550);
  assert.strictEqual(completeEvents[2].data.smtpResponseCode, 250);
  console.log('✓ SMTP response recorded for every message (250 & 550 in logs and SSE stream).');

  // -------------------------------------------------------------
  // Test 4: Stop or Slow Down when Transient Errors Occur
  // -------------------------------------------------------------
  console.log('\n--- 4. Stop or Slow Down on Transient Errors ---');

  // 4A: Slow Down on 4xx Error
  const eventsSlowdown = [];
  const senderWithTransient = async ({ to }) => {
    if (to === 'r1@test.com') {
      const err = new Error('421 4.7.0 Try again later');
      err.responseCode = 421;
      err.classification = classifySmtpError(err);
      throw err;
    }
    return {
      messageId: '<ok@jdmail>',
      smtpResponse: '250 OK',
      smtpResponseCode: 250,
      attempts: 1
    };
  };

  await dispatchCampaign({
    recipients: [
      { id: '1', email: 'r1@test.com', name: 'R1' },
      { id: '2', email: 'r2@test.com', name: 'R2' }
    ],
    profile: { name: 'P' },
    delaySeconds: 2,
    concurrency: 1,
    sendEvent: (ev, data) => eventsSlowdown.push({ ev, data }),
    sendEmailFn: senderWithTransient
  });

  const slowdownEvents = eventsSlowdown.filter(e => e.ev === 'slowdown');
  assert.ok(slowdownEvents.length >= 1, 'Must emit slowdown event on 4xx transient error');
  assert.ok(slowdownEvents[0].data.currentDelay > 2, 'Pacing delay must increase after 4xx transient error');
  console.log(`✓ Slowdown verified: Pacing increased to ${slowdownEvents[0].data.currentDelay}s after 421 transient error.`);

  // 4B: Circuit Breaker Stop on 3 Consecutive Transient Errors
  const eventsCircuitBreaker = [];
  let callsCount = 0;
  const senderPersistentFailures = async () => {
    callsCount++;
    const err = new Error('451 4.3.0 Local error in processing');
    err.responseCode = 451;
    err.classification = classifySmtpError(err);
    throw err;
  };

  const tenRecipients = Array.from({ length: 10 }, (_, i) => ({
    id: `r_${i + 1}`,
    email: `rec${i + 1}@example.com`,
    name: `User ${i + 1}`
  }));

  const circuitBreakerOutput = await dispatchCampaign({
    recipients: tenRecipients,
    profile: { name: 'Work Profile' },
    delaySeconds: 0,
    concurrency: 1,
    sendEvent: (ev, data) => eventsCircuitBreaker.push({ ev, data }),
    sendEmailFn: senderPersistentFailures
  });

  const cbEvents = eventsCircuitBreaker.filter(e => e.ev === 'circuit_breaker');
  assert.strictEqual(cbEvents.length, 1, 'Must emit circuit_breaker event');
  assert.strictEqual(callsCount, 3, 'Must stop queue after 3 consecutive transient errors');
  assert.strictEqual(circuitBreakerOutput.results.length, 3, 'Only 3 recipients processed before stopping');
  assert.ok(circuitBreakerOutput.results.every(r => r.status === 'failed'));
  console.log('✓ Circuit breaker stop verified: Campaign aborted after 3 consecutive transient errors to protect domain reputation.');

  // -------------------------------------------------------------
  // Test 5: Sequential vs Controlled Concurrency
  // -------------------------------------------------------------
  console.log('\n--- 5. Sequential vs Controlled Concurrency ---');

  // Test 5A: Sequential Dispatch (concurrency = 1)
  const dispatchOrder = [];
  const senderSequential = async ({ to }) => {
    dispatchOrder.push(to);
    return { messageId: `<${to}@jdmail>`, smtpResponse: '250 OK', smtpResponseCode: 250, attempts: 1 };
  };

  await dispatchCampaign({
    recipients: [
      { id: '1', email: 'first@test.com' },
      { id: '2', email: 'second@test.com' },
      { id: '3', email: 'third@test.com' }
    ],
    profile: { name: 'P' },
    delaySeconds: 0,
    concurrency: 1,
    sendEmailFn: senderSequential
  });

  assert.deepStrictEqual(dispatchOrder, ['first@test.com', 'second@test.com', 'third@test.com'], 'Must execute sequentially in strict order');
  console.log('✓ Sequential dispatch verified (concurrency = 1 in deterministic order).');

  // Test 5B: Controlled Concurrency (concurrency = 3)
  let activeWorkers = 0;
  let maxObservedWorkers = 0;
  const senderConcurrent = async ({ to }) => {
    activeWorkers++;
    maxObservedWorkers = Math.max(maxObservedWorkers, activeWorkers);
    await new Promise(r => setTimeout(r, 20));
    activeWorkers--;
    return { messageId: `<${to}@jdmail>`, smtpResponse: '250 OK', smtpResponseCode: 250, attempts: 1 };
  };

  const sixRecipients = Array.from({ length: 6 }, (_, i) => ({
    id: `c_${i + 1}`,
    email: `concurrent${i + 1}@example.com`
  }));

  const concurrentOutput = await dispatchCampaign({
    recipients: sixRecipients,
    profile: { name: 'P' },
    delaySeconds: 0,
    concurrency: 3,
    sendEmailFn: senderConcurrent
  });

  assert.strictEqual(concurrentOutput.results.length, 6, 'All 6 results preserved');
  assert.ok(maxObservedWorkers > 1, `Observed concurrency (${maxObservedWorkers}) must be > 1`);
  assert.ok(maxObservedWorkers <= 3, `Observed concurrency (${maxObservedWorkers}) must not exceed pool limit of 3`);
  for (let i = 0; i < sixRecipients.length; i++) {
    assert.strictEqual(concurrentOutput.results[i].recipientEmail, sixRecipients[i].email, `Index ${i} order preserved`);
  }
  console.log(`✓ Controlled concurrency verified (Observed max concurrency: ${maxObservedWorkers} <= 3, results order preserved).`);

  console.log('\n====================================================');
  console.log('ALL SMTP PIPELINE & RESILIENCE TESTS PASSED CLEANLY!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
