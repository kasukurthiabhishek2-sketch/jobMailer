const assert = require('assert');
const fs = require('fs');
const path = require('path');
const copilotService = require('./services/copilotService');

function runTests() {
  console.log('Testing Danger Zone Full Purge Properties...');

  const TEST_UPLOADS_DIR = path.join(__dirname, 'temp_test_danger_uploads');
  if (!fs.existsSync(TEST_UPLOADS_DIR)) {
    fs.mkdirSync(TEST_UPLOADS_DIR, { recursive: true });
  }

  // Seed dummy upload file
  const testFile = path.join(TEST_UPLOADS_DIR, 'test_dummy_resume.pdf');
  fs.writeFileSync(testFile, 'dummy confidential resume content');
  assert.ok(fs.existsSync(testFile), 'Test file must exist before purge');

  // Seed Copilot session cache
  copilotService.clearSessionCache();
  // Simulate an active token cache
  const cache = copilotService.getSessionCache();
  cache.copilotToken = 'ghu_active_session_token';
  cache.expiresAt = Date.now() + 3600000;
  assert.strictEqual(copilotService.getSessionCache().copilotToken, 'ghu_active_session_token');

  try {
    // Perform purge actions matching /api/config/reset
    const files = fs.readdirSync(TEST_UPLOADS_DIR);
    for (const file of files) {
      if (file !== '.gitkeep' && file !== '.DS_Store') {
        try {
          fs.unlinkSync(path.join(TEST_UPLOADS_DIR, file));
        } catch {}
      }
    }
    copilotService.clearSessionCache();

    // Assertions
    assert.ok(!fs.existsSync(testFile), 'Uploaded resume file must be removed from disk');
    assert.strictEqual(copilotService.getSessionCache().copilotToken, null, 'In-memory Copilot token must be cleared');
    assert.strictEqual(copilotService.getSessionCache().expiresAt, 0, 'In-memory token expiry must be reset');

    console.log('✓ Danger zone disk purge and in-memory cache wipe verified.');
    console.log('ALL DANGER ZONE TESTS PASSED!');
  } finally {
    if (fs.existsSync(TEST_UPLOADS_DIR)) {
      try {
        fs.rmSync(TEST_UPLOADS_DIR, { recursive: true, force: true });
      } catch {}
    }
  }
}

runTests();
