/**
 * Test: Server-side API key resolution for authenticated users
 *
 * Validates that the /api/config/ai/test and /api/config/ai/models routes
 * resolve API keys from encrypted storage for ALL users (not just unauthenticated),
 * and honor client-supplied selectedKeyId for multi-key scenarios.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('Testing Authenticated User Key Resolution for AI Routes...');

  const indexPath = path.join(__dirname, 'index.js');
  const indexContent = fs.readFileSync(indexPath, 'utf8');

  // ---- Test 1: uid guard removed from /api/config/ai/test ----
  // The old code was: if (!effectiveApiKey && (!req.uid || req.uid === 'test_user_offline'))
  // The new code is:  if (!effectiveApiKey)
  // This ensures authenticated Firebase users fall back to decrypted storage (they never have raw keys)
  {
    // Find the /api/config/ai/test route handler
    const testRouteStart = indexContent.indexOf("app.post('/api/config/ai/test'");
    assert.ok(testRouteStart > 0, '/api/config/ai/test route must exist');

    // Find the /api/config/ai/models route (the boundary of the test route)
    const modelsRouteStart = indexContent.indexOf("app.post('/api/config/ai/models'");
    assert.ok(modelsRouteStart > testRouteStart, '/api/config/ai/models must come after /api/config/ai/test');

    const testRouteBody = indexContent.substring(testRouteStart, modelsRouteStart);

    // Must NOT contain the old uid guard pattern
    assert.ok(
      !testRouteBody.includes("req.uid === 'test_user_offline'"),
      '/api/config/ai/test must not restrict storage fallback to offline users only'
    );
    assert.ok(
      !testRouteBody.includes('!req.uid'),
      '/api/config/ai/test must not check req.uid before falling back to storage'
    );

    // Must contain the simple fallback pattern
    assert.ok(
      testRouteBody.includes('if (!effectiveApiKey)'),
      '/api/config/ai/test must fall back to storage unconditionally when no key is provided'
    );

    // Must accept selectedKeyId from the request body
    assert.ok(
      testRouteBody.includes('selectedKeyId'),
      '/api/config/ai/test must accept selectedKeyId from request body'
    );

    console.log('✓ /api/config/ai/test resolves keys from storage for all users (uid guard removed).');
  }

  // ---- Test 2: uid guard removed from /api/config/ai/models ----
  {
    const modelsRouteStart = indexContent.indexOf("app.post('/api/config/ai/models'");
    assert.ok(modelsRouteStart > 0, '/api/config/ai/models route must exist');

    // Find the next route after models (copilot device-code)
    const nextRouteStart = indexContent.indexOf("app.post('/api/copilot/device-code'");
    assert.ok(nextRouteStart > modelsRouteStart, 'copilot route must come after models route');

    const modelsRouteBody = indexContent.substring(modelsRouteStart, nextRouteStart);

    assert.ok(
      !modelsRouteBody.includes("req.uid === 'test_user_offline'"),
      '/api/config/ai/models must not restrict storage fallback to offline users only'
    );
    assert.ok(
      !modelsRouteBody.includes('!req.uid'),
      '/api/config/ai/models must not check req.uid before falling back to storage'
    );
    assert.ok(
      modelsRouteBody.includes('if (!effectiveApiKey)'),
      '/api/config/ai/models must fall back to storage unconditionally when no key is provided'
    );
    assert.ok(
      modelsRouteBody.includes('selectedKeyId'),
      '/api/config/ai/models must accept selectedKeyId from request body'
    );

    console.log('✓ /api/config/ai/models resolves keys from storage for all users (uid guard removed).');
  }

  // ---- Test 3: savedKeys resolution prefers selectedKeyId ----
  {
    const testRouteStart = indexContent.indexOf("app.post('/api/config/ai/test'");
    const modelsRouteStart = indexContent.indexOf("app.post('/api/config/ai/models'");
    const testRouteBody = indexContent.substring(testRouteStart, modelsRouteStart);

    // Both routes should check savedKeys first (before plain apiKey) and use selectedKeyId
    assert.ok(
      testRouteBody.includes('selectedKeyId || savedProvider.selectedKeyId'),
      '/api/config/ai/test must prefer client-supplied selectedKeyId over saved default'
    );

    const nextRouteStart = indexContent.indexOf("app.post('/api/copilot/device-code'");
    const modelsRouteBody = indexContent.substring(modelsRouteStart, nextRouteStart);
    assert.ok(
      modelsRouteBody.includes('selectedKeyId || savedProvider.selectedKeyId'),
      '/api/config/ai/models must prefer client-supplied selectedKeyId over saved default'
    );

    console.log('✓ Both routes prefer client-supplied selectedKeyId for multi-key lookup.');
  }

  // ---- Test 4: Client API functions pass selectedKeyId ----
  {
    const apiPath = path.join(__dirname, '..', 'client', 'src', 'services', 'api.js');
    const apiContent = fs.readFileSync(apiPath, 'utf8');

    // testAiConnection must send selectedKeyId
    const testFnMatch = apiContent.match(/export async function testAiConnection\(\{[^}]+\}\)/);
    assert.ok(testFnMatch, 'testAiConnection function must exist in api.js');
    assert.ok(
      testFnMatch[0].includes('selectedKeyId'),
      'testAiConnection must accept selectedKeyId parameter'
    );

    // listAiModels must send selectedKeyId
    const listFnMatch = apiContent.match(/export async function listAiModels\(\{[^}]+\}\)/);
    assert.ok(listFnMatch, 'listAiModels function must exist in api.js');
    assert.ok(
      listFnMatch[0].includes('selectedKeyId'),
      'listAiModels must accept selectedKeyId parameter'
    );

    // Both must include selectedKeyId in the request body JSON
    const testBodyIdx = apiContent.indexOf('testAiConnection');
    const testBodySlice = apiContent.substring(testBodyIdx, testBodyIdx + 500);
    assert.ok(
      testBodySlice.includes('selectedKeyId'),
      'testAiConnection must include selectedKeyId in request body'
    );

    const listBodyIdx = apiContent.indexOf('listAiModels');
    const listBodySlice = apiContent.substring(listBodyIdx, listBodyIdx + 500);
    assert.ok(
      listBodySlice.includes('selectedKeyId'),
      'listAiModels must include selectedKeyId in request body'
    );

    console.log('✓ Client API functions send selectedKeyId to server.');
  }

  // ---- Test 5: AiProvidersTab has replacingKey state declared ----
  {
    const tabPath = path.join(__dirname, '..', 'client', 'src', 'components', 'settings', 'AiProvidersTab.jsx');
    const tabContent = fs.readFileSync(tabPath, 'utf8');

    assert.ok(
      tabContent.includes('setReplacingKey] = useState('),
      'AiProvidersTab must declare setReplacingKey via useState'
    );

    assert.ok(
      tabContent.includes('const getEffectiveApiKey ='),
      'AiProvidersTab must declare getEffectiveApiKey helper'
    );

    // handleTestConnection and handleFetchModels should use getEffectiveApiKey
    assert.ok(
      tabContent.includes('getEffectiveApiKey(providerKey)'),
      'handleTestConnection and handleFetchModels must resolve key via getEffectiveApiKey'
    );

    // handleFetchModels should pass selectedKeyId to server
    const fetchModelsIdx = tabContent.indexOf('const handleFetchModels =');
    const fetchModelsSlice = tabContent.substring(fetchModelsIdx, fetchModelsIdx + 600);
    assert.ok(
      fetchModelsSlice.includes('selectedKeyId'),
      'handleFetchModels must pass selectedKeyId to the server'
    );

    console.log('✓ AiProvidersTab declares replacingKey state and properly resolves effective API keys.');
  }

  console.log('\n--- All Authenticated Key Resolution Tests PASSED ---');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err.message);
  process.exit(1);
});
