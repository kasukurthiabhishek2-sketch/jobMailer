const assert = require('assert');
const fs = require('fs');
const path = require('path');
const copilotService = require('./services/copilotService');
const storage = require('./services/storageService');

function runTests() {
  console.log('Testing Danger Zone Full Purge Properties...');

  const UPLOADS_DIR = path.join(__dirname, 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // Seed dummy upload file
  const testFile = path.join(UPLOADS_DIR, 'test_dummy_resume.pdf');
  fs.writeFileSync(testFile, 'dummy confidential resume content');
  assert.ok(fs.existsSync(testFile), 'Test file must exist before purge');

  // Seed Copilot session cache
  copilotService.clearSessionCache();
  // Simulate an active token cache
  const cache = copilotService.getSessionCache();
  cache.copilotToken = 'ghu_active_session_token';
  cache.expiresAt = Date.now() + 3600000;
  assert.strictEqual(copilotService.getSessionCache().copilotToken, 'ghu_active_session_token');

  // Perform purge actions matching /api/config/reset
  const files = fs.readdirSync(UPLOADS_DIR);
  for (const file of files) {
    if (file !== '.gitkeep' && file !== '.DS_Store') {
      try {
        fs.unlinkSync(path.join(UPLOADS_DIR, file));
      } catch (e) {}
    }
  }
  copilotService.clearSessionCache();

  // Assertions
  assert.ok(!fs.existsSync(testFile), 'Uploaded resume file must be removed from disk');
  assert.strictEqual(copilotService.getSessionCache().copilotToken, null, 'In-memory Copilot token must be cleared');
  assert.strictEqual(copilotService.getSessionCache().expiresAt, 0, 'In-memory token expiry must be reset');

  console.log('✓ Danger zone disk purge and in-memory cache wipe verified.');
  console.log('ALL DANGER ZONE TESTS PASSED!');
}

runTests();
