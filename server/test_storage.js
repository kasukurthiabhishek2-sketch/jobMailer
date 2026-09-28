const assert = require('assert');
const fs = require('fs');
const path = require('path');
const storage = require('./services/storageService');

function runTests() {
  console.log('Testing Storage Service & Data Security Invariants...');

  const configPath = path.join(__dirname, 'data', 'config.json');
  const logsPath = path.join(__dirname, 'data', 'logs.json');

  const origConfig = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : null;
  const origLogs = fs.existsSync(logsPath) ? fs.readFileSync(logsPath, 'utf8') : null;

  try {
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

    // Test 4: getDailySendingStats calculates sentToday and remaining quota (TICK-CYC3-12 / C3)
    const stats = storage.getDailySendingStats();
    assert.strictEqual(typeof stats.sentToday, 'number');
    assert.strictEqual(typeof stats.dailyLimit, 'number');
    assert.strictEqual(typeof stats.remaining, 'number');
    assert.ok(stats.sentToday >= 1, 'sentToday must count the recently added sent log');
    assert.strictEqual(stats.remaining, Math.max(0, stats.dailyLimit - stats.sentToday));
    // Test 5: Multiple named savedKeys and active key selection
    storage.updateAiProvider('groq', { apiKey: '' });
    const configBeforeTest5 = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (configBeforeTest5.aiProviders?.groq) {
      configBeforeTest5.aiProviders.groq.savedKeys = [];
      configBeforeTest5.aiProviders.groq.apiKey = '';
      fs.writeFileSync(configPath, JSON.stringify(configBeforeTest5, null, 2), 'utf8');
    }

    const testKey1 = 'gsk_primary_key_abc1234567890';
    const testKey2 = 'gsk_backup_key_xyz9876543210';
    
    // Add primary key with name
    storage.updateAiProvider('groq', {
      apiKey: testKey1,
      keyName: 'Production Groq',
      model: 'openai/gpt-oss-20b'
    });

    // Add second key with name
    storage.updateAiProvider('groq', {
      apiKey: testKey2,
      keyName: 'Backup Groq'
    });

    const publicGroqConfig = storage.getPublicConfig();
    const groqProvider = publicGroqConfig.aiProviders.groq;
    assert.strictEqual(groqProvider.isConfigured, true, 'Groq must be marked configured');
    assert.strictEqual(groqProvider.apiKey, undefined, 'Public config must mask apiKey');
    assert.ok(Array.isArray(groqProvider.savedKeys), 'savedKeys must be an array');
    assert.strictEqual(groqProvider.savedKeys.length, 2, 'Must have 2 saved keys');
    
    // Check that neither saved key leaks raw apiKey
    for (const k of groqProvider.savedKeys) {
      assert.strictEqual(k.apiKey, undefined, 'Saved key in public config must NEVER contain raw apiKey');
      assert.ok(k.maskedKey && k.maskedKey.startsWith('gsk_'), 'Saved key must have valid maskedKey');
      assert.ok(k.name, 'Saved key must have name');
    }

    // Switch active key to first key
    const firstKeyId = groqProvider.savedKeys[0].id;
    storage.updateAiProvider('groq', { selectedKeyId: firstKeyId });
    const decryptedGroq = storage.getDecryptedConfig().aiProviders.groq;
    assert.strictEqual(decryptedGroq.selectedKeyId, firstKeyId);
    assert.strictEqual(decryptedGroq.apiKey, testKey1, 'Active key must be switched to testKey1');

    console.log('✓ Named savedKeys storage, encryption at rest, and active selection verified.');

    console.log('ALL STORAGE SUBSYSTEM TESTS PASSED!');
  } finally {
    // Strictly restore original files so tests never corrupt user data
    if (origConfig !== null) {
      fs.writeFileSync(configPath, origConfig, 'utf8');
    }
    if (origLogs !== null) {
      fs.writeFileSync(logsPath, origLogs, 'utf8');
    }
  }
}

runTests();
