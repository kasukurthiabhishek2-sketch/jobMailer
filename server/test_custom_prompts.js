const assert = require('assert');
const fs = require('fs');
const path = require('path');
const storage = require('./services/storageService');
const { buildPrompts } = require('./services/aiService');

function runTests() {
  console.log('Testing User-Customizable AI Prompts & Invariants...');

  const configPath = path.join(__dirname, 'data', 'config.json');
  const origConfig = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : null;

  try {
    // 1. Initial / default config schema contains customPrompts with disabled flags
    const publicConfig = storage.getPublicConfig();
    assert.ok(publicConfig.customPrompts, 'publicConfig must have customPrompts field');
    assert.strictEqual(typeof publicConfig.customPrompts.coldEmail, 'object', 'coldEmail slot must exist');
    assert.strictEqual(typeof publicConfig.customPrompts.jdParser, 'object', 'jdParser slot must exist');
    console.log('✓ customPrompts initialized in publicConfig with coldEmail and jdParser slots');

    // 2. buildPrompts uses default prompt when no customSystemPrompt is supplied
    const defaultPrompts = buildPrompts({
      resumeText: 'Experienced Node.js and React engineer with 5 years experience',
      jobDescription: 'Senior Backend Engineer with Express and PostgreSQL',
      recipient: { name: 'Sarah Connor', company: 'Cyberdyne Systems', role: 'Staff Engineer' },
      customTone: 'Direct and confident',
      senderName: 'John Doe'
    });
    assert.ok(defaultPrompts.systemPrompt.includes('You are an elite career strategist'), 'Must use default system prompt');
    assert.ok(defaultPrompts.systemPrompt.includes('"subject"'), 'Must require JSON format');
    assert.ok(defaultPrompts.userPrompt.includes('Sarah Connor'), 'Must include recipient name in userPrompt');
    console.log('✓ buildPrompts default behavior preserved with fact-grounding and JSON rules');

    // 3. buildPrompts overrides system prompt when customSystemPrompt is provided
    const customPromptText = 'You are a warm networking mentor writing casual intro notes.';
    const customizedPrompts = buildPrompts({
      resumeText: 'Frontend specialist',
      jobDescription: 'Frontend React Role',
      recipient: { name: 'Alex', company: 'Acme' },
      senderName: 'Jane',
      customSystemPrompt: customPromptText
    });
    assert.ok(customizedPrompts.systemPrompt.includes(customPromptText), 'Must contain custom prompt text');
    assert.ok(customizedPrompts.systemPrompt.includes('"subject"') && customizedPrompts.systemPrompt.includes('"body"'), 'Must automatically guarantee JSON output formatting even if custom prompt omitted it');
    console.log('✓ Custom system prompt applied with automatic JSON output formatting guarantee');

    // 4. If custom prompt already includes JSON instructions, does not duplicate suffix
    const customPromptWithJson = 'Custom prompt that returns {"subject": "...", "body": "..."} strictly.';
    const promptWithJson = buildPrompts({
      resumeText: 'Fullstack Dev',
      customSystemPrompt: customPromptWithJson
    });
    assert.strictEqual(promptWithJson.systemPrompt, customPromptWithJson.trim());
    console.log('✓ Custom prompt with existing JSON schema specification preserved cleanly');

    // 5. updateCustomPrompts persists custom prompts to storage and returns updated publicConfig
    const testCustomEmailPrompt = 'Custom recruiter prompt: highlight leadership and cloud migrations.';
    const testCustomJdPrompt = 'Custom JD extractor: prioritize extracting HR email addresses.';

    const updated = storage.updateCustomPrompts({
      coldEmail: { enabled: true, content: testCustomEmailPrompt },
      jdParser: { enabled: true, content: testCustomJdPrompt }
    });

    assert.strictEqual(updated.customPrompts.coldEmail.enabled, true);
    assert.strictEqual(updated.customPrompts.coldEmail.content, testCustomEmailPrompt);
    assert.strictEqual(updated.customPrompts.jdParser.enabled, true);
    assert.strictEqual(updated.customPrompts.jdParser.content, testCustomJdPrompt);

    // Verify persistence on disk via fresh read
    const reloaded = storage.getDecryptedConfig();
    assert.strictEqual(reloaded.customPrompts.coldEmail.content, testCustomEmailPrompt);
    assert.strictEqual(reloaded.customPrompts.jdParser.content, testCustomJdPrompt);
    console.log('✓ Custom prompts safely persisted to storage with validation');

    // 6. Security & bounds: ignores unknown prompt keys and caps max length
    const massiveContent = 'A'.repeat(10000);
    const bounded = storage.updateCustomPrompts({
      coldEmail: { enabled: true, content: massiveContent },
      maliciousKey: { enabled: true, content: 'hack' }
    });
    assert.strictEqual(bounded.customPrompts.maliciousKey, undefined, 'Must reject unknown prompt keys');
    assert.strictEqual(bounded.customPrompts.coldEmail.content.length, 8000, 'Must cap prompt content to 8000 characters');
    console.log('✓ Security validation and length capping verified');

    // 7. Resetting custom prompts disables them cleanly
    storage.updateCustomPrompts({
      coldEmail: { enabled: false, content: '' },
      jdParser: { enabled: false, content: '' }
    });
    const afterReset = storage.getPublicConfig();
    assert.strictEqual(afterReset.customPrompts.coldEmail.enabled, false);
    assert.strictEqual(afterReset.customPrompts.coldEmail.content, '');
    console.log('✓ Custom prompts reset to default state verified');

    console.log('\nALL CUSTOM PROMPT TESTS PASSED CLEANLY!\n');
  } finally {
    // Restore original config
    if (origConfig) {
      fs.writeFileSync(configPath, origConfig, 'utf8');
    }
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
