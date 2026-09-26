const assert = require('assert');

// Simulate the worker pool algorithm from /api/ai/batch-generate
async function runConcurrentBatch(recipients, mockGenerator, concurrency = 4) {
  const results = new Array(recipients.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < recipients.length) {
      const i = nextIndex++;
      const recipient = recipients[i];
      try {
        const emailContent = await mockGenerator(recipient);
        results[i] = {
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          success: true,
          email: emailContent
        };
      } catch (genErr) {
        results[i] = {
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          success: false,
          error: genErr.message
        };
      }
    }
  }

  const workers = [];
  const numWorkers = Math.min(concurrency, recipients.length);
  for (let w = 0; w < numWorkers; w++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

async function runTests() {
  console.log('Testing Batch Generation Concurrency & Ordering Properties...');

  // Create 8 recipients
  const recipients = Array.from({ length: 8 }, (_, idx) => ({
    id: `rec_${idx + 1}`,
    name: `Recipient ${idx + 1}`,
    email: `rec${idx + 1}@example.com`,
    company: `Company ${idx + 1}`
  }));

  let activeConcurrent = 0;
  let maxObservedConcurrent = 0;

  const mockGenerator = async (recipient) => {
    activeConcurrent++;
    maxObservedConcurrent = Math.max(maxObservedConcurrent, activeConcurrent);
    
    // Simulate variable network latency
    const delay = recipient.id === 'rec_3' ? 40 : 25;
    await new Promise(r => setTimeout(r, delay));

    // Simulate failure on rec_5
    if (recipient.id === 'rec_5') {
      activeConcurrent--;
      throw new Error('LLM rate limit on rec_5');
    }

    activeConcurrent--;
    return {
      subject: `Subject for ${recipient.name}`,
      body: `Body for ${recipient.company}`
    };
  };

  const results = await runConcurrentBatch(recipients, mockGenerator, 4);

  // Assertions
  assert.strictEqual(results.length, 8, 'Results length must match recipients count');
  assert.ok(maxObservedConcurrent > 1, `Max observed concurrency (${maxObservedConcurrent}) must be > 1`);
  assert.ok(maxObservedConcurrent <= 4, `Max observed concurrency (${maxObservedConcurrent}) must not exceed pool limit of 4`);

  // Verify order preservation
  for (let i = 0; i < recipients.length; i++) {
    assert.strictEqual(results[i].recipientId, recipients[i].id, `Index ${i} must preserve original recipient ID`);
    if (recipients[i].id === 'rec_5') {
      assert.strictEqual(results[i].success, false, 'rec_5 must be marked as failed');
      assert.ok(results[i].error.includes('LLM rate limit'), 'Error message preserved');
    } else {
      assert.strictEqual(results[i].success, true, `Recipient ${recipients[i].id} must succeed`);
      assert.ok(results[i].email.subject.includes(recipients[i].name));
    }
  }

  console.log(`✓ Concurrent batch execution verified (Max concurrency: ${maxObservedConcurrent}, order preserved, fault-isolated).`);
  console.log('ALL BATCH CONCURRENCY TESTS PASSED!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
