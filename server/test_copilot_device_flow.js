const assert = require('assert');
const fs = require('fs');
const path = require('path');
const copilotService = require('./services/copilotService');
const { testAiConnection, listProviderModels } = require('./services/aiService');

async function runTests() {
  console.log('Testing GitHub Copilot OAuth Device Flow & No-API-Key Invariants...');

  // Test 1: getPendingDeviceFlow is defined and returns null when no flow is active
  assert.strictEqual(typeof copilotService.getPendingDeviceFlow, 'function', 'getPendingDeviceFlow must be an exported function');
  assert.strictEqual(typeof copilotService.clearPendingDeviceFlow, 'function', 'clearPendingDeviceFlow must be an exported function');
  copilotService.clearPendingDeviceFlow();
  assert.strictEqual(copilotService.getPendingDeviceFlow(), null, 'Should return null when no flow is active');
  console.log('✓ copilotService flow tracking functions are properly exported and initialized.');

  // Test 2: testCopilotConnection without token returns GitHub authorization error, NOT generic API key error
  const testConnResult = await copilotService.testCopilotConnection('');
  assert.strictEqual(testConnResult.success, false);
  assert.ok(
    testConnResult.error.toLowerCase().includes('github') || testConnResult.error.toLowerCase().includes('copilot'),
    'Error message must reference GitHub / Copilot authorization'
  );
  assert.ok(
    !testConnResult.error.toLowerCase().includes('api key'),
    'Error message must NOT demand an API key for Copilot'
  );
  console.log('✓ testCopilotConnection provides clear GitHub authorization guidance without demanding an API key.');

  // Test 3: aiService.testAiConnection for copilot without key returns GitHub authorization message
  const aiTestResult = await testAiConnection('copilot', { apiKey: '' });
  assert.strictEqual(aiTestResult.success, false);
  assert.ok(
    aiTestResult.error.toLowerCase().includes('github') || aiTestResult.error.toLowerCase().includes('copilot'),
    'aiService test error must reference GitHub / Copilot'
  );
  assert.ok(
    !aiTestResult.error.toLowerCase().includes('api key is required'),
    'aiService test error must NOT demand an API key for Copilot'
  );
  console.log('✓ aiService.testAiConnection cleanly differentiates Copilot from API-key providers.');

  // Test 4: aiService.listProviderModels for copilot succeeds without requiring an API key
  const modelsResult = await listProviderModels('copilot', '');
  assert.strictEqual(modelsResult.success, true, 'Copilot model listing must succeed without an API key');
  assert.ok(Array.isArray(modelsResult.models), 'Models must be an array');
  const modelIds = modelsResult.models.map(m => m.id);
  assert.ok(modelIds.includes('gpt-4o'), 'Must include gpt-4o');
  assert.ok(modelIds.includes('gpt-4o-mini'), 'Must include gpt-4o-mini');
  console.log('✓ listProviderModels serves Copilot model catalog without requiring an API key.');

  // Test 5: Server index.js routes exist and implement Copilot flow without crashing
  const indexPath = path.join(__dirname, 'index.js');
  const indexContent = fs.readFileSync(indexPath, 'utf8');

  assert.ok(indexContent.includes("app.get('/api/copilot/current-flow'"), 'Must have /api/copilot/current-flow route');
  assert.ok(indexContent.includes("app.post('/api/copilot/cancel-flow'"), 'Must have /api/copilot/cancel-flow route');
  assert.ok(indexContent.includes("app.post('/api/copilot/device-code'"), 'Must have /api/copilot/device-code route');
  assert.ok(indexContent.includes("app.post('/api/copilot/check-status'"), 'Must have /api/copilot/check-status route');
  console.log('✓ Server routes for Copilot device authorization and status checks are properly wired.');

  console.log('ALL GITHUB COPILOT DEVICE FLOW TESTS PASSED!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
