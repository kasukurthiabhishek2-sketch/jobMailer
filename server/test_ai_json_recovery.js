const assert = require('assert');
const { cleanJsonOutput } = require('./services/aiService');

async function runTests() {
  console.log('Testing AI Multi-Stage JSON Recovery & Schema Repair Engine...\n');

  // Test 1: Valid clean JSON
  const validJson = JSON.stringify({
    subject: 'Discussion: Distributed Systems at Acme Corp',
    body: 'Hi Sarah,\n\nI noticed your engineering team is scaling distributed systems.'
  });
  const res1 = cleanJsonOutput(validJson);
  assert.ok(res1, 'Valid JSON must be parsed');
  assert.strictEqual(res1.subject, 'Discussion: Distributed Systems at Acme Corp');
  assert.strictEqual(res1.body, 'Hi Sarah,\n\nI noticed your engineering team is scaling distributed systems.');
  console.log('✓ 1. Valid clean JSON parsed.');

  // Test 2: Markdown fenced JSON (```json ... ```)
  const fencedJson = '```json\n' + validJson + '\n```';
  const res2 = cleanJsonOutput(fencedJson);
  assert.ok(res2, 'Fenced JSON must be parsed');
  assert.strictEqual(res2.subject, res1.subject);
  assert.strictEqual(res2.body, res1.body);
  console.log('✓ 2. Markdown ```json fenced JSON stripped and parsed.');

  // Test 3: Markdown fenced with conversational preamble and postscript
  const chatterJson = 'Here is the draft you requested for Sarah Connor:\n\n```json\n' + validJson + '\n```\n\nHope this is helpful!';
  const res3 = cleanJsonOutput(chatterJson);
  assert.ok(res3, 'JSON with preamble and postscript must be recovered');
  assert.strictEqual(res3.subject, res1.subject);
  assert.strictEqual(res3.body, res1.body);
  console.log('✓ 3. Preamble and postscript conversation stripped.');

  // Test 4: JSON with unescaped literal newlines in "body"
  const rawWithNewlines = '{\n  "subject": "Role Inquiry",\n  "body": "Hi Sarah,\n\nI am writing to connect.\n\nBest,\nAlex"\n}';
  const res4 = cleanJsonOutput(rawWithNewlines);
  assert.ok(res4, 'Unescaped newlines must be recovered');
  assert.strictEqual(res4.subject, 'Role Inquiry');
  assert.ok(res4.body.includes('Hi Sarah'));
  assert.ok(res4.body.includes('Best,\nAlex'));
  console.log('✓ 4. Unescaped literal newlines in body repaired.');

  // Test 5: JSON with unescaped literal tabs
  const rawWithTabs = '{\n  "subject": "System Highlights",\n  "body": "Highlights:\tReduced latency by 45%\nScale:\t2M users"\n}';
  const res5 = cleanJsonOutput(rawWithTabs);
  assert.ok(res5, 'Unescaped tabs must be recovered');
  assert.strictEqual(res5.subject, 'System Highlights');
  assert.ok(res5.body.includes('Reduced latency by 45%'));
  console.log('✓ 5. Unescaped literal tabs in body repaired.');

  // Test 6: JSON with unescaped double quotes inside "body"
  const rawWithQuotes = '{"subject": "Project Lead", "body": "I led the "Project Titan" initiative and "Apollo" microservice at Stripe."}';
  const res6 = cleanJsonOutput(rawWithQuotes);
  assert.ok(res6, 'Unescaped internal quotes must be recovered');
  assert.strictEqual(res6.subject, 'Project Lead');
  assert.ok(res6.body.includes('Project Titan'));
  assert.ok(res6.body.includes('Apollo'));
  console.log('✓ 6. Unescaped double quotes inside body recovered.');

  // Test 7: Truncated JSON missing closing brace (token ceiling cutoff)
  const truncatedJson = '{"subject": "Infrastructure Lead", "body": "Hi Sarah,\n\nAt my previous company I reduced AWS costs by 35% and scaled services';
  const res7 = cleanJsonOutput(truncatedJson);
  assert.ok(res7, 'Truncated JSON must recover subject and available body');
  assert.strictEqual(res7.subject, 'Infrastructure Lead');
  assert.ok(res7.body.includes('reduced AWS costs by 35%'));
  console.log('✓ 7. Truncated JSON missing closing brace recovered.');

  // Test 8: JSON with trailing commas
  const trailingCommaJson = '{\n  "subject": "Trailing Comma Test",\n  "body": "Clean body text",\n}';
  const res8 = cleanJsonOutput(trailingCommaJson);
  assert.ok(res8, 'Trailing comma JSON must be parsed');
  assert.strictEqual(res8.subject, 'Trailing Comma Test');
  assert.strictEqual(res8.body, 'Clean body text');
  console.log('✓ 8. Trailing commas stripped and parsed.');

  // Test 9: Non-JSON plain text with "Subject: ..." on line 1
  const plainTextEmail = 'Subject: Exploring Opportunities at Acme Corp\n\nHi Sarah,\n\nI noticed your open position and wanted to share my background.\n\nBest,\nAlex';
  const res9 = cleanJsonOutput(plainTextEmail);
  assert.ok(res9, 'Plain text RFC 822 format must extract subject and body');
  assert.strictEqual(res9.subject, 'Exploring Opportunities at Acme Corp');
  assert.ok(res9.body.includes('Hi Sarah'));
  assert.ok(!res9.body.includes('Subject:'), 'Body should not contain the Subject header line');
  console.log('✓ 9. Plain text with Subject header parsed into fields.');

  // Test 10: Completely garbled text
  const garbledText = '<<<Garbled noise with random characters !@#$%^&*()_+{}|:<>?>>>';
  assert.doesNotThrow(() => {
    const res10 = cleanJsonOutput(garbledText);
    if (res10) {
      assert.ok(typeof res10 === 'object');
    }
  }, 'Garbled text must never crash or throw unhandled exceptions');
  console.log('✓ 10. Completely garbled text handled fail-safe without throwing.');

  console.log('\nALL AI JSON RECOVERY & SCHEMA REPAIR TESTS PASSED!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
