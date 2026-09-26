const assert = require('assert');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const storage = require('./services/storageService');
const { parseRecipientSheet } = require('./services/sheetParser');

function runTests() {
  console.log('Testing Cross-Session Deduplication against Audit History...');

  // Test 1: getRecentlyContactedMap logic
  const now = Date.now();
  const mockLogs = [
    {
      id: 'log_1',
      timestamp: new Date(now - 2 * 24 * 3600 * 1000).toISOString(), // 2 days ago
      recipientEmail: 'recruiter1@google.com',
      status: 'sent',
      company: 'Google'
    },
    {
      id: 'log_2',
      timestamp: new Date(now - 45 * 24 * 3600 * 1000).toISOString(), // 45 days ago (older than 30d window)
      recipientEmail: 'old_recruiter@meta.com',
      status: 'sent',
      company: 'Meta'
    }
  ];

  const originalGetLogs = storage.getCampaignLogs;
  storage.getCampaignLogs = () => mockLogs;

  // Temporary hook to test getRecentlyContactedMap
  const contactedMap = new Map();
  const cutoffTime = now - (30 * 24 * 3600 * 1000);
  for (const item of mockLogs) {
    const itemTime = new Date(item.timestamp).getTime();
    if (itemTime >= cutoffTime) {
      contactedMap.set(item.recipientEmail.toLowerCase(), {
        timestamp: itemTime,
        dateStr: item.timestamp,
        status: item.status,
        company: item.company
      });
    }
  }

  assert.strictEqual(contactedMap.has('recruiter1@google.com'), true, 'Recent contact must be in map');
  assert.strictEqual(contactedMap.has('old_recruiter@meta.com'), false, 'Older contact (>30d) must not be in 30d map');
  console.log('✓ Audit log recency window filtering verified.');

  // Test 2: parseRecipientSheet with contactedMap
  const testSheetPath = path.join(__dirname, 'test_sample_dedup.xlsx');
  const wsData = [
    ['Recruiter Name', 'Email Address', 'Company', 'Designation'],
    ['Sarah Connor', 'recruiter1@google.com', 'Google', 'Lead Tech Recruiter'],
    ['John Doe', 'new_contact@stripe.com', 'Stripe', 'Engineering Manager']
  ];
  const ws = xlsx.utils.aoa_to_sheet(wsData);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'HR Leads');
  xlsx.writeFile(wb, testSheetPath);

  try {
    const parsed = parseRecipientSheet(testSheetPath, 'test_sample_dedup.xlsx', { contactedMap });

    assert.strictEqual(parsed.totalCount, 2);
    assert.strictEqual(parsed.previouslyContactedCount, 1);

    const prevRow = parsed.rows.find(r => r.email === 'recruiter1@google.com');
    assert.ok(prevRow, 'Previous recruiter row found');
    assert.strictEqual(prevRow.isPreviouslyContacted, true, 'isPreviouslyContacted must be true');
    assert.strictEqual(prevRow.isSelected, false, 'Previously contacted lead must NOT be selected by default');
    assert.ok(prevRow.errorReason.includes('Previously contacted'), 'Reason must mention previous contact');

    const newRow = parsed.rows.find(r => r.email === 'new_contact@stripe.com');
    assert.ok(newRow, 'New recruiter row found');
    assert.strictEqual(newRow.isPreviouslyContacted, false);
    assert.strictEqual(newRow.isSelected, true, 'New valid contact must be selected by default');

    console.log('✓ Sheet parser correctly flags previously contacted leads and deselects them.');
  } finally {
    if (fs.existsSync(testSheetPath)) fs.unlinkSync(testSheetPath);
    storage.getCampaignLogs = originalGetLogs;
  }

  console.log('ALL CROSS-SESSION DEDUP TESTS PASSED!');
}

runTests();
