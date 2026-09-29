/**
 * Error Taxonomy and Diagnostic Protocol for URL & JD Parsing Pipeline
 * Standardizes machine-readable error codes, multi-layered diagnostics, and recovery paths.
 */

const crypto = require('crypto');

const ERROR_CODES = {
  // URL & Network Validation
  URL_REQUIRED: 'URL_REQUIRED',
  URL_INVALID: 'URL_INVALID',
  URL_INVALID_SCHEME: 'URL_INVALID_SCHEME',
  URL_CREDENTIALS_FORBIDDEN: 'URL_CREDENTIALS_FORBIDDEN',
  URL_FORBIDDEN_HOST: 'URL_FORBIDDEN_HOST',
  URL_FORBIDDEN_PORT: 'URL_FORBIDDEN_PORT',
  URL_DNS_FAILED: 'URL_DNS_FAILED',
  URL_REDIRECT_FORBIDDEN: 'URL_REDIRECT_FORBIDDEN',
  URL_TOO_MANY_REDIRECTS: 'URL_TOO_MANY_REDIRECTS',

  // Fetch / HTTP Statuses
  URL_TIMEOUT: 'URL_TIMEOUT',
  URL_NETWORK_FAILED: 'URL_NETWORK_FAILED',
  URL_HTTP_401: 'URL_HTTP_401',
  URL_HTTP_403: 'URL_HTTP_403',
  URL_HTTP_404: 'URL_HTTP_404',
  URL_HTTP_429: 'URL_HTTP_429',
  URL_HTTP_5XX: 'URL_HTTP_5XX',
  URL_CAPTCHA_DETECTED: 'URL_CAPTCHA_DETECTED',
  URL_REQUIRES_LOGIN: 'URL_REQUIRES_LOGIN',

  // Content Extraction
  CONTENT_EMPTY: 'CONTENT_EMPTY',
  CONTENT_TOO_SHORT: 'CONTENT_TOO_SHORT',
  CONTENT_TOO_LARGE: 'CONTENT_TOO_LARGE',
  CONTENT_UNSUPPORTED_TYPE: 'CONTENT_UNSUPPORTED_TYPE',
  CONTENT_JAVASCRIPT_REQUIRED: 'CONTENT_JAVASCRIPT_REQUIRED',
  CONTENT_NOT_JOB_DESCRIPTION: 'CONTENT_NOT_JOB_DESCRIPTION',

  // Direct JD text
  JD_EMPTY: 'JD_EMPTY',
  JD_TOO_SHORT: 'JD_TOO_SHORT',

  // AI Pipeline
  AI_KEY_MISSING: 'AI_KEY_MISSING',
  AI_REQUEST_FAILED: 'AI_REQUEST_FAILED',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',
  AI_AUTH_FAILED: 'AI_AUTH_FAILED',
  AI_INVALID_RESPONSE: 'AI_INVALID_RESPONSE',
  AI_INVALID_JSON: 'AI_INVALID_JSON',
  AI_SCHEMA_VALIDATION_FAILED: 'AI_SCHEMA_VALIDATION_FAILED',
  AI_INCOMPLETE_RESULT: 'AI_INCOMPLETE_RESULT',
  AI_LOW_CONFIDENCE: 'AI_LOW_CONFIDENCE',

  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

const STAGES = {
  URL_VALIDATION: 'url_validation',
  URL_FETCH: 'url_fetch',
  CONTENT_EXTRACTION: 'content_extraction',
  JD_VALIDATION: 'jd_validation',
  AI_CONFIG: 'ai_config',
  AI_DISPATCH: 'ai_dispatch',
  AI_PARSING: 'ai_parsing',
  SCHEMA_VALIDATION: 'schema_validation'
};

/**
 * Generate a consistent, human-readable Request Reference ID.
 * Example: REQ-20260930-A7F92C
 */
function generateRequestId() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `REQ-${dateStr}-${rand}`;
}

/**
 * Standardized Parsing Error class carrying structured machine-readable diagnostics.
 */
class ParsingError extends Error {
  constructor({
    code = ERROR_CODES.UNKNOWN_ERROR,
    stage = STAGES.URL_VALIDATION,
    message,
    userMessage,
    technicalMessage,
    retryable = false,
    fallbackAvailable = false,
    inputType = 'text',
    operation = 'parse_job_description',
    details = {},
    requestId,
    httpStatus = 400
  }) {
    super(message || userMessage || 'Parsing failed.');
    this.name = 'ParsingError';
    this.code = code;
    this.stage = stage;
    this.userMessage = userMessage || message;
    this.technicalMessage = technicalMessage || message;
    this.retryable = Boolean(retryable);
    this.fallbackAvailable = Boolean(fallbackAvailable);
    this.inputType = inputType;
    this.operation = operation;
    this.details = details;
    this.requestId = requestId || generateRequestId();
    this.httpStatus = httpStatus;
    this.timestamp = new Date().toISOString();
  }

  toResponse() {
    return {
      success: false,
      error: this.userMessage,
      errorDetails: {
        code: this.code,
        stage: this.stage,
        message: this.message,
        userMessage: this.userMessage,
        technicalMessage: this.technicalMessage,
        retryable: this.retryable,
        fallbackAvailable: this.fallbackAvailable,
        inputType: this.inputType,
        operation: this.operation,
        details: this.details,
        requestId: this.requestId,
        timestamp: this.timestamp
      },
      diagnostics: {
        requestId: this.requestId,
        failedStage: this.stage,
        errorCode: this.code
      }
    };
  }
}

/**
 * Helper to test if an error object is a ParsingError instance.
 */
function isParsingError(err) {
  return err instanceof ParsingError || (err && err.name === 'ParsingError' && err.code);
}

module.exports = {
  ERROR_CODES,
  STAGES,
  ParsingError,
  generateRequestId,
  isParsingError
};
