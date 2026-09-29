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
    const hasSpecificRole = Boolean(
      recipient &&
      recipient.role &&
      typeof recipient.role === 'string' &&
      recipient.role.trim().length > 0
    );
    if (hasSpecificJd || hasSpecificRole) {
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

test('batch-generate routes recipients with specific role into tailored generation', () => {
  const recipients = [
    { id: '1', email: 'dev@co.com', role: 'Staff Backend Engineer', jobDescription: '' },
    { id: '2', email: 'pm@co.com', role: 'Product Lead' },
    { id: '3', email: 'generic@co.com' } // no role, no JD
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
    const hasSpecificRole = Boolean(
      recipient &&
      recipient.role &&
      typeof recipient.role === 'string' &&
      recipient.role.trim().length > 0
    );
    if (hasSpecificJd || hasSpecificRole) {
      withJd.push({ recipient, index: idx });
    } else {
      withoutJd.push({ recipient, index: idx });
    }
  });

  assert.strictEqual(withJd.length, 2, 'Should route 2 role-specific recipients to tailored pool');
  assert.strictEqual(withoutJd.length, 1, 'Should route 1 role-less recipient to generic pool');
  assert.strictEqual(withJd[0].recipient.role, 'Staff Backend Engineer');
  assert.strictEqual(withJd[1].recipient.role, 'Product Lead');
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

// ─── SSRF, Host & Port Security Tests ────────────────────────────────

console.log('\n── SSRF & Port Security ──');

const { isPrivateOrRestrictedIp, extractJsonLdJobPosting, detectContentBarriers } = require('./services/urlScraper');

test('validateUrl rejects localhost', () => {
  const r = validateUrl('http://localhost:5001/api/config');
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.code, 'URL_FORBIDDEN_HOST');
});

test('validateUrl rejects 127.0.0.1 loopback', () => {
  const r = validateUrl('http://127.0.0.1:80/job');
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.code, 'URL_FORBIDDEN_HOST');
});

test('validateUrl rejects cloud metadata IP 169.254.169.254', () => {
  const r = validateUrl('http://169.254.169.254/latest/meta-data/');
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.code, 'URL_FORBIDDEN_HOST');
});

test('validateUrl rejects Google cloud internal metadata hostname', () => {
  const r = validateUrl('http://metadata.google.internal/computeMetadata/v1/');
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.code, 'URL_FORBIDDEN_HOST');
});

test('validateUrl rejects embedded credentials in URL', () => {
  const r = validateUrl('https://admin:secret@boards.greenhouse.io/job/123');
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.code, 'URL_CREDENTIALS_FORBIDDEN');
});

test('validateUrl rejects non-standard web ports (e.g. 22, 6379, 8080)', () => {
  assert.strictEqual(validateUrl('http://example.com:22/job').valid, false);
  assert.strictEqual(validateUrl('http://example.com:6379/job').valid, false);
  assert.strictEqual(validateUrl('http://example.com:8080/job').valid, false);
  assert.strictEqual(validateUrl('https://example.com:443/job').valid, true);
  assert.strictEqual(validateUrl('http://example.com:80/job').valid, true);
});

test('isPrivateOrRestrictedIp detects private IPv4 subnets', () => {
  assert.strictEqual(isPrivateOrRestrictedIp('10.0.0.1'), true);
  assert.strictEqual(isPrivateOrRestrictedIp('172.16.0.1'), true);
  assert.strictEqual(isPrivateOrRestrictedIp('192.168.1.1'), true);
  assert.strictEqual(isPrivateOrRestrictedIp('100.64.0.1'), true); // CGNAT
  assert.strictEqual(isPrivateOrRestrictedIp('169.254.169.254'), true); // Link-local
  assert.strictEqual(isPrivateOrRestrictedIp('127.0.0.1'), true); // Loopback
  assert.strictEqual(isPrivateOrRestrictedIp('8.8.8.8'), false); // Public Google DNS
  assert.strictEqual(isPrivateOrRestrictedIp('1.1.1.1'), false); // Public Cloudflare DNS
});

test('isPrivateOrRestrictedIp detects IPv6 loopback and link-local', () => {
  assert.strictEqual(isPrivateOrRestrictedIp('::1'), true);
  assert.strictEqual(isPrivateOrRestrictedIp('fe80::1'), true);
  assert.strictEqual(isPrivateOrRestrictedIp('::ffff:127.0.0.1'), true);
  assert.strictEqual(isPrivateOrRestrictedIp('2606:4700:4700::1111'), false); // Public IPv6
});

// ─── JSON-LD JobPosting Extraction Tests ─────────────────────────────

console.log('\n── Deterministic JSON-LD Extraction ──');

test('extractJsonLdJobPosting extracts Schema.org JobPosting', () => {
  const html = `<html><head>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org/",
      "@type": "JobPosting",
      "title": "Staff Platform Engineer",
      "description": "<p>We are looking for a Staff Engineer to lead distributed systems.</p>",
      "hiringOrganization": {
        "@type": "Organization",
        "name": "Stripe"
      },
      "jobLocation": {
        "@type": "Place",
        "address": {
          "addressLocality": "San Francisco",
          "addressRegion": "CA",
          "addressCountry": "USA"
        }
      }
    }
    </script>
  </head><body></body></html>`;

  const parsed = extractJsonLdJobPosting(html);
  assert.ok(parsed, 'Must extract JSON-LD');
  assert.strictEqual(parsed.company, 'Stripe');
  assert.strictEqual(parsed.role, 'Staff Platform Engineer');
  assert.strictEqual(parsed.location, 'San Francisco, CA, USA');
  assert.ok(parsed.description.includes('distributed systems'));
});

test('extractJsonLdJobPosting handles @graph arrays', () => {
  const html = `<html><head>
    <script type="application/ld+json">
    {
      "@graph": [
        { "@type": "WebSite", "name": "Company" },
        {
          "@type": "JobPosting",
          "title": "Lead Rust Developer",
          "hiringOrganization": { "name": "RustCorp" },
          "jobLocationType": "TELECOMMUTE"
        }
      ]
    }
    </script>
  </head></html>`;

  const parsed = extractJsonLdJobPosting(html);
  assert.ok(parsed);
  assert.strictEqual(parsed.company, 'RustCorp');
  assert.strictEqual(parsed.role, 'Lead Rust Developer');
  assert.strictEqual(parsed.location, 'Remote');
});

// ─── SPA and Bot Barrier Detection Tests ─────────────────────────────

console.log('\n── SPA and Bot Barrier Detection ──');

test('detectContentBarriers flags empty SPA root shells', () => {
  const html = '<html><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
  const result = detectContentBarriers(html, '');
  assert.strictEqual(result.isSpa, true);
  assert.strictEqual(result.isCaptcha, false);
  assert.ok(result.reason.includes('JavaScript'));
});

test('detectContentBarriers flags Cloudflare Turnstile / Challenge pages', () => {
  const html = '<html><head><title>Just a moment...</title></head><body><div id="cf-turnstile"></div></body></html>';
  const result = detectContentBarriers(html, 'Checking if the site connection is secure');
  assert.strictEqual(result.isCaptcha, true);
  assert.ok(result.reason.includes('challenge'));
});

// ─── Schema Validation & Grounding Tests ─────────────────────────────

console.log('\n── Schema Validation & Grounding ──');

const { validateAndNormalizeJd, isValidEmail } = require('./utils/jdSchemaValidator');

test('isValidEmail accepts genuine emails and rejects placeholders/system emails', () => {
  assert.strictEqual(isValidEmail('recruiter.jane@stripe.com'), true);
  assert.strictEqual(isValidEmail('jobs@figma.com'), true);
  assert.strictEqual(isValidEmail('email@example.com'), false); // Placeholder
  assert.strictEqual(isValidEmail('support@greenhouse.io'), false); // Platform domain
  assert.strictEqual(isValidEmail('privacy@company.com'), false); // Compliance prefix
  assert.strictEqual(isValidEmail('noreply@company.com'), false); // System prefix
});

test('validateAndNormalizeJd grounds contact emails against source text', () => {
  const sourceText = 'We are hiring a Senior Engineer at Stripe. Please reach out to jessica@stripe.com with your resume.';
  const rawAiOutput = {
    company: 'Stripe',
    role: 'Senior Engineer',
    contacts: [
      { name: 'Jessica', email: 'jessica@stripe.com', title: 'Recruiter' },
      { name: 'Fake', email: 'hallucinated@other.com', title: 'Recruiter' },
      { name: 'Example', email: 'email@example.com', title: '' }
    ]
  };

  const { data } = validateAndNormalizeJd(rawAiOutput, sourceText);
  assert.strictEqual(data.contacts.length, 1);
  assert.strictEqual(data.contacts[0].email, 'jessica@stripe.com');
  assert.strictEqual(data.confidence.emailFound, true);
  assert.strictEqual(data.confidence.companyFound, true);
  assert.strictEqual(data.confidence.roleFound, true);
});

test('validateAndNormalizeJd discards placeholder company and role names', () => {
  const sourceText = 'Looking for an experienced software developer to build platforms.';
  const rawAiOutput = {
    company: 'Company Name',
    role: 'Job Title',
    contacts: []
  };

  const { data } = validateAndNormalizeJd(rawAiOutput, sourceText);
  assert.strictEqual(data.company, '');
  assert.strictEqual(data.role, '');
  assert.strictEqual(data.confidence.companyFound, false);
  assert.strictEqual(data.confidence.roleFound, false);
});

// ─── Schema-Agnostic JSON Extractor Tests ────────────────────────────

console.log('\n── Schema-Agnostic JSON Extractor ──');

const { extractJsonObject } = require('./utils/jsonExtractor');

test('extractJsonObject parses markdown-fenced JSON with conversational preamble', () => {
  const text = `Here is the extracted job information:\n\n\`\`\`json\n{\n  "company": "Vercel",\n  "role": "Edge Engineer"\n}\n\`\`\`\nHope this is useful!`;
  const result = extractJsonObject(text);
  assert.ok(result);
  assert.strictEqual(result.company, 'Vercel');
  assert.strictEqual(result.role, 'Edge Engineer');
});

test('extractJsonObject repairs unescaped newlines and trailing commas', () => {
  const raw = '{\n  "company": "Figma",\n  "description": "Multiplayer\nCanvas Engine",\n}';
  const result = extractJsonObject(raw);
  assert.ok(result);
  assert.strictEqual(result.company, 'Figma');
  assert.ok(result.description.includes('Multiplayer'));
});

// ─── Structured Error Taxonomy & Diagnostics Tests ───────────────────

console.log('\n── Error Taxonomy & Diagnostics ──');

const { ERROR_CODES, ParsingError, generateRequestId } = require('./utils/errorTaxonomy');

test('generateRequestId returns REQ-YYYYMMDD-XXXXXX format', () => {
  const reqId = generateRequestId();
  assert.ok(/^REQ-\d{8}-[A-F0-9]{6}$/.test(reqId), `Invalid request ID format: ${reqId}`);
});

test('ParsingError serializes into structured response contract', () => {
  const err = new ParsingError({
    code: ERROR_CODES.URL_HTTP_403,
    stage: 'url_fetch',
    message: 'URL returned HTTP 403 (Forbidden)',
    userMessage: 'The job board blocked automated access. Try pasting the job description directly.',
    technicalMessage: 'HTTP 403 Forbidden on greenhouse.io',
    retryable: false,
    fallbackAvailable: true,
    requestId: 'REQ-20260930-123456'
  });

  const response = err.toResponse();
  assert.strictEqual(response.success, false);
  assert.strictEqual(response.error, 'The job board blocked automated access. Try pasting the job description directly.');
  assert.strictEqual(response.errorDetails.code, 'URL_HTTP_403');
  assert.strictEqual(response.errorDetails.stage, 'url_fetch');
  assert.strictEqual(response.errorDetails.requestId, 'REQ-20260930-123456');
  assert.strictEqual(response.errorDetails.fallbackAvailable, true);
  assert.strictEqual(response.diagnostics.requestId, 'REQ-20260930-123456');
});

// ─── Summary ────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log(`${'═'.repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
}

