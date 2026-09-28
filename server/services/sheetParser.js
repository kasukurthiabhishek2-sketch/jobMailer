const xlsx = require('xlsx');
const path = require('path');

/**
 * Standard case-insensitive email extraction regex.
 * Detects patterns like: local-part@domain.tld
 * Supports modern TLDs (.com, .in, .co.in, .org, .net, .io, .co, .ai, .edu, .gov, etc.)
 */
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i;

/**
 * Normalize Excel column/header names for robust, case-insensitive comparison.
 * Examples:
 *   " HR_Email " -> "hr email"
 *   "HR_EMAIL"   -> "hr email"
 *   "Hr-Email"   -> "hr email"
 *   "HREmail"    -> "hremail"
 *   "Recruiter_Name" -> "recruiter name"
 */
function normalizeHeader(header) {
  if (!header || typeof header !== 'string') return '';
  return header
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')  // replace _ and - with space
    .replace(/\s+/g, ' ')     // collapse repeated spaces to single space
    .trim();
}

/**
 * Extract email address from cell text that may contain additional text.
 * Handles examples:
 *   "HR Team - hr@company.com" -> "hr@company.com"
 *   "Contact: recruiter@company.in" -> "recruiter@company.in"
 *   "<hr@company.com>" -> "hr@company.com"
 *   "hr@company.com," -> "hr@company.com"
 *   "(hr@company.com)" -> "hr@company.com"
 *   "\"hr@company.com\"" -> "hr@company.com"
 */
function extractEmail(cellVal) {
  if (cellVal === null || cellVal === undefined) return null;
  const str = String(cellVal).trim();
  if (!str) return null;

  const match = str.match(EMAIL_REGEX);
  if (!match) return null;

  let email = match[0].trim();
  // Strip surrounding punctuation like < > ( ) [ ] " ' , ; :
  email = email.replace(/^[<(["']+|[>)\]"',;:]+$/g, '').trim();
  return email;
}

/**
 * Validate an email address format and domain.
 * Supports any valid domain/TLD (.com, .in, .co.in, .org, .net, .io, .ai, .co, .edu, .gov, etc.)
 * Detects common typos like @gamil.com without hard-coding it as valid.
 */
function validateEmail(raw) {
  if (!raw || (typeof raw !== 'string' && typeof raw !== 'number')) {
    return { valid: false, reason: 'Empty or missing email' };
  }

  const extracted = extractEmail(String(raw));
  if (!extracted) {
    return { valid: false, reason: 'No valid email syntax found in cell' };
  }

  const trimmed = extracted.trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: 'Empty email' };
  }

  const atParts = trimmed.split('@');
  if (atParts.length !== 2) {
    return { valid: false, reason: "Must contain exactly one '@' symbol" };
  }

  const [localPart, domain] = atParts;
  if (!localPart || localPart.length === 0) {
    return { valid: false, reason: 'Missing email username/local-part' };
  }

  if (!domain || !domain.includes('.')) {
    return { valid: false, reason: 'Missing domain extension' };
  }

  if (domain.startsWith('.') || domain.endsWith('.')) {
    return { valid: false, reason: 'Invalid domain syntax' };
  }

  if (domain.includes('..')) {
    return { valid: false, reason: 'Consecutive dots in domain' };
  }

  const domainLower = domain.toLowerCase();

  // Defensive typo detection for common misspellings (e.g. gamil instead of gmail)
  if (domainLower === 'gamil.com' || domainLower === 'gnail.com' || domainLower === 'gmial.com') {
    return { valid: false, reason: `Probable typo in domain "@${domain}" (did you mean @gmail.com?)` };
  }
  if (domainLower === 'yaho.com' || domainLower === 'yahooo.com') {
    return { valid: false, reason: `Probable typo in domain "@${domain}" (did you mean @yahoo.com?)` };
  }
  if (domainLower === 'hotmial.com' || domainLower === 'outlok.com') {
    return { valid: false, reason: `Probable typo in domain "@${domain}"` };
  }

  // TLD check (must have at least a 2-character alphabetic TLD like .com, .in, .co.in, .ai, .org)
  const tldMatch = domain.match(/\.([A-Za-z]{2,})$/);
  if (!tldMatch) {
    return { valid: false, reason: 'Invalid or missing top-level domain (TLD)' };
  }

  return {
    valid: true,
    cleanEmail: trimmed.toLowerCase(),
    original: trimmed
  };
}

/**
 * Clean extracted name candidate by removing prefixes, quotes, and emails
 */
function cleanPersonName(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let str = raw.trim();

  // Strip prefixes like "Name:", "HR Name:", "Recruiter:", "Contact Person:"
  str = str.replace(/^(name|hr name|recruiter name|recruiter|contact name|contact person|contact|hiring manager|full name|candidate)\s*[:-|]\s*/i, '');
  // Strip surrounding quotes or parentheses
  str = str.replace(/^["'`(]+|[)"'`]+$/g, '').trim();
  // Strip any email address inside the text
  str = str.replace(/<[^>]+>/g, '').replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i, '').trim();
  // Strip trailing punctuation like hyphens or colons
  str = str.replace(/[-–|,;:]+$/, '').trim();
  return str;
}

/**
 * Check if a cell string looks like a person's name
 */
function looksLikePersonName(val) {
  if (!val || typeof val !== 'string') return false;
  const s = cleanPersonName(val);
  if (s.length < 2 || s.length > 60) return false;
  if (EMAIL_REGEX.test(s)) return false;
  if (/^https?:\/\/|www\./i.test(s)) return false;
  if (/^\+?\d[\d\s\-()]+$/.test(s)) return false; // numbers or phone
  if (/^(yes|no|true|false|na|n\/a|null|undefined)$/i.test(s)) return false;

  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 5) return false;

  // Allow alphabetic characters, hyphens, periods, apostrophes, international accents
  return /^[A-Za-zÀ-ÖØ-öø-ÿ'.-]+( [A-Za-zÀ-ÖØ-öø-ÿ'.-]+)*$/.test(s);
}

/**
 * Try to extract a person's name from an email cell with additional text
 * e.g. "Jessica Taylor <jessica@openai.com>" -> "Jessica Taylor"
 *      "HR Team - Jessica Doe (jessica@company.com)" -> "Jessica Doe"
 */
function extractNameFromEmailCell(cellText, extractedEmail) {
  if (!cellText || typeof cellText !== 'string') return '';
  let text = cellText;
  if (extractedEmail) {
    text = text.replace(extractedEmail, '');
  }
  text = text.replace(/<|>|\(|\)|\[|\]|"|'/g, ' ').trim();
  text = text.replace(/^(contact|reach out to|email|write to|hr team|hr|recruiter)\s*[:-|]?\s*/i, '');
  text = text.replace(/\s+(at|for|via|regarding).*$/i, '');
  text = text.replace(/[-–|:]+$/, '').trim();

  if (looksLikePersonName(text)) {
    return cleanPersonName(text);
  }
  return '';
}

/**
 * Detect sheet with HR/contact data from workbook
 */
function findBestSheetName(workbook) {
  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) return null;
  if (sheetNames.length === 1) return sheetNames[0];

  const hrSheetRegex = /hr|recruiter|contact|lead|candidate|people|talent|email|outreach/i;
  for (const name of sheetNames) {
    if (hrSheetRegex.test(name)) {
      return name;
    }
  }

  // Check each sheet to see which one has the most emails / data rows
  let bestName = sheetNames[0];
  let maxEmails = -1;

  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    let emailCount = 0;
    for (const row of json.slice(0, 25)) {
      if (Array.isArray(row)) {
        for (const cell of row) {
          if (cell && extractEmail(String(cell))) {
            emailCount++;
          }
        }
      }
    }
    if (emailCount > maxEmails) {
      maxEmails = emailCount;
      bestName = name;
    }
  }

  return bestName;
}

/**
 * Smart detection of header row in Excel sheet data.
 * Handles cases where row 0 contains title/notes or when sheet has no headers.
 */
function detectHeaderRowIndex(jsonData) {
  if (!jsonData || jsonData.length === 0) return -1;
  const headerKeywords = /email|mail|name|recruiter|hr|contact|hiring|company|role|title|position|firm|org|jd|job/i;

  let bestIndex = -1;
  let highestScore = -1;

  const maxInspect = Math.min(jsonData.length, 20);
  for (let r = 0; r < maxInspect; r++) {
    const row = jsonData[r];
    if (!row || !Array.isArray(row)) continue;

    const nonEmptyCells = row.filter(c => c !== undefined && c !== null && String(c).trim() !== '');
    if (nonEmptyCells.length === 0) continue;

    const hasActualEmail = nonEmptyCells.some(c => extractEmail(String(c)));

    let score = 0;
    nonEmptyCells.forEach(cell => {
      const norm = normalizeHeader(String(cell));
      if (headerKeywords.test(norm)) {
        score += 2;
        if (/email|mail/.test(norm)) score += 3;
        if (/name|recruiter|hr/.test(norm)) score += 3;
      }
    });

    // If row contains actual email addresses, it's likely a data row, not a header row
    if (hasActualEmail) {
      score -= 5;
    }

    if (score > highestScore && score >= 2) {
      highestScore = score;
      bestIndex = r;
    }
  }

  // If no high-confidence header row found:
  if (bestIndex === -1) {
    for (let r = 0; r < maxInspect; r++) {
      const row = jsonData[r];
      if (row && row.some(c => c && String(c).trim())) {
        // If first non-empty row contains an email, data starts on row 0 without headers!
        if (row.some(c => extractEmail(String(c)))) {
          return -1;
        }
        return r;
      }
    }
  }

  return bestIndex;
}

/**
 * Analyze headers and find column mappings using priority rules.
 * Preferred order for Name:
 *   1. HR Name
 *   2. Recruiter Name
 *   3. Recruiter
 *   4. Hiring Manager Name
 *   5. Hiring Manager
 *   6. Contact Name
 *   7. Full Name
 *   8. Name
 *   9. Candidate / Contact Person
 *   10. First Name + Last Name compound
 */
function analyzeHeaders(rawHeaders) {
  const normHeaders = rawHeaders.map(h => normalizeHeader(h));

  // Name Priorities
  const namePriorities = [
    { priority: 1, type: 'hr_name', test: h => /^hr\s*name$/.test(h) || /^hr\s*contact\s*name$/.test(h) || /^hr\s*full\s*name$/.test(h) || /^hrname$/.test(h) },
    { priority: 2, type: 'recruiter_name', test: h => /^recruiter\s*name$/.test(h) || /^recruiter\s*full\s*name$/.test(h) || /^recruitername$/.test(h) },
    { priority: 3, type: 'recruiter', test: h => /^recruiter$/.test(h) || /^recruiters$/.test(h) },
    { priority: 4, type: 'hiring_mgr_name', test: h => /^hiring\s*manager\s*name$/.test(h) },
    { priority: 5, type: 'hiring_mgr', test: h => /^hiring\s*manager$/.test(h) || /^hiring\s*mgr$/.test(h) },
    { priority: 6, type: 'contact_name', test: h => /^contact\s*name$/.test(h) || /^contact\s*person\s*name$/.test(h) || /^contactname$/.test(h) },
    { priority: 7, type: 'full_name', test: h => /^full\s*name$/.test(h) || /^fullname$/.test(h) || /^candidate\s*name$/.test(h) },
    { priority: 8, type: 'name', test: h => /^name$/.test(h) || /^person\s*name$/.test(h) || /^person$/.test(h) },
    { priority: 9, type: 'contact_person', test: h => /^contact\s*person$/.test(h) || /^contact$/.test(h) }
  ];

  let bestNameMatch = null;
  for (const p of namePriorities) {
    for (let i = 0; i < normHeaders.length; i++) {
      const h = normHeaders[i];
      // Defensive: Ensure company, firm, org, role, title are NEVER matched as Person Name
      if (/company|firm|org|employer|agency|client|title|role|position|job/i.test(h)) continue;
      if (p.test(h)) {
        bestNameMatch = { colIndex: i, header: rawHeaders[i], norm: h, priority: p.priority, type: p.type };
        break;
      }
    }
    if (bestNameMatch) break;
  }

  // Compound Name Columns (First Name & Last Name)
  let firstNameIdx = -1;
  let lastNameIdx = -1;
  for (let i = 0; i < normHeaders.length; i++) {
    const h = normHeaders[i];
    if (/^first\s*name$/.test(h) || /^fname$/.test(h) || /^given\s*name$/.test(h)) firstNameIdx = i;
    if (/^last\s*name$/.test(h) || /^lname$/.test(h) || /^surname$/.test(h) || /^family\s*name$/.test(h)) lastNameIdx = i;
  }

  // Email Priorities
  const emailPriorities = [
    { priority: 1, type: 'hr_email', test: h => /^hr\s*e?mail(\s*address|\s*id)?$/.test(h) || /^hremail$/.test(h) },
    { priority: 2, type: 'recruiter_email', test: h => /^recruiter\s*e?mail(\s*address|\s*id)?$/.test(h) || /^recruiteremail$/.test(h) },
    { priority: 3, type: 'contact_email', test: h => /^contact\s*e?mail(\s*address|\s*id)?$/.test(h) || /^contactemail$/.test(h) },
    { priority: 4, type: 'hiring_mgr_email', test: h => /^hiring\s*(manager\s*)?e?mail(\s*address|\s*id)?$/.test(h) },
    { priority: 5, type: 'email', test: h => /^(email|e\s*mail|mail)(\s*address|\s*id)?$/.test(h) },
    { priority: 6, type: 'contains_email', test: h => /email|mail/i.test(h) && !/template|campaign|status|sent|draft/i.test(h) }
  ];

  let bestEmailMatch = null;
  for (const p of emailPriorities) {
    for (let i = 0; i < normHeaders.length; i++) {
      const h = normHeaders[i];
      if (p.test(h)) {
        bestEmailMatch = { colIndex: i, header: rawHeaders[i], norm: h, priority: p.priority, type: p.type };
        break;
      }
    }
    if (bestEmailMatch) break;
  }

  // Company Match
  let companyIdx = -1;
  let companyHeader = null;
  for (let i = 0; i < normHeaders.length; i++) {
    const h = normHeaders[i];
    if (/^company(\s*name)?$/.test(h) || /^organization(\s*name)?$/.test(h) || /^organisation(\s*name)?$/.test(h) || /^firm(\s*name)?$/.test(h) || /^employer$/.test(h) || /^client$/.test(h)) {
      companyIdx = i;
      companyHeader = rawHeaders[i];
      break;
    }
  }

  // Role Match
  let roleIdx = -1;
  let roleHeader = null;
  for (let i = 0; i < normHeaders.length; i++) {
    const h = normHeaders[i];
    if (/^role$/.test(h) || /^target\s*role$/.test(h) || /^job\s*title$/.test(h) || /^title$/.test(h) || /^position$/.test(h) || /^designation$/.test(h) || /^job$/.test(h)) {
      roleIdx = i;
      roleHeader = rawHeaders[i];
      break;
    }
  }

  // Job Description Match
  let jdIdx = -1;
  let jdHeader = null;
  for (let i = 0; i < normHeaders.length; i++) {
    const h = normHeaders[i];
    if (/^(job\s*description|jd|job\s*details|role\s*description|job\s*desc)$/i.test(h)) {
      jdIdx = i;
      jdHeader = rawHeaders[i];
      break;
    }
  }

  return {
    bestNameMatch,
    firstNameIdx,
    lastNameIdx,
    bestEmailMatch,
    companyIdx,
    companyHeader,
    roleIdx,
    roleHeader,
    jdIdx,
    jdHeader,
    rawHeaders,
    normHeaders
  };
}

/**
 * Process Excel/CSV sheet row-by-row and extract verified recipient records.
 *
 * Guarantees:
 * 1. ROW 1 -> Email 1 -> Name 1
 *    ROW 2 -> Email 2 -> Name 2
 *    ROW 3 -> Email 3 -> Name 3
 * 2. Never combines an email from one row with a name from another row.
 * 3. Extracts clean email via regex even if cell has additional text.
 * 4. Normalizes headers case-insensitively.
 * 5. Uses prioritized name detection from the SAME row.
 */
function parseRecipientSheet(filePath, originalFilename, options = {}) {
  const contactedMap = options.contactedMap || new Map();
  const ext = path.extname(originalFilename || filePath).toLowerCase();
  if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
    throw new Error('Unsupported recipient list format. Please upload an Excel (.xlsx, .xls) or CSV file.');
  }

  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = findBestSheetName(workbook);
  if (!sheetName) {
    throw new Error('Spreadsheet contains no sheets or data.');
  }

  const worksheet = workbook.Sheets[sheetName];
  const jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: '', header: 1 });

  if (!jsonData || jsonData.length === 0) {
    throw new Error('Spreadsheet is empty.');
  }

  // Detect header row index
  const headerRowIndex = detectHeaderRowIndex(jsonData);

  let rawHeaders = [];
  let dataRows = [];

  if (headerRowIndex === -1) {
    // No header row: first row is data. Create generic Column A, B, C...
    const colCount = Math.max(...jsonData.map(r => (Array.isArray(r) ? r.length : 0)), 1);
    rawHeaders = Array.from({ length: colCount }, (_, i) => `Column ${String.fromCharCode(65 + i)}`);
    dataRows = jsonData;
  } else {
    rawHeaders = (jsonData[headerRowIndex] || []).map(h => String(h || '').trim());
    dataRows = jsonData.slice(headerRowIndex + 1);
  }

  // Analyze headers
  const headerAnalysis = analyzeHeaders(rawHeaders);
  const {
    bestNameMatch,
    firstNameIdx,
    lastNameIdx,
    bestEmailMatch,
    companyIdx,
    roleIdx,
    jdIdx
  } = headerAnalysis;

  const rows = [];
  const seenEmails = new Set();

  dataRows.forEach((rowArr, index) => {
    // Skip completely empty rows
    if (!rowArr || !Array.isArray(rowArr) || rowArr.every(cell => !cell || String(cell).trim() === '')) {
      return;
    }

    const excelRowNum = (headerRowIndex >= 0 ? headerRowIndex + 1 : 0) + index + 1;

    // Build raw row object with headers preserved
    const rowObj = {};
    rawHeaders.forEach((header, idx) => {
      rowObj[header] = rowArr[idx] !== undefined ? String(rowArr[idx]).trim() : '';
    });

    // -------------------------------------------------------------
    // STEP 1: Identify Email Address strictly from THIS ROW
    // -------------------------------------------------------------
    let rawEmailVal = '';
    let emailCellIdx = -1;

    // Check designated email column first if matched
    if (bestEmailMatch && bestEmailMatch.colIndex < rowArr.length) {
      const cellVal = rowArr[bestEmailMatch.colIndex];
      if (cellVal !== undefined && cellVal !== null) {
        const extracted = extractEmail(String(cellVal));
        if (extracted) {
          rawEmailVal = String(cellVal).trim();
          emailCellIdx = bestEmailMatch.colIndex;
        }
      }
    }

    // If no email found in designated column, scan ALL cells in THIS exact row
    if (!rawEmailVal) {
      for (let c = 0; c < rowArr.length; c++) {
        const cellVal = rowArr[c];
        if (cellVal !== undefined && cellVal !== null) {
          const extracted = extractEmail(String(cellVal));
          if (extracted) {
            rawEmailVal = String(cellVal).trim();
            emailCellIdx = c;
            break;
          }
        }
      }
    }

    // Validate email format and domain
    const emailValidation = validateEmail(rawEmailVal);
    const cleanEmail = emailValidation.valid
      ? emailValidation.cleanEmail
      : (extractEmail(rawEmailVal) || rawEmailVal.trim().toLowerCase());

    // -------------------------------------------------------------
    // STEP 2: Identify HR / Contact Name strictly from the SAME ROW
    // -------------------------------------------------------------
    let extractedName = '';
    let rawNameVal = '';
    let nameDetectionMethod = 'none';

    // Priority A: Check matched name column (HR Name > Recruiter Name > Recruiter > Hiring Manager > etc.)
    if (bestNameMatch && bestNameMatch.colIndex < rowArr.length) {
      const cellVal = rowArr[bestNameMatch.colIndex];
      if (cellVal !== undefined && cellVal !== null && String(cellVal).trim()) {
        const candidate = cleanPersonName(String(cellVal));
        if (candidate) {
          rawNameVal = String(cellVal).trim();
          extractedName = candidate;
          nameDetectionMethod = bestNameMatch.type;
        }
      }
    }

    // Priority B: Check First Name + Last Name compound columns
    if (!extractedName && firstNameIdx !== -1 && firstNameIdx < rowArr.length) {
      const fVal = String(rowArr[firstNameIdx] || '').trim();
      const lVal = lastNameIdx !== -1 && lastNameIdx < rowArr.length ? String(rowArr[lastNameIdx] || '').trim() : '';
      if (fVal || lVal) {
        rawNameVal = [fVal, lVal].filter(Boolean).join(' ');
        extractedName = cleanPersonName(rawNameVal);
        nameDetectionMethod = 'compound_first_last';
      }
    }

    // Priority C: Fallback to other cells in the EXACT SAME ROW
    if (!extractedName) {
      for (let c = 0; c < rowArr.length; c++) {
        if (c === emailCellIdx || c === companyIdx || c === roleIdx) continue;
        const cellVal = rowArr[c];
        if (cellVal && looksLikePersonName(String(cellVal))) {
          rawNameVal = String(cellVal).trim();
          extractedName = cleanPersonName(rawNameVal);
          nameDetectionMethod = 'row_heuristic';
          break;
        }
      }
    }

    // Priority D: If still no name, check if email cell itself had person's name
    if (!extractedName && emailCellIdx !== -1) {
      const nameFromEmailCell = extractNameFromEmailCell(rowArr[emailCellIdx], cleanEmail);
      if (nameFromEmailCell) {
        rawNameVal = rowArr[emailCellIdx];
        extractedName = nameFromEmailCell;
        nameDetectionMethod = 'email_cell_name';
      }
    }

    // -------------------------------------------------------------
    // STEP 3: Identify Company, Role, and Job Description from the SAME ROW
    // -------------------------------------------------------------
    const rawCompany = companyIdx !== -1 && companyIdx < rowArr.length ? String(rowArr[companyIdx] || '').trim() : '';
    const rawRole = roleIdx !== -1 && roleIdx < rowArr.length ? String(rowArr[roleIdx] || '').trim() : '';
    const rawJd = jdIdx !== -1 && jdIdx < rowArr.length ? String(rowArr[jdIdx] || '').trim() : '';

    // Check for duplicate in this sheet
    const isDuplicate = cleanEmail ? seenEmails.has(cleanEmail) : false;
    if (cleanEmail) seenEmails.add(cleanEmail);

    // Cross-session duplicate check against audit history (logs.json)
    const previousContact = cleanEmail ? contactedMap.get(cleanEmail) : null;
    const isPreviouslyContacted = Boolean(previousContact);
    const lastContactedDate = previousContact ? previousContact.dateStr : null;

    const isValidEmail = emailValidation.valid && !isDuplicate;
    // Don't auto-select duplicates, invalid emails, OR previously contacted recruiters
    const shouldSelect = isValidEmail && !isPreviouslyContacted;

    let errorReason = null;
    if (isDuplicate) {
      errorReason = 'Duplicate email address in sheet';
    } else if (!emailValidation.valid) {
      errorReason = emailValidation.reason;
    } else if (isPreviouslyContacted) {
      errorReason = `Previously contacted on ${new Date(lastContactedDate).toLocaleDateString()}`;
    }

    rows.push({
      id: `rec_${index + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      rowIndex: index + 1,
      excelRowNum,
      email: cleanEmail,
      rawEmail: rawEmailVal,
      name: extractedName,
      rawName: rawNameVal,
      nameDetectionMethod,
      company: rawCompany,
      role: rawRole,
      jobDescription: rawJd,
      isValidEmail,
      isDuplicate,
      isPreviouslyContacted,
      lastContactedDate,
      errorReason,
      isSelected: shouldSelect,
      isApproved: false, // Requires explicit user approval
      source: 'excel',
      rawRowData: rowObj
    });
  });

  const validCount = rows.filter(r => r.isValidEmail).length;
  const invalidCount = rows.length - validCount;
  const previouslyContactedCount = rows.filter(r => r.isPreviouslyContacted).length;

  return {
    filename: originalFilename || path.basename(filePath),
    sheetName,
    sheetNames: workbook.SheetNames,
    headers: rawHeaders,
    headerRowIndex,
    columnMapping: {
      emailCol: bestEmailMatch ? bestEmailMatch.header : null,
      nameCol: bestNameMatch ? bestNameMatch.header : null,
      companyCol: headerAnalysis.companyHeader,
      roleCol: headerAnalysis.roleHeader,
      jdCol: headerAnalysis.jdHeader
    },
    totalCount: rows.length,
    validCount,
    invalidCount,
    previouslyContactedCount,
    rows
  };
}

module.exports = {
  parseRecipientSheet,
  validateEmail,
  extractEmail,
  normalizeHeader,
  cleanPersonName
};
