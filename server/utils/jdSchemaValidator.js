/**
 * Canonical Schema Definition and Grounding Validator for Job Description Parsing
 * Pure Node.js (Zero external dependencies).
 */

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const SYSTEM_EMAIL_PREFIXES = [
  'noreply', 'no-reply', 'privacy', 'dpo', 'legal', 'security',
  'compliance', 'abuse', 'accessibility', 'terms', 'press', 'media', 'support'
];

const PLATFORM_DOMAINS = [
  'greenhouse.io', 'lever.co', 'workday.com', 'myworkdayjobs.com',
  'ashbyhq.com', 'smartrecruiters.com', 'icims.com', 'taleo.net',
  'jobvite.com', 'bamboohr.com', 'sentry.io', 'example.com'
];

const PLACEHOLDER_STRINGS = new Set([
  'company name', 'job title', 'their title', 'person name',
  'email@example.com', 'unknown', 'n/a', 'not specified',
  'placeholder', 'sample', 'none', 'null', 'undefined'
]);

function isPlaceholder(val) {
  if (!val || typeof val !== 'string') return true;
  return PLACEHOLDER_STRINGS.has(val.trim().toLowerCase());
}

/**
 * Validates that an email is structurally sound, not a placeholder, and not a platform/system address.
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(trimmed)) return false;

  const [prefix, domain] = trimmed.split('@');
  if (!prefix || !domain) return false;

  if (SYSTEM_EMAIL_PREFIXES.some(p => prefix === p || prefix.startsWith(`${p}-`) || prefix.startsWith(`${p}.`))) {
    return false;
  }
  if (PLATFORM_DOMAINS.some(d => domain === d || domain.endsWith(`.${d}`))) {
    return false;
  }
  return true;
}

/**
 * Validates, normalizes, and source-grounds parsed AI JD output against source text.
 * @param {object} parsed - The parsed output from AI or heuristic extractor
 * @param {string} rawText - Original raw input text
 * @param {object} deterministic - Optional deterministic facts (from JSON-LD or page metadata)
 * @returns {{ valid: boolean, errors: string[], data: object }}
 */
function validateAndNormalizeJd(parsed, rawText = '', deterministic = {}) {
  const errors = [];
  const flags = [];
  const textLower = (rawText || '').toLowerCase();

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      valid: false,
      errors: ['Output must be a valid JSON object.'],
      data: null
    };
  }

  // 1. Company: prioritize deterministic data if present and valid
  let company = typeof parsed.company === 'string' ? parsed.company.trim() : '';
  if (isPlaceholder(company)) company = '';
  if (!company && deterministic && typeof deterministic.company === 'string' && deterministic.company.trim()) {
    company = deterministic.company.trim();
  }

  const companyVerified = Boolean(
    company && (
      textLower.includes(company.toLowerCase()) ||
      (deterministic && deterministic.company && deterministic.company.toLowerCase() === company.toLowerCase())
    )
  );
  if (company && !companyVerified) {
    flags.push('company_not_grounded_in_text');
  }

  // 2. Role / Job Title
  let role = typeof parsed.role === 'string' ? parsed.role.trim() : '';
  if (isPlaceholder(role)) role = '';
  if (!role && deterministic && typeof deterministic.role === 'string' && deterministic.role.trim()) {
    role = deterministic.role.trim();
  }

  const roleVerified = Boolean(
    role && (
      textLower.includes(role.toLowerCase()) ||
      (deterministic && deterministic.role && deterministic.role.toLowerCase() === role.toLowerCase())
    )
  );
  if (role && !roleVerified) {
    flags.push('role_not_grounded_in_text');
  }

  // 3. Location
  let location = typeof parsed.location === 'string' ? parsed.location.trim() : '';
  if (isPlaceholder(location)) location = '';
  if (!location && deterministic && typeof deterministic.location === 'string' && deterministic.location.trim()) {
    location = deterministic.location.trim();
  }

  // 4. Contacts (Email, Name, Title)
  let rawContacts = Array.isArray(parsed.contacts) ? parsed.contacts : [];
  if (typeof parsed.contacts === 'string' && parsed.contacts.includes('@')) {
    rawContacts = [{ email: parsed.contacts.trim() }];
  }

  const validContacts = [];
  const seenEmails = new Set();

  for (const c of rawContacts) {
    if (!c || typeof c !== 'object') continue;
    const email = typeof c.email === 'string' ? c.email.trim() : '';
    if (!isValidEmail(email)) continue;

    const emailLower = email.toLowerCase();
    if (seenEmails.has(emailLower)) continue;

    // Grounding check: Email must be physically found in raw text or source URL
    const grounded = textLower.includes(emailLower);
    if (!grounded) {
      flags.push(`hallucinated_email_omitted:${email}`);
      continue;
    }

    seenEmails.add(emailLower);

    let name = typeof c.name === 'string' ? c.name.trim() : '';
    if (isPlaceholder(name)) name = '';

    let title = typeof c.title === 'string' ? c.title.trim() : '';
    if (isPlaceholder(title)) title = '';

    validContacts.push({ name, email, title });
  }

  // Also check if any raw emails exist in the source text that AI may have missed
  const directEmailMatches = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  for (const matchedEmail of directEmailMatches) {
    const emailLower = matchedEmail.toLowerCase();
    if (!seenEmails.has(emailLower) && isValidEmail(matchedEmail)) {
      seenEmails.add(emailLower);
      validContacts.push({ name: '', email: matchedEmail, title: '' });
      flags.push(`deterministic_email_recovered:${matchedEmail}`);
    }
  }

  // 5. Responsibilities & Requirements
  const coerceBulletArray = (val) => {
    if (Array.isArray(val)) {
      return val
        .map(v => (typeof v === 'string' ? v.trim() : ''))
        .filter(v => v.length > 5 && !isPlaceholder(v))
        .slice(0, 6);
    }
    if (typeof val === 'string' && val.trim().length > 5) {
      return val
        .split(/\r?\n|•|-/)
        .map(s => s.trim())
        .filter(s => s.length > 5 && !isPlaceholder(s))
        .slice(0, 6);
    }
    return [];
  };

  const responsibilities = coerceBulletArray(parsed.responsibilities);
  const requirements = coerceBulletArray(parsed.requirements);

  // 6. Clean Job Description text (preserve human readability)
  let cleanJd = typeof parsed.jobDescriptionClean === 'string' && parsed.jobDescriptionClean.trim().length >= 20
    ? parsed.jobDescriptionClean.trim()
    : rawText.slice(0, 5000);

  // 7. Calibrated Confidence
  const emailFound = validContacts.length > 0;
  const companyFound = Boolean(company);
  const roleFound = Boolean(role);

  let qualityScore = 0;
  if (companyFound && companyVerified) qualityScore += 0.35;
  else if (companyFound) qualityScore += 0.2;

  if (roleFound && roleVerified) qualityScore += 0.35;
  else if (roleFound) qualityScore += 0.2;

  if (emailFound) qualityScore += 0.3;

  const result = {
    contacts: validContacts,
    company,
    role,
    location,
    responsibilities,
    requirements,
    jobDescriptionClean: cleanJd,
    confidence: {
      emailFound,
      companyFound,
      roleFound,
      qualityScore: Number(qualityScore.toFixed(2)),
      audit: {
        companyVerified,
        roleVerified,
        flags
      }
    }
  };

  // Require at least minimal viable extraction (company or role or some content)
  if (!company && !role && responsibilities.length === 0 && requirements.length === 0 && validContacts.length === 0) {
    errors.push('No viable job description attributes could be identified.');
    return {
      valid: false,
      errors,
      data: result
    };
  }

  return {
    valid: true,
    errors,
    data: result
  };
}

module.exports = {
  validateAndNormalizeJd,
  isValidEmail,
  isPlaceholder
};
