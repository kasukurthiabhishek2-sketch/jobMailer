const assert = require('assert');

// Use fast 100ms timeout for tests instead of 15s production timeout
process.env.TEST_FAST_TIMEOUT = 'true';
const { testAiConnection, listProviderModels } = require('./services/aiService');

async function runTests() {
  console.log('Testing AI Provider Connection Timeout Behavior...');
  const originalFetch = global.fetch;

  try {
    // Test 1: testAiConnection times out when fetch hangs (simulated with AbortController)
    {
      global.fetch = async (_url, opts) => {
        // Simulate a hang: wait for abort signal
        return new Promise((_resolve, reject) => {
          if (opts?.signal) {
            opts.signal.addEventListener('abort', () => {
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
          // Never resolves on its own — simulates a hanging connection
        });
      };

      const result = await testAiConnection('nvidia', {
        apiKey: 'nvapi-test-key',
        model: 'z-ai/glm-5.3',
        baseURL: 'https://integrate.api.nvidia.com/v1'
      });

      assert.strictEqual(result.success, false, 'Timed out connection should fail');
      assert.ok(
        result.error.includes('timed out'),
        `Error should mention timeout, got: ${result.error}`
      );
      console.log('✓ testAiConnection returns timeout error when provider hangs.');
    }

    // Test 2: testAiConnection for Gemini times out when fetch hangs
    {
      global.fetch = async (_url, opts) => {
        return new Promise((_resolve, reject) => {
          if (opts?.signal) {
            opts.signal.addEventListener('abort', () => {
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      };

      const result = await testAiConnection('gemini', {
        apiKey: 'AIzaTestKey',
        model: 'gemini-1.5-flash'
      });

      assert.strictEqual(result.success, false, 'Gemini timeout should fail');
      assert.ok(
        result.error.includes('timed out'),
        `Gemini error should mention timeout, got: ${result.error}`
      );
      console.log('✓ testAiConnection (Gemini) returns timeout error when API hangs.');
    }

    // Test 3: listProviderModels times out for OpenAI-compatible providers
    {
      global.fetch = async (_url, opts) => {
        return new Promise((_resolve, reject) => {
          if (opts?.signal) {
            opts.signal.addEventListener('abort', () => {
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      };

      const result = await listProviderModels('nvidia', 'nvapi-test-key');

      assert.strictEqual(result.success, false, 'Model listing timeout should fail');
      assert.ok(
        result.error.includes('timed out'),
        `Model listing error should mention timeout, got: ${result.error}`
      );
      console.log('✓ listProviderModels returns timeout error when provider hangs.');
    }

    // Test 4: testAiConnection succeeds when provider responds quickly
    {
      global.fetch = async (_url, _opts) => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: 'Hi' } }]
          })
        };
      };

      const result = await testAiConnection('nvidia', {
        apiKey: 'nvapi-valid-key',
        model: 'meta/llama-3.1-70b-instruct',
        baseURL: 'https://integrate.api.nvidia.com/v1'
      });

      assert.strictEqual(result.success, true, 'Quick response should succeed');
      assert.ok(result.message.includes('NVIDIA'), 'Success message should mention provider');
      console.log('✓ testAiConnection succeeds normally when provider responds fast.');
    }

    // Test 5: testAiConnection returns provider error (not timeout) on HTTP error
    {
      global.fetch = async (_url, _opts) => {
        return {
          ok: false,
          status: 401,
          text: async () => JSON.stringify({ error: { message: 'Invalid API key' } })
        };
      };

      const result = await testAiConnection('nvidia', {
        apiKey: 'nvapi-bad-key',
        model: 'meta/llama-3.1-70b-instruct',
        baseURL: 'https://integrate.api.nvidia.com/v1'
      });

      assert.strictEqual(result.success, false, 'Bad key should fail');
      assert.ok(
        result.error.includes('Invalid API key'),
        `Should show provider error, got: ${result.error}`
      );
      assert.ok(
        !result.error.includes('timed out'),
        'Non-timeout error should not mention timeout'
      );
      console.log('✓ testAiConnection returns provider error (not timeout) on 401.');
    }

    console.log('All connection timeout tests passed!');
  } finally {
    global.fetch = originalFetch;
  }
}

runTests().catch(err => {
  console.error('Connection timeout test failed:', err);
  process.exit(1);
});
