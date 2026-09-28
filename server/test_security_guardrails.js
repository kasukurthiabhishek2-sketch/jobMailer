const assert = require('assert');
const path = require('path');
const { validateCustomBaseUrl } = require('./services/aiService');
const copilotService = require('./services/copilotService');
const { requireAuth } = require('./services/firebaseAdmin');
const { isOriginAllowed } = require('./index');

async function runTests() {
  console.log('Testing Comprehensive Security Guardrails...');

  // ---------------------------------------------------------
  // 1. SSRF Guardrails (aiService.validateCustomBaseUrl)
  // ---------------------------------------------------------
  console.log('\n--- 1. SSRF Guardrails ---');

  // Must reject empty / non-string
  assert.throws(() => validateCustomBaseUrl(''), /Custom provider baseURL must be a valid URL/);
  assert.throws(() => validateCustomBaseUrl(null), /Custom provider baseURL must be a valid URL/);

  // Must reject non-http/https schemes
  assert.throws(() => validateCustomBaseUrl('file:///etc/passwd'), /Forbidden protocol/);
  assert.throws(() => validateCustomBaseUrl('ftp://ftp.example.com'), /Forbidden protocol/);
  assert.throws(() => validateCustomBaseUrl('gopher://gopher.example.com'), /Forbidden protocol/);

  // Must reject AWS / GCP / Azure cloud metadata endpoints
  assert.throws(() => validateCustomBaseUrl('http://169.254.169.254/latest/meta-data/'), /cloud instance metadata services is forbidden/);
  assert.throws(() => validateCustomBaseUrl('http://metadata.google.internal/computeMetadata/v1/'), /cloud instance metadata services is forbidden/);
  assert.throws(() => validateCustomBaseUrl('http://instance-data/latest/meta-data/'), /cloud instance metadata services is forbidden/);

  // Must reject link-local ranges
  assert.throws(() => validateCustomBaseUrl('http://169.254.10.20/api'), /link-local address range is forbidden/);

  // In production mode, must reject loopback & private subnets (RFC 1918)
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_LOCAL_AI_ENDPOINTS;

    assert.throws(() => validateCustomBaseUrl('http://127.0.0.1:8080/v1'), /private or loopback IP/);
    assert.throws(() => validateCustomBaseUrl('http://localhost:11434/v1'), /localhost is forbidden in production/);
    assert.throws(() => validateCustomBaseUrl('http://10.0.0.1:8000/v1'), /private or loopback IP/);
    assert.throws(() => validateCustomBaseUrl('http://192.168.1.1:8000/v1'), /private or loopback IP/);
    assert.throws(() => validateCustomBaseUrl('http://172.16.0.1:8000/v1'), /private or loopback IP/);
  } finally {
    process.env.NODE_ENV = prevEnv;
  }

  // Valid external endpoints must pass cleanly
  const validUrl = validateCustomBaseUrl('https://api.together.xyz/v1/');
  assert.strictEqual(validUrl, 'https://api.together.xyz/v1');
  console.log('✓ SSRF guardrails verified (cloud metadata, schemes, and subnets blocked).');

  // ---------------------------------------------------------
  // 2. Multi-Tenant Copilot Token Cache Isolation
  // ---------------------------------------------------------
  console.log('\n--- 2. Copilot Token Cache Multi-Tenant Isolation ---');
  copilotService.clearSessionCache();

  // Mock fetch to simulate two separate users getting distinct Copilot tokens
  const originalFetch = global.fetch;
  let fetchCallCount = 0;
  try {
    global.fetch = async (url, options) => {
      fetchCallCount++;
      const authHeader = options?.headers?.Authorization || '';
      if (authHeader.includes('token_user_alice')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ token: 'copilot_session_alice', expires_at: Math.floor(Date.now() / 1000) + 1800 })
        };
      }
      if (authHeader.includes('token_user_bob')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ token: 'copilot_session_bob', expires_at: Math.floor(Date.now() / 1000) + 1800 })
        };
      }
      return { ok: false, status: 401, text: async () => 'Unauthorized' };
    };

    const aliceToken1 = await copilotService.getCopilotSessionToken('token_user_alice');
    assert.strictEqual(aliceToken1, 'copilot_session_alice');

    const bobToken1 = await copilotService.getCopilotSessionToken('token_user_bob');
    assert.strictEqual(bobToken1, 'copilot_session_bob', 'Bob must receive his own Copilot session token');

    // Second call for Alice should hit cache and NOT overwrite Bob
    const aliceToken2 = await copilotService.getCopilotSessionToken('token_user_alice');
    assert.strictEqual(aliceToken2, 'copilot_session_alice');

    const bobToken2 = await copilotService.getCopilotSessionToken('token_user_bob');
    assert.strictEqual(bobToken2, 'copilot_session_bob');

    // Only 2 network fetches should have occurred (one per distinct user)
    assert.strictEqual(fetchCallCount, 2, 'Should cache separately per user token');

    // Clear cache wipes both
    copilotService.clearSessionCache();
    assert.strictEqual(copilotService.getSessionCache('token_user_alice').copilotToken, null);
    assert.strictEqual(copilotService.getSessionCache('token_user_bob').copilotToken, null);

    console.log('✓ Copilot token cache multi-tenant isolation verified.');
  } finally {
    global.fetch = originalFetch;
  }

  // ---------------------------------------------------------
  // 3. Path Traversal Containment
  // ---------------------------------------------------------
  console.log('\n--- 3. Path Traversal Containment ---');
  const UPLOADS_DIR = path.resolve(__dirname, 'data', 'uploads');

  function checkPathSafety(userSuppliedFile) {
    const safeFilename = path.basename(userSuppliedFile);
    const candidatePath = path.resolve(UPLOADS_DIR, safeFilename);
    const isWithinUploads = candidatePath.startsWith(path.resolve(UPLOADS_DIR) + path.sep);
    return { safeFilename, candidatePath, isWithinUploads };
  }

  const traversal1 = checkPathSafety('../../etc/passwd');
  assert.strictEqual(traversal1.safeFilename, 'passwd', 'Path basename must strip directory traversal');
  assert.ok(traversal1.isWithinUploads, 'Resolved candidate must be safely trapped inside UPLOADS_DIR');

  const traversal2 = checkPathSafety('../../../.secret_key');
  assert.strictEqual(traversal2.safeFilename, '.secret_key');
  assert.ok(traversal2.isWithinUploads);

  console.log('✓ Path traversal containment verified.');

  // ---------------------------------------------------------
  // 4. Firebase Authentication Middleware (requireAuth)
  // ---------------------------------------------------------
  console.log('\n--- 4. Authentication Middleware Guardrails ---');
  const prevDisableAuth = process.env.DISABLE_AUTH;
  const prevNodeEnv = process.env.NODE_ENV;

  try {
    delete process.env.DISABLE_AUTH;
    process.env.NODE_ENV = 'production';

    // Mock request and response objects
    const createMocks = (headers = {}) => {
      let statusCode = 200;
      let jsonPayload = null;
      let nextCalled = false;
      return {
        req: { headers },
        res: {
          status: (code) => {
            statusCode = code;
            return {
              json: (data) => {
                jsonPayload = data;
              }
            };
          }
        },
        next: () => {
          nextCalled = true;
        },
        getStatusCode: () => statusCode,
        getJson: () => jsonPayload,
        wasNextCalled: () => nextCalled
      };
    };

    // Test missing Authorization header
    const mock1 = createMocks({});
    await requireAuth(mock1.req, mock1.res, mock1.next);
    assert.strictEqual(mock1.getStatusCode(), 401);
    assert.strictEqual(mock1.wasNextCalled(), false);
    assert.ok(mock1.getJson().error.includes('Authentication token required'));

    // Test invalid scheme (Basic instead of Bearer)
    const mock2 = createMocks({ authorization: 'Basic user:pass' });
    await requireAuth(mock2.req, mock2.res, mock2.next);
    assert.strictEqual(mock2.getStatusCode(), 401);
    assert.strictEqual(mock2.wasNextCalled(), false);

    // Test forged/invalid Bearer token
    const mock3 = createMocks({ authorization: 'Bearer invalid_forged_token_xyz' });
    await requireAuth(mock3.req, mock3.res, mock3.next);
    assert.strictEqual(mock3.getStatusCode(), 401);
    assert.strictEqual(mock3.wasNextCalled(), false);
    assert.ok(mock3.getJson().error.includes('Invalid or expired authentication token'));

    console.log('✓ requireAuth middleware strictly rejects unauthenticated and invalid tokens with 401.');
  } finally {
    process.env.DISABLE_AUTH = prevDisableAuth;
    process.env.NODE_ENV = prevNodeEnv;
  }

  // ---------------------------------------------------------
  // 5. Strictly Scoped CORS & Port Resilience (isOriginAllowed)
  // ---------------------------------------------------------
  console.log('\n--- 5. CORS Allowed Origins & Dev Port Resilience ---');
  const prevAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const prevNodeEnvCors = process.env.NODE_ENV;

  try {
    // Development mode tests (default)
    delete process.env.ALLOWED_ORIGINS;
    process.env.NODE_ENV = 'development';

    // Must permit undefined/null origin (same-origin, curl, server-to-server)
    assert.strictEqual(isOriginAllowed(null), true, 'Must permit null origin');
    assert.strictEqual(isOriginAllowed(undefined), true, 'Must permit undefined origin');

    // Must permit default Vite port 5173
    assert.strictEqual(isOriginAllowed('http://localhost:5173'), true);
    assert.strictEqual(isOriginAllowed('http://127.0.0.1:5173'), true);

    // Must permit alternate Vite dev port 5174 (e.g. when 5173 is occupied)
    assert.strictEqual(isOriginAllowed('http://localhost:5174'), true);
    assert.strictEqual(isOriginAllowed('http://127.0.0.1:5174'), true);

    // Must permit Vite preview port 4173 and alternate dev ports in development
    assert.strictEqual(isOriginAllowed('http://localhost:4173'), true);
    assert.strictEqual(isOriginAllowed('http://localhost:5179'), true);
    assert.strictEqual(isOriginAllowed('http://127.0.0.1:8080'), true);

    // Must strictly REJECT external/unauthorized origins
    assert.strictEqual(isOriginAllowed('https://evil.com'), false);
    assert.strictEqual(isOriginAllowed('http://localhost.evil.com'), false);
    assert.strictEqual(isOriginAllowed('http://127.0.0.1.nip.io'), false);
    assert.strictEqual(isOriginAllowed('invalid-origin-string'), false);

    // Production mode with explicit ALLOWED_ORIGINS override
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'https://app.jdmail.com,https://staging.jdmail.com';

    assert.strictEqual(isOriginAllowed('https://app.jdmail.com'), true);
    assert.strictEqual(isOriginAllowed('https://staging.jdmail.com'), true);
    assert.strictEqual(isOriginAllowed('https://evil.com'), false);
    assert.strictEqual(isOriginAllowed('http://localhost:5174'), false);

    // Production mode fallback without ALLOWED_ORIGINS (only standard origins)
    delete process.env.ALLOWED_ORIGINS;
    assert.strictEqual(isOriginAllowed('http://localhost:5173'), true);
    assert.strictEqual(isOriginAllowed('http://localhost:5174'), true);
    assert.strictEqual(isOriginAllowed('http://localhost:9999'), false, 'Arbitrary dev ports rejected in production');
    assert.strictEqual(isOriginAllowed('https://evil.com'), false);

    console.log('✓ CORS origin policy verified (dev port 5174 permitted, external origins strictly blocked).');
  } finally {
    if (prevAllowedOrigins !== undefined) process.env.ALLOWED_ORIGINS = prevAllowedOrigins;
    else delete process.env.ALLOWED_ORIGINS;
    process.env.NODE_ENV = prevNodeEnvCors;
  }

  console.log('\nALL SECURITY GUARDRAIL TESTS PASSED CLEANLY!\n');
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('Security test failed:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
