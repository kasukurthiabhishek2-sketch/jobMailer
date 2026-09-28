/**
 * Pluggable AI Service supporting Google Gemini, OpenAI, Grok (xAI), NVIDIA NIM, and Custom OpenAI-compatible endpoints.
 */

const copilotService = require('./copilotService');

/**
 * Clean and parse JSON from model output (handles markdown code blocks like ```json ... ```)
 */
function cleanJsonOutput(text) {
  if (!text) return null;
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt to extract JSON substring between { and }
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // Fallback to text parsing
      }
    }
    return null;
  }
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
    // If not valid JSON, treat raw text as body
    return {
      subject: `Introduction & Interest in Opportunities at ${userPrompt.match(/Company:\s*(.*)/)?.[1] || 'your team'}`,
      body: textOutput
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
    max_tokens: 550
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
      body: rawText
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
      isDemoNotice: 'Generated via Demo Mode. Add your API key in Settings to enable live LLM synthesis.'
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
 * Test Connection for a given provider
 */
async function testAiConnection(providerKey, config) {
  const apiKey = config.apiKey;
  if (!apiKey || apiKey.trim() === '') {
    return { success: false, error: 'API key is required to test connection.' };
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
      const res = await fetch(url);
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
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 3
      })
    });

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
    console.error(`[testAiConnection] Error testing ${providerKey}:`, err);
    return { success: false, error: err.message || 'Network request failed' };
  }
}

module.exports = {
  generateColdEmail,
  testAiConnection,
  cleanJsonOutput,
  buildPrompts,
  auditDraftClaims,
  validateCustomBaseUrl,
  callGemini,
  callOpenAiCompatible
};
