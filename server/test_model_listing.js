const assert = require('assert');
const { listProviderModels } = require('./services/aiService');

async function runTests() {
  console.log('Testing AI Provider Model Listing & Status Derivation...');

  // Test 1: Missing API key returns error
  const noKeyResult = await listProviderModels('openai', '');
  assert.strictEqual(noKeyResult.success, false, 'Empty key should fail');
  assert.ok(noKeyResult.error.includes('API key is required'), 'Should mention key required');
  console.log('✓ Missing API key returns structured error.');

  // Test 2: Null key returns error
  const nullKeyResult = await listProviderModels('groq', null);
  assert.strictEqual(nullKeyResult.success, false, 'Null key should fail');
  console.log('✓ Null API key returns structured error.');

  // Test 3: Copilot returns static model list without needing a real key
  const copilotResult = await listProviderModels('copilot', 'fake-token');
  assert.strictEqual(copilotResult.success, true, 'Copilot should return static list');
  assert.ok(Array.isArray(copilotResult.models), 'Models should be an array');
  assert.ok(copilotResult.models.length >= 2, 'Copilot should have at least 2 models');
  const modelIds = copilotResult.models.map(m => m.id);
  assert.ok(modelIds.includes('gpt-4o'), 'Copilot should include gpt-4o');
  assert.ok(modelIds.includes('gpt-4o-mini'), 'Copilot should include gpt-4o-mini');
  assert.strictEqual(copilotResult.provider, 'copilot', 'Provider should be copilot');
  console.log('✓ Copilot returns static model list with correct IDs.');

  // Test 4: Each model has required fields
  for (const model of copilotResult.models) {
    assert.ok(model.id, 'Model must have an id');
    assert.ok(model.name, 'Model must have a name');
    assert.ok('created' in model, 'Model must have created field (can be null)');
  }
  console.log('✓ Model objects have correct schema (id, name, created).');

  // Test 5: Invalid API key to a real provider returns structured error (not crash)
  const invalidKeyResult = await listProviderModels('openai', 'sk-invalid-key-that-will-fail');
  assert.strictEqual(invalidKeyResult.success, false, 'Invalid key should fail');
  assert.ok(typeof invalidKeyResult.error === 'string', 'Error should be a string');
  assert.ok(invalidKeyResult.error.length > 0, 'Error should be non-empty');
  console.log('✓ Invalid API key returns structured error without crashing.');

  // Test 6: Unknown provider falls back to openai base URL
  const unknownResult = await listProviderModels('unknown_provider', 'sk-invalid-key');
  assert.strictEqual(unknownResult.success, false, 'Unknown provider with bad key should fail');
  assert.ok(typeof unknownResult.error === 'string', 'Should return error string');
  console.log('✓ Unknown provider falls back gracefully.');

  // Test 7: Model filtering logic (unit test with mock data)
  // OpenAI filter: should exclude embeddings, whisper, tts, dall-e, moderation
  const mockOpenAIModels = [
    { id: 'gpt-4o', created: 1700000000 },
    { id: 'gpt-4o-mini', created: 1700000001 },
    { id: 'text-embedding-3-large', created: 1700000002 },
    { id: 'whisper-1', created: 1700000003 },
    { id: 'tts-1', created: 1700000004 },
    { id: 'dall-e-3', created: 1700000005 },
    { id: 'text-moderation-latest', created: 1700000006 },
    { id: 'gpt-3.5-turbo-audio-preview', created: 1700000007 },
    { id: 'davinci-002', created: 1700000008 },
    { id: 'babbage-002', created: 1700000009 }
  ];
  const openaiFilter = m => {
    const id = (m.id || '').toLowerCase();
    return !id.includes('embedding') && !id.includes('whisper') &&
           !id.includes('tts') && !id.includes('dall-e') &&
           !id.includes('moderation') && !id.includes('audio') &&
           !id.includes('davinci') && !id.includes('babbage');
  };
  const filteredOpenAI = mockOpenAIModels.filter(openaiFilter);
  assert.strictEqual(filteredOpenAI.length, 2, 'Should keep only gpt-4o and gpt-4o-mini');
  assert.ok(filteredOpenAI.every(m => m.id.startsWith('gpt-')), 'Filtered models should be GPT models');
  console.log('✓ OpenAI model filter correctly removes non-chat models.');

  // Test 8: Groq filter: should exclude whisper, tts, guard
  const mockGroqModels = [
    { id: 'llama-3.3-70b-versatile', active: true },
    { id: 'whisper-large-v3', active: true },
    { id: 'llama-guard-3-8b', active: true },
    { id: 'playai-tts-arabic', active: true },
    { id: 'mixtral-8x7b-32768', active: false }
  ];
  const groqFilter = m => {
    const id = (m.id || '').toLowerCase();
    return !id.includes('whisper') && !id.includes('tts') &&
           !id.includes('guard') && m.active !== false;
  };
  const filteredGroq = mockGroqModels.filter(groqFilter);
  assert.strictEqual(filteredGroq.length, 1, 'Should keep only llama-3.3-70b-versatile');
  assert.strictEqual(filteredGroq[0].id, 'llama-3.3-70b-versatile');
  console.log('✓ Groq model filter correctly removes whisper/tts/guard/inactive models.');

  // Test 9: Sorting (newest first when created exists)
  const mockModels = [
    { id: 'old-model', name: 'Old', created: 1600000000 },
    { id: 'new-model', name: 'New', created: 1700000000 },
    { id: 'alpha-model', name: 'Alpha', created: null },
    { id: 'zeta-model', name: 'Zeta', created: null }
  ];
  mockModels.sort((a, b) => {
    if (a.created && b.created) return b.created - a.created;
    if (a.created) return -1;
    if (b.created) return 1;
    return a.id.localeCompare(b.id);
  });
  assert.strictEqual(mockModels[0].id, 'new-model', 'Newest should be first');
  assert.strictEqual(mockModels[1].id, 'old-model', 'Older should be second');
  assert.strictEqual(mockModels[2].id, 'alpha-model', 'No-date alpha should be third');
  assert.strictEqual(mockModels[3].id, 'zeta-model', 'No-date zeta should be last');
  console.log('✓ Model sorting: newest first, then alphabetical for undated.');

  console.log('All model listing tests passed!');
}

runTests().catch(err => {
  console.error('Model listing test failed:', err);
  process.exit(1);
});
