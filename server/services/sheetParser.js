const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validate an email address format
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Empty or missing email' };
  }
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: 'Empty email' };
  }
  if (!trimmed.includes('@')) {
    return { valid: false, reason: 'Missing @ symbol' };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, reason: 'Malformed email syntax' };
  }
  return { valid: true };
}

/**
 * Identify column mappings from header names
 */
function detectColumns(headers) {
  const mapping = {
    emailCol: null,
    nameCol: null,
    companyCol: null,
    roleCol: null
  };

  headers.forEach(header => {
    const norm = String(header).toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!mapping.emailCol && (norm.includes('email') || norm === 'mail' || norm === 'contactemail')) {
      mapping.emailCol = header;
    } else if (!mapping.nameCol && (norm.includes('name') || norm.includes('recruiter') || norm.includes('contact') || norm === 'person')) {
      mapping.nameCol = header;
    } else if (!mapping.companyCol && (norm.includes('company') || norm.includes('org') || norm.includes('firm') || norm.includes('employer'))) {
      mapping.companyCol = header;
    } else if (!mapping.roleCol && (norm.includes('role') || norm.includes('title') || norm.includes('position') || norm.includes('job'))) {
      mapping.roleCol = header;
    }
  });

  return mapping;
}

/**
 * Parse .xlsx, .xls, or .csv file and extract recipient list
 */
function parseRecipientSheet(filePath, originalFilename) {
  const ext = path.extname(originalFilename || filePath).toLowerCase();
  if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
    throw new Error('Unsupported recipient list format. Please upload an Excel (.xlsx, .xls) or CSV file.');
  }

  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Spreadsheet contains no sheets.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: '', header: 1 });

  if (!jsonData || jsonData.length === 0) {
    throw new Error('Spreadsheet is empty.');
  }

  // Find header row (first non-empty row)
  let headerRowIndex = 0;
  while (headerRowIndex < jsonData.length && (!jsonData[headerRowIndex] || jsonData[headerRowIndex].filter(Boolean).length === 0)) {
    headerRowIndex++;
  }

  if (headerRowIndex >= jsonData.length) {
    throw new Error('Could not find any data in the file.');
  }

  const rawHeaders = jsonData[headerRowIndex].map(h => String(h || '').trim());
  const colMapping = detectColumns(rawHeaders);

  // If email column wasn't identified by header, check rows to find column with most emails
  if (!colMapping.emailCol) {
    const colEmailCounts = rawHeaders.map(() => 0);
    const inspectRows = jsonData.slice(headerRowIndex + 1, Math.min(jsonData.length, headerRowIndex + 20));
    
    inspectRows.forEach(row => {
      row.forEach((cell, idx) => {
        if (cell && typeof cell === 'string' && EMAIL_REGEX.test(cell.trim())) {
          colEmailCounts[idx]++;
        }
      });
    });

    const maxCount = Math.max(...colEmailCounts, 0);
    if (maxCount > 0) {
      const bestIdx = colEmailCounts.indexOf(maxCount);
      colMapping.emailCol = rawHeaders[bestIdx];
    }
  }

  const rows = [];
  const rawDataRows = jsonData.slice(headerRowIndex + 1);

  rawDataRows.forEach((rowArr, index) => {
    // Skip completely empty rows
    if (!rowArr || rowArr.every(cell => !cell || String(cell).trim() === '')) {
      return;
    }

    // Convert row array to object based on headers
    const rowObj = {};
    rawHeaders.forEach((header, idx) => {
      rowObj[header] = rowArr[idx] !== undefined ? String(rowArr[idx]).trim() : '';
    });

    const rawEmail = colMapping.emailCol ? rowObj[colMapping.emailCol] : '';
    const rawName = colMapping.nameCol ? rowObj[colMapping.nameCol] : '';
    const rawCompany = colMapping.companyCol ? rowObj[colMapping.companyCol] : '';
    const rawRole = colMapping.roleCol ? rowObj[colMapping.roleCol] : '';

    const validation = validateEmail(rawEmail);

    rows.push({
      id: `rec_${index + 1}_${Date.now()}`,
      rowIndex: index + 1,
      email: rawEmail,
      name: rawName,
      company: rawCompany,
      role: rawRole,
      isValidEmail: validation.valid,
      errorReason: validation.valid ? null : validation.reason,
      isSelected: validation.valid, // Select valid rows by default
      rawRowData: rowObj
    });
  });

  const validCount = rows.filter(r => r.isValidEmail).length;
  const invalidCount = rows.length - validCount;

  return {
    filename: originalFilename || path.basename(filePath),
    sheetName: firstSheetName,
    headers: rawHeaders,
    columnMapping: colMapping,
    totalCount: rows.length,
    validCount,
    invalidCount,
    rows
  };
}

module.exports = {
  parseRecipientSheet,
  validateEmail
};
