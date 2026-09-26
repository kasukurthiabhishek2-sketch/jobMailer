const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');
const fs = require('fs');

/**
 * Extract email from text
 */
function extractEmail(text) {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : null;
}

/**
 * Extract phone from text
 */
function extractPhone(text) {
  const match = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  return match ? match[0] : null;
}

/**
 * Extract name heuristic from top of resume
 */
function extractName(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    // Candidate name usually doesn't have @ or numbers or common words like Resume, Curriculum, etc.
    if (
      line.length > 2 &&
      line.length < 40 &&
      !line.includes('@') &&
      !line.includes('http') &&
      !/\d/.test(line) &&
      !/curriculum|resume|profile|summary|contact/i.test(line)
    ) {
      return line;
    }
  }
  return null;
}

/**
 * Parses PDF or DOCX file buffer and returns clean text & metadata
 */
async function parseResumeFile(filePath, originalFilename) {
  const ext = path.extname(originalFilename || filePath).toLowerCase();
  let rawText = '';

  const buffer = fs.readFileSync(filePath);

  if (ext === '.pdf') {
    const data = await pdfParse(buffer);
    rawText = data.text || '';
  } else if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    rawText = result.value || '';
  } else if (ext === '.txt') {
    rawText = buffer.toString('utf8');
  } else {
    throw new Error(`Unsupported resume format: ${ext}. Please upload a PDF or DOCX file.`);
  }

  // Clean text
  const cleanText = rawText
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleanText || cleanText.length < 20) {
    throw new Error('Could not extract readable text from the uploaded file. Please ensure the file is not scanned/empty.');
  }

  const detectedName = extractName(cleanText);
  const detectedEmail = extractEmail(cleanText);
  const detectedPhone = extractPhone(cleanText);
  const wordCount = cleanText.split(/\s+/).length;

  return {
    rawText: cleanText,
    summarySnippet: cleanText.slice(0, 300) + (cleanText.length > 300 ? '...' : ''),
    wordCount,
    detectedName,
    detectedEmail,
    detectedPhone,
    originalFilename,
    filePath
  };
}

module.exports = {
  parseResumeFile
};
