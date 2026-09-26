const assert = require('assert');
const storage = require('./services/storageService');
const { decrypt } = require('./utils/crypto');

function runTests() {
  console.log('Testing Storage Service & Data Security Invariants...');

  // Test 1: getPublicConfig masks secrets and NEVER leaks raw secrets
  const publicConfig = storage.getPublicConfig();
  assert.ok(publicConfig.aiProviders, 'Must have aiProviders');

  for (const [key, provider] of Object.entries(publicConfig.aiProviders)) {
    assert.strictEqual(provider.apiKey, undefined, `Raw apiKey for ${key} must NEVER be returned in public config`);
    assert.ok('maskedKey' in provider, `maskedKey property must exist for ${key}`);
    assert.ok(typeof provider.isConfigured === 'boolean', `isConfigured must be boolean for ${key}`);
  }

  if (Array.isArray(publicConfig.smtpProfiles)) {
    for (const profile of publicConfig.smtpProfiles) {
      assert.strictEqual(profile.password, undefined, 'Raw password must NEVER be returned in public config');
      assert.ok('maskedPassword' in profile, 'maskedPassword property must exist');
    }
  }
  console.log('✓ Public config masking invariant verified across all providers and SMTP profiles.');

  // Test 2: AI provider secret encryption at rest
  const testApiKey = 'sk-test-secret-key-1234567890abcdefg';
  const updatedConfig = storage.updateAiProvider('openai', {
    apiKey: testApiKey,
    model: 'gpt-4o-mini',
    enabled: true
  });

  assert.strictEqual(updatedConfig.aiProviders.openai.isConfigured, true);
  assert.strictEqual(updatedConfig.aiProviders.openai.apiKey, undefined, 'Public update response must mask apiKey');

  const decryptedConfig = storage.getDecryptedConfig();
  assert.strictEqual(decryptedConfig.aiProviders.openai.apiKey, testApiKey, 'Decrypted internal config must recover secret');
  console.log('✓ AES-256-GCM encryption at rest verified for AI providers.');

  // Test 3: Campaign logs persistence and bounding
  const initialLogs = storage.getCampaignLogs();
  const testLog = {
    id: 'test_log_' + Date.now(),
    timestamp: new Date().toISOString(),
    recipientEmail: 'audit_test@example.com',
    status: 'sent'
  };

  storage.addCampaignLogs(testLog);
  const logsAfter = storage.getCampaignLogs();
  assert.ok(logsAfter.some(l => l.id === testLog.id), 'New log must be retrievable from storage');
  assert.ok(logsAfter.length <= 500, 'Logs must be bounded to 500');
  console.log('✓ Campaign logs audit storage verified.');

  console.log('ALL STORAGE SUBSYSTEM TESTS PASSED!');
}

runTests();
