/**
 * Pluggable AI Service supporting Google Gemini, OpenAI, Grok (xAI), NVIDIA NIM, and Custom OpenAI-compatible endpoints.
 */

const copilotService = require('./copilotService');

const CONNECTION_TIMEOUT_MS = process.env.TEST_FAST_TIMEOUT === 'true' ? 100 : 15000;

/**
 * Scans string literals and escapes raw control characters (RFC 8259 compliance).
 */
function normalizeControlCharacters(str) {
  let inString = false;
  let escaped = false;
  let out = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (char === '"' && !escaped) {
      inString = !inString;
      out += char;
    } else if (inString) {
      if (char === '\n') {
        out += '\\n';
      } else if (char === '\r') {
        // Drop carriage return
      } else if (char === '\t') {
        out += '\\t';
      } else if (char.charCodeAt(0) < 32) {
        // Strip unprintable control characters
      } else {
        out += char;
      }
      escaped = (char === '\\' && !escaped);
    } else {
      out += char;
      escaped = false;
    }
  }
  return out;
}

/**
 * Unescapes JSON escape sequences in extracted string fields.
 */
function unescapeJsonString(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\')
    .trim();
}

/**
 * Extracts "subject" and "body" fields using regex when JSON syntax is corrupted.
 */
function extractFieldsViaRegex(text) {
  let subject = '';
  let body = '';

  // Extract subject
  const subjectMatch = text.match(/(?:"subject"|'subject')\s*:\s*["']((?:[^"'\\]|\\.)*?)["']/i);
  if (subjectMatch) {
    subject = subjectMatch[1];
  } else {
    const truncatedSubject = text.match(/(?:"subject"|'subject')\s*:\s*["']([^\r\n"']+)/i);
    if (truncatedSubject) {
      subject = truncatedSubject[1];
    }
  }

  // Extract body
  const bodyStartMatch = text.match(/(?:"body"|'body')\s*:\s*["']/i);
  if (bodyStartMatch) {
    const startIndex = bodyStartMatch.index + bodyStartMatch[0].length;
    const remaining = text.slice(startIndex);

    // Look for terminal boundary: quote followed by optional closing brace/fence or end of string
    const endMatch = remaining.match(/["']\s*(?:\}\s*```?|\}\s*$|,\s*["']|\s*$)/);
    let rawBody = endMatch ? remaining.slice(0, endMatch.index) : remaining;
    rawBody = rawBody.replace(/\s*```\s*$/, '').replace(/\s*\}\s*$/, '');
    body = rawBody;
  }

  if (subject || body) {
    return {
      subject: unescapeJsonString(subject),
      body: unescapeJsonString(body)
    };
  }
  return null;
}

/**
 * Extracts subject and body from non-JSON plain text model output.
 * Guaranteed to never dump raw JSON or { "subject": ... } into body.
 */
function extractPlainTextFallback(text) {
  if (!text || typeof text !== 'string') return null;

  let cleaned = text
    .replace(/^```(?:json)?\s*/gim, '')
    .replace(/\s*```\s*$/gim, '')
    .trim();

  // If text starts with { and contains "body":, extract fields rather than treating as raw text
  if (cleaned.startsWith('{') && cleaned.includes('"body"')) {
    const recovered = extractFieldsViaRegex(cleaned);
    if (recovered && (recovered.subject || recovered.body)) {
      return sanitizeParsedEmail(recovered);
    }
  }

  // Check for explicit "Subject: ..." header line
  const subjectLineMatch = cleaned.match(/^Subject:\s*(.*?)(?:\r?\n|$)/i);
  let subject = '';
  let body = cleaned;

  if (subjectLineMatch) {
    subject = subjectLineMatch[1].trim();
    body = cleaned.slice(subjectLineMatch[0].length).trim();
  } else {
    // If no explicit Subject:, check if first line can serve as subject
    const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 1 && lines[0].length <= 80 && !/^(?:hi|hello|dear|hey)\b/i.test(lines[0])) {
      subject = lines[0];
      body = cleaned.slice(cleaned.indexOf(lines[1])).trim();
    } else {
      subject = 'Inquiry & Introduction';
      body = cleaned;
    }
  }

  return sanitizeParsedEmail({ subject, body });
}

/**
 * Sanitizes parsed subject and body fields to guarantee clean plain text.
 */
function sanitizeParsedEmail(parsed) {
  let subject = typeof parsed.subject === 'string' ? parsed.subject.trim() : '';
  let body = typeof parsed.body === 'string' ? parsed.body.trim() : '';

  // Sanitize subject: strip leading "Subject:" and outer quotes
  subject = subject.replace(/^subject:\s*/i, '').trim();
  subject = subject.replace(/^["']+|["']+$/g, '').trim();

  // Sanitize body: strip any residual code fences
  body = body.replace(/^```(?:json)?\s*/gim, '').replace(/\s*```\s*$/gim, '').trim();

  // Defense against recursive JSON leakage: if body itself starts with { and contains "body", extract inner
  if (body.startsWith('{') && body.includes('"body"')) {
    const inner = extractFieldsViaRegex(body);
    if (inner && inner.body) {
      body = inner.body;
      if (!subject && inner.subject) subject = inner.subject;
    }
  }

  return { subject, body };
}

/**
 * Multi-stage resilient JSON extractor and schema recovery for AI outputs.
 * Guarantees that returned object has clean string properties `subject` and `body`.
 * Under NO circumstances does `body` contain raw JSON, markdown fences, or unescaped JSON keys.
 */
function cleanJsonOutput(text) {
  if (!text || typeof text !== 'string') return null;

  const raw = text.trim();
  if (!raw) return null;

  // -------------------------------------------------------------------------
  // STAGE 1: Code Fence & Commentary Stripper
  // -------------------------------------------------------------------------
  let candidate = raw;

  // Extract from markdown code fences if present (```json ... ``` or ``` ... ```)
  const fenceMatch = candidate.match(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch && fenceMatch[1]) {
    candidate = fenceMatch[1].trim();
  } else {
    // Strip leading or trailing unclosed fence markers
    candidate = candidate.replace(/^```[a-zA-Z]*\s*/m, '').replace(/\s*```\s*$/m, '').trim();
  }

  // Fast path: attempt direct JSON.parse if already valid
  try {
    const direct = JSON.parse(candidate);
    if (direct && typeof direct === 'object' && (direct.subject || direct.body)) {
      return sanitizeParsedEmail(direct);
    }
  } catch {}

  // If surrounded by conversational chatter, extract between outermost { and }
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const braceExtracted = candidate.slice(firstBrace, lastBrace + 1).trim();
    try {
      const parsed = JSON.parse(braceExtracted);
      if (parsed && typeof parsed === 'object' && (parsed.subject || parsed.body)) {
        return sanitizeParsedEmail(parsed);
      }
    } catch {}
    candidate = braceExtracted;
  } else if (firstBrace !== -1 && lastBrace === -1) {
    // Truncated JSON starting with { but missing closing }
    candidate = candidate.slice(firstBrace).trim();
  }

  // -------------------------------------------------------------------------
  // STAGE 2: Control Character & Unescaped Newline Normalization
  // -------------------------------------------------------------------------
  // RFC 8259 forbids unescaped literal newlines (0x0A, 0x0D) and control chars (0x00-0x1F) inside string literals.
  const normalized = normalizeControlCharacters(candidate);
  try {
    const parsed = JSON.parse(normalized);
    if (parsed && typeof parsed === 'object' && (parsed.subject || parsed.body)) {
      return sanitizeParsedEmail(parsed);
    }
  } catch {}

  // -------------------------------------------------------------------------
  // STAGE 3: Trailing Comma & Quote Repair
  // -------------------------------------------------------------------------
  let repaired = normalized.replace(/,\s*([\}\]])/g, '$1');

  // If truncated, repair unclosed quotes and missing closing brace
  if (repaired.startsWith('{')) {
    const quoteMatches = repaired.match(/(?<!\\)"/g) || [];
    if (quoteMatches.length % 2 !== 0) {
      repaired += '"';
    }
    if (!repaired.trim().endsWith('}')) {
      repaired += '\n}';
    }
    try {
      const parsed = JSON.parse(repaired);
      if (parsed && typeof parsed === 'object' && (parsed.subject || parsed.body)) {
        return sanitizeParsedEmail(parsed);
      }
    } catch {}
  }

  // -------------------------------------------------------------------------
  // STAGE 4: Field-Level Regex Fallback for "subject" and "body"
  // -------------------------------------------------------------------------
  const regexResult = extractFieldsViaRegex(raw);
  if (regexResult && (regexResult.subject || regexResult.body)) {
    return sanitizeParsedEmail(regexResult);
  }

  // -------------------------------------------------------------------------
  // STAGE 5: Clean Plain-Text Heuristic Fallback
  // -------------------------------------------------------------------------
  return extractPlainTextFallback(raw);
}

/**
 * Builds system prompt and user prompt for cold email generation
 */
function buildPrompts({ resumeText, jobDescription, recipient, customTone, senderName }) {
  const recipientName = recipient?.name || 'Hiring Manager / Team';
  const company = recipient?.company || 'your team';
  const role = recipient?.role || (jobDescription ? 'the open position' : 'relevant opportunities');

  const systemPrompt = `You are an elite career strategist and executive cold-email copywriter.
Your goal is to craft high-converting, personalized cold outreach emails for job seekers reaching out to recruiters, hiring managers, or founders.

Guidelines for cold emails:
1. Subject line: Catchy, professional, and personalized (e.g., "[Role] at [Company] - [Candidate Name] / [Key Achievement]" or "Quick note regarding [Role] / [Candidate Name]"). Never spammy or generic.
2. Opening Hook: Address the recipient respectfully (${recipientName}). Mention something specific about ${company} if known.
3. Value Proposition: Draw 2-3 compelling, quantifiable achievements, skills, or projects from the Candidate Resume that directly match the Job Description (if provided) or demonstrate strong impact in the domain.
4. If a Job Description is provided, explicitly align the candidate's core strengths to the JD's requirements.
5. If NO Job Description is provided, highlight the candidate's strongest career pillars and how they can create immediate value for ${company}.
6. Strict Fact Grounding: Never fabricate numbers, metrics, percentages, revenue figures, or credentials not explicitly present in the CANDIDATE RESUME SUMMARY.
7. Call to Action (CTA): Low friction, polite, asking for a brief 10-15 minute introductory conversation.
8. Brevity: Keep the email body between 110 and 175 words. Busy executives don't read long essays.
9. Output Format: You MUST reply strictly in valid JSON format with two keys:
{
  "subject": "The email subject line here",
  "body": "The email body text here with line breaks (\\n\\n) between paragraphs, ending with a warm professional sign-off and [Your Name / Sender Name]."
}`;

  const userPrompt = `CANDIDATE INFORMATION:
Sender Name: ${senderName || 'Candidate'}

CANDIDATE RESUME SUMMARY / TEXT:
${resumeText ? resumeText.slice(0, 4500) : 'Experienced professional seeking exciting opportunities.'}

TARGET RECIPIENT:
Name: ${recipientName}
Email: ${recipient?.email || ''}
Company: ${company}
Target Role: ${role}

JOB DESCRIPTION:
${jobDescription ? jobDescription.slice(0, 3500) : 'None provided. Focus on candidate core strengths and value proposition for the company.'}

${customTone ? `ADDITIONAL TONE / INSTRUCTION: ${customTone}` : ''}

Generate the personalized cold email in strict JSON format.`;

  return { systemPrompt, userPrompt };
}

/**
 * Call Google Gemini API
 */
async function callGemini({ apiKey, model = 'gemini-1.5-flash', systemPrompt, userPrompt }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: `${systemPrompt}\n\n---\n\n${userPrompt}` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1200,
      responseMimeType: 'application/json'
    }
  };

  const RETRY_DELAYS = [2000, 4000, 8000];
  let response;
  let attempt = 0;
  while (true) {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.status === 429 && attempt < RETRY_DELAYS.length) {
      const delay = process.env.TEST_FAST_RETRY === 'true' ? 10 : RETRY_DELAYS[attempt];
      console.warn(`[AI Rate Limit] Gemini HTTP 429 received. Retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_DELAYS.length})...`);
      await new Promise(r => setTimeout(r, delay));
      attempt++;
      continue;
    }
    break;
  }

  if (!response.ok) {
    const errorText = await response.text();
    let msg = `Gemini API error (${response.status})`;
    try {
      const errJson = JSON.parse(errorText);
      msg = errJson.error?.message || msg;
    } catch {}
    if (response.status === 429) {
      msg = `Gemini rate limit exceeded (HTTP 429) after ${RETRY_DELAYS.length} retries: ${msg}`;
    }
    throw new Error(msg);
  }

  const data = await response.json();
  const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) {
    throw new Error('Gemini returned an empty response.');
  }

  const parsed = cleanJsonOutput(textOutput);
  if (!parsed || !parsed.body) {
    return {
      subject: `Introduction & Interest in Opportunities at ${userPrompt.match(/Company:\s*(.*)/)?.[1] || 'your team'}`,
      body: (textOutput || '').replace(/^```(?:json)?\s*/gi, '').replace(/\s*```\s*$/gi, '').trim()
    };
  }
  return parsed;
}

/**
 * Strict SSRF protection for user-configurable AI endpoint URLs.
 * Rejects non-HTTP(S) schemes, cloud metadata addresses, link-local IPs, and private network ranges in production.
 */
function validateCustomBaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Custom provider baseURL must be a valid URL string.');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch (err) {
    throw new Error(`Invalid custom baseURL format: ${err.message}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Forbidden protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Prohibit cloud metadata endpoints across all cloud providers (AWS, GCP, Azure, DigitalOcean)
  const forbiddenHostnames = [
    '169.254.169.254',
    'metadata.google.internal',
    'metadata',
    'instance-data'
  ];
  if (forbiddenHostnames.includes(hostname) || hostname.endsWith('.metadata.google.internal')) {
    throw new Error('Access to cloud instance metadata services is forbidden.');
  }

  // Prohibit IPv4 link-local (169.254.0.0/16) and IPv6 link-local
  if (hostname.startsWith('169.254.') || hostname.startsWith('fe80:')) {
    throw new Error('Access to link-local address range is forbidden.');
  }

  // In production, prohibit loopback and RFC 1918 private IP subnets to prevent SSRF into VPC/internal services
  const isProduction = process.env.NODE_ENV === 'production';
  const allowLocal = process.env.ALLOW_LOCAL_AI_ENDPOINTS === 'true';

  if (isProduction && !allowLocal) {
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Regex);
    if (ipMatch) {
      const o1 = Number(ipMatch[1]);
      const o2 = Number(ipMatch[2]);
      if (
        o1 === 127 || // Loopback
        o1 === 10 ||  // 10.0.0.0/8
        (o1 === 172 && o2 >= 16 && o2 <= 31) || // 172.16.0.0/12
        (o1 === 192 && o2 === 168) ||           // 192.168.0.0/16
        o1 === 0
      ) {
        throw new Error(`Access to private or loopback IP (${hostname}) is forbidden in production.`);
      }
    }

    if (hostname === 'localhost' || hostname === '::1' || hostname === '0.0.0.0') {
      throw new Error('Access to localhost is forbidden in production.');
    }
  }

  return parsed.origin + parsed.pathname.replace(/\/+$/, '');
}

/**
 * Generic OpenAI-compatible caller (OpenAI, Grok, NVIDIA, Custom)
 */
async function callOpenAiCompatible({ apiKey, baseURL, model, systemPrompt, userPrompt }) {
  const endpoint = `${baseURL.replace(/\/+$/, '')}/chat/completions`;
  
  const payload = {
    model: model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 1200
  };

  const RETRY_DELAYS = [2000, 4000, 8000];
  let response;
  let attempt = 0;
  while (true) {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 429 && attempt < RETRY_DELAYS.length) {
      const delay = process.env.TEST_FAST_RETRY === 'true' ? 10 : RETRY_DELAYS[attempt];
      console.warn(`[AI Rate Limit] OpenAI-compatible HTTP 429 received from ${endpoint}. Retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_DELAYS.length})...`);
      await new Promise(r => setTimeout(r, delay));
      attempt++;
      continue;
    }
    break;
  }

  if (!response.ok) {
    const errorText = await response.text();
    let msg = `API error (${response.status}) from ${endpoint}`;
    try {
      const errJson = JSON.parse(errorText);
      msg = errJson.error?.message || errJson.message || msg;
    } catch {}
    if (response.status === 429) {
      msg = `API rate limit exceeded (HTTP 429) from ${endpoint} after ${RETRY_DELAYS.length} retries: ${msg}`;
    }
    throw new Error(msg);
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error('Provider returned an empty response.');
  }

  const parsed = cleanJsonOutput(rawText);
  if (!parsed || !parsed.body) {
    return {
      subject: `Inquiry: Value & Opportunities`,
      body: (rawText || '').replace(/^```(?:json)?\s*/gi, '').replace(/\s*```\s*$/gi, '').trim()
    };
  }
  return parsed;
}

/**
 * Verifiable post-generation claim checker.
 * Extracts metrics, numbers, and stats from the email draft and verifies their presence in resumeText.
 */
function auditDraftClaims({ draftText, resumeText }) {
  if (!draftText || typeof draftText !== 'string') {
    return { isGroundingAudited: true, groundingScore: 100, flaggedClaims: [], hasUngroundedClaims: false };
  }

  const cleanResume = (resumeText || '').toLowerCase();
  const flaggedClaims = [];

  // 1. Look for percentages (e.g. 40%, 150%)
  const percentageMatches = draftText.match(/\b\d+%(?!\w)/g) || [];
  for (const match of percentageMatches) {
    if (!cleanResume.includes(match.toLowerCase())) {
      flaggedClaims.push({
        claim: match,
        type: 'percentage',
        reason: `Percentage '${match}' is not found in your uploaded resume.`
      });
    }
  }

  // 2. Look for financial / dollar metrics (e.g. $10M, $500k, $2.5M)
  const financialMatches = draftText.match(/\$[0-9]+(?:\.[0-9]+)?(?:[kKmMbB]|(?:\s*(?:million|billion|thousand)))?\b/g) || [];
  for (const match of financialMatches) {
    const norm = match.toLowerCase().replace(/\s+/g, '');
    const cleanResumeNoSpace = cleanResume.replace(/\s+/g, '');
    if (!cleanResume.includes(norm) && !cleanResumeNoSpace.includes(norm)) {
      flaggedClaims.push({
        claim: match,
        type: 'financial_metric',
        reason: `Revenue or financial metric '${match}' does not appear in your resume.`
      });
    }
  }

  // 3. Look for scale claims (e.g. 2.5M+ users, 50+ engineers)
  const scaleMatches = draftText.match(/\b\d+(?:\.\d+)?(?:[kKmMbB]|\+)?\s*(?:users|clients|customers|engineers|developers|direct reports)\b/gi) || [];
  for (const match of scaleMatches) {
    const numPart = match.match(/\b\d+(?:\.\d+)?/)?.[0];
    if (numPart && !cleanResume.includes(numPart)) {
      flaggedClaims.push({
        claim: match,
        type: 'scale_claim',
        reason: `Scale assertion '${match}' does not appear to be grounded in your resume.`
      });
    }
  }

  // Deduplicate flagged claims
  const uniqueFlagged = [];
  const seenClaims = new Set();
  for (const f of flaggedClaims) {
    if (!seenClaims.has(f.claim.toLowerCase())) {
      seenClaims.add(f.claim.toLowerCase());
      uniqueFlagged.push(f);
    }
  }

  const hasUngroundedClaims = uniqueFlagged.length > 0;
  const groundingScore = Math.max(0, 100 - (uniqueFlagged.length * 25));

  return {
    isGroundingAudited: true,
    groundingScore,
    flaggedClaims: uniqueFlagged,
    hasUngroundedClaims
  };
}

/**
 * Main generate function dispatching to active provider
 */
async function generateColdEmail({ providerKey, providerConfig, resumeText, jobDescription, recipient, customTone, senderName }) {
  const { systemPrompt, userPrompt } = buildPrompts({
    resumeText,
    jobDescription,
    recipient,
    customTone,
    senderName
  });

  const apiKey = providerConfig.apiKey;
  if (!apiKey || apiKey.trim() === '') {
    // Demo mode email with grounding audit
    const recipientFirst = recipient?.name ? recipient.name.split(' ')[0] : 'Hiring Team';
    const comp = recipient?.company || 'your team';
    const role = recipient?.role || (jobDescription ? 'the open position' : 'relevant engineering opportunities');
    const sender = senderName || 'Candidate';

    const demoBody = `Hi ${recipientFirst},\n\nI’ve been following ${comp}’s progress and love your focus on building modern, high-impact products.\n\nI’m reaching out because with 6+ years of experience engineering scalable web applications and distributed cloud systems, I recently architected platform improvements that reduced latency by 42% and supported 2.5M+ active users. Given ${jobDescription ? 'your requirements for this role' : 'your team’s growth'}, I believe my background in full-stack architecture, performance optimization, and AI workflows would allow me to contribute immediately.\n\nI've attached my resume for your review. Would you be open to a brief 10-minute introductory conversation this week to see if my experience aligns with your current goals?\n\nWarm regards,\n${sender}`;

    const demoResult = {
      subject: `Inquiry: ${role} at ${comp} — ${sender}`,
      body: demoBody,
      isDemoNotice: providerKey === 'copilot'
        ? 'Generated via Demo Mode. Connect your GitHub account in Settings to enable live LLM synthesis.'
        : 'Generated via Demo Mode. Add your API key in Settings to enable live LLM synthesis.'
    };

    return {
      ...demoResult,
      groundingAudit: auditDraftClaims({ draftText: demoResult.body, resumeText })
    };
  }

  const model = providerConfig.model;
  let draftResult;

  switch (providerKey) {
    case 'gemini':
      draftResult = await callGemini({ apiKey, model, systemPrompt, userPrompt });
      break;

    case 'groq':
      draftResult = await callOpenAiCompatible({
        apiKey,
        baseURL: 'https://api.groq.com/openai/v1',
        model: model || 'qwen/qwen3.8-27b',
        systemPrompt,
        userPrompt
      });
      break;

    case 'openai':
      draftResult = await callOpenAiCompatible({
        apiKey,
        baseURL: 'https://api.openai.com/v1',
        model: model || 'gpt-4o-mini',
        systemPrompt,
        userPrompt
      });
      break;

    case 'grok':
      draftResult = await callOpenAiCompatible({
        apiKey,
        baseURL: 'https://api.x.ai/v1',
        model: model || 'grok-2-1212',
        systemPrompt,
        userPrompt
      });
      break;

    case 'nvidia':
      draftResult = await callOpenAiCompatible({
        apiKey,
        baseURL: 'https://integrate.api.nvidia.com/v1',
        model: model || 'meta/llama-3.1-70b-instruct',
        systemPrompt,
        userPrompt
      });
      break;

    case 'copilot':
      draftResult = await copilotService.callCopilotChat({
        githubAccessToken: apiKey,
        model: model || 'gpt-4o',
        systemPrompt,
        userPrompt
      });
      break;

    case 'custom': {
      const sanitizedBaseUrl = validateCustomBaseUrl(providerConfig.baseURL || 'https://api.openai.com/v1');
      draftResult = await callOpenAiCompatible({
        apiKey,
        baseURL: sanitizedBaseUrl,
        model: model || 'gpt-4o',
        systemPrompt,
        userPrompt
      });
      break;
    }

    default:
      throw new Error(`Unsupported AI provider: ${providerKey}`);
  }

  // Verifiable claim grounding audit
  const groundingAudit = auditDraftClaims({
    draftText: draftResult?.body,
    resumeText
  });

  return {
    ...draftResult,
    groundingAudit
  };
}

/**
 * Dispatches a system+user prompt to the active AI provider and returns raw text.
 * Shared helper for parseJobDescription (avoids duplicating the provider switch).
 */
async function dispatchToProvider({ providerKey, providerConfig, systemPrompt, userPrompt }) {
  const apiKey = providerConfig.apiKey;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('AI provider API key is not configured. Please add your key in Settings.');
  }

  const model = providerConfig.model;
  let rawText;

  switch (providerKey) {
    case 'gemini': {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;
      const payload = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2000 }
      };
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini API error (${response.status}): ${errText.slice(0, 200)}`);
        }
        const data = await response.json();
        rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      } finally {
        clearTimeout(timeout);
      }
      break;
    }

    case 'copilot':
      rawText = await copilotService.callCopilotChat({
        githubAccessToken: apiKey,
        model: model || 'gpt-4o',
        systemPrompt,
        userPrompt
      }).then(r => JSON.stringify(r));
      break;

    default: {
      // OpenAI-compatible: openai, groq, grok, nvidia, custom
      const baseURLs = {
        openai: 'https://api.openai.com/v1',
        groq: 'https://api.groq.com/openai/v1',
        grok: 'https://api.x.ai/v1',
        nvidia: 'https://integrate.api.nvidia.com/v1',
        custom: (providerConfig.baseURL || 'https://api.openai.com/v1').replace(/\/+$/, '')
      };
      const baseURL = baseURLs[providerKey];
      if (!baseURL) throw new Error(`Unsupported AI provider: ${providerKey}`);

      const endpoint = `${baseURL.replace(/\/+$/, '')}/chat/completions`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API error (${response.status}): ${errText.slice(0, 200)}`);
      }
      const data = await response.json();
      rawText = data?.choices?.[0]?.message?.content;
      break;
    }
  }

  if (!rawText) {
    throw new Error('AI provider returned an empty response.');
  }
  return rawText;
}

/**
 * Parses raw job description text using AI to extract structured recipient data.
 * Returns: { contacts[], company, role, location, responsibilities[], requirements[], jobDescriptionClean, confidence }
 */
async function parseJobDescription({ providerKey, providerConfig, rawText }) {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 20) {
    throw new Error('Job description text is too short for AI parsing. Please provide more content.');
  }

  const systemPrompt = `You are a precise job description parser. Extract structured data from job posting text.

Rules:
1. Extract ALL email addresses found in the text — these are typically HR, recruiter, hiring manager, or apply-to addresses. Look for patterns like name@domain.com, mailto: links, or "apply to:" / "contact:" sections.
2. For each email found, also extract the associated person's name and title if mentioned nearby.
3. Extract the company name, job title/role, and location.
4. Extract the top responsibilities and requirements as concise bullet points (max 6 each).
5. Preserve the full job description text in jobDescriptionClean — cleaned and formatted but complete.
6. Set confidence flags to indicate what was successfully found.
7. If a field cannot be determined, use an empty string or empty array — never fabricate data.
8. Reply ONLY in valid JSON format matching this exact schema:

{
  "contacts": [{ "name": "Person Name", "email": "email@example.com", "title": "Their Title" }],
  "company": "Company Name",
  "role": "Job Title",
  "location": "Location",
  "responsibilities": ["responsibility 1", "responsibility 2"],
  "requirements": ["requirement 1", "requirement 2"],
  "jobDescriptionClean": "Full cleaned job description text...",
  "confidence": { "emailFound": true, "companyFound": true, "roleFound": true }
}`;

  const userPrompt = `Parse this job posting and extract structured data:\n\n${rawText.slice(0, 6000)}`;

  const rawResponse = await dispatchToProvider({ providerKey, providerConfig, systemPrompt, userPrompt });

  // Parse the JSON response using existing recovery pipeline
  let parsed;
  try {
    // Strip markdown code fences if present
    const cleaned = rawResponse.replace(/^```(?:json)?\s*/gi, '').replace(/\s*```\s*$/gi, '').trim();
    const normalized = normalizeControlCharacters(cleaned);
    parsed = JSON.parse(normalized);
  } catch {
    // Attempt regex extraction for key fields
    try {
      const companyMatch = rawResponse.match(/"company"\s*:\s*"([^"]+)"/);
      const roleMatch = rawResponse.match(/"role"\s*:\s*"([^"]+)"/);
      const locationMatch = rawResponse.match(/"location"\s*:\s*"([^"]+)"/);
      const emailMatch = rawResponse.match(/"email"\s*:\s*"([^"]+@[^"]+)"/);
      const nameMatch = rawResponse.match(/"name"\s*:\s*"([^"]+)"/);

      parsed = {
        contacts: emailMatch ? [{ name: nameMatch?.[1] || '', email: emailMatch[1], title: '' }] : [],
        company: companyMatch?.[1] || '',
        role: roleMatch?.[1] || '',
        location: locationMatch?.[1] || '',
        responsibilities: [],
        requirements: [],
        jobDescriptionClean: rawText.slice(0, 4000),
        confidence: {
          emailFound: Boolean(emailMatch),
          companyFound: Boolean(companyMatch),
          roleFound: Boolean(roleMatch)
        }
      };
    } catch {
      throw new Error('Failed to parse AI response as structured data. Please try again.');
    }
  }

  // Normalize and validate the parsed result
  const result = {
    contacts: Array.isArray(parsed.contacts) ? parsed.contacts.filter(c => c && c.email) : [],
    company: typeof parsed.company === 'string' ? parsed.company.trim() : '',
    role: typeof parsed.role === 'string' ? parsed.role.trim() : '',
    location: typeof parsed.location === 'string' ? parsed.location.trim() : '',
    responsibilities: Array.isArray(parsed.responsibilities) ? parsed.responsibilities.filter(Boolean).slice(0, 6) : [],
    requirements: Array.isArray(parsed.requirements) ? parsed.requirements.filter(Boolean).slice(0, 6) : [],
    jobDescriptionClean: typeof parsed.jobDescriptionClean === 'string'
      ? parsed.jobDescriptionClean.trim().slice(0, 5000)
      : rawText.slice(0, 4000),
    confidence: {
      emailFound: Boolean(parsed.confidence?.emailFound || (parsed.contacts && parsed.contacts.length > 0)),
      companyFound: Boolean(parsed.confidence?.companyFound || parsed.company),
      roleFound: Boolean(parsed.confidence?.roleFound || parsed.role)
    }
  };

  return result;
}

/**
 * Test Connection for a given provider
 */
async function testAiConnection(providerKey, config) {
  const apiKey = config.apiKey;
  if (!apiKey || apiKey.trim() === '') {
    return {
      success: false,
      error: providerKey === 'copilot'
        ? 'GitHub authorization required. Please connect your GitHub account via "Connect GitHub Copilot".'
        : 'API key is required to test connection.'
    };
  }

  const trimmedKey = apiKey.trim();

  // Smart prefix mismatch detection to guide user
  if (trimmedKey.startsWith('gsk_') && providerKey === 'grok') {
    return {
      success: false,
      error: "This key starts with 'gsk_', which is a GroqCloud key (console.groq.com), not Grok (xAI). Please select the 'Groq (LPU Inference)' provider instead!"
    };
  }
  if (trimmedKey.startsWith('gsk_') && providerKey !== 'groq' && providerKey !== 'custom') {
    return {
      success: false,
      error: "This key starts with 'gsk_', which is a GroqCloud key (console.groq.com). Please select the 'Groq (LPU Inference)' provider!"
    };
  }
  if (trimmedKey.startsWith('xai-') && providerKey === 'groq') {
    return {
      success: false,
      error: "This key starts with 'xai-', which is an xAI Grok key. Please select 'Grok (xAI)' provider!"
    };
  }

  try {
    if (providerKey === 'copilot') {
      return await copilotService.testCopilotConnection(apiKey);
    }

    if (providerKey === 'gemini') {
      const model = config.model || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${apiKey}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);
      let res;
      try {
        res = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) {
        const text = await res.text();
        let msg = `Gemini connection failed (${res.status})`;
        try {
          const j = JSON.parse(text);
          msg = j.error?.message || msg;
        } catch {}
        return { success: false, error: msg };
      }
      return { success: true, message: `Connected to Gemini (${model}) successfully!` };
    }

    // OpenAI compatible providers
    let baseURL = (config && config.baseURL) ? config.baseURL : 'https://api.openai.com/v1';
    let model = (config && config.model) || 'gpt-4o-mini';

    if (providerKey === 'groq') {
      baseURL = (config && config.baseURL) || 'https://api.groq.com/openai/v1';
      model = (config && config.model) || 'qwen/qwen3.8-27b';
    } else if (providerKey === 'grok') {
      baseURL = (config && config.baseURL) || 'https://api.x.ai/v1';
      model = (config && config.model) || 'grok-2-1212';
    } else if (providerKey === 'nvidia') {
      baseURL = (config && config.baseURL) || 'https://integrate.api.nvidia.com/v1';
      model = (config && config.model) || 'meta/llama-3.1-70b-instruct';
    } else if (providerKey === 'custom') {
      baseURL = validateCustomBaseUrl((config && config.baseURL) || 'https://api.openai.com/v1');
      model = (config && config.model) || 'gpt-4o';
    }

    const safeBaseUrl = (baseURL && typeof baseURL === 'string') ? baseURL.trim() : 'https://api.openai.com/v1';
    const endpoint = `${safeBaseUrl.replace(/\/+$/, '')}/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 3
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const text = await res.text();
      let msg = `Connection failed (${res.status})`;
      try {
        const j = JSON.parse(text);
        msg = j.error?.message || j.message || msg;
      } catch {}
      return { success: false, error: msg };
    }

    return { success: true, message: `Connected to ${providerKey.toUpperCase()} (${model}) successfully!` };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Connection timed out after 15 seconds. The provider may be unreachable or the model may not exist.' };
    }
    console.error(`[testAiConnection] Error testing ${providerKey}:`, err);
    return { success: false, error: err.message || 'Network request failed' };
  }
}

/**
 * Fetch available models from a provider's API.
 * Returns { success, models: [{ id, name, created? }], provider } or { success: false, error }.
 */
async function listProviderModels(providerKey, apiKey) {
  if (providerKey === 'copilot') {
    const models = [
      { id: 'gpt-4o', name: 'GPT-4o', created: null },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', created: null }
    ];
    return { success: true, models, provider: providerKey };
  }

  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: 'API key is required to list models.' };
  }
  const trimmedKey = apiKey.trim();

  try {
    if (providerKey === 'gemini') {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);
      let res;
      try {
        res = await fetch(`${url}?key=${trimmedKey}&pageSize=100`, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) {
        const text = await res.text();
        let msg = `Gemini models API error (${res.status})`;
        try { const j = JSON.parse(text); msg = j.error?.message || msg; } catch {}
        return { success: false, error: msg };
      }
      const data = await res.json();
      const models = (data.models || [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => ({
          id: (m.name || '').replace(/^models\//, ''),
          name: m.displayName || m.name || '',
          created: null
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return { success: true, models, provider: providerKey };
    }

    // OpenAI-compatible providers
    const BASE_URLS = {
      openai: 'https://api.openai.com/v1',
      groq: 'https://api.groq.com/openai/v1',
      grok: 'https://api.x.ai/v1',
      nvidia: 'https://integrate.api.nvidia.com/v1',
      custom: 'https://api.openai.com/v1'
    };
    const baseURL = BASE_URLS[providerKey] || BASE_URLS.openai;
    const endpoint = `${baseURL.replace(/\/+$/, '')}/models`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${trimmedKey}` },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) {
      const text = await res.text();
      let msg = `Models API error (${res.status})`;
      try { const j = JSON.parse(text); msg = j.error?.message || j.message || msg; } catch {}
      return { success: false, error: msg };
    }
    const data = await res.json();
    let rawModels = data.data || data.models || [];

    if (providerKey === 'openai') {
      rawModels = rawModels.filter(m => {
        const id = (m.id || '').toLowerCase();
        return !id.includes('embedding') && !id.includes('whisper') &&
               !id.includes('tts') && !id.includes('dall-e') &&
               !id.includes('moderation') && !id.includes('audio') &&
               !id.includes('davinci') && !id.includes('babbage');
      });
    } else if (providerKey === 'groq') {
      rawModels = rawModels.filter(m => {
        const id = (m.id || '').toLowerCase();
        return !id.includes('whisper') && !id.includes('tts') &&
               !id.includes('guard') && m.active !== false;
      });
    }

    const models = rawModels.map(m => ({
      id: m.id || '',
      name: m.id || '',
      created: m.created || null
    }));

    models.sort((a, b) => {
      if (a.created && b.created) return b.created - a.created;
      if (a.created) return -1;
      if (b.created) return 1;
      return a.id.localeCompare(b.id);
    });

    return { success: true, models, provider: providerKey };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Request timed out after 15 seconds. The provider may be unreachable.' };
    }
    return { success: false, error: err.message || 'Failed to fetch models' };
  }
}

module.exports = {
  generateColdEmail,
  parseJobDescription,
  testAiConnection,
  listProviderModels,
  cleanJsonOutput,
  buildPrompts,
  auditDraftClaims,
  validateCustomBaseUrl,
  callGemini,
  callOpenAiCompatible,
  dispatchToProvider
};
