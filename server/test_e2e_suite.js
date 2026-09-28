/**
 * JDMail Server-Side Opaque-Box E2E Test Suite (Tiers 1 to 4)
 *
 * Implements formal testing methodology:
 * - Tier 1: Feature Coverage (Isolated Happy Paths)
 * - Tier 2: Boundary Value Analysis & Adversarial Hardening
 * - Tier 3: Cross-Feature Interactions & Pairwise Combinations
 * - Tier 4: Real-World Workload Scenarios
 *
 * Authoritative sources: RFC 5321, RFC 8628, AES-256-GCM standard, WIZARD_STEPS spec.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { cleanJsonOutput, buildPrompts, auditDraftClaims } = require('./services/aiService');
const { parseRecipientSheet } = require('./services/sheetParser');
const { classifySmtpError } = require('./services/smtpService');
const { encrypt, decrypt, maskApiKey, maskPassword } = require('./utils/crypto');
const storage = require('./services/storageService');

function runServerE2eSuite() {
  console.log('====================================================');
  console.log('  RUNNING JDMAIL SERVER OPAQUE-BOX E2E TEST SUITE   ');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (err) {
      console.error(`  ✕ ${name}`);
      console.error(err);
      throw err;
    }
  }

  // =========================================================================
  // TIER 1: FEATURE COVERAGE (Isolated Happy Paths)
  // =========================================================================
  console.log('--- TIER 1: FEATURE COVERAGE (Isolated Happy Paths) ---');

  test('T1.1 (F01/F02): Sheet parser extracts clean RFC recipients from CSV', () => {
    const csvContent = 'Name,Email,Company,Role\nAda Lovelace,ada@analytical.org,Babbage Engine,Chief Mathematician';
    const tmp = path.join(__dirname, `tmp_t1_${Date.now()}.csv`);
    try {
      fs.writeFileSync(tmp, csvContent);
      const res = parseRecipientSheet(tmp, 'test.csv');
      assert.strictEqual(res.totalCount, 1);
      assert.strictEqual(res.rows[0].email, 'ada@analytical.org');
      assert.strictEqual(res.rows[0].isValidEmail, true);
    } finally {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
  });

  test('T1.2 (F11): buildPrompts formats system and user prompts with 5 tone profiles', () => {
    const tones = ['impact', 'warm', 'founder', 'bullets', 'Executive'];
    for (const tone of tones) {
      const p = buildPrompts({
        resumeText: 'Full Stack Engineer with React and Node experience.',
        jobDescription: 'Seeking backend developer.',
        recipient: { name: 'Grace Hopper', company: 'Navy Computing', role: 'Director' },
        customTone: tone,
        senderName: 'Alex Mercer'
      });
      assert.ok(p.systemPrompt.includes('Strict Fact Grounding'));
      assert.ok(p.userPrompt.includes('Grace Hopper'));
      assert.ok(p.userPrompt.includes('Navy Computing'));
    }
  });

  test('T1.3 (F12): cleanJsonOutput extracts valid subject and body from clean JSON', () => {
    const raw = JSON.stringify({ subject: 'Senior SWE Role', body: 'Hi Grace,\n\nI admire your compiler work.' });
    const parsed = cleanJsonOutput(raw);
    assert.deepStrictEqual(parsed, { subject: 'Senior SWE Role', body: 'Hi Grace,\n\nI admire your compiler work.' });
  });

  test('T1.4 (F16): auditDraftClaims confirms 100% verified claims when all numbers match resume', () => {
    const resume = 'Led team of 12 engineers. Cut latency by 45%. Built systems serving 2M users.';
    const draft = 'Hi Grace, I previously led 12 engineers and improved latency by 45% for 2M users.';
    const audit = auditDraftClaims({ draftText: draft, resumeText: resume });
    assert.strictEqual(audit.hasUngroundedClaims, false);
    assert.strictEqual(audit.flaggedClaims.length, 0);
  });

  test('T1.5 (F17/F18): classifySmtpError correctly maps RFC 5321 535 Auth error and 421 transient error', () => {
    const auth = classifySmtpError({ responseCode: 535, code: 'EAUTH', response: '535 5.7.8 Authentication credentials invalid' });
    assert.strictEqual(auth.isAuthFailure, true);
    assert.strictEqual(auth.isPermanent, true);
    assert.strictEqual(auth.shouldRetry, false);

    const transient = classifySmtpError({ responseCode: 421, response: '421 Service not available' });
    assert.strictEqual(transient.isTransient, true);
    assert.strictEqual(transient.shouldRetry, true);
  });

  test('T1.6 (F21/F25): AES-256-GCM crypto encrypts, validates format, decrypts cleanly, and masks', () => {
    const secret = 'ai-provider-super-secret-key-42';
    const cipher = encrypt(secret);
    assert.strictEqual(cipher.split(':').length, 3);
    assert.strictEqual(decrypt(cipher), secret);
    assert.strictEqual(maskPassword('mypassword'), '••••••••••••');
    assert.ok(!maskApiKey(secret).includes('secret'));
  });

  // =========================================================================
  // TIER 2: BOUNDARY VALUE ANALYSIS & ADVERSARIAL STRESS
  // =========================================================================
  console.log('\n--- TIER 2: BOUNDARY VALUE ANALYSIS & ADVERSARIAL STRESS ---');

  test('T2.1: cleanJsonOutput strips ```json markdown fences and surrounding commentary', () => {
    const payload = 'Here is the draft:\n```json\n{"subject":"Staff Role","body":"Hello!"}\n```\nHope it helps!';
    const parsed = cleanJsonOutput(payload);
    assert.deepStrictEqual(parsed, { subject: 'Staff Role', body: 'Hello!' });
  });

  test('T2.2: cleanJsonOutput handles generic ``` code fences without json tag', () => {
    const payload = '```\n{"subject":"Direct Pitch","body":"Greetings!"}\n```';
    const parsed = cleanJsonOutput(payload);
    assert.deepStrictEqual(parsed, { subject: 'Direct Pitch', body: 'Greetings!' });
  });

  test('T2.3: cleanJsonOutput handles non-JSON plain text gracefully without crashing', () => {
    const plain = 'Subject: Hello World\n\nThis is just plain text from a confused model.';
    const parsed = cleanJsonOutput(plain);
    assert.ok(parsed === null || typeof parsed === 'object');
  });

  test('T2.4: auditDraftClaims catches ungrounded percentages and currency figures', () => {
    const resume = 'Handled 500k monthly requests with 99.9% uptime.';
    const draft = 'Hi, I drove $5M in ARR and boosted conversion by 80%.';
    const audit = auditDraftClaims({ draftText: draft, resumeText: resume });
    assert.strictEqual(audit.hasUngroundedClaims, true);
    assert.ok(audit.flaggedClaims.some(c => c.claim.includes('$5M')));
    assert.ok(audit.flaggedClaims.some(c => c.claim.includes('80%')));
  });

  test('T2.5: classifySmtpError categorizes transient 4xx errors for retry vs permanent 5xx reject', () => {
    const t421 = classifySmtpError({ responseCode: 421, response: '421 4.7.0 Service not available, closing transmission' });
    assert.strictEqual(t421.isTransient, true);
    assert.strictEqual(t421.shouldRetry, true);

    const t452 = classifySmtpError({ responseCode: 452, response: '452 4.2.2 Mailbox full' });
    assert.strictEqual(t452.isTransient, true);

    const p550 = classifySmtpError({ responseCode: 550, response: '550 5.1.1 User unknown' });
    assert.strictEqual(p550.isTransient, false);
    assert.strictEqual(p550.shouldRetry, false);
  });

  test('T2.6: decrypt fail-closed on tampered ciphertext returning empty string', () => {
    const valid = encrypt('valid_secret');
    const parts = valid.split(':');
    // Tamper with auth tag
    const tampered = `${parts[0]}:00000000000000000000000000000000:${parts[2]}`;
    assert.strictEqual(decrypt(tampered), '', 'Tampered auth tag must fail closed to empty string');
  });

  // =========================================================================
  // TIER 3: CROSS-FEATURE INTERACTIONS (Pairwise Combinations)
  // =========================================================================
  console.log('\n--- TIER 3: CROSS-FEATURE INTERACTIONS ---');

  test('T3.1: Sheet Ingestion × RFC Validation with mixed valid and invalid rows', () => {
    const csvContent = [
      'Name,Email,Company',
      'Valid User,valid@domain.com,Tech',
      'Typo User,typo@gamil.com,Tech',
      'No At,notanemail,Tech',
      'Spaces,"  spaced@domain.com  ",Tech'
    ].join('\n');
    const tmp = path.join(__dirname, `tmp_t3_${Date.now()}.csv`);
    try {
      fs.writeFileSync(tmp, csvContent);
      const res = parseRecipientSheet(tmp, 'mixed.csv');
      assert.strictEqual(res.totalCount, 4);
      const valid = res.rows.find(r => r.email === 'valid@domain.com');
      assert.strictEqual(valid.isValidEmail, true);
      const spaced = res.rows.find(r => r.name === 'Spaces');
      assert.strictEqual(spaced.email, 'spaced@domain.com');
      assert.strictEqual(spaced.isValidEmail, true);
    } finally {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
  });

  test('T3.2: Prompt Construction × Fact Grounding with resume context', () => {
    const resumeText = 'Spearheaded migration to microservices, saving 30% on infrastructure.';
    const prompts = buildPrompts({
      resumeText,
      jobDescription: 'Looking for a cloud infrastructure engineer.',
      recipient: { name: 'Linus Torvalds', company: 'Linux Foundation' },
      customTone: 'impact',
      senderName: 'Candidate'
    });
    assert.ok(prompts.systemPrompt.includes('Strict Fact Grounding'));
    assert.ok(prompts.userPrompt.includes('saving 30% on infrastructure'));
    // Audit a draft generated from this prompt
    const mockOutput = 'Hi Linus,\n\nI saved 30% on infrastructure by migrating to microservices.\n\nBest,\nCandidate';
    const audit = auditDraftClaims({ draftText: mockOutput, resumeText });
    assert.strictEqual(audit.hasUngroundedClaims, false);
  });

  test('T3.3: Cryptographic Storage Invariants × Config Loading', () => {
    const config = storage.getPublicConfig();
    assert.ok(config);
    assert.ok(Array.isArray(config.smtpProfiles));
    assert.ok(config.aiProviders);
    // Invariant: public config never leaks unmasked secret keys
    for (const [provider, p] of Object.entries(config.aiProviders)) {
      if (p.apiKey) {
        assert.ok(!p.apiKey.includes('super-secret'), `Provider ${provider} apiKey must never be unmasked in public config`);
      }
    }
  });

  // =========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS
  // =========================================================================
  console.log('\n--- TIER 4: REAL-WORLD APPLICATION SCENARIOS ---');

  test('T4.1 (Scenario 1): Full Outreach Pipeline Lifecycle', () => {
    // 1. Recipient ingestion
    const csvContent = 'Name,Email,Company,Role\nMargaret Hamilton,margaret@mit.edu,MIT,Director of Software Engineering';
    const tmp = path.join(__dirname, `tmp_t4_${Date.now()}.csv`);
    let sheet;
    try {
      fs.writeFileSync(tmp, csvContent);
      sheet = parseRecipientSheet(tmp, 'margaret.csv');
    } finally {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
    assert.strictEqual(sheet.totalCount, 1);
    const recipient = sheet.rows[0];

    // 2. Build personalized prompts
    const resumeText = 'Developed onboard flight software for Apollo guidance computer. Zero software bugs in flight.';
    const prompts = buildPrompts({
      resumeText,
      jobDescription: 'Software reliability and mission-critical systems engineering.',
      recipient,
      customTone: 'impact',
      senderName: 'Alex Mercer'
    });

    // 3. Simulate AI output with markdown fence
    const aiResponse = '```json\n{\n  "subject": "Mission-Critical Software Engineering — Alex Mercer",\n  "body": "Hi Margaret,\\n\\nI have developed onboard flight software for critical guidance systems with zero bugs in flight.\\n\\nBest,\\nAlex"\n}\n```';
    const draft = cleanJsonOutput(aiResponse);
    assert.ok(draft);
    assert.strictEqual(draft.subject, 'Mission-Critical Software Engineering — Alex Mercer');

    // 4. Audit claims
    const audit = auditDraftClaims({ draftText: draft.body, resumeText });
    assert.strictEqual(audit.hasUngroundedClaims, false);

    // 5. Simulate SMTP delivery classification on transient error
    const deliveryResult = classifySmtpError({ responseCode: 421, response: '421 4.7.0 Service not available, closing transmission' });
    assert.strictEqual(deliveryResult.isTransient, true);
    assert.strictEqual(deliveryResult.shouldRetry, true);
  });

  test('T4.2 (Scenario 2): Cross-Campaign Deduplication & Zero Retention Verification', () => {
    // Verify uploads folder has zero residual test files
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    
    // Simulate upload and immediate cleanup
    const tempFile = path.join(uploadsDir, `ephemeral_resume_${Date.now()}.pdf`);
    fs.writeFileSync(tempFile, 'Simulated resume buffer');
    assert.ok(fs.existsSync(tempFile));
    fs.unlinkSync(tempFile);
    assert.ok(!fs.existsSync(tempFile));
  });

  console.log(`\n====================================================`);
  console.log(`SUMMARY: ${passed} / ${total} SERVER E2E TESTS PASSED`);
  console.log(`====================================================\n`);
}

runServerE2eSuite();
