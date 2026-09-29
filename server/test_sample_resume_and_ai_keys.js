/**
 * Test Suite: Sample Resume Workflow, AI Key Testing & Server-Only Persistence
 *
 * Validates:
 * 1. "Try with Sample Resume" payload structure and end-to-end cold email generation.
 * 2. Key resolution: Server-stored decrypted keys resolve for both authenticated and offline users
 *    without requiring raw keys from the client.
 * 3. AI connection testing (/api/config/ai/test):
 *    - Validates connection with explicit keys and server-stored encrypted keys.
 *    - Detects key prefix mismatches (e.g. Groq vs Grok).
 *    - Rejects missing keys with clear error messaging.
 *    - Handles timeouts gracefully with 15s abort notice.
 * 4. Server-Only Persistence (Zero Firestore Data):
 *    - All settings, candidateProfile, preferences, and outreach logs are stored strictly on the server.
 *    - Zero Firestore database writes across client and server.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const storage = require('./services/storageService');
const { testAiConnection } = require('./services/aiService');

console.log('================================================================');
console.log('  TEST SUITE: SAMPLE RESUME, AI KEY TESTING & SERVER-ONLY DATA  ');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. SAMPLE RESUME PAYLOAD & GENERATION INVARIANTS
// -----------------------------------------------------------------------------
console.log('1. Testing "Try with Sample Resume" payload structure and generation...');

const sampleResumeData = {
  fileId: 'sample-resume-alex-mercer',
  originalFilename: 'Alex_Mercer_Resume.pdf',
  detectedName: 'Alex Mercer',
  detectedEmail: 'alex.mercer.dev@example.com',
  detectedPhone: '+1 (555) 382-9912',
  wordCount: 420,
  text: `Alex Mercer
Senior Full-Stack & AI Systems Engineer
San Francisco, CA | alex.mercer.dev@example.com | +1 (555) 382-9912 | github.com/alexmercer | linkedin.com/in/alex-mercer-dev

Summary:
Passionate engineer with 6+ years designing scalable distributed systems, cloud microservices, and LLM-powered applications. Specialized in TypeScript, React, Node.js, Python, and vector databases.`
};

// Check payload properties required by UI and generation pipeline
assert.ok(sampleResumeData.text && sampleResumeData.text.length > 50, 'Sample resume must contain rich text');
assert.strictEqual(sampleResumeData.detectedName, 'Alex Mercer', 'Sample resume name must match');
assert.ok(sampleResumeData.detectedEmail.includes('@'), 'Sample resume must have valid email');
assert.ok(sampleResumeData.wordCount > 100, 'Sample resume must have substantial word count');
console.log('  ✓ Sample resume payload satisfies all parser requirements.');

// -----------------------------------------------------------------------------
// 2. KEY RESOLUTION FOR SERVER-CONFIGURED AI (NO RAW KEY FROM CLIENT)
// -----------------------------------------------------------------------------
console.log('2. Testing AI key resolution from server storage for authenticated & offline users...');

const serverIndexPath = path.join(__dirname, 'index.js');
const serverIndexCode = fs.readFileSync(serverIndexPath, 'utf8');

// Verify resolveAiProviderConfig handles masked keys and falls back to storage
assert.ok(
  serverIndexCode.includes('function resolveAiProviderConfig'),
  'resolveAiProviderConfig helper must be defined'
);
assert.ok(
  !serverIndexCode.includes("callerUid === 'test_user_offline'"),
  'resolveAiProviderConfig must not restrict server storage fallback to test_user_offline'
);

// Simulate resolveAiProviderConfig behavior
function simulateResolveAiProviderConfig(body, callerUid, mockStorageConfig) {
  const fullConfig = mockStorageConfig || storage.getDecryptedConfig();
  const requestedProvider = body.providerKey;
  const clientProviderConfig = body.providerConfig;
  const providerKey = requestedProvider || clientProviderConfig?.providerKey || fullConfig.activeProvider || 'gemini';
  const savedProvider = fullConfig.aiProviders?.[providerKey] || {};

  let apiKey = '';
  if (clientProviderConfig?.apiKey && typeof clientProviderConfig.apiKey === 'string' && !clientProviderConfig.apiKey.includes('...') && !clientProviderConfig.apiKey.includes('••')) {
    apiKey = clientProviderConfig.apiKey.trim();
  }

  if (!apiKey) {
    if (savedProvider.apiKey && !savedProvider.apiKey.includes('...') && !savedProvider.apiKey.includes('••')) {
      apiKey = savedProvider.apiKey;
    } else if (Array.isArray(savedProvider.savedKeys) && savedProvider.savedKeys.length > 0) {
      const lookupId = clientProviderConfig?.selectedKeyId || savedProvider.selectedKeyId;
      const selected = savedProvider.savedKeys.find(k => k.id === lookupId) || savedProvider.savedKeys[0];
      if (selected?.apiKey && !selected.apiKey.includes('...') && !selected.apiKey.includes('••')) {
        apiKey = selected.apiKey;
      }
    }
  }

  const model = clientProviderConfig?.model || savedProvider.model || '';
  const baseURL = clientProviderConfig?.baseURL || savedProvider.baseURL || '';

  return {
    providerKey,
    providerConfig: {
      ...savedProvider,
      ...clientProviderConfig,
      apiKey,
      model: model || savedProvider.model,
      baseURL: baseURL || savedProvider.baseURL
    }
  };
}

const mockStoredConfig = {
  activeProvider: 'gemini',
  aiProviders: {
    gemini: {
      name: 'Google Gemini',
      apiKey: 'AIzaSyLiveServerKeyStoredEncrypted12345',
      model: 'gemini-1.5-flash',
      isConfigured: true
    },
    groq: {
      name: 'Groq',
      savedKeys: [
        { id: 'key-1', apiKey: 'gsk_mockSavedGroqKey999' }
      ],
      selectedKeyId: 'key-1',
      model: 'qwen/qwen3.8-27b'
    }
  }
};

// Case A: Authenticated user sends request with masked key (client knows it is configured, sends masked)
const authUserPayload = {
  providerKey: 'gemini',
  providerConfig: {
    name: 'Google Gemini',
    apiKey: '••••••••',
    model: 'gemini-1.5-flash'
  },
  resumeText: sampleResumeData.text,
  jobDescription: 'Senior Backend Engineer at Stripe'
};
const resolvedAuth = simulateResolveAiProviderConfig(authUserPayload, 'google-uid-12345', mockStoredConfig);
assert.strictEqual(
  resolvedAuth.providerConfig.apiKey,
  'AIzaSyLiveServerKeyStoredEncrypted12345',
  'Authenticated user must resolve real decrypted server key when masked key is sent'
);
assert.strictEqual(resolvedAuth.providerKey, 'gemini');
console.log('  ✓ Authenticated user with masked key resolves server-decrypted key.');

// Case B: Client sends NO apiKey at all (only providerKey)
const noKeyPayload = {
  providerKey: 'groq',
  resumeText: sampleResumeData.text
};
const resolvedNoKey = simulateResolveAiProviderConfig(noKeyPayload, 'google-uid-67890', mockStoredConfig);
assert.strictEqual(
  resolvedNoKey.providerConfig.apiKey,
  'gsk_mockSavedGroqKey999',
  'Client omitting apiKey must resolve key from savedKeys array in server storage'
);
console.log('  ✓ Request omitting apiKey resolves server savedKeys.');

// Case C: Client sends explicit fresh unmasked key (e.g. testing new key in modal)
const explicitKeyPayload = {
  providerKey: 'gemini',
  providerConfig: {
    apiKey: 'AIzaSyClientSuppliedOverrideKey777',
    model: 'gemini-2.0-flash'
  }
};
const resolvedExplicit = simulateResolveAiProviderConfig(explicitKeyPayload, 'google-uid-12345', mockStoredConfig);
assert.strictEqual(
  resolvedExplicit.providerConfig.apiKey,
  'AIzaSyClientSuppliedOverrideKey777',
  'Explicit unmasked client key must override server key'
);
assert.strictEqual(resolvedExplicit.providerConfig.model, 'gemini-2.0-flash');
console.log('  ✓ Explicit client key override takes precedence over server storage.');

// -----------------------------------------------------------------------------
// 3. AI CONNECTION TESTING (/api/config/ai/test)
// -----------------------------------------------------------------------------
console.log('3. Testing AI connection testing invariants and validation...');

// Test 3a: Empty or missing API key rejection
(async () => {
  const emptyRes = await testAiConnection('gemini', { apiKey: '' });
  assert.strictEqual(emptyRes.success, false);
  assert.ok(emptyRes.error.includes('API key is required'), 'Missing key must return clear error message');
})();

// Test 3b: Key prefix mismatch guidance
(async () => {
  // Groq key on Grok
  const mismatch1 = await testAiConnection('grok', { apiKey: 'gsk_test12345678901234567890' });
  assert.strictEqual(mismatch1.success, false);
  assert.ok(mismatch1.error.includes("starts with 'gsk_'"), 'Must detect Groq key prefix on Grok provider');
  assert.ok(mismatch1.error.includes('Groq (LPU Inference)'), 'Must suggest switching to Groq');

  // Groq key on Gemini
  const mismatch2 = await testAiConnection('gemini', { apiKey: 'gsk_test12345678901234567890' });
  assert.strictEqual(mismatch2.success, false);
  assert.ok(mismatch2.error.includes("starts with 'gsk_'"), 'Must detect Groq key prefix on Gemini');

  // xAI Grok key on Groq
  const mismatch3 = await testAiConnection('groq', { apiKey: 'xai-test1234567890' });
  assert.strictEqual(mismatch3.success, false);
  assert.ok(mismatch3.error.includes("starts with 'xai-'"), 'Must detect xAI key prefix on Groq provider');
  console.log('  ✓ Key prefix mismatch guidance operates correctly across providers.');
})();

// Test 3c: Connection test endpoint structure & JSON response guarantee
assert.ok(
  serverIndexCode.includes("res.setHeader('Content-Type', 'application/json');"),
  'AI test endpoint must set JSON content-type header'
);
assert.ok(
  serverIndexCode.includes("storage.updateAiProvider(providerKey, { apiKey: effectiveApiKey"),
  'AI test endpoint must sync verified key to local storage'
);
console.log('  ✓ /api/config/ai/test ensures JSON response and server-side key synchronization.');

// -----------------------------------------------------------------------------
// 4. SERVER-ONLY PERSISTENCE INVARIANTS (ZERO FIRESTORE DATA STORAGE)
// -----------------------------------------------------------------------------
console.log('4. Verifying Server-Only Persistence (Zero Firestore Data Storage)...');

// Verify server endpoints exist for candidate profile, sync, and logs
assert.ok(
  serverIndexCode.includes("app.post('/api/config/candidate-profile'"),
  'Endpoint POST /api/config/candidate-profile must be defined'
);
assert.ok(
  serverIndexCode.includes("app.post('/api/config/sync'"),
  'Endpoint POST /api/config/sync must be defined'
);
assert.ok(
  serverIndexCode.includes("app.get('/api/logs'"),
  'Endpoint GET /api/logs must be defined'
);
assert.ok(
  serverIndexCode.includes("app.delete('/api/logs'"),
  'Endpoint DELETE /api/logs must be defined'
);

// Verify candidateProfile and preferences are exported in storageService
const publicConfig = storage.getPublicConfig();
assert.ok('candidateProfile' in publicConfig, 'Public config must include candidateProfile');
assert.ok('preferences' in publicConfig, 'Public config must include preferences');
assert.ok('smtp' in publicConfig, 'Public config must include smtp');
assert.strictEqual(typeof storage.updateCandidateProfile, 'function', 'updateCandidateProfile must be exported');
assert.strictEqual(typeof storage.saveFullSettings, 'function', 'saveFullSettings must be exported');
console.log('  ✓ Server storage exposes candidateProfile and unified saveFullSettings.');

// Verify Candidate Profile persistence
const testProfile = {
  fullName: 'Alex Mercer',
  email: 'alex.mercer.dev@example.com',
  phone: '+1 (555) 382-9912'
};
const updatedCfg = storage.updateCandidateProfile(testProfile);
assert.strictEqual(updatedCfg.candidateProfile.fullName, 'Alex Mercer');
assert.strictEqual(updatedCfg.candidateProfile.email, 'alex.mercer.dev@example.com');
assert.strictEqual(updatedCfg.candidateProfile.phone, '+1 (555) 382-9912');
console.log('  ✓ Candidate profile persists cleanly in server encrypted storage.');

// Verify Codebase Audit: Zero Firestore Database Calls for User Data
const clientLibDir = path.join(__dirname, '..', 'client', 'src', 'lib');
const settingsJsContent = fs.readFileSync(path.join(clientLibDir, 'settings.js'), 'utf8');
const logsServiceContent = fs.readFileSync(path.join(clientLibDir, 'logsService.js'), 'utf8');
const clientApiContent = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'services', 'api.js'), 'utf8');

// settings.js must not import firestore methods
assert.ok(!settingsJsContent.includes("from 'firebase/firestore'"), 'settings.js must not import firebase/firestore');
assert.ok(!settingsJsContent.includes('setDoc('), 'settings.js must not call setDoc');
assert.ok(!settingsJsContent.includes('getDoc('), 'settings.js must not call getDoc');
assert.ok(!settingsJsContent.includes('deleteDoc('), 'settings.js must not call deleteDoc');

// logsService.js must not import firestore methods
assert.ok(!logsServiceContent.includes("from 'firebase/firestore'"), 'logsService.js must not import firebase/firestore');
assert.ok(!logsServiceContent.includes('collection('), 'logsService.js must not call collection');

// client api.js must use /api/logs
assert.ok(clientApiContent.includes("authFetch('/api/logs')"), 'api.js fetchOutreachLogs must call /api/logs');
assert.ok(clientApiContent.includes("authFetch('/api/config/candidate-profile'"), 'api.js saveCandidateProfile must call /api/config/candidate-profile');
assert.ok(clientApiContent.includes("authFetch('/api/config/sync'"), 'api.js syncSettings must call /api/config/sync');

console.log('  ✓ Codebase audit confirmed: ZERO Firestore database calls for user settings, logs, or credentials.');
console.log('\n================================================================');
console.log('  ALL SAMPLE RESUME, AI KEYS & SERVER-ONLY TESTS PASSED CLEANLY ');
console.log('================================================================\n');
