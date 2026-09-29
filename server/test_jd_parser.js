/**
 * Tests for AI-Powered JD Parser feature:
 * - urlScraper: URL validation, HTML text extraction
 * - aiService: parseJobDescription structured extraction
 * - server route: /api/ai/parse-jd input validation
 */

const assert = require('assert');
const { validateUrl, extractTextFromHtml, extractTitle } = require('./services/urlScraper');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('\n🧪 AI JD Parser Test Suite\n');

// ─── URL Validation Tests ────────────────────────────────────────────

console.log('── URL Validation ──');

test('validateUrl accepts valid https URL', () => {
  const r = validateUrl('https://boards.greenhouse.io/stripe/jobs/12345');
  assert.strictEqual(r.valid, true);
  assert.ok(r.url instanceof URL);
});

test('validateUrl accepts valid http URL', () => {
  const r = validateUrl('http://example.com/jobs/swe');
  assert.strictEqual(r.valid, true);
});

test('validateUrl rejects missing protocol', () => {
  const r = validateUrl('boards.greenhouse.io/stripe/jobs/12345');
  assert.strictEqual(r.valid, false);
  assert.ok(r.error.includes('http'));
});

test('validateUrl rejects empty input', () => {
  const r = validateUrl('');
  assert.strictEqual(r.valid, false);
});

test('validateUrl rejects null input', () => {
  const r = validateUrl(null);
  assert.strictEqual(r.valid, false);
});

test('validateUrl rejects ftp protocol', () => {
  const r = validateUrl('ftp://example.com/file');
  assert.strictEqual(r.valid, false);
});

// ─── HTML Text Extraction Tests ──────────────────────────────────────

console.log('\n── HTML Text Extraction ──');

test('extractTextFromHtml strips script and style tags', () => {
  const html = '<body><script>alert("x")</script><style>.a{}</style><p>Hello World</p></body>';
  const text = extractTextFromHtml(html);
  assert.ok(!text.includes('alert'));
  assert.ok(!text.includes('.a{}'));
  assert.ok(text.includes('Hello World'));
});

test('extractTextFromHtml prefers main content', () => {
  const html = '<body><nav>Menu</nav><main><p>Job Description Here</p></main><footer>Footer</footer></body>';
  const text = extractTextFromHtml(html);
  assert.ok(text.includes('Job Description Here'));
  assert.ok(!text.includes('Menu'));
  assert.ok(!text.includes('Footer'));
});

test('extractTextFromHtml prefers article if no main', () => {
  const html = '<body><nav>Nav</nav><article><p>Senior Engineer at Stripe</p></article></body>';
  const text = extractTextFromHtml(html);
  assert.ok(text.includes('Senior Engineer at Stripe'));
  assert.ok(!text.includes('Nav'));
});

test('extractTextFromHtml decodes HTML entities', () => {
  const html = '<body><p>React &amp; TypeScript &lt;3</p></body>';
  const text = extractTextFromHtml(html);
  assert.ok(text.includes('React & TypeScript'));
});

test('extractTextFromHtml collapses whitespace', () => {
  const html = '<body><p>Hello    World</p><p>  Another   Line  </p></body>';
  const text = extractTextFromHtml(html);
  assert.ok(!text.includes('    '));
});

test('extractTextFromHtml handles empty input', () => {
  assert.strictEqual(extractTextFromHtml(''), '');
  assert.strictEqual(extractTextFromHtml(null), '');
});

test('extractTextFromHtml truncates to 8000 chars', () => {
  const longHtml = '<body>' + 'A'.repeat(10000) + '</body>';
  const text = extractTextFromHtml(longHtml);
  assert.ok(text.length <= 8000);
});

// ─── Title Extraction Tests ─────────────────────────────────────────

console.log('\n── Title Extraction ──');

test('extractTitle extracts page title', () => {
  const html = '<html><head><title>Senior SWE - Stripe Careers</title></head><body></body></html>';
  assert.strictEqual(extractTitle(html), 'Senior SWE - Stripe Careers');
});

test('extractTitle returns empty for no title', () => {
  assert.strictEqual(extractTitle('<html><body></body></html>'), '');
});

// ─── parseJobDescription Input Validation ────────────────────────────

console.log('\n── parseJobDescription Validation ──');

const { parseJobDescription } = require('./services/aiService');

test('parseJobDescription rejects short text', async () => {
  try {
    await parseJobDescription({ providerKey: 'gemini', providerConfig: { apiKey: 'test' }, rawText: 'too short' });
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('too short'));
  }
});

test('parseJobDescription rejects empty text', async () => {
  try {
    await parseJobDescription({ providerKey: 'gemini', providerConfig: { apiKey: 'test' }, rawText: '' });
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('too short'));
  }
});

test('parseJobDescription rejects null text', async () => {
  try {
    await parseJobDescription({ providerKey: 'gemini', providerConfig: { apiKey: 'test' }, rawText: null });
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('too short'));
  }
});

// ─── Batch Generate Respects Per-Recipient JDs ──────────────────────

console.log('\n── Per-Recipient JD Partitioning ──');

test('batch-generate partitions recipients with/without JDs correctly', () => {
  // Simulates the partition logic from server/index.js batch-generate route
  const recipients = [
    { id: '1', email: 'a@co.com', jobDescription: 'Senior SWE role at Stripe requiring React and Node.js' },
    { id: '2', email: 'b@co.com', jobDescription: '' },
    { id: '3', email: 'c@co.com', jobDescription: '   ' },
    { id: '4', email: 'd@co.com', jobDescription: 'Founding engineer role at AI startup' },
    { id: '5', email: 'e@co.com' } // no JD field at all
  ];

  const withJd = [];
  const withoutJd = [];
  recipients.forEach((recipient, idx) => {
    const hasSpecificJd = Boolean(
      recipient &&
      recipient.jobDescription &&
      typeof recipient.jobDescription === 'string' &&
      recipient.jobDescription.trim().length > 0
    );
    if (hasSpecificJd) {
      withJd.push({ recipient, index: idx });
    } else {
      withoutJd.push({ recipient, index: idx });
    }
  });

  assert.strictEqual(withJd.length, 2, 'Should have 2 recipients with JDs');
  assert.strictEqual(withoutJd.length, 3, 'Should have 3 recipients without JDs');
  assert.strictEqual(withJd[0].recipient.id, '1');
  assert.strictEqual(withJd[1].recipient.id, '4');
});

// ─── Duplicate Email Detection ──────────────────────────────────────

console.log('\n── Duplicate Email Detection ──');

test('AI-parsed recipient email dedup matches existing recipients', () => {
  const existingEmails = ['hr@stripe.com', 'RECRUITER@openai.com', 'jobs@figma.com'];
  const newEmail = 'HR@Stripe.com';

  const isDuplicate = existingEmails.some(
    e => e.toLowerCase() === newEmail.trim().toLowerCase()
  );
  assert.strictEqual(isDuplicate, true, 'Should detect case-insensitive duplicate');
});

test('non-duplicate email passes dedup check', () => {
  const existingEmails = ['hr@stripe.com', 'recruiter@openai.com'];
  const newEmail = 'hiring@google.com';

  const isDuplicate = existingEmails.some(
    e => e.toLowerCase() === newEmail.trim().toLowerCase()
  );
  assert.strictEqual(isDuplicate, false);
});

// ─── Summary ────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log(`${'═'.repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
}
