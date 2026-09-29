/**
 * Unified Test Runner for JDMail Server Test Suites
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const testSuites = [
  { name: 'Sheet Parser & Extraction Engine', file: 'test_sheet_parser_full.js' },
  { name: 'AES-256-GCM Cryptographic Storage & Masking', file: 'test_crypto.js' },
  { name: 'Storage Service & Config Invariants', file: 'test_storage.js' },
  { name: 'SMTP Resilience, Strict TLS & Retries', file: 'test_smtp_resilience.js' },
  { name: 'Copilot AI Dispatch & Fallback', file: 'test_copilot_dispatch.js' },
  { name: 'AI Fact-Checking Guardrail & Prompts', file: 'test_ai_guardrail.js' },
  { name: 'AI Multi-Stage JSON Recovery & Repair Engine', file: 'test_ai_json_recovery.js' },
  { name: 'Batch Concurrency & Order Preservation', file: 'test_batch_concurrency.js' },
  { name: 'Cross-Session Audit Deduplication', file: 'test_cross_session_dedup.js' },
  { name: 'Danger-Zone Full Purge Verification', file: 'test_danger_zone.js' },
  { name: 'Resume Text & Heuristic Parser', file: 'test_resume_parser.js' },
  { name: 'Design System & Theme Token Invariants', file: 'test_design_tokens.js' },
  { name: 'Firebase Firestore Settings & Auth Migration', file: 'test_firebase_migration.js' },
  { name: 'Security Guardrails & Hardening', file: 'test_security_guardrails.js' },
  { name: 'Ephemeral Uploads & Zero Retention Policy', file: 'test_ephemeral_uploads.js' },
  { name: 'AI Provider 429 Backoff & Retry Logic', file: 'test_ai_retry.js' },
  { name: 'AI Provider Model Listing & Filtering', file: 'test_model_listing.js' },
  { name: 'SMTP Pacing, Response Recording & Retry Pipeline', file: 'test_smtp_pipeline.js' },
  { name: 'AI Provider Connection Timeout Behavior', file: 'test_connection_timeout.js' },
  { name: 'End-to-End Outreach Pipeline & Invariants', file: 'test_e2e_pipeline.js' },
  { name: 'Comprehensive Opaque-Box E2E Suite (Tiers 1-4)', file: 'test_e2e_suite.js' },
  { name: 'Authenticated User Key Resolution for AI Routes', file: 'test_key_resolution.js' },
  { name: 'GitHub Copilot OAuth Device Flow & No-Key Invariants', file: 'test_copilot_device_flow.js' },
  { name: 'Hybrid Deployment Wiring (Vercel + Render)', file: 'test_hybrid_deployment.js' },
  { name: 'Graphify Knowledge Graph & Agent Invariants', file: 'test_graphify_integration.js' },
  { name: 'AI JD Parser, URL Scraper & Recipient Extraction', file: 'test_jd_parser.js' },
  { name: 'Custom AI Prompts & Invariants', file: 'test_custom_prompts.js' },
  { name: 'Sample Resume, AI Keys & Server Persistence', file: 'test_sample_resume_and_ai_keys.js' }
];

console.log('====================================================');
console.log('   RUNNING JDMAIL COMPREHENSIVE SUBSYSTEM SUITE    ');
console.log('====================================================\n');

let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];

for (const suite of testSuites) {
  const filePath = path.join(__dirname, suite.file);
  if (!fs.existsSync(filePath)) {
    console.log(`• Skipping ${suite.name} (${suite.file} not present in this branch)`);
    skipped++;
    continue;
  }
  process.stdout.write(`• Running ${suite.name} (${suite.file})... `);
  
  const startTime = Date.now();
  const res = spawnSync('node', [filePath], { encoding: 'utf8', cwd: __dirname });
  const duration = Date.now() - startTime;

  if (res.status === 0) {
    console.log(`\x1b[32mPASSED\x1b[0m (${duration}ms)`);
    passed++;
    results.push({ name: suite.name, status: 'PASS', duration });
  } else {
    console.log(`\x1b[31mFAILED\x1b[0m (${duration}ms)`);
    console.error(res.stderr || res.stdout);
    failed++;
    results.push({ name: suite.name, status: 'FAIL', duration });
  }
}

console.log('\n====================================================');
console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED across ${testSuites.length} test suites`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32mALL SUBSYSTEM TEST SUITES PASSED CLEANLY!\x1b[0m\n');
  process.exit(0);
}
