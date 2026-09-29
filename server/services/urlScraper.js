/**
 * URL Scraper Service — Fetches a URL and extracts readable plain text and structured metadata.
 * Uses Node.js native fetch with strict SSRF, DNS-rebinding, and streaming DoS guardrails.
 * Designed for job posting pages (Greenhouse, Lever, Workday, LinkedIn public, Ashby, etc.)
 */

const dns = require('dns').promises;
const net = require('net');
const { ERROR_CODES, STAGES, ParsingError } = require('../utils/errorTaxonomy');

const URL_FETCH_TIMEOUT_MS = 10000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_TEXT_LENGTH = 8000;
const MAX_REDIRECTS = 3;
const ALLOWED_PORTS = new Set(['80', '443', '']);

// Desktop Chrome User-Agent with JDMail identifier in comment to prevent aggressive bot blocks
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (compatible; JDMail/1.0; +https://github.com/jdmail)';

/**
 * Checks if an IP address belongs to private, loopback, link-local, CGNAT, or reserved subnets.
 * @param {string} rawIp
 * @returns {boolean} True if IP is private/restricted and must be blocked.
 */
function isPrivateOrRestrictedIp(rawIp) {
  if (!rawIp || typeof rawIp !== 'string') return true;
  let ip = rawIp.trim();

  // Unwrap IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }

  // Handle NAT64 prefix (64:ff9b::/96)
  if (ip.toLowerCase().startsWith('64:ff9b::')) {
    const hex = ip.slice(9).replace(/:/g, '');
    if (hex.length === 8) {
      const num = parseInt(hex, 16);
      ip = `${(num >> 24) & 255}.${(num >> 16) & 255}.${(num >> 8) & 255}.${num & 255}`;
    }
  }

  const version = net.isIP(ip);

  // IPv4 Checks
  if (version === 4) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return true;
    const [a, b, c] = parts;

    if (a === 0) return true;                           // 0.0.0.0/8 (Current network)
    if (a === 10) return true;                          // 10.0.0.0/8 (Private RFC 1918)
    if (a === 100 && b >= 64 && b <= 127) return true;  // 100.64.0.0/10 (Carrier-Grade NAT)
    if (a === 127) return true;                         // 127.0.0.0/8 (Loopback)
    if (a === 169 && b === 254) return true;            // 169.254.0.0/16 (Link-Local / Cloud IMDS)
    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12 (Private RFC 1918)
    if (a === 192 && b === 0 && c === 0) return true;   // 192.0.0.0/24 (IETF assignments)
    if (a === 192 && b === 0 && c === 2) return true;   // 192.0.2.0/24 (TEST-NET-1)
    if (a === 192 && b === 168) return true;            // 192.168.0.0/16 (Private RFC 1918)
    if (a === 198 && b >= 18 && b <= 19) return true;  // 198.18.0.0/15 (Benchmarking)
    if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 (TEST-NET-2)
    if (a === 203 && b === 0 && c === 113) return true;  // 203.0.113.0/24 (TEST-NET-3)
    if (a >= 224) return true;                          // 224.0.0.0/4 (Multicast/Reserved/Broadcast)

    return false;
  }

  // IPv6 Checks
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true; // Loopback
    if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;  // Unspecified
    if (/^fe[89ab][0-9a-f]:/i.test(lower)) return true;             // fe80::/10 (Link-Local)
    if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true;             // fc00::/7 (Unique Local Address)
    if (/^ff[0-9a-f]{2}:/i.test(lower)) return true;                // ff00::/8 (Multicast)

    return false;
  }

  return true; // Not a recognized IP format
}

/**
 * Validates a URL string. Must be http:// or https:// with permitted ports and public destinations.
 * @param {string} raw
 * @returns {{ valid: boolean, url?: URL, error?: string, code?: string }}
 */
function validateUrl(raw) {
  if (!raw || typeof raw !== 'string') {
    return {
      valid: false,
      code: ERROR_CODES.URL_REQUIRED,
      error: 'URL is required.'
    };
  }

  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return {
      valid: false,
      code: ERROR_CODES.URL_INVALID_SCHEME,
      error: 'URL must start with http:// or https://'
    };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (err) {
    return {
      valid: false,
      code: ERROR_CODES.URL_INVALID,
      error: `Invalid URL format: ${err.message}`
    };
  }

  // Scheme verification
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      code: ERROR_CODES.URL_INVALID_SCHEME,
      error: 'Only HTTP and HTTPS protocols are supported.'
    };
  }

  // Reject embedded credentials in URL (user:pass@host)
  if (parsed.username || parsed.password) {
    return {
      valid: false,
      code: ERROR_CODES.URL_CREDENTIALS_FORBIDDEN,
      error: 'URLs with embedded credentials are not permitted.'
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Cloud metadata, localhost, and loopback hostnames
  const forbiddenHostnames = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '169.254.169.254',
    'metadata.google.internal',
    'metadata',
    'instance-data'
  ];

  if (forbiddenHostnames.includes(hostname) || hostname.endsWith('.metadata.google.internal') || hostname.endsWith('.localhost')) {
    return {
      valid: false,
      code: ERROR_CODES.URL_FORBIDDEN_HOST,
      error: 'Access to loopback, internal, or cloud metadata network addresses is forbidden.'
    };
  }

  // If hostname is directly an IP literal, validate it immediately
  if (net.isIP(hostname)) {
    if (isPrivateOrRestrictedIp(hostname)) {
      return {
        valid: false,
        code: ERROR_CODES.URL_FORBIDDEN_HOST,
        error: 'Access to private, loopback, or cloud metadata network addresses is forbidden.'
      };
    }
  }

  // Port verification: standard web ports only
  if (!ALLOWED_PORTS.has(parsed.port)) {
    return {
      valid: false,
      code: ERROR_CODES.URL_FORBIDDEN_PORT,
      error: `Port ${parsed.port} is not allowed. Only standard web ports (80, 443) are supported.`
    };
  }

  return { valid: true, url: parsed };
}

/**
 * Resolves a hostname via DNS and checks all returned IP addresses.
 * Protects against DNS rebinding, nip.io wildcards, and encoded IPs.
 * @param {string} hostname
 */
async function assertPublicDnsResolution(hostname) {
  // If already verified IP literal
  if (net.isIP(hostname)) {
    if (isPrivateOrRestrictedIp(hostname)) {
      const err = new Error('Access to private, loopback, or cloud metadata network addresses is forbidden.');
      err.code = ERROR_CODES.URL_FORBIDDEN_HOST;
      throw err;
    }
    return;
  }

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch (err) {
    const error = new Error(`DNS resolution failed for host "${hostname}": ${err.code || err.message}`);
    error.code = ERROR_CODES.URL_DNS_FAILED;
    throw error;
  }

  if (!addresses || addresses.length === 0) {
    const error = new Error(`No DNS records found for host "${hostname}".`);
    error.code = ERROR_CODES.URL_DNS_FAILED;
    throw error;
  }

  for (const { address } of addresses) {
    if (isPrivateOrRestrictedIp(address)) {
      const error = new Error(`Host "${hostname}" resolved to restricted IP ${address}. Access is forbidden.`);
      error.code = ERROR_CODES.URL_FORBIDDEN_HOST;
      throw error;
    }
  }
}

/**
 * Safely consumes an HTTP response body with an immediate chunk-level size ceiling.
 * Protects against chunked-transfer OOM bombs and unbounded memory consumption.
 * @param {Response} response
 * @returns {Promise<string>}
 */
async function safeReadResponseBody(response) {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        const err = new Error(`Page content exceeds maximum size limit (${MAX_RESPONSE_BYTES / (1024 * 1024)}MB).`);
        err.code = ERROR_CODES.CONTENT_TOO_LARGE;
        throw err;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Deterministically extracts Schema.org JobPosting data from <script type="application/ld+json"> tags.
 * @param {string} html
 * @returns {object|null} Structured job data if found
 */
function extractJsonLdJobPosting(html) {
  if (!html || typeof html !== 'string') return null;

  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const rawJson = match[1].trim();
      const parsed = JSON.parse(rawJson);
      const postings = [];

      if (parsed && typeof parsed === 'object') {
        if (parsed['@type'] === 'JobPosting') {
          postings.push(parsed);
        } else if (Array.isArray(parsed['@graph'])) {
          for (const item of parsed['@graph']) {
            if (item && item['@type'] === 'JobPosting') postings.push(item);
          }
        } else if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item['@type'] === 'JobPosting') postings.push(item);
          }
        }
      }

      if (postings.length > 0) {
        const p = postings[0];
        const company = p.hiringOrganization?.name ||
                        (Array.isArray(p.hiringOrganization) ? p.hiringOrganization[0]?.name : '') || '';
        const role = p.title || '';

        let location = '';
        if (p.jobLocationType === 'TELECOMMUTE' || p.applicantLocationRequirements) {
          location = 'Remote';
        } else if (p.jobLocation?.address) {
          const addr = p.jobLocation.address;
          if (typeof addr === 'string') {
            location = addr;
          } else if (typeof addr === 'object') {
            location = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
              .filter(Boolean)
              .join(', ');
          }
        }

        let description = '';
        if (typeof p.description === 'string') {
          description = extractTextFromHtml(p.description);
        }

        return {
          company: company.trim(),
          role: role.trim(),
          location: location.trim(),
          description: description.trim(),
          datePosted: p.datePosted || '',
          employmentType: p.employmentType || ''
        };
      }
    } catch {}
  }

  return null;
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

  // Decode common HTML entities (named & numeric)
  content = content
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&bull;/g, '•')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));

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
  if (!html || typeof html !== 'string') return '';
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/<[^>]+>/g, '').trim().slice(0, 200) : '';
}

/**
 * Inspects HTML for JavaScript SPA shells or bot challenge pages.
 * @param {string} html
 * @param {string} text
 * @returns {{ isSpa: boolean, isCaptcha: boolean, reason?: string }}
 */
function detectContentBarriers(html, text) {
  if (!html) return { isSpa: false, isCaptcha: false };

  const lowerHtml = html.toLowerCase();
  const lowerText = (text || '').toLowerCase();

  // Check for Cloudflare Turnstile, CAPTCHA, or Bot mitigation interstitials
  const isCaptcha =
    lowerHtml.includes('cf-browser-verification') ||
    lowerHtml.includes('challenge-platform') ||
    lowerHtml.includes('cf-turnstile') ||
    lowerHtml.includes('<title>just a moment...</title>') ||
    lowerText.includes('checking if the site connection is secure') ||
    lowerText.includes('please verify you are a human') ||
    lowerText.includes('enable javascript and cookies to continue');

  if (isCaptcha) {
    return {
      isSpa: false,
      isCaptcha: true,
      reason: 'The website is protected by an automated bot challenge (e.g. Cloudflare Turnstile). Automated extraction is blocked.'
    };
  }

  // Check for Single Page Application empty shells (Workday, React, Vue, Angular)
  const hasSpaContainer =
    /<div[^>]+id=["'](?:root|app|__next)["'][^>]*>\s*<\/div>/i.test(html) ||
    lowerHtml.includes('<app-root></app-root>') ||
    lowerHtml.includes('id="workdayapp"');

  const hasSpaNotice =
    lowerHtml.includes('you need to enable javascript to run this app') ||
    lowerHtml.includes('javascript is required to use this site');

  const isSpa = (hasSpaContainer || hasSpaNotice) && (!text || text.trim().length < 80);

  if (isSpa) {
    return {
      isSpa: true,
      isCaptcha: false,
      reason: 'This job portal renders its job postings dynamically using JavaScript (Single Page Application). Automated fetch cannot execute client-side scripts.'
    };
  }

  return { isSpa: false, isCaptcha: false };
}

/**
 * Fetches a URL with manual redirect checking, SSRF validation per hop,
 * chunk-level streaming memory limits, and JSON-LD extraction.
 * @param {string} rawUrl
 * @param {object} options
 * @returns {Promise<{ text: string, title: string, sourceUrl: string, jsonLd: object|null }>}
 */
async function fetchUrlAsText(rawUrl, options = {}) {
  const requestId = options.requestId;
  const validation = validateUrl(rawUrl);

  if (!validation.valid) {
    throw new ParsingError({
      code: validation.code || ERROR_CODES.URL_INVALID,
      stage: STAGES.URL_VALIDATION,
      message: validation.error,
      userMessage: validation.error,
      technicalMessage: `URL validation failed: ${validation.error}`,
      retryable: false,
      fallbackAvailable: true,
      inputType: 'url',
      requestId,
      details: { rawUrl }
    });
  }

  let currentUrl = validation.url;
  let redirectCount = 0;
  let response;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);

  try {
    while (true) {
      // Pre-flight DNS & IP check on every hop to prevent DNS rebinding
      try {
        await assertPublicDnsResolution(currentUrl.hostname);
      } catch (dnsErr) {
        throw new ParsingError({
          code: dnsErr.code || ERROR_CODES.URL_DNS_FAILED,
          stage: STAGES.URL_FETCH,
          message: dnsErr.message,
          userMessage: dnsErr.code === ERROR_CODES.URL_FORBIDDEN_HOST
            ? 'Access to internal or private network addresses is forbidden.'
            : `Could not resolve hostname "${currentUrl.hostname}". Please verify the URL.`,
          technicalMessage: dnsErr.message,
          retryable: false,
          fallbackAvailable: true,
          inputType: 'url',
          requestId,
          details: { hostname: currentUrl.hostname }
        });
      }

      try {
        response = await fetch(currentUrl.href, {
          signal: controller.signal,
          headers: {
            'User-Agent': DEFAULT_USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache'
          },
          redirect: 'manual' // Inspect every redirect hop for SSRF
        });
      } catch (netErr) {
        if (netErr.name === 'AbortError') {
          throw new ParsingError({
            code: ERROR_CODES.URL_TIMEOUT,
            stage: STAGES.URL_FETCH,
            message: 'URL request timed out (10s).',
            userMessage: 'The job posting took too long to respond (10s timeout). The site may be slow or blocking automated requests.',
            technicalMessage: `AbortError after ${URL_FETCH_TIMEOUT_MS}ms`,
            retryable: true,
            fallbackAvailable: true,
            inputType: 'url',
            requestId,
            details: { url: currentUrl.href }
          });
        }
        throw new ParsingError({
          code: ERROR_CODES.URL_NETWORK_FAILED,
          stage: STAGES.URL_FETCH,
          message: netErr.message,
          userMessage: 'Network connection to the job posting server failed. Please check the URL or paste the job description directly.',
          technicalMessage: netErr.message,
          retryable: true,
          fallbackAvailable: true,
          inputType: 'url',
          requestId,
          details: { url: currentUrl.href }
        });
      }

      // Handle HTTP redirects manually
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        redirectCount++;
        if (redirectCount > MAX_REDIRECTS) {
          throw new ParsingError({
            code: ERROR_CODES.URL_TOO_MANY_REDIRECTS,
            stage: STAGES.URL_FETCH,
            message: `Too many redirects (exceeded limit of ${MAX_REDIRECTS}).`,
            userMessage: 'The job posting URL redirected too many times.',
            technicalMessage: `Exceeded MAX_REDIRECTS (${MAX_REDIRECTS})`,
            retryable: false,
            fallbackAvailable: true,
            inputType: 'url',
            requestId
          });
        }

        const location = response.headers.get('location');
        if (!location) {
          throw new ParsingError({
            code: ERROR_CODES.URL_INVALID,
            stage: STAGES.URL_FETCH,
            message: 'Redirect missing Location header.',
            userMessage: 'The job posting redirected with an invalid location header.',
            technicalMessage: 'HTTP redirect response without Location header',
            retryable: false,
            fallbackAvailable: true,
            inputType: 'url',
            requestId
          });
        }

        const nextUrl = new URL(location, currentUrl.href);
        const nextValidation = validateUrl(nextUrl.href);
        if (!nextValidation.valid) {
          throw new ParsingError({
            code: ERROR_CODES.URL_REDIRECT_FORBIDDEN,
            stage: STAGES.URL_FETCH,
            message: `Redirect to unsafe target: ${nextValidation.error}`,
            userMessage: 'The job posting attempted to redirect to an invalid or restricted destination.',
            technicalMessage: `Invalid redirect target: ${nextValidation.error}`,
            retryable: false,
            fallbackAvailable: true,
            inputType: 'url',
            requestId,
            details: { target: nextUrl.href }
          });
        }

        currentUrl = nextValidation.url;
        continue;
      }

      break;
    }

    // Handle HTTP status errors
    if (!response.ok) {
      let code = ERROR_CODES.URL_NETWORK_FAILED;
      let userMsg = `The website returned HTTP ${response.status}.`;
      let retryable = false;

      if (response.status === 401 || response.status === 403) {
        code = ERROR_CODES.URL_HTTP_403;
        userMsg = `The job board blocked automated access (HTTP ${response.status} Forbidden). Try copying and pasting the job description directly.`;
      } else if (response.status === 404 || response.status === 410) {
        code = ERROR_CODES.URL_HTTP_404;
        userMsg = 'This job posting was not found (HTTP 404). It may have expired or been removed.';
      } else if (response.status === 429) {
        code = ERROR_CODES.URL_HTTP_429;
        userMsg = 'The website is temporarily rate-limiting requests (HTTP 429). Please wait a moment or paste the job description directly.';
        retryable = true;
      } else if (response.status >= 500) {
        code = ERROR_CODES.URL_HTTP_5XX;
        userMsg = `The target job website is experiencing server issues (HTTP ${response.status}). Please try again later or paste the text directly.`;
        retryable = true;
      }

      throw new ParsingError({
        code,
        stage: STAGES.URL_FETCH,
        message: `URL returned HTTP ${response.status} (${response.statusText})`,
        userMessage: userMsg,
        technicalMessage: `HTTP ${response.status} ${response.statusText}`,
        retryable,
        fallbackAvailable: true,
        inputType: 'url',
        requestId,
        httpStatus: response.status,
        details: { status: response.status, statusText: response.statusText, url: currentUrl.href }
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml') && !contentType.includes('text/plain')) {
      throw new ParsingError({
        code: ERROR_CODES.CONTENT_UNSUPPORTED_TYPE,
        stage: STAGES.CONTENT_EXTRACTION,
        message: `Unsupported content type: ${contentType.split(';')[0]}`,
        userMessage: `This URL points to a ${contentType.split(';')[0]} file. Only HTML web pages and text are supported. Please copy and paste the text directly.`,
        technicalMessage: `Received Content-Type: ${contentType}`,
        retryable: false,
        fallbackAvailable: true,
        inputType: 'url',
        requestId
      });
    }

    // Fast-fail if Content-Length header is oversized
    const declaredLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (declaredLength > MAX_RESPONSE_BYTES) {
      throw new ParsingError({
        code: ERROR_CODES.CONTENT_TOO_LARGE,
        stage: STAGES.CONTENT_EXTRACTION,
        message: `Page too large (${Math.round(declaredLength / 1024)}KB). Maximum is ${MAX_RESPONSE_BYTES / 1024}KB.`,
        userMessage: 'The web page content exceeds the maximum size limit (2MB). Please paste the job description directly.',
        technicalMessage: `Content-Length header declared ${declaredLength} bytes`,
        retryable: false,
        fallbackAvailable: true,
        inputType: 'url',
        requestId
      });
    }

    // Stream and consume body safely
    let html;
    try {
      html = await safeReadResponseBody(response);
    } catch (streamErr) {
      if (streamErr.code === ERROR_CODES.CONTENT_TOO_LARGE) {
        throw new ParsingError({
          code: ERROR_CODES.CONTENT_TOO_LARGE,
          stage: STAGES.CONTENT_EXTRACTION,
          message: streamErr.message,
          userMessage: 'The web page content exceeded the 2MB size limit while downloading.',
          technicalMessage: streamErr.message,
          retryable: false,
          fallbackAvailable: true,
          inputType: 'url',
          requestId
        });
      }
      throw streamErr;
    }

    // Extract JSON-LD JobPosting before stripping script tags
    const jsonLdData = contentType.includes('text/plain') ? null : extractJsonLdJobPosting(html);

    // Extract readable text and title
    let text = contentType.includes('text/plain') ? html.slice(0, MAX_TEXT_LENGTH) : extractTextFromHtml(html);
    const title = contentType.includes('text/plain') ? '' : extractTitle(html);

    // If text extraction yielded minimal text, inspect for SPA shells or CAPTCHA interstitials
    if (!text || text.trim().length < 50) {
      const barrier = detectContentBarriers(html, text);
      if (barrier.isCaptcha) {
        throw new ParsingError({
          code: ERROR_CODES.URL_CAPTCHA_DETECTED,
          stage: STAGES.CONTENT_EXTRACTION,
          message: 'Bot challenge detected.',
          userMessage: barrier.reason,
          technicalMessage: 'Detected Cloudflare Turnstile / Bot verification challenge',
          retryable: false,
          fallbackAvailable: true,
          inputType: 'url',
          requestId
        });
      }
      if (barrier.isSpa) {
        throw new ParsingError({
          code: ERROR_CODES.CONTENT_JAVASCRIPT_REQUIRED,
          stage: STAGES.CONTENT_EXTRACTION,
          message: 'JavaScript execution required for this Single Page Application.',
          userMessage: barrier.reason,
          technicalMessage: 'Found empty root container (#root/#app) with < 50 extracted characters',
          retryable: false,
          fallbackAvailable: true,
          inputType: 'url',
          requestId,
          details: { detectedTitle: title }
        });
      }
    }

    // If JSON-LD provided a rich description and text extraction was sparse, prefer JSON-LD
    if (jsonLdData && jsonLdData.description && jsonLdData.description.length > text.length) {
      text = jsonLdData.description.slice(0, MAX_TEXT_LENGTH);
    }

    if (!text || text.trim().length < 20) {
      throw new ParsingError({
        code: ERROR_CODES.CONTENT_TOO_SHORT,
        stage: STAGES.CONTENT_EXTRACTION,
        message: 'Could not extract meaningful text from this URL.',
        userMessage: 'We could not extract meaningful job text from this page. Try pasting the job description text directly.',
        technicalMessage: `Extracted length: ${text ? text.trim().length : 0} characters. Minimum required: 20 characters.`,
        retryable: false,
        fallbackAvailable: true,
        inputType: 'url',
        requestId
      });
    }

    return {
      text: text.trim(),
      title,
      sourceUrl: currentUrl.href,
      jsonLd: jsonLdData
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  fetchUrlAsText,
  validateUrl,
  extractTextFromHtml,
  extractTitle,
  extractJsonLdJobPosting,
  isPrivateOrRestrictedIp,
  assertPublicDnsResolution,
  detectContentBarriers
};
