/**
 * Generic, Schema-Agnostic JSON Repair Engine
 * Recovers valid JSON objects from raw LLM responses.
 * Handles markdown fences, preamble/postscript conversation, unescaped characters, and trailing commas.
 */

/**
 * Escapes unescaped control characters inside JSON string literals
 */
function normalizeControlCharacters(str) {
  if (!str || typeof str !== 'string') return '';
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (char === '"' && !escaped) {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
        result += char;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        result += char;
        continue;
      }

      if (char === '\n') {
        result += '\\n';
        continue;
      }

      if (char === '\r') {
        continue;
      }

      if (char === '\t') {
        result += '\\t';
        continue;
      }
    }

    result += char;
  }

  return result;
}

/**
 * Extracts and parses a JSON object from arbitrary raw text.
 * @param {string} rawText
 * @returns {object|null}
 */
function extractJsonObject(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  let text = rawText.trim();

  // 1. Strip markdown code fences if present anywhere in text
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // 2. Extract outermost braces
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1).trim();
  }

  // 3. Fast-path direct JSON.parse
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}

  // 4. Normalize control characters (newlines, tabs in strings)
  const normalized = normalizeControlCharacters(text);
  try {
    const parsed = JSON.parse(normalized);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}

  // 5. Repair trailing commas before closing braces/brackets
  let repaired = normalized.replace(/,\s*([\}\]])/g, '$1');

  // Repair unclosed outer brace if response was truncated
  if (repaired.startsWith('{') && !repaired.endsWith('}')) {
    repaired += '\n}';
  }

  try {
    const parsed = JSON.parse(repaired);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}

  // 6. Relaxed single-quote replacement if model output Python-style dict
  try {
    if (repaired.includes("'") && !repaired.includes('"')) {
      const doubleQuoted = repaired.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
      const parsed = JSON.parse(doubleQuoted);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}

  return null;
}

module.exports = {
  extractJsonObject,
  normalizeControlCharacters
};
