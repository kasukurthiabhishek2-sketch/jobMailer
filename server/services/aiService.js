/**
 * Pluggable AI Service supporting Google Gemini, OpenAI, Grok (xAI), NVIDIA NIM, and Custom OpenAI-compatible endpoints.
 */

const copilotService = require('./copilotService');
const { callCopilotChat, testCopilotConnection } = copilotService;

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
  } catch (err) {
    // Attempt to extract JSON substring between { and }
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
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
6. Call to Action (CTA): Low friction, polite, asking for a brief 10-15 minute introductory conversation.
7. Brevity: Keep the email body between 110 and 175 words. Busy executives don't read long essays.
8. Output Format: You MUST reply strictly in valid JSON format with two keys:
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

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let msg = `Gemini API error (${response.status})`;
    try {
      const errJson = JSON.parse(errorText);
      msg = errJson.error?.message || msg;
    } catch (e) {}
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

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let msg = `API error (${response.status}) from ${endpoint}`;
    try {
      const errJson = JSON.parse(errorText);
      msg = errJson.error?.message || errJson.message || msg;
    } catch (e) {}
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
    // If no key is set yet, provide an intelligent candidate-tailored demo email
    // so user can test the workflow immediately before adding their key
    const recipientFirst = recipient?.name ? recipient.name.split(' ')[0] : 'Hiring Team';
    const comp = recipient?.company || 'your team';
    const role = recipient?.role || (jobDescription ? 'the open position' : 'relevant engineering opportunities');
    const sender = senderName || 'Candidate';

    return {
      subject: `Inquiry: ${role} at ${comp} — ${sender}`,
      body: `Hi ${recipientFirst},\n\nI’ve been following ${comp}’s progress and love your focus on building modern, high-impact products.\n\nI’m reaching out because with 6+ years of experience engineering scalable web applications and distributed cloud systems, I recently architected platform improvements that reduced latency by 42% and supported 2.5M+ active users. Given ${jobDescription ? 'your requirements for this role' : 'your team’s growth'}, I believe my background in full-stack architecture, performance optimization, and AI workflows would allow me to contribute immediately.\n\nI've attached my resume for your review. Would you be open to a brief 10-minute introductory conversation this week to see if my experience aligns with your current goals?\n\nWarm regards,\n${sender}`,
      isDemoNotice: 'Generated via Demo Mode. Add your API key in Settings to enable live LLM synthesis.'
    };
  }

  const model = providerConfig.model;

  switch (providerKey) {
    case 'gemini':
      return await callGemini({ apiKey, model, systemPrompt, userPrompt });

    case 'groq':
      return await callOpenAiCompatible({
        apiKey,
        baseURL: 'https://api.groq.com/openai/v1',
        model: model || 'qwen/qwen3.8-27b',
        systemPrompt,
        userPrompt
      });

    case 'openai':
      return await callOpenAiCompatible({
        apiKey,
        baseURL: 'https://api.openai.com/v1',
        model: model || 'gpt-4o-mini',
        systemPrompt,
        userPrompt
      });

    case 'grok':
      return await callOpenAiCompatible({
        apiKey,
        baseURL: 'https://api.x.ai/v1',
        model: model || 'grok-2-1212',
        systemPrompt,
        userPrompt
      });

    case 'nvidia':
      return await callOpenAiCompatible({
        apiKey,
        baseURL: 'https://integrate.api.nvidia.com/v1',
        model: model || 'meta/llama-3.1-70b-instruct',
        systemPrompt,
        userPrompt
      });

    case 'copilot':
      return await copilotService.callCopilotChat({
        githubAccessToken: apiKey,
        model: model || 'gpt-4o',
        systemPrompt,
        userPrompt
      });

    case 'custom':
      return await callOpenAiCompatible({
        apiKey,
        baseURL: providerConfig.baseURL || 'https://api.openai.com/v1',
        model: model || 'gpt-4o',
        systemPrompt,
        userPrompt
      });

    default:
      throw new Error(`Unsupported AI provider: ${providerKey}`);
  }
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
        } catch (e) {}
        return { success: false, error: msg };
      }
      return { success: true, message: `Connected to Gemini (${model}) successfully!` };
    }

    // OpenAI compatible providers
    let baseURL = 'https://api.openai.com/v1';
    let model = config.model || 'gpt-4o-mini';

    if (providerKey === 'groq') {
      baseURL = 'https://api.groq.com/openai/v1';
      model = config.model || 'qwen/qwen3.8-27b';
    } else if (providerKey === 'grok') {
      baseURL = 'https://api.x.ai/v1';
      model = config.model || 'grok-2-1212';
    } else if (providerKey === 'nvidia') {
      baseURL = 'https://integrate.api.nvidia.com/v1';
      model = config.model || 'meta/llama-3.1-70b-instruct';
    } else if (providerKey === 'custom') {
      baseURL = config.baseURL || 'https://api.openai.com/v1';
      model = config.model || 'gpt-4o';
    }

    const endpoint = `${baseURL.replace(/\/+$/, '')}/chat/completions`;
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
      } catch (e) {}
      return { success: false, error: msg };
    }

    return { success: true, message: `Connected to ${providerKey.toUpperCase()} (${model}) successfully!` };
  } catch (err) {
    return { success: false, error: err.message || 'Network request failed' };
  }
}

module.exports = {
  generateColdEmail,
  testAiConnection
};
