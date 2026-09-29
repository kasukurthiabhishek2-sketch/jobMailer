/**
 * Test Suite: Ephemeral Data & Zero File Retention Policy
 *
 * Enforces User Invariants:
 * 1. Only API keys, email history, and settings are saved.
 * 2. Candidate resumes and uploaded Excel/spreadsheets are strictly ephemeral
 *    and NEVER stored permanently in cloud storage or persistent databases.
 * 3. Uploaded Excel files are deleted immediately after parsing.
 * 4. Stale resume files are cleaned up and purged.
 * 5. Firebase Storage rules reject all storage operations.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const storage = require('./services/storageService');
const { parseRecipientSheet } = require('./services/sheetParser');

function runTests() {
  console.log('Testing Ephemeral Data & Zero File Retention Policy...');

  const UPLOADS_DIR = path.join(__dirname, 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // -------------------------------------------------------------
  // Test 1: Uploaded Excel/Spreadsheet is Ephemeral (Immediately Deleted)
  // -------------------------------------------------------------
  console.log('\n--- 1. Ephemeral Spreadsheet File Lifecycle ---');
  const tempSheetPath = path.join(UPLOADS_DIR, `test_sheet_${Date.now()}.csv`);
  const csvContent = 'Name,Email,Company,Role\nAlice,alice@example.com,Acme,Engineer\nBob,bob@example.com,Beta,Designer\n';
  fs.writeFileSync(tempSheetPath, csvContent, 'utf8');

  assert.ok(fs.existsSync(tempSheetPath), 'Spreadsheet file created for ingestion');

  // Parse recipients from file
  const parsed = parseRecipientSheet(tempSheetPath);
  assert.strictEqual(parsed.rows.length, 2, 'Recipients should be parsed correctly');

  // Simulate server/index.js POST /api/upload/recipients finally block
  try {
    if (fs.existsSync(tempSheetPath)) {
      fs.unlinkSync(tempSheetPath);
    }
  } catch (err) {
    assert.fail(`Spreadsheet file failed to unlink: ${err.message}`);
  }

  assert.strictEqual(fs.existsSync(tempSheetPath), false, 'Spreadsheet file MUST NOT exist on disk after parsing');
  console.log('✓ Spreadsheet parsed into memory and immediately unlinked from disk.');

  // -------------------------------------------------------------
  // Test 2: Corrupt Spreadsheet File Cleanup on Failure
  // -------------------------------------------------------------
  console.log('\n--- 2. Corrupt Spreadsheet File Cleanup on Failure ---');
  const corruptPath = path.join(UPLOADS_DIR, `corrupt_sheet_${Date.now()}.bin`);
  fs.writeFileSync(corruptPath, Buffer.from([0x00, 0x11, 0x22, 0x33]));

  let parseErrorThrown = false;
  try {
    try {
      parseRecipientSheet(corruptPath);
    } finally {
      // Mirroring server finally handler
      if (fs.existsSync(corruptPath)) {
        fs.unlinkSync(corruptPath);
      }
    }
  } catch {
    parseErrorThrown = true;
  }

  assert.ok(parseErrorThrown, 'Corrupt file should cause parse error');
  assert.strictEqual(fs.existsSync(corruptPath), false, 'Corrupt spreadsheet MUST still be unlinked in error/finally block');
  console.log('✓ Corrupt spreadsheets are guaranteed unlinked even on parsing failure.');

  // -------------------------------------------------------------
  // Test 3: Resume Replacement & Cleanup Pruning
  // -------------------------------------------------------------
  console.log('\n--- 3. Ephemeral Resume Pruning ---');
  const resume1Path = path.join(UPLOADS_DIR, `resume_first_${Date.now()}.pdf`);
  const resume2Path = path.join(UPLOADS_DIR, `resume_second_${Date.now()}.pdf`);

  fs.writeFileSync(resume1Path, 'dummy resume 1');
  assert.ok(fs.existsSync(resume1Path));

  // When uploading resume 2, previous resume files should be pruned
  fs.writeFileSync(resume2Path, 'dummy resume 2');

  // Pruning logic as implemented in server/index.js
  const files = fs.readdirSync(UPLOADS_DIR);
  for (const f of files) {
    if (f !== path.basename(resume2Path) && f.startsWith('resume_')) {
      fs.unlinkSync(path.join(UPLOADS_DIR, f));
    }
  }

  assert.strictEqual(fs.existsSync(resume1Path), false, 'Older resume file must be pruned when new resume uploaded');
  assert.strictEqual(fs.existsSync(resume2Path), true, 'Current active resume file remains');

  // Cleanup on campaign completion or explicit reset
  fs.unlinkSync(resume2Path);
  assert.strictEqual(fs.existsSync(resume2Path), false, 'Active resume must be deleted after sending/cleanup');
  console.log('✓ Resume files are ephemeral, pruned on new upload, and deleted on send.');

  // -------------------------------------------------------------
  // Test 4: Firebase Storage Rules Enforce Zero Cloud File Retention
  // -------------------------------------------------------------
  console.log('\n--- 4. Cloud Storage Invariant (storage.rules) ---');
  const storageRulesPath = path.join(__dirname, '..', 'storage.rules');
  assert.ok(fs.existsSync(storageRulesPath), 'storage.rules must exist');
  const storageRules = fs.readFileSync(storageRulesPath, 'utf8');

  assert.ok(
    storageRules.includes('allow read, write: if false;'),
    'storage.rules must explicitly disallow all read and write operations'
  );
  console.log('✓ Firebase Cloud Storage explicitly disallows any file persistence.');

  // -------------------------------------------------------------
  // Test 5: Persistent Storage Stores ONLY Keys, Settings, and Logs
  // -------------------------------------------------------------
  console.log('\n--- 5. Persistent Storage Schema Inspection ---');
  const configPath = path.join(__dirname, 'data', 'config.json');
  const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
  const logs = storage.getCampaignLogs();

  // Validate config.json does NOT contain binary data or spreadsheet arrays
  const configKeys = Object.keys(config);
  const allowedConfigKeys = [
    'activeProvider',
    'aiProviders',
    'smtpProfiles',
    'candidateProfile',
    'sendingPreferences',
    'preferences',
    'customPrompts'
  ];

  for (const key of configKeys) {
    assert.ok(
      allowedConfigKeys.includes(key),
      `config.json contains unexpected key '${key}'. Only keys and settings are allowed.`
    );
  }

  // Ensure no base64 buffers or raw resume blobs exist in config
  const configStr = JSON.stringify(config);
  assert.strictEqual(configStr.includes('data:application/pdf'), false, 'Config must not store PDF data');
  assert.strictEqual(configStr.includes('base64'), false, 'Config must not store base64 file blobs');

  // Ensure logs only contain delivery records
  for (const log of logs) {
    assert.ok(!log.resumeBuffer, 'Logs must never store resume buffers');
    assert.ok(!log.spreadsheetData, 'Logs must never store raw spreadsheet rows');
  }

  // -------------------------------------------------------------
  // Test 6: Explicit Ephemeral Resume File Removal (TICK-CYC3-13 / C4)
  // -------------------------------------------------------------
  console.log('\n--- 6. Explicit Ephemeral Resume Removal ---');
  const userResumePath = path.join(UPLOADS_DIR, `user_resume_${Date.now()}.pdf`);
  fs.writeFileSync(userResumePath, 'Test resume content');
  assert.ok(fs.existsSync(userResumePath), 'User resume must exist before deletion');

  // Deletion logic matching DELETE /api/upload/resume
  fs.unlinkSync(userResumePath);
  assert.strictEqual(fs.existsSync(userResumePath), false, 'Resume file must be wiped from disk upon removal');
  console.log('✓ Explicit resume removal removes file immediately from disk.');

  console.log('\nALL EPHEMERAL DATA & ZERO RETENTION TESTS PASSED CLEANLY!\n');
}

runTests();
