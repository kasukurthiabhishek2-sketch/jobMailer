const assert = require('assert');
const {
  auditDraftClaims,
  buildPrompts,
  cleanJsonOutput,
  generateColdEmail
} = require('./services/aiService');

async function runTests() {
  console.log('Testing AI Fact-Checking Guardrails, Prompt Building & JSON Cleaning...');

  // Test 1: Grounded Claims (Happy Path)
  const resumeText = 'Senior Software Engineer with 6 years experience. Improved API throughput by 42% and scaled databases to support 2.5M users. Led team of 8 engineers.';
  const groundedDraft = 'Hi Team, I recently improved system latency by 42% and scaled infra for 2.5M users. Would love to discuss opportunities.';
  const auditGrounded = auditDraftClaims({ draftText: groundedDraft, resumeText });
  assert.strictEqual(auditGrounded.hasUngroundedClaims, false, 'Grounded draft should have no ungrounded claims');
  assert.strictEqual(auditGrounded.flaggedClaims.length, 0);
  assert.strictEqual(auditGrounded.groundingScore, 100);
  console.log('✓ Grounded metrics verified without false positives.');

  // Test 2: Ungrounded / Hallucinated Metrics Detected
  const hallucinatedDraft = 'Hi Jane, at my last company I grew revenue by $15M and increased conversion rates by 85%. I also managed 500+ clients.';
  const auditHallucinated = auditDraftClaims({ draftText: hallucinatedDraft, resumeText });
  assert.strictEqual(auditHallucinated.hasUngroundedClaims, true, 'Ungrounded claims must be detected');
  assert.ok(auditHallucinated.flaggedClaims.some(c => c.claim === '85%'), 'Must catch fake 85%');
  assert.ok(auditHallucinated.flaggedClaims.some(c => c.claim.includes('$15M')), 'Must catch fake $15M revenue');
  assert.ok(auditHallucinated.flaggedClaims.some(c => c.claim.includes('500+ clients')), 'Must catch fake 500+ clients');
  assert.ok(auditHallucinated.groundingScore < 100, 'Score must be penalized');
  console.log('✓ Hallucinated numbers, revenue, and scale metrics successfully flagged.');

  // Test 3: buildPrompts with JD and without JD
  const withJd = buildPrompts({
    resumeText: 'Experienced Node.js dev',
    jobDescription: 'Looking for a Senior Backend Engineer proficient in distributed systems.',
    recipient: { name: 'Sarah', company: 'Acme', role: 'Staff SWE' },
    senderName: 'Alex'
  });
  assert.ok(withJd.systemPrompt.includes('Strict Fact Grounding'));
  assert.ok(withJd.userPrompt.includes('Looking for a Senior Backend Engineer'));

  const withoutJd = buildPrompts({
    resumeText: 'Experienced Node.js dev',
    jobDescription: '',
    recipient: { name: 'Sarah', company: 'Acme' },
    senderName: 'Alex'
  });
  assert.ok(withoutJd.userPrompt.includes('None provided. Focus on candidate core strengths'));
  console.log('✓ buildPrompts with and without JD verified.');

  // Test 4: cleanJsonOutput robustness
  const rawWithMarkdown = '```json\n{"subject": "Test Subj", "body": "Test Body"}\n```';
  const parsedMd = cleanJsonOutput(rawWithMarkdown);
  assert.strictEqual(parsedMd.subject, 'Test Subj');
  assert.strictEqual(parsedMd.body, 'Test Body');

  const rawWithChatter = 'Here is the requested email JSON:\n{"subject": "Chatter Subj", "body": "Chatter Body"}\nHope this helps!';
  const parsedChatter = cleanJsonOutput(rawWithChatter);
  assert.strictEqual(parsedChatter.subject, 'Chatter Subj');
  assert.strictEqual(parsedChatter.body, 'Chatter Body');
  console.log('✓ cleanJsonOutput markdown and chatter extraction verified.');

  // Test 5: generateColdEmail returns groundingAudit
  const demoEmail = await generateColdEmail({
    providerKey: 'gemini',
    providerConfig: { apiKey: '', model: 'gemini-1.5-flash' },
    resumeText,
    recipient: { name: 'Mark', email: 'mark@example.com', company: 'OpenAI' }
  });
  assert.ok(demoEmail.groundingAudit, 'Email generation must attach groundingAudit object');
  assert.strictEqual(demoEmail.groundingAudit.isGroundingAudited, true);
  console.log('✓ generateColdEmail attaches verifiable groundingAudit.');

  console.log('ALL AI GUARDRAIL TESTS PASSED!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
