# test_batch_concurrency.js

> 9 nodes · cohesion 0.36

## Key Concepts

- **test_batch_concurrency.js** (8 connections) — `server/test_batch_concurrency.js`
- **adaptGenericEmailForRecipient()** (5 connections) — `server/index.js`
- **runConcurrentBatch()** (4 connections) — `server/test_batch_concurrency.js`
- **runPartitionedBatch()** (4 connections) — `server/test_batch_concurrency.js`
- **runTests()** (4 connections) — `server/test_batch_concurrency.js`
- **worker()** (2 connections) — `server/test_batch_concurrency.js`
- **{ adaptGenericEmailForRecipient }** (1 connections) — `server/test_batch_concurrency.js`
- **assert** (1 connections) — `server/test_batch_concurrency.js`
- **worker()** (1 connections) — `server/test_batch_concurrency.js`

## Relationships

- [index.js](index.js.md) (2 shared connections)
- [aiService.js](aiService.js.md) (1 shared connections)
- [ref_assert](ref_assert.md) (1 shared connections)

## Source Files

- `server/index.js`
- `server/test_batch_concurrency.js`

## Audit Trail

- EXTRACTED: 17 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*