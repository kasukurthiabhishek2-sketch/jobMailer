/**
 * Tests for hybrid deployment wiring:
 * - API_BASE URL prefix in api.js
 * - CORS ALLOWED_ORIGINS support
 * - Firestore logs service contract
 * - SMTP profile local-secret resolution
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const TEST_NAME = 'Hybrid Deployment Wiring (Vercel + Render)';

function runTests() {
  const results = [];

  // Test 1: api.js contains API_BASE constant
  (() => {
    const name = 'api.js exports API_BASE from VITE_API_URL env var';
    try {
      const apiJs = fs.readFileSync(
        path.join(__dirname, '..', 'client', 'src', 'services', 'api.js'),
        'utf8'
      );
      assert(apiJs.includes("const API_BASE = import.meta.env.VITE_API_URL || ''"),
        'API_BASE constant not found');
      assert(apiJs.includes('`${API_BASE}${url}`'),
        'authFetch should prepend API_BASE to URL');
      results.push({ name, passed: true });
    } catch (err) {
      results.push({ name, passed: false, error: err.message });
    }
  })();

  // Test 2: .env has VITE_API_URL
  (() => {
    const name = 'client/.env contains VITE_API_URL variable';
    try {
      const envFile = fs.readFileSync(
        path.join(__dirname, '..', 'client', '.env'),
        'utf8'
      );
      assert(envFile.includes('VITE_API_URL'), 'VITE_API_URL not found in .env');
      results.push({ name, passed: true });
    } catch (err) {
      results.push({ name, passed: false, error: err.message });
    }
  })();

  // Test 3: CORS ALLOWED_ORIGINS already works in server
  (() => {
    const name = 'server CORS supports ALLOWED_ORIGINS env var';
    try {
      const serverJs = fs.readFileSync(
        path.join(__dirname, 'index.js'),
        'utf8'
      );
      assert(serverJs.includes('process.env.ALLOWED_ORIGINS'),
        'ALLOWED_ORIGINS env var support not found');
      assert(serverJs.includes('.split(\',\')'),
        'ALLOWED_ORIGINS should be comma-split');
      results.push({ name, passed: true });
    } catch (err) {
      results.push({ name, passed: false, error: err.message });
    }
  })();

  // Test 4: resolveSmtpProfile accepts client metadata but resolves credentials locally
  (() => {
    const name = 'resolveSmtpProfile ignores client-supplied SMTP credentials';
    try {
      const serverJs = fs.readFileSync(
        path.join(__dirname, 'index.js'),
        'utf8'
      );
      // The function may merge display metadata but must never trust a password from Firestore/client state.
      assert(serverJs.includes('clientSmtpProfile'),
        'resolveSmtpProfile should accept clientSmtpProfile');
      assert(serverJs.includes('...safeClientProfile'),
        'client SMTP profile metadata should be spread-merged safely');
      assert(serverJs.includes('password: profile?.password || profile?.appPassword ||'),
        'SMTP password should resolve from the encrypted server profile');
      assert(!serverJs.includes('clientSmtpProfile.password'),
        'client SMTP passwords must never be used for dispatch');
      results.push({ name, passed: true });
    } catch (err) {
      results.push({ name, passed: false, error: err.message });
    }
  })();

  // Test 5: Firestore logs service exists
  (() => {
    const name = 'logsService.js exists with Firestore-backed log functions';
    try {
      const logsService = fs.readFileSync(
        path.join(__dirname, '..', 'client', 'src', 'lib', 'logsService.js'),
        'utf8'
      );
      assert(logsService.includes('saveLogsToFirestore'),
        'saveLogsToFirestore function not found');
      assert(logsService.includes('fetchLogsFromFirestore'),
        'fetchLogsFromFirestore function not found');
      assert(logsService.includes('clearLogsFromFirestore'),
        'clearLogsFromFirestore function not found');
      assert(logsService.includes("'users'"),
        'Should use users collection path');
      assert(logsService.includes("'outreachLogs'"),
        'Should use outreachLogs subcollection');
      results.push({ name, passed: true });
    } catch (err) {
      results.push({ name, passed: false, error: err.message });
    }
  })();

  // Test 6: api.js fetchOutreachLogs has Firestore-first path
  (() => {
    const name = 'fetchOutreachLogs uses Firestore-first with backend fallback';
    try {
      const apiJs = fs.readFileSync(
        path.join(__dirname, '..', 'client', 'src', 'services', 'api.js'),
        'utf8'
      );
      assert(apiJs.includes('fetchLogsFromFirestore'),
        'Should import fetchLogsFromFirestore');
      assert(apiJs.includes("authFetch('/api/logs')"),
        'Should fall back to backend /api/logs');
      results.push({ name, passed: true });
    } catch (err) {
      results.push({ name, passed: false, error: err.message });
    }
  })();

  // Test 7: api.js has saveOutreachLogs export
  (() => {
    const name = 'api.js exports saveOutreachLogs for campaign log persistence';
    try {
      const apiJs = fs.readFileSync(
        path.join(__dirname, '..', 'client', 'src', 'services', 'api.js'),
        'utf8'
      );
      assert(apiJs.includes('export async function saveOutreachLogs'),
        'saveOutreachLogs should be exported');
      assert(apiJs.includes('saveLogsToFirestore'),
        'saveOutreachLogs should use Firestore');
      results.push({ name, passed: true });
    } catch (err) {
      results.push({ name, passed: false, error: err.message });
    }
  })();

  // Test 8: useCampaignStream calls saveOutreachLogs on finish
  (() => {
    const name = 'useCampaignStream saves logs to Firestore on campaign finish';
    try {
      const hookJs = fs.readFileSync(
        path.join(__dirname, '..', 'client', 'src', 'hooks', 'useCampaignStream.js'),
        'utf8'
      );
      assert(hookJs.includes('saveOutreachLogs'),
        'Should import saveOutreachLogs');
      assert(hookJs.includes('saveOutreachLogs(eventData.logs)'),
        'Should call saveOutreachLogs with campaign logs');
      results.push({ name, passed: true });
    } catch (err) {
      results.push({ name, passed: false, error: err.message });
    }
  })();

  // Test 9: render.yaml exists with correct config
  (() => {
    const name = 'render.yaml Blueprint exists with correct server config';
    try {
      const renderYaml = fs.readFileSync(
        path.join(__dirname, '..', 'render.yaml'),
        'utf8'
      );
      assert(renderYaml.includes('rootDir: server'),
        'Should deploy from server/ directory');
      assert(renderYaml.includes('npm start'),
        'Should use npm start');
      assert(renderYaml.includes('healthCheckPath: /api/health'),
        'Should use /api/health check');
      assert(renderYaml.includes('ALLOWED_ORIGINS'),
        'Should include ALLOWED_ORIGINS env var');
      assert(renderYaml.includes('ENCRYPTION_MASTER_KEY'),
        'Should include ENCRYPTION_MASTER_KEY env var');
      results.push({ name, passed: true });
    } catch (err) {
      results.push({ name, passed: false, error: err.message });
    }
  })();

  // Test 10: Firestore rules cover outreachLogs subcollection
  (() => {
    const name = 'Firestore rules wildcard covers outreachLogs subcollection';
    try {
      const rules = fs.readFileSync(
        path.join(__dirname, '..', 'firestore.rules'),
        'utf8'
      );
      assert(rules.includes('match /users/{uid}/{document=**}'),
        'Wildcard rule should cover all user subcollections');
      assert(rules.includes('request.auth.uid == uid'),
        'Should enforce owner-only access');
      results.push({ name, passed: true });
    } catch (err) {
      results.push({ name, passed: false, error: err.message });
    }
  })();

  // Test 11: API_BASE default is empty string (preserves local dev proxy)
  (() => {
    const name = 'API_BASE defaults to empty string for local dev compatibility';
    try {
      const apiJs = fs.readFileSync(
        path.join(__dirname, '..', 'client', 'src', 'services', 'api.js'),
        'utf8'
      );
      assert(apiJs.includes("|| ''"),
        'API_BASE should default to empty string');
      // Verify the fetch pattern: API_BASE + relative URL
      // When API_BASE is '', fetch('/api/foo') stays as relative (Vite proxy works)
      // When API_BASE is 'https://x.onrender.com', fetch becomes absolute
      results.push({ name, passed: true });
    } catch (err) {
      results.push({ name, passed: false, error: err.message });
    }
  })();

  return results;
}

// Run
const results = runTests();
let passed = 0;
let failed = 0;
for (const r of results) {
  if (r.passed) {
    console.log(`  ✓ ${r.name}`);
    passed++;
  } else {
    console.error(`  ✗ ${r.name}: ${r.error}`);
    failed++;
  }
}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
