const assert = require('assert');
const { callGemini, callOpenAiCompatible } = require('./services/aiService');

// Fast retry for tests
process.env.TEST_FAST_RETRY = 'true';

async function runTests() {
  console.log('Testing AI Provider HTTP 429 Backoff & Retry Logic...');
  const originalFetch = global.fetch;

  try {
    // ----------------------------------------------------
    // Test 1: callGemini retries on HTTP 429 and succeeds on attempt 3
    // ----------------------------------------------------
    let geminiAttempts = 0;
    global.fetch = async (url) => {
      geminiAttempts++;
      if (geminiAttempts < 3) {
        return {
          ok: false,
          status: 429,
          text: async () => JSON.stringify({ error: { message: 'Resource has been exhausted (e.g. check quota).' } })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.stringify({ subject: 'Success Subj', body: 'Success Body' }) }
                ]
              }
            }
          ]
        })
      };
    };

    const resGemini = await callGemini({
      apiKey: 'test-key',
      systemPrompt: 'System',
      userPrompt: 'User'
    });

    assert.strictEqual(geminiAttempts, 3, 'Gemini must have retried twice and succeeded on 3rd attempt');
    assert.strictEqual(resGemini.subject, 'Success Subj');
    assert.strictEqual(resGemini.body, 'Success Body');
    console.log('✓ callGemini successfully recovered from 429 rate limit after retries.');

    // ----------------------------------------------------
    // Test 2: callOpenAiCompatible retries on HTTP 429 and succeeds
    // ----------------------------------------------------
    let openAiAttempts = 0;
    global.fetch = async () => {
      openAiAttempts++;
      if (openAiAttempts < 2) {
        return {
          ok: false,
          status: 429,
          text: async () => JSON.stringify({ error: { message: 'Rate limit reached for requests' } })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ subject: 'OpenAI Subj', body: 'OpenAI Body' })
              }
            }
          ]
        })
      };
    };

    const resOpenAi = await callOpenAiCompatible({
      apiKey: 'sk-test',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      systemPrompt: 'System',
      userPrompt: 'User'
    });

    assert.strictEqual(openAiAttempts, 2, 'OpenAI caller must have retried once on 429 and succeeded');
    assert.strictEqual(resOpenAi.subject, 'OpenAI Subj');
    assert.strictEqual(resOpenAi.body, 'OpenAI Body');
    console.log('✓ callOpenAiCompatible successfully recovered from 429 rate limit after retries.');

    // ----------------------------------------------------
    // Test 3: Exceeding max retries throws clear descriptive error
    // ----------------------------------------------------
    let persistentAttempts = 0;
    global.fetch = async () => {
      persistentAttempts++;
      return {
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: 'Quota exceeded permanently' } })
      };
    };

    let errorThrown = null;
    try {
      await callOpenAiCompatible({
        apiKey: 'sk-test',
        baseURL: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        systemPrompt: 'System',
        userPrompt: 'User'
      });
    } catch (err) {
      errorThrown = err;
    }

    assert.ok(errorThrown, 'Must throw error when 429 persists beyond max retries');
    assert.ok(errorThrown.message.includes('429'), 'Error message must mention 429');
    assert.ok(errorThrown.message.includes('retries'), 'Error message must mention retries');
    assert.strictEqual(persistentAttempts, 4, 'Must have attempted initial request + 3 retries (total 4)');
    console.log('✓ Persistent 429 cleanly fails with clear error after 3 retries.');

    console.log('ALL AI 429 RETRY TESTS PASSED!');
  } finally {
    global.fetch = originalFetch;
    delete process.env.TEST_FAST_RETRY;
  }
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
