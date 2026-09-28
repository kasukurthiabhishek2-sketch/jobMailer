/**
 * client/src/lib/sanitizeDraft.js
 *
 * Client-Side Defensive Email Draft Sanitizer.
 * Guarantees plain-text output for email subject and body:
 * - Detects and recovers from raw JSON syntax, quotes, and markdown code fences
 * - Strips redundant "Subject:" prefixes and enclosing quotes from subject
 * - Strips code fences, backticks, and unparsed braces from body
 * - Unescapes escaped control characters (\n, \", etc.)
 * - Preserves groundingAudit and other metadata
 */

export function sanitizeDraft(draft, recipient = null) {
  const fallbackCompany = recipient?.company || recipient?.team || 'your team';
  const defaultFallbackSubject = `Exploring Opportunities at ${fallbackCompany}`;

  if (!draft) {
    return {
      subject: defaultFallbackSubject,
      body: '',
      groundingAudit: null
    };
  }

  let rawSubject = '';
  let rawBody = '';
  let groundingAudit = null;

  if (typeof draft === 'string') {
    rawBody = draft;
  } else if (typeof draft === 'object') {
    rawSubject = typeof draft.subject === 'string' ? draft.subject : '';
    rawBody = typeof draft.body === 'string' ? draft.body : (typeof draft.text === 'string' ? draft.text : '');
    groundingAudit = draft.groundingAudit || null;
  }

  let cleanSubject = rawSubject.trim();
  let cleanBody = rawBody.trim();

  // 1. Detect if rawBody contains a full JSON object or markdown-wrapped JSON
  const hasJsonFences = /```(?:json)?\s*\{[\s\S]*\}\s*```/i.test(cleanBody);
  const hasJsonKeys = /(?:"subject"|'subject')\s*:[\s\S]*(?:"body"|'body')\s*:/i.test(cleanBody) ||
                      /(?:"body"|'body')\s*:[\s\S]*(?:"subject"|'subject')\s*:/i.test(cleanBody);
  const startsWithBrace = cleanBody.startsWith('{') && cleanBody.endsWith('}');

  if (hasJsonFences || hasJsonKeys || startsWithBrace) {
    let extracted = null;

    // Stage 1a: Attempt JSON parse on outermost { ... } substring
    const jsonMatch = cleanBody.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        extracted = JSON.parse(jsonMatch[0]);
      } catch {
        // Stage 1b: Attempt repair of unescaped literal newlines inside string literals
        try {
          const repaired = jsonMatch[0].replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/gs, (match) => {
            return match.replace(/\r?\n/g, '\\n');
          });
          extracted = JSON.parse(repaired);
        } catch {
          // Fall through to regex extraction
        }
      }
    }

    // Stage 2: Extract values if JSON parse succeeded, else regex recovery
    if (extracted && typeof extracted === 'object') {
      if (typeof extracted.subject === 'string' && extracted.subject.trim()) {
        cleanSubject = extracted.subject;
      }
      if (typeof extracted.body === 'string') {
        cleanBody = extracted.body;
      }
      if (extracted.groundingAudit) {
        groundingAudit = extracted.groundingAudit;
      }
    } else {
      // Regex field recovery for subject
      const subMatch = cleanBody.match(/(?:"subject"|'subject')\s*:\s*"((?:[^"\\]|\\.)*)"/i);
      if (subMatch && subMatch[1]) {
        cleanSubject = subMatch[1]
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
      }

      // Regex field recovery for body
      const bodyStartMatch = cleanBody.match(/(?:"body"|'body')\s*:\s*"/i);
      if (bodyStartMatch) {
        const afterKey = cleanBody.slice(bodyStartMatch.index + bodyStartMatch[0].length);
        const bodyEndMatch = afterKey.match(/^(.*?)(?<!\\)"\s*(?:\}|$|,\s*["'a-zA-Z])/s);
        if (bodyEndMatch) {
          cleanBody = bodyEndMatch[1];
        } else {
          cleanBody = afterKey.replace(/\s*```\s*$/, '').replace(/"\s*\}?\s*$/, '');
        }
        cleanBody = cleanBody
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
      }
    }
  }

  // 2. Strip any outer markdown code fences from body
  cleanBody = cleanBody.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
  if (cleanBody.includes('```')) {
    cleanBody = cleanBody.replace(/```[a-zA-Z0-9_-]*/g, '').replace(/```/g, '');
  }
  // Strip leading/trailing backticks while leaving inline backticks intact
  cleanBody = cleanBody.replace(/^`+|`+$/g, '').trim();

  // 3. Extract line 1 "Subject:" prefix if inadvertently placed in body
  const bodySubjectLineMatch = cleanBody.match(/^Subject:\s*(.*)(?:\r?\n|$)/i);
  if (bodySubjectLineMatch) {
    const extractedHeader = bodySubjectLineMatch[1].trim();
    if (!cleanSubject || cleanSubject === defaultFallbackSubject || cleanSubject.startsWith('Inquiry:')) {
      cleanSubject = extractedHeader;
    }
    cleanBody = cleanBody.slice(bodySubjectLineMatch[0].length).trim();
  }

  // 4. Sanitize Subject field:
  cleanSubject = cleanSubject.replace(/^Subject:\s*/i, '').trim();

  // Strip wrapping quotes recursively
  let prevSubject = '';
  while (prevSubject !== cleanSubject) {
    prevSubject = cleanSubject;
    if (
      (cleanSubject.startsWith('"') && cleanSubject.endsWith('"') && cleanSubject.length >= 2) ||
      (cleanSubject.startsWith("'") && cleanSubject.endsWith("'") && cleanSubject.length >= 2) ||
      (cleanSubject.startsWith('`') && cleanSubject.endsWith('`') && cleanSubject.length >= 2)
    ) {
      cleanSubject = cleanSubject.slice(1, -1).trim();
    }
    cleanSubject = cleanSubject.replace(/^Subject:\s*/i, '').trim();
  }

  // Ensure subject does not contain raw JSON keys
  if (cleanSubject.includes('"subject"') || cleanSubject.startsWith('{')) {
    const inlineSub = cleanSubject.match(/(?:"subject"|'subject')\s*:\s*"((?:[^"\\]|\\.)*)"/i);
    if (inlineSub) {
      cleanSubject = inlineSub[1].replace(/\\"/g, '"').trim();
    } else {
      cleanSubject = cleanSubject.replace(/[{}[\]"]/g, '').replace(/^subject\s*:\s*/i, '').trim();
    }
  }

  if (!cleanSubject) {
    cleanSubject = defaultFallbackSubject;
  }

  return {
    subject: cleanSubject,
    body: cleanBody,
    groundingAudit
  };
}
