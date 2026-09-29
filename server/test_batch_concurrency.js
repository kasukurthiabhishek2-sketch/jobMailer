const assert = require('assert');
const { adaptGenericEmailForRecipient } = require('./index');

// Simulate the worker pool algorithm from /api/ai/batch-generate
async function runConcurrentBatch(recipients, mockGenerator, concurrency = 4) {
  const results = Array.from({ length: recipients.length });
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

// Simulate the partitioned batch generation from /api/ai/batch-generate
async function runPartitionedBatch({
  recipients,
  fallbackJd = '',
  mockJdGenerator,
  mockGenericGenerator,
  concurrency = 4
}) {
  const withJd = [];
  const withoutJd = [];

  recipients.forEach((recipient, idx) => {
    const hasSpecificJd = Boolean(
      recipient &&
      recipient.jobDescription &&
      typeof recipient.jobDescription === 'string' &&
      recipient.jobDescription.trim().length > 0
    );
    const hasSpecificRole = Boolean(
      recipient &&
      recipient.role &&
      typeof recipient.role === 'string' &&
      recipient.role.trim().length > 0
    );
    if (hasSpecificJd || hasSpecificRole) {
      withJd.push({ recipient, index: idx });
    } else {
      withoutJd.push({ recipient, index: idx });
    }
  });

  const results = Array.from({ length: recipients.length });

  // 1. Process recipients WITH specific Job Descriptions or roles using concurrency pool
  const jdTask = (async () => {
    if (withJd.length === 0) return;

    let nextIndex = 0;
    async function worker() {
      while (nextIndex < withJd.length) {
        const item = withJd[nextIndex++];
        const { recipient, index } = item;
        try {
          const effectiveJd = (recipient.jobDescription && typeof recipient.jobDescription === 'string' && recipient.jobDescription.trim())
            ? recipient.jobDescription.trim()
            : fallbackJd;
          const emailContent = await mockJdGenerator(recipient, effectiveJd);
          results[index] = {
            recipientId: recipient.id,
            recipientEmail: recipient.email,
            success: true,
            email: emailContent
          };
        } catch (genErr) {
          results[index] = {
            recipientId: recipient.id,
            recipientEmail: recipient.email,
            success: false,
            error: genErr.message
          };
        }
      }
    }

    const workers = [];
    const numWorkers = Math.min(concurrency, withJd.length);
    for (let w = 0; w < numWorkers; w++) {
      workers.push(worker());
    }
    await Promise.all(workers);
  })();

  // 2. For recipients WITHOUT specific Job Descriptions:
  // Generate ONE generic cold email, then adapt for each recipient
  const genericTask = (async () => {
    if (withoutJd.length === 0) return;

    try {
      const genericEmail = await mockGenericGenerator(fallbackJd);
      for (const item of withoutJd) {
        const { recipient, index } = item;
        const adaptedEmail = adaptGenericEmailForRecipient(genericEmail, recipient);
        results[index] = {
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          success: true,
          email: adaptedEmail
        };
      }
    } catch (genErr) {
      for (const item of withoutJd) {
        const { recipient, index } = item;
        results[index] = {
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          success: false,
          error: genErr.message
        };
      }
    }
  })();

  await Promise.all([jdTask, genericTask]);
  return results;
}

async function runTests() {
  console.log('Testing Batch Generation Concurrency & Ordering Properties...');

  // -------------------------------------------------------------
  // Test 1: Worker Pool Concurrency & Order Preservation
  // -------------------------------------------------------------
  console.log('\n--- 1. Worker Pool Concurrency (4 workers) ---');
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

  assert.strictEqual(results.length, 8, 'Results length must match recipients count');
  assert.ok(maxObservedConcurrent > 1, `Max observed concurrency (${maxObservedConcurrent}) must be > 1`);
  assert.ok(maxObservedConcurrent <= 4, `Max observed concurrency (${maxObservedConcurrent}) must not exceed pool limit of 4`);

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

  // -------------------------------------------------------------
  // Test 2: Generic Email Adaptation for Specific Recipients
  // -------------------------------------------------------------
  console.log('\n--- 2. Generic Email Adaptation ---');
  const genericEmail = {
    subject: 'Inquiry: Opportunities at your team — Candidate',
    body: 'Hi Hiring Manager,\n\nI’ve been following your team’s progress and would love to explore opportunities at your team.\n\nWarm regards,\nCandidate',
    groundingAudit: { isGroundingAudited: true, groundingScore: 100 }
  };

  // Case A: Recipient with personal name and company
  const recAlice = { id: 'r1', name: 'Alice Walker', company: 'Anthropic', role: 'Staff Engineer' };
  const adaptedAlice = adaptGenericEmailForRecipient(genericEmail, recAlice);
  assert.ok(adaptedAlice.body.startsWith('Hi Alice,'), `Expected body to start with "Hi Alice,", got: ${adaptedAlice.body.slice(0, 20)}`);
  assert.ok(adaptedAlice.body.includes('Anthropic’s progress') || adaptedAlice.body.includes("Anthropic's progress"), 'Adapted company progress in body');
  assert.ok(adaptedAlice.body.includes('at Anthropic'), 'Adapted "at your team" to "at Anthropic"');
  assert.ok(adaptedAlice.subject.includes('at Anthropic'), 'Adapted subject line to "at Anthropic"');
  assert.deepStrictEqual(adaptedAlice.groundingAudit, genericEmail.groundingAudit, 'Preserved groundingAudit');

  // Case B: Recipient with company only (no name)
  const recCompanyOnly = { id: 'r2', name: '', company: 'Stripe' };
  const adaptedCompanyOnly = adaptGenericEmailForRecipient(genericEmail, recCompanyOnly);
  assert.ok(adaptedCompanyOnly.body.startsWith('Hi Stripe Team,'), `Expected "Hi Stripe Team,", got: ${adaptedCompanyOnly.body.slice(0, 25)}`);
  assert.ok(adaptedCompanyOnly.subject.includes('at Stripe'), 'Subject includes company');

  // Case C: Generic recipient name "Hiring Manager" with company
  const recGenericName = { id: 'r3', name: 'Hiring Manager', company: 'Google' };
  const adaptedGenericName = adaptGenericEmailForRecipient(genericEmail, recGenericName);
  assert.ok(adaptedGenericName.body.startsWith('Hi Google Team,'), `Expected "Hi Google Team,", got: ${adaptedGenericName.body.slice(0, 25)}`);

  // Case D: Recipient with neither name nor company
  const recBlank = { id: 'r4', name: '', company: '' };
  const adaptedBlank = adaptGenericEmailForRecipient(genericEmail, recBlank);
  assert.ok(adaptedBlank.body.startsWith('Hi Hiring Manager,'), 'Preserved default greeting when no name or company');
  console.log('✓ Generic email adaptation verified across personal names, companies, and generic fallbacks.');

  // -------------------------------------------------------------
  // Test 3: Partitioned Batch Generation (Per-JD & Single Generic)
  // -------------------------------------------------------------
  console.log('\n--- 3. Partitioned Batch: Per-JD Generation + Single Generic Adaptation ---');
  const mixedRecipients = [
    { id: 'm1', name: 'Bob JD', email: 'bob@jd1.com', company: 'Comp1', jobDescription: 'Senior Rust Developer' },
    { id: 'm2', name: 'Carol NoJD', email: 'carol@no1.com', company: 'Comp2' }, // No JD
    { id: 'm3', name: 'Dan JD', email: 'dan@jd2.com', company: 'Comp3', jobDescription: 'Kubernetes Platform Lead' },
    { id: 'm4', name: 'Eva NoJD', email: 'eva@no2.com', company: 'Comp4', jobDescription: '   ' }, // Blank JD
    { id: 'm5', name: 'Frank NoJD', email: 'frank@no3.com', company: 'Comp5' }, // No JD
    { id: 'm6', name: 'Grace JD', email: 'grace@jd3.com', company: 'Comp6', jobDescription: 'Frontend React Specialist' }
  ];

  let jdCallCount = 0;
  const jdCalls = [];
  const mockJdGen = async (rec, jd) => {
    jdCallCount++;
    jdCalls.push({ id: rec.id, jd });
    await new Promise(r => setTimeout(r, 15));
    return {
      subject: `Tailored: ${jd} at ${rec.company}`,
      body: `Hi ${rec.name.split(' ')[0]},\n\nSpecifically tailored for ${jd}.\n\nBest,\nCandidate`,
      groundingAudit: { isGroundingAudited: true }
    };
  };

  let genericCallCount = 0;
  const mockGenericGen = async (fallback) => {
    genericCallCount++;
    await new Promise(r => setTimeout(r, 10));
    return {
      subject: 'Inquiry: Opportunities at your team — Candidate',
      body: 'Hi Hiring Manager,\n\nI bring strong core software engineering experience.\n\nBest,\nCandidate',
      groundingAudit: { isGroundingAudited: true }
    };
  };

  const partitionedResults = await runPartitionedBatch({
    recipients: mixedRecipients,
    fallbackJd: '',
    mockJdGenerator: mockJdGen,
    mockGenericGenerator: mockGenericGen,
    concurrency: 4
  });

  // Verify call counts:
  // 3 recipients have specific JDs -> exactly 3 individual calls
  // 3 recipients do NOT have JDs -> exactly 1 generic call for all 3!
  assert.strictEqual(jdCallCount, 3, `Expected exactly 3 JD calls, got ${jdCallCount}`);
  assert.strictEqual(genericCallCount, 1, `Expected exactly 1 generic call, got ${genericCallCount}`);

  // Verify total results length and index order
  assert.strictEqual(partitionedResults.length, 6, 'Total results length must match recipients count');
  for (let i = 0; i < mixedRecipients.length; i++) {
    assert.strictEqual(partitionedResults[i].recipientId, mixedRecipients[i].id, `Index ${i} must preserve recipientId`);
    assert.strictEqual(partitionedResults[i].recipientEmail, mixedRecipients[i].email, `Index ${i} must preserve email`);
    assert.strictEqual(partitionedResults[i].success, true, `Recipient ${mixedRecipients[i].id} must succeed`);
  }

  // Verify JD-specific recipients received tailored emails
  assert.ok(partitionedResults[0].email.body.includes('Senior Rust Developer'));
  assert.ok(partitionedResults[2].email.body.includes('Kubernetes Platform Lead'));
  assert.ok(partitionedResults[5].email.body.includes('Frontend React Specialist'));

  // Verify non-JD recipients received adapted generic emails with their own names
  assert.ok(partitionedResults[1].email.body.startsWith('Hi Carol,'));
  assert.ok(partitionedResults[3].email.body.startsWith('Hi Eva,'));
  assert.ok(partitionedResults[4].email.body.startsWith('Hi Frank,'));
  console.log('✓ Partitioned batch generation verified (3 JD calls + 1 generic call, order preserved, greetings adapted).');

  // -------------------------------------------------------------
  // Test 4: Fault Isolation Across Partitioned Generation
  // -------------------------------------------------------------
  console.log('\n--- 4. Fault Isolation in Partitioned Generation ---');
  // Sub-test 4A: JD generation fails for one recipient
  const failJdResults = await runPartitionedBatch({
    recipients: mixedRecipients,
    mockJdGenerator: async (rec) => {
      if (rec.id === 'm1') throw new Error('Timeout on m1');
      return { subject: 'Sub', body: 'Body' };
    },
    mockGenericGenerator: async () => ({ subject: 'Gen Sub', body: 'Hi Hiring Manager,\n\nBody' })
  });
  assert.strictEqual(failJdResults[0].success, false);
  assert.ok(failJdResults[0].error.includes('Timeout on m1'));
  assert.strictEqual(failJdResults[1].success, true, 'Non-JD recipient succeeded despite JD failure');
  assert.strictEqual(failJdResults[2].success, true, 'Other JD recipient succeeded');

  // Sub-test 4B: Generic generator fails
  const failGenResults = await runPartitionedBatch({
    recipients: mixedRecipients,
    mockJdGenerator: async () => ({ subject: 'Sub', body: 'Body' }),
    mockGenericGenerator: async () => {
      throw new Error('Generic LLM quota exceeded');
    }
  });
  assert.strictEqual(failGenResults[0].success, true, 'JD recipient succeeded despite generic failure');
  assert.strictEqual(failGenResults[1].success, false, 'Non-JD recipient marked failed');
  assert.ok(failGenResults[1].error.includes('Generic LLM quota exceeded'));
  assert.strictEqual(failGenResults[3].success, false);
  assert.strictEqual(failGenResults[4].success, false);
  assert.strictEqual(failGenResults[5].success, true, 'JD recipient succeeded');
  console.log('✓ Fault isolation verified (individual JD failures and generic failures isolated without crashing queue).');

  // -------------------------------------------------------------
  // Test 5: Role-Aware Tailoring & Shared Fallback JD Propagation
  // -------------------------------------------------------------
  console.log('\n--- 5. Role-Aware Tailoring & Fallback JD Propagation ---');
  const roleRecipients = [
    { id: 'r_backend', name: 'Alice', email: 'alice@stripe.com', company: 'Stripe', role: 'Staff Backend Engineer', jobDescription: '' },
    { id: 'r_frontend', name: 'Bob', email: 'bob@meta.com', company: 'Meta', role: 'Frontend Lead', jobDescription: '' },
    { id: 'r_generic', name: 'Charlie', email: 'charlie@open.com', company: 'OpenAI' } // no role, no JD
  ];

  const roleCalls = [];
  const roleResults = await runPartitionedBatch({
    recipients: roleRecipients,
    fallbackJd: 'Shared engineering requirements: high scalability and microservices',
    mockJdGenerator: async (rec, jd) => {
      roleCalls.push({ id: rec.id, role: rec.role, jd });
      return {
        subject: `Tailored for ${rec.role} at ${rec.company}`,
        body: `Hi ${rec.name},\n\nSpecifically tailored for ${rec.role} using JD: ${jd}`
      };
    },
    mockGenericGenerator: async (fallback) => ({
      subject: 'Inquiry: Opportunities at your team',
      body: 'Hi Hiring Manager,\n\nCore strengths pitch.'
    })
  });

  // Verify Alice and Bob with roles get tailored calls with the fallback JD
  assert.strictEqual(roleCalls.length, 2, 'Expected 2 tailored calls for recipients with roles');
  assert.strictEqual(roleCalls[0].role, 'Staff Backend Engineer');
  assert.strictEqual(roleCalls[0].jd, 'Shared engineering requirements: high scalability and microservices');
  assert.strictEqual(roleCalls[1].role, 'Frontend Lead');
  assert.ok(roleResults[0].email.body.includes('Staff Backend Engineer'));
  assert.ok(roleResults[1].email.body.includes('Frontend Lead'));
  // Verify Charlie without role got the adapted generic email
  assert.ok(roleResults[2].email.body.startsWith('Hi Charlie,'));
  console.log('✓ Role-aware batch tailoring verified (role recipients get tailored calls with fallback JD; role-less gets adapted generic).');

  console.log('\n====================================================');
  console.log('ALL BATCH CONCURRENCY & PARTITIONING TESTS PASSED!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

