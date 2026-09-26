const assert = require('assert');
const { generateColdEmail } = require('./services/aiService');
const copilotService = require('./services/copilotService');

async function runTests() {
  console.log('Testing Copilot AI Service Dispatch...');

  // Test 1: Demo mode fallback when no key is set
  const demoResult = await generateColdEmail({
    providerKey: 'copilot',
    providerConfig: { apiKey: '', model: 'gpt-4o' },
    resumeText: 'Software engineer with 5 years experience in Node.js',
    recipient: { name: 'Alice Smith', email: 'alice@example.com', company: 'Acme Corp' }
  });
  assert.ok(demoResult.subject.includes('Acme Corp'), 'Demo subject should include company name');
  assert.ok(demoResult.body.includes('Alice'), 'Demo body should address recipient');
  assert.ok(demoResult.isDemoNotice, 'Should have demo notice');
  console.log('✓ Copilot demo mode fallback passed.');

  // Test 2: Verify callCopilotChat is properly defined and invoked without ReferenceError
  const originalCallCopilot = copilotService.callCopilotChat;
  let invoked = false;
  let receivedArgs = null;

  copilotService.callCopilotChat = async (args) => {
    invoked = true;
    receivedArgs = args;
    return {
      subject: 'Mock Copilot Subject',
      body: 'Mock Copilot Body'
    };
  };

  try {
    const liveResult = await generateColdEmail({
      providerKey: 'copilot',
      providerConfig: { apiKey: 'ghu_mock_token_123', model: 'claude-3.5-sonnet' },
      resumeText: 'Experienced Node.js dev',
      recipient: { name: 'Bob Jones', email: 'bob@example.com', company: 'Beta Corp' }
    });

    assert.strictEqual(invoked, true, 'callCopilotChat must be invoked');
    assert.strictEqual(receivedArgs.githubAccessToken, 'ghu_mock_token_123');
    assert.strictEqual(receivedArgs.model, 'claude-3.5-sonnet');
    assert.strictEqual(liveResult.subject, 'Mock Copilot Subject');
    console.log('✓ Copilot live dispatch routing passed without ReferenceError.');
  } finally {
    copilotService.callCopilotChat = originalCallCopilot;
  }

  console.log('ALL COPILOT DISPATCH TESTS PASSED!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
