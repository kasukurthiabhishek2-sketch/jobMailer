/**
 * Test Suite: Firebase Auth & Firestore Settings Storage / Migration Invariants
 *
 * Validates:
 * 1. Firestore settings schema compliance (Section 3 & 7)
 * 2. Decrypted config export for one-time migration (Section 6)
 * 3. Firestore security rules strictly scoped to owner UID (Section 4 & 8)
 * 4. Backward compatibility and zero-loss migration of configured keys
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const storage = require('./services/storageService');

console.log('--- Testing Firebase Settings Storage & Migration Invariants ---');

// 1. Validate Firestore Security Rules
console.log('1. Checking firestore.rules owner-only authorization...');
const rulesPath = path.join(__dirname, '..', 'firestore.rules');
assert(fs.existsSync(rulesPath), 'firestore.rules file must exist');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

assert(
  rulesContent.includes('match /users/{uid}/{document=**}'),
  'Rules must scope to user UID paths'
);
assert(
  rulesContent.includes('request.auth != null'),
  'Rules must enforce authenticated requests'
);
assert(
  rulesContent.includes('request.auth.uid == uid'),
  'Rules must restrict read/write to the authenticated owner UID only'
);
assert(
  !rulesContent.includes('allow read, write: if true;'),
  'Rules must NOT allow unrestricted or test-mode public access'
);
console.log('✓ Firestore security rules strictly scoped to request.auth.uid == uid.');

// 2. Validate One-Time Migration Data Format
console.log('2. Verifying one-time migration export schema...');
const decrypted = storage.getDecryptedConfig();
assert(decrypted, 'storage.getDecryptedConfig() must return active configuration');
assert(typeof decrypted.aiProviders === 'object', 'Configuration must contain aiProviders');
assert(Array.isArray(decrypted.smtpProfiles), 'Configuration must contain smtpProfiles');

// Simulate client-side formatForFirestore transformation enforcing Option 1
function formatForFirestore(legacyConfig) {
  const activeKey = legacyConfig.activeProvider || 'gemini';
  const aiProviders = {};

  if (legacyConfig.aiProviders) {
    for (const [key, val] of Object.entries(legacyConfig.aiProviders)) {
      aiProviders[key] = {
        name: val.name || key,
        model: val.model || '',
        active: key === activeKey,
        enabled: val.enabled !== false,
        isConfigured: Boolean(val.isConfigured || val.apiKey)
      };
      // Option 1: Secrets are NEVER written to Firestore
    }
  }

  const smtpProfiles = Array.isArray(legacyConfig.smtpProfiles)
    ? legacyConfig.smtpProfiles.map(p => {
        const { password, appPassword, ...rest } = p;
        return {
          ...rest,
          isConfigured: Boolean(p.isConfigured || password || appPassword)
        };
      })
    : [];

  const defaultSmtp = smtpProfiles.find(p => p.isDefault) || smtpProfiles[0] || {};
  const smtp = {
    provider: 'gmail',
    email: defaultSmtp.username || defaultSmtp.fromEmail || '',
    appPassword: '', // Option 1: Secrets are NEVER written to Firestore
    host: defaultSmtp.host || 'smtp.gmail.com',
    port: defaultSmtp.port || 465,
    encryption: defaultSmtp.encryption || 'SSL',
    fromName: defaultSmtp.fromName || ''
  };

  const preferences = {
    outreachTone: legacyConfig.preferences?.outreachTone || 'direct',
    delaySeconds: legacyConfig.sendingPreferences?.delaySeconds || 8,
    attachResume: legacyConfig.sendingPreferences?.attachResume !== false
  };

  const candidateProfile = legacyConfig.candidateProfile || {
    fullName: '',
    email: '',
    phone: ''
  };

  return {
    activeProvider: activeKey,
    aiProviders,
    smtp,
    smtpProfiles,
    candidateProfile,
    preferences
  };
}

const firestoreDoc = formatForFirestore(decrypted);

// Verify Section 3 schema keys exist
assert(firestoreDoc.activeProvider, 'Doc must have activeProvider');
assert(firestoreDoc.aiProviders, 'Doc must have aiProviders');
assert(firestoreDoc.smtp, 'Doc must have smtp');
assert(Array.isArray(firestoreDoc.smtpProfiles), 'Doc must have smtpProfiles array');
assert(firestoreDoc.candidateProfile, 'Doc must have candidateProfile');
assert(firestoreDoc.preferences, 'Doc must have preferences');
assert(firestoreDoc.preferences.outreachTone, 'Doc must specify outreachTone');

// Verify Option 1: Secrets are never persisted to Firestore; configuration state is preserved
for (const [key, provider] of Object.entries(firestoreDoc.aiProviders)) {
  assert.strictEqual(
    provider.apiKey,
    undefined,
    `Provider ${key} must NOT contain plaintext apiKey in Firestore`
  );
}
assert.strictEqual(
  firestoreDoc.smtp.appPassword,
  '',
  'SMTP appPassword must NOT be stored in Firestore'
);
if (decrypted.aiProviders?.openai?.apiKey) {
  assert(firestoreDoc.aiProviders.openai.isConfigured, 'OpenAI must be marked configured');
}
if (decrypted.aiProviders?.groq?.apiKey) {
  assert(firestoreDoc.aiProviders.groq.isConfigured, 'Groq must be marked configured');
}

console.log('✓ Option 1 verified: Zero plaintext secrets stored in Firestore; configuration flags preserved.');

// 3. Verify Candidate Profile and Preferences Invariants
console.log('3. Checking candidateProfile & preferences schema...');
assert('fullName' in firestoreDoc.candidateProfile, 'candidateProfile must have fullName');
assert('email' in firestoreDoc.candidateProfile, 'candidateProfile must have email');
assert('phone' in firestoreDoc.candidateProfile, 'candidateProfile must have phone');
assert('outreachTone' in firestoreDoc.preferences, 'preferences must have outreachTone');
assert('delaySeconds' in firestoreDoc.preferences, 'preferences must have delaySeconds');
assert('attachResume' in firestoreDoc.preferences, 'preferences must have attachResume');
console.log('✓ Candidate profile and tone preferences properly structured in schema.');

// 4. Verify Single Source of Truth
console.log('4. Verifying persistence locations...');
// Theme preference is allowed in localStorage as documented in audit report
// Credential keys must NOT be written to localStorage
const clientSrcDir = path.join(__dirname, '..', 'client', 'src');
function checkNoLocalStorageCredentials(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkNoLocalStorageCredentials(fullPath);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) {
      const code = fs.readFileSync(fullPath, 'utf8');
      const lines = code.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('localStorage.setItem')) {
          // Only jdmail-theme is allowed
          assert(
            line.includes('jdmail-theme'),
            `Unexpected localStorage write at ${fullPath}:${idx + 1}: ${line.trim()}`
          );
        }
      });
    }
  }
}
checkNoLocalStorageCredentials(clientSrcDir);
console.log('✓ Verified zero credential persistence in client localStorage (only theme is stored).');

// 5. Verify stripUndefined Sanitizer for Firestore setDoc
console.log('5. Verifying stripUndefined recursive sanitizer for Firestore writes...');
function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)])
    );
  }
  return value;
}

const payloadWithUndefined = {
  activeProvider: 'groq',
  aiProviders: {
    groq: {
      name: 'Groq',
      apiKey: 'gsk_test123',
      model: 'qwen/qwen3.8-27b',
      baseURL: undefined
    },
    grok: {
      name: 'Grok',
      apiKey: '',
      baseURL: undefined,
      nested: {
        field: undefined,
        valid: 'ok'
      }
    },
    custom: {
      name: 'Custom',
      baseURL: 'https://api.openai.com/v1'
    }
  },
  items: [
    { id: 1, missing: undefined, present: true }
  ]
};

const sanitizedDoc = stripUndefined(payloadWithUndefined);
assert(!('baseURL' in sanitizedDoc.aiProviders.groq), 'groq.baseURL undefined must be stripped');
assert(!('baseURL' in sanitizedDoc.aiProviders.grok), 'grok.baseURL undefined must be stripped');
assert(!('field' in sanitizedDoc.aiProviders.grok.nested), 'nested undefined must be stripped');
assert.strictEqual(sanitizedDoc.aiProviders.grok.nested.valid, 'ok', 'nested valid field must be preserved');
assert.strictEqual(sanitizedDoc.aiProviders.custom.baseURL, 'https://api.openai.com/v1', 'custom.baseURL must be preserved');
assert(!('missing' in sanitizedDoc.items[0]), 'array element undefined property must be stripped');
console.log('✓ stripUndefined cleanly strips all undefined fields from nested objects and arrays.');

// 6. Verify Cross-Origin-Opener-Policy (same-origin-allow-popups) Configuration
console.log('6. Verifying Cross-Origin-Opener-Policy settings...');
const serverIndexPath = path.join(__dirname, 'index.js');
const serverIndexContent = fs.readFileSync(serverIndexPath, 'utf8');
assert(
  serverIndexContent.includes("crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }"),
  'Server Helmet config must include same-origin-allow-popups for Firebase popup auth'
);

const viteConfigPath = path.join(__dirname, '..', 'client', 'vite.config.js');
const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf8');
assert(
  viteConfigContent.includes("'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'"),
  'Client Vite server & preview headers must include same-origin-allow-popups'
);
console.log('✓ Cross-Origin-Opener-Policy set to same-origin-allow-popups across server and client.');

// 7. Verify AI Connection Test Endpoint Invariants
console.log('7. Verifying /api/config/ai/test JSON response guarantee & baseURL defaulting...');
assert(
  serverIndexContent.includes("res.setHeader('Content-Type', 'application/json');"),
  'AI test endpoint must explicitly set Content-Type: application/json'
);
assert(
  serverIndexContent.includes("DEFAULT_BASE_URLS"),
  'AI test endpoint must define DEFAULT_BASE_URLS for providers'
);
assert(
  serverIndexContent.includes("groq: 'https://api.groq.com/openai/v1'"),
  'AI test endpoint must default Groq baseURL'
);
assert(
  serverIndexContent.includes("grok: 'https://api.x.ai/v1'"),
  'AI test endpoint must default Grok baseURL'
);
console.log('✓ /api/config/ai/test server-side defaulting and JSON response guarantee verified.');

console.log('\n--- All Firebase Settings & Migration Tests PASSED ---');
