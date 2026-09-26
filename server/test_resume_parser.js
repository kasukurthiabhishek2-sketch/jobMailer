const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseResumeFile } = require('./services/resumeParser');

async function runTests() {
  console.log('Testing Resume Parser Subsystem...');

  const sampleResumeContent = `
John Alexander Doe
Senior Full-Stack Cloud Architect
Email: john.doe@engineer.ai | Phone: +1 (555) 234-5678 | San Francisco, CA

SUMMARY
Seasoned software engineer with 8+ years building enterprise Node.js microservices and React frontends.
Successfully migrated monolithic architecture to Kubernetes, reducing cloud expenditure by 35%.

EXPERIENCE
Lead Architect — TechVentures Inc (2021 - Present)
- Designed real-time event streaming pipeline processing 100M events/day.
- Mentored 12 junior engineers in asynchronous programming and clean code.
`;

  const tempFilePath = path.join(__dirname, 'temp_test_resume.txt');
  fs.writeFileSync(tempFilePath, sampleResumeContent.trim());

  try {
    const result = await parseResumeFile(tempFilePath, 'john_doe_resume.txt');

    assert.strictEqual(result.detectedName, 'John Alexander Doe', 'Heuristic must extract candidate name from top lines');
    assert.strictEqual(result.detectedEmail, 'john.doe@engineer.ai', 'Must extract valid email address');
    assert.ok(result.detectedPhone.includes('555') && result.detectedPhone.includes('234-5678'), 'Must extract phone number');
    assert.ok(result.wordCount > 40, 'Word count must be calculated');
    assert.ok(result.summarySnippet.length > 20, 'Summary snippet must be populated');
    assert.ok(result.rawText.includes('TechVentures'), 'Raw text must contain resume body');

    console.log('✓ Candidate name, email, phone, and metrics extracted accurately.');
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }

  console.log('ALL RESUME PARSER TESTS PASSED!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
