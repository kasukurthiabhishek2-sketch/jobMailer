const assert = require('assert');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const {
  parseRecipientSheet,
  validateEmail,
  extractEmail,
  normalizeHeader
} = require('./services/sheetParser');

console.log('====================================================');
console.log('RUNNING COMPREHENSIVE SHEET PARSER & EXTRACTION TEST');
console.log('====================================================\n');

// 1. Test Header Normalization
console.log('Test 1: Header Normalization');
assert.strictEqual(normalizeHeader(' HR_Email '), 'hr email');
assert.strictEqual(normalizeHeader('HR_EMAIL'), 'hr email');
assert.strictEqual(normalizeHeader('Hr-Email'), 'hr email');
assert.strictEqual(normalizeHeader('HREmail'), 'hremail');
assert.strictEqual(normalizeHeader('Recruiter_Name'), 'recruiter name');
assert.strictEqual(normalizeHeader('  Hiring   Manager   Name  '), 'hiring manager name');
assert.strictEqual(normalizeHeader('Company_Name'), 'company name');
assert.strictEqual(normalizeHeader('contact-email'), 'contact email');
console.log('✓ Header Normalization passed.\n');

// 2. Test Email Extraction from text
console.log('Test 2: Email Extraction from cells with extra text');
assert.strictEqual(extractEmail('HR Team - hr@company.com'), 'hr@company.com');
assert.strictEqual(extractEmail('Contact: recruiter@company.in'), 'recruiter@company.in');
assert.strictEqual(extractEmail('Email: hiring@company.co.in'), 'hiring@company.co.in');
assert.strictEqual(extractEmail('john.doe@company.com | HR'), 'john.doe@company.com');
assert.strictEqual(extractEmail('Reach out to recruiter@company.org for opportunities'), 'recruiter@company.org');
assert.strictEqual(extractEmail('Contact HR at john@company.com'), 'john@company.com');
assert.strictEqual(extractEmail('<hr@company.com>'), 'hr@company.com');
assert.strictEqual(extractEmail('hr@company.com,'), 'hr@company.com');
assert.strictEqual(extractEmail('(hr@company.com)'), 'hr@company.com');
assert.strictEqual(extractEmail('"hr@company.com"'), 'hr@company.com');
console.log('✓ Email Extraction passed.\n');

// 3. Test Email Validation and Domain Rules
console.log('Test 3: Email Validation & Non-.com TLDs');
const validDomains = [
  'hr@company.com',
  'HR@COMPANY.COM',
  'recruiter@google.com',
  'john.doe@company.in',
  'careers@company.co.in',
  'talent.acquisition@company.org',
  'lead@company.net',
  'founder@startup.io',
  'engineer@ai-lab.ai',
  'support@service.co',
  'dean@harvard.edu',
  'officer@usds.gov'
];

validDomains.forEach(email => {
  const v = validateEmail(email);
  assert.strictEqual(v.valid, true, `Expected ${email} to be valid`);
  assert.strictEqual(v.cleanEmail, email.toLowerCase());
});

// Check typo domains (e.g. gamil.com)
const typoCheck = validateEmail('candidate@gamil.com');
assert.strictEqual(typoCheck.valid, false);
assert.match(typoCheck.reason, /gamil\.com/i);

const invalidCheck = validateEmail('not-an-email');
assert.strictEqual(invalidCheck.valid, false);
console.log('✓ Email Validation & Domain Rules passed.\n');

// 4. Test Row-by-Row Excel Parsing with Diverse Header Formats & Priorities
console.log('Test 4: Excel Row-by-Row Isolation & Priority Extraction');

const testWb = xlsx.utils.book_new();

// Sheet 1: Instructions (should be skipped)
const wsGuide = xlsx.utils.aoa_to_sheet([
  ['Guide / Notes Sheet'],
  ['Please see Sheet 2 for HR contacts']
]);
xlsx.utils.book_append_sheet(testWb, wsGuide, 'Guide');

// Sheet 2: HR Contacts with diverse header casing, non-row-0 headers, surrounding text, etc.
const sheetRows = [
  // Row 0: Banner / title row
  ['INTERNAL HR DATABASE - OCTOBER 2026', '', '', '', ''],
  // Row 1: Subtitle
  ['Confidential - For Recruiting Campaign Only', '', '', '', ''],
  // Row 2: Actual Header row with diverse casing & naming
  ['Company Name', ' Hr_Name ', '  HR_EMAIL  ', 'ORGANIZATION', 'Job_Title'],
  // Row 3: Standard
  ['TechCorp Labs', 'Sarah Jenkins', 'sarah.jenkins@techcorp.io', 'TechCorp Labs', 'Senior Engineering Recruiter'],
  // Row 4: Extra text in email cell + name
  ['FinScale AI', 'David Zhao', 'Contact: recruiter@finscale.ai', 'FinScale AI', 'VP of Engineering'],
  // Row 5: Angle brackets + .co.in domain
  ['HyperGrowth', 'Elena Rostova', '<elena@hypergrowth.co.in>', 'HyperGrowth Talent', 'Head of Technical Recruiting'],
  // Row 6: Quotes & comma in email
  ['Dunder Mifflin', 'Michael Scott', '"mscott@dundermifflin.com",', 'Dunder Mifflin', 'Regional Manager'],
  // Row 7: Typo domain @gamil.com (should be flagged as invalid)
  ['Acme Corp', 'John Typo', 'john@gamil.com', 'Acme Corp', 'Lead HR'],
  // Row 8: Parentheses + .org domain
  ['Wonderland Labs', 'Alice Wonderland', '(alice@wonderland.org)', 'Wonderland Labs', 'Talent Scout'],
  // Row 9: Email cell has surrounding text with name
  ['Studio Co', 'Emily Blunt', 'HR Team - emily.blunt@studio.co for inquiries', 'Studio Co', 'Casting']
];

const wsContacts = xlsx.utils.aoa_to_sheet(sheetRows);
xlsx.utils.book_append_sheet(testWb, wsContacts, 'HR Outreach Leads');

const testFilePath = path.join(__dirname, 'test_temp_hr.xlsx');
xlsx.writeFile(testWb, testFilePath);

try {
  const result = parseRecipientSheet(testFilePath, 'test_temp_hr.xlsx');

  // Verify sheet selection
  assert.strictEqual(result.sheetName, 'HR Outreach Leads');

  // Verify header row detected at index 2
  assert.strictEqual(result.headerRowIndex, 2);

  // Verify column mapping
  assert.strictEqual(result.columnMapping.emailCol, 'HR_EMAIL');
  assert.strictEqual(result.columnMapping.nameCol, 'Hr_Name');
  assert.strictEqual(result.columnMapping.companyCol, 'Company Name');
  assert.strictEqual(result.columnMapping.roleCol, 'Job_Title');

  // Verify row counts
  assert.strictEqual(result.totalCount, 7);
  assert.strictEqual(result.validCount, 6);
  assert.strictEqual(result.invalidCount, 1);

  // Verify row-by-row extraction integrity: ROW i -> Email i -> Name i
  const [row1, row2, row3, row4, row5, row6, row7] = result.rows;

  // ROW 1
  assert.strictEqual(row1.excelRowNum, 4);
  assert.strictEqual(row1.name, 'Sarah Jenkins');
  assert.strictEqual(row1.email, 'sarah.jenkins@techcorp.io');
  assert.strictEqual(row1.company, 'TechCorp Labs');
  assert.strictEqual(row1.role, 'Senior Engineering Recruiter');
  assert.strictEqual(row1.isValidEmail, true);

  // ROW 2
  assert.strictEqual(row2.excelRowNum, 5);
  assert.strictEqual(row2.name, 'David Zhao');
  assert.strictEqual(row2.email, 'recruiter@finscale.ai');
  assert.strictEqual(row2.isValidEmail, true);

  // ROW 3 (.co.in domain)
  assert.strictEqual(row3.excelRowNum, 6);
  assert.strictEqual(row3.name, 'Elena Rostova');
  assert.strictEqual(row3.email, 'elena@hypergrowth.co.in');
  assert.strictEqual(row3.isValidEmail, true);

  // ROW 4 (cleaned quotes & commas)
  assert.strictEqual(row4.excelRowNum, 7);
  assert.strictEqual(row4.name, 'Michael Scott');
  assert.strictEqual(row4.email, 'mscott@dundermifflin.com');
  assert.strictEqual(row4.isValidEmail, true);

  // ROW 5 (@gamil.com typo domain)
  assert.strictEqual(row5.excelRowNum, 8);
  assert.strictEqual(row5.name, 'John Typo');
  assert.strictEqual(row5.email, 'john@gamil.com');
  assert.strictEqual(row5.isValidEmail, false);
  assert.match(row5.errorReason, /gamil\.com/);

  // ROW 6 (cleaned parentheses + .org domain)
  assert.strictEqual(row6.excelRowNum, 9);
  assert.strictEqual(row6.name, 'Alice Wonderland');
  assert.strictEqual(row6.email, 'alice@wonderland.org');
  assert.strictEqual(row6.isValidEmail, true);

  // ROW 7 (cleaned extra text)
  assert.strictEqual(row7.excelRowNum, 10);
  assert.strictEqual(row7.name, 'Emily Blunt');
  assert.strictEqual(row7.email, 'emily.blunt@studio.co');
  assert.strictEqual(row7.isValidEmail, true);

  console.log('✓ Excel Row-by-Row Isolation & Priority Extraction passed.');
} finally {
  try { fs.unlinkSync(testFilePath); } catch {}
}

// 5. Test Priority Order: Recruiter Name vs Company Name, Hiring Manager vs Contact Name
console.log('\nTest 5: Name Priority Order Ranking');

const testWb2 = xlsx.utils.book_new();
const priorityRows = [
  ['Company Name', 'Recruiter Name', 'Email Address'],
  ['Amazon AWS', 'Marcus Vance', 'marcus@amazon.com'],
  ['Google Cloud', 'Priya Patel', 'priya@google.com']
];
const wsPriority = xlsx.utils.aoa_to_sheet(priorityRows);
xlsx.utils.book_append_sheet(testWb2, wsPriority, 'Sheet1');

const testFilePath2 = path.join(__dirname, 'test_priority.xlsx');
xlsx.writeFile(testWb2, testFilePath2);

try {
  const result2 = parseRecipientSheet(testFilePath2, 'test_priority.xlsx');
  assert.strictEqual(result2.columnMapping.nameCol, 'Recruiter Name');
  assert.strictEqual(result2.columnMapping.companyCol, 'Company Name');
  assert.strictEqual(result2.rows[0].name, 'Marcus Vance');
  assert.strictEqual(result2.rows[0].email, 'marcus@amazon.com');
  assert.strictEqual(result2.rows[0].company, 'Amazon AWS');
  assert.strictEqual(result2.rows[1].name, 'Priya Patel');
  assert.strictEqual(result2.rows[1].email, 'priya@google.com');
  console.log('✓ Name Priority (avoiding Company Name confusion) passed.');
} finally {
  try { fs.unlinkSync(testFilePath2); } catch {}
}

// 6. Test First Name + Last Name compound columns
console.log('\nTest 6: Compound First Name & Last Name');
const testWb3 = xlsx.utils.book_new();
const compoundRows = [
  ['First Name', 'Last Name', 'Recruiter_Email', 'Organization'],
  ['Alexander', 'Hamilton', 'alex@treasury.gov', 'Treasury'],
  ['Aaron', 'Burr', 'burr@law.org', 'Burr & Co']
];
xlsx.utils.book_append_sheet(testWb3, xlsx.utils.aoa_to_sheet(compoundRows), 'Contacts');
const testFilePath3 = path.join(__dirname, 'test_compound.xlsx');
xlsx.writeFile(testWb3, testFilePath3);

try {
  const result3 = parseRecipientSheet(testFilePath3, 'test_compound.xlsx');
  assert.strictEqual(result3.rows[0].name, 'Alexander Hamilton');
  assert.strictEqual(result3.rows[0].email, 'alex@treasury.gov');
  assert.strictEqual(result3.rows[1].name, 'Aaron Burr');
  assert.strictEqual(result3.rows[1].email, 'burr@law.org');
  console.log('✓ Compound First Name + Last Name passed.');
} finally {
  try { fs.unlinkSync(testFilePath3); } catch {}
}

// 7. Test Job Description column auto-detection and row mapping
console.log('\nTest 7: Job Description Column Auto-Detection & Mapping');
const testWb4 = xlsx.utils.book_new();
const jdRows = [
  ['Company', 'Recruiter Name', 'Email', 'Job Description'],
  ['Anthropic', 'Dario Amodei', 'dario@anthropic.com', 'Senior AI Alignment Researcher with PyTorch experience.'],
  ['OpenAI', 'Sam Altman', 'sam@openai.com', ''],
  ['Cohere', 'Aidan Gomez', 'aidan@cohere.com', 'Transformer architecture specialist.']
];
xlsx.utils.book_append_sheet(testWb4, xlsx.utils.aoa_to_sheet(jdRows), 'Candidates');
const testFilePath4 = path.join(__dirname, 'test_jd.xlsx');
xlsx.writeFile(testWb4, testFilePath4);

try {
  const result4 = parseRecipientSheet(testFilePath4, 'test_jd.xlsx');
  assert.strictEqual(result4.columnMapping.jdCol, 'Job Description');
  assert.strictEqual(result4.rows[0].jobDescription, 'Senior AI Alignment Researcher with PyTorch experience.');
  assert.strictEqual(result4.rows[1].jobDescription, '');
  assert.strictEqual(result4.rows[2].jobDescription, 'Transformer architecture specialist.');
  console.log('✓ Job Description Column Auto-Detection & Mapping passed.');
} finally {
  try { fs.unlinkSync(testFilePath4); } catch {}
}

console.log('\n====================================================');
console.log('ALL TESTS PASSED! FULL EXTRACTION & VALIDATION VERIFIED.');
console.log('====================================================');
