/**
 * URL Scraper Service — Fetches a URL and extracts readable plain text.
 * Uses Node.js native fetch (no external dependencies / no headless browser).
 * Designed for job posting pages (Greenhouse, Lever, Workday, LinkedIn public, etc.)
 */

const URL_FETCH_TIMEOUT_MS = 10000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_TEXT_LENGTH = 8000;

/**
 * Validates a URL string. Must be http:// or https://.
 * @param {string} raw
 * @returns {{ valid: boolean, url?: URL, error?: string }}
 */
function validateUrl(raw) {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, error: 'URL is required.' };
  }
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return { valid: false, error: 'URL must start with http:// or https://' };
  }
  try {
    const parsed = new URL(trimmed);
    return { valid: true, url: parsed };
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }
}

/**
 * Strips HTML tags and extracts readable text from raw HTML.
 * Prioritizes <main>, <article>, then <body> content.
 * @param {string} html
 * @returns {string}
 */
function extractTextFromHtml(html) {
  if (!html || typeof html !== 'string') return '';

  // Try to extract content from semantic containers first
  let content = html;
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (mainMatch) {
    content = mainMatch[1];
  } else if (articleMatch) {
    content = articleMatch[1];
  } else {
    // Fall back to body
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) content = bodyMatch[1];
  }

  // Strip non-content tags entirely
  content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  content = content.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  content = content.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  content = content.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  content = content.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // Convert block-level tags to newlines for readability
  content = content.replace(/<\/?(p|div|br|h[1-6]|li|tr|blockquote|section)[^>]*\/?>/gi, '\n');
  // Convert list items to bullets
  content = content.replace(/<li[^>]*>/gi, '\n• ');

  // Strip all remaining HTML tags
  content = content.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  content = content
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');

  // Collapse whitespace
  content = content
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length > 0)
    .join('\n');

  return content.slice(0, MAX_TEXT_LENGTH);
}

/**
 * Extracts the page title from HTML.
 * @param {string} html
 * @returns {string}
 */
function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/<[^>]+>/g, '').trim().slice(0, 200) : '';
}

/**
 * Fetches a URL and returns extracted plain text content.
 * @param {string} rawUrl
 * @returns {Promise<{ text: string, title: string, sourceUrl: string }>}
 * @throws {Error} On validation failure, timeout, or fetch error
 */
async function fetchUrlAsText(rawUrl) {
  const validation = validateUrl(rawUrl);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(validation.url.href, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JDMail/1.0; +https://github.com/jdmail)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`URL returned HTTP ${response.status} (${response.statusText})`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml') && !contentType.includes('text/plain')) {
      throw new Error(`Unsupported content type: ${contentType.split(';')[0]}. Only HTML and text pages are supported.`);
    }

    // Enforce size limit
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_RESPONSE_BYTES) {
      throw new Error(`Page too large (${Math.round(contentLength / 1024)}KB). Maximum is ${MAX_RESPONSE_BYTES / 1024}KB.`);
    }

    const html = await response.text();
    if (html.length > MAX_RESPONSE_BYTES) {
      throw new Error('Page content exceeds size limit.');
    }

    const text = contentType.includes('text/plain') ? html.slice(0, MAX_TEXT_LENGTH) : extractTextFromHtml(html);
    const title = contentType.includes('text/plain') ? '' : extractTitle(html);

    if (!text || text.trim().length < 20) {
      throw new Error('Could not extract meaningful text from this URL. Try pasting the job description text directly.');
    }

    return {
      text: text.trim(),
      title,
      sourceUrl: validation.url.href
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('URL request timed out (10s). The page may be too slow or require authentication.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  fetchUrlAsText,
  validateUrl,
  extractTextFromHtml,
  extractTitle
};
