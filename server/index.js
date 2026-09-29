require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = require('./services/storageService');
const copilotService = require('./services/copilotService');
const { generateColdEmail, parseJobDescription, testAiConnection, listProviderModels, cleanJsonOutput } = require('./services/aiService');
const { parseResumeFile } = require('./services/resumeParser');
const { parseRecipientSheet } = require('./services/sheetParser');
const { fetchUrlAsText } = require('./services/urlScraper');
const { ERROR_CODES, STAGES, ParsingError, generateRequestId } = require('./utils/errorTaxonomy');
const { testSmtpConnection, sendEmailMessage, sendEmailMessageWithRetry, classifySmtpError, dispatchCampaign } = require('./services/smtpService');

const app = express();
const PORT = process.env.PORT || 5001;

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Safely unlink an ephemeral file if it exists without throwing
function safeUnlink(filePath) {
  if (filePath) {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}
  }
}

// Clean up any stale ephemeral uploads on server boot (Zero File Retention Policy)
try {
  const existingUploads = fs.readdirSync(UPLOADS_DIR);
  for (const f of existingUploads) {
    if (f !== '.gitkeep') {
      safeUnlink(path.join(UPLOADS_DIR, f));
    }
  }
} catch {}

// Setup multer storage
const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'));
  }
});

const upload = multer({
  storage: multerStorage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('./services/firebaseAdmin');

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
}));

// Strictly Scoped CORS (disallow wildcard origin, permit local dev environments)
const STANDARD_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5001',
  'http://127.0.0.1:5001',
  'https://job-mailer-ruddy.vercel.app'
];

function isOriginAllowed(origin) {
  if (!origin) return true;

  const normalizedOrigin = origin.replace(/\/+$/, '');

  if (process.env.ALLOWED_ORIGINS) {
    const customAllowed = process.env.ALLOWED_ORIGINS.split(',')
      .map(s => s.trim().replace(/\/+$/, ''))
      .filter(Boolean);
    return customAllowed.includes(normalizedOrigin);
  }

  if (process.env.NODE_ENV !== 'production') {
    try {
      const parsed = new URL(origin);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        return true;
      }
    } catch {
      return false;
    }
  }

  return STANDARD_ALLOWED_ORIGINS.includes(normalizedOrigin);
}

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: Origin not permitted'));
  },
  credentials: true
}));

// Rate Limiting to prevent quota exhaustion and spam
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please slow down.' }
});

const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many send requests. Please wait before starting another session.' }
});

app.use('/api/ai/', aiLimiter);
app.use('/api/send/', sendLimiter);

// Centralized authentication on mutation routes (TICK-CYC3-06)
app.use('/api/ai', requireAuth);
app.use('/api/upload', requireAuth);
app.use('/api/send', requireAuth);
app.use('/api/config', (req, res, next) => {
  // Allow public GET /api/config for initial app config loading
  if (req.method === 'GET' && (req.path === '/' || req.path === '')) {
    return next();
  }
  return requireAuth(req, res, next);
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------- CONFIG & SETTINGS ----------------------

// One-time migration endpoint to export non-sensitive settings to Firestore (Option 1)
app.get('/api/config/migration-export', (req, res) => {
  try {
    const publicConfig = storage.getPublicConfig();
    res.json(publicConfig);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get public masked configuration
app.get('/api/config', (req, res) => {
  try {
    const config = storage.getPublicConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save / Update AI Provider settings
app.post('/api/config/ai', (req, res) => {
  try {
    const { providerKey, apiKey, model, baseURL, enabled, keyName, savedKeys, selectedKeyId, deleteKeyId, renameKeyId, newName } = req.body;
    if (!providerKey) {
      return res.status(400).json({ error: 'providerKey is required' });
    }
    const updated = storage.updateAiProvider(providerKey, { apiKey, model, baseURL, enabled, keyName, savedKeys, selectedKeyId, deleteKeyId, renameKeyId, newName });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set active AI Provider
app.post('/api/config/ai/active', (req, res) => {
  try {
    const { providerKey } = req.body;
    if (!providerKey) {
      return res.status(400).json({ error: 'providerKey is required' });
    }
    const updated = storage.setActiveAiProvider(providerKey);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test AI Provider Connection
app.post('/api/config/ai/test', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { providerKey, apiKey, model, baseURL, selectedKeyId } = req.body || {};
    if (!providerKey) {
      return res.status(400).json({ success: false, error: 'providerKey is required' });
    }

    // Default provider base URLs
    const DEFAULT_BASE_URLS = {
      gemini: 'https://generativelanguage.googleapis.com',
      openai: 'https://api.openai.com/v1',
      groq: 'https://api.groq.com/openai/v1',
      grok: 'https://api.x.ai/v1',
      nvidia: 'https://integrate.api.nvidia.com/v1',
      custom: 'https://api.openai.com/v1'
    };

    const DEFAULT_MODELS = {
      gemini: 'gemini-1.5-flash',
      openai: 'gpt-4o-mini',
      groq: 'qwen/qwen3.8-27b',
      grok: 'grok-2-1212',
      nvidia: 'meta/llama-3.1-70b-instruct',
      copilot: 'gpt-4o',
      custom: 'gpt-4o'
    };

    // Server-side baseURL resolution: use client-supplied string if non-empty, otherwise fallback to provider default
    let effectiveBaseUrl = (baseURL && typeof baseURL === 'string' && baseURL.trim())
      ? baseURL.trim()
      : (DEFAULT_BASE_URLS[providerKey] || '');

    let effectiveModel = (model && typeof model === 'string' && model.trim())
      ? model.trim()
      : (DEFAULT_MODELS[providerKey] || '');

    let effectiveApiKey = (apiKey && typeof apiKey === 'string' && !apiKey.includes('...') && !apiKey.includes('••')) ? apiKey.trim() : '';

    // If apiKey not sent or masked, fall back to decrypted storage
    if (!effectiveApiKey) {
      try {
        const fullConfig = storage.getDecryptedConfig();
        const savedProvider = fullConfig?.aiProviders?.[providerKey];
        if (savedProvider && Array.isArray(savedProvider.savedKeys) && savedProvider.savedKeys.length > 0) {
          const lookupId = selectedKeyId || savedProvider.selectedKeyId;
          const selected = savedProvider.savedKeys.find(k => k.id === lookupId) || savedProvider.savedKeys[0];
          if (selected?.apiKey && !selected.apiKey.includes('...') && !selected.apiKey.includes('••')) {
            effectiveApiKey = selected.apiKey;
          }
          if (!model && savedProvider.model) effectiveModel = savedProvider.model;
          if (!baseURL && savedProvider.baseURL) effectiveBaseUrl = savedProvider.baseURL;
        } else if (savedProvider && savedProvider.apiKey && !savedProvider.apiKey.includes('...') && !savedProvider.apiKey.includes('••')) {
          effectiveApiKey = savedProvider.apiKey;
          if (!model && savedProvider.model) effectiveModel = savedProvider.model;
          if (!baseURL && savedProvider.baseURL) effectiveBaseUrl = savedProvider.baseURL;
        }
        if (!effectiveApiKey && savedProvider?.apiKey && !savedProvider.apiKey.includes('...') && !savedProvider.apiKey.includes('••')) {
          effectiveApiKey = savedProvider.apiKey;
        }
        if (!effectiveApiKey && Array.isArray(savedProvider?.savedKeys)) {
          const anyValid = savedProvider.savedKeys.find(k => k.apiKey && !k.apiKey.includes('...') && !k.apiKey.includes('••'));
          if (anyValid) effectiveApiKey = anyValid.apiKey;
        }
      } catch (storageErr) {
        console.error(`[AI Test] Warning reading decrypted storage for ${providerKey}:`, storageErr.message);
      }
    } else {
      // Sync valid key to local storage so server stays in sync
      try {
        storage.updateAiProvider(providerKey, { apiKey: effectiveApiKey, selectedKeyId, model: effectiveModel, baseURL: effectiveBaseUrl });
      } catch (syncErr) {
        console.error(`[AI Test] Notice syncing key for ${providerKey}:`, syncErr.message);
      }
    }

    if (!effectiveApiKey) {
      if (providerKey === 'copilot') {
        return res.status(400).json({
          success: false,
          error: 'GitHub authorization required. Please connect your GitHub account via "Connect GitHub Copilot".'
        });
      }
      return res.status(400).json({ success: false, error: 'API key is required to test connection.' });
    }

    const configToTest = {
      apiKey: effectiveApiKey,
      model: effectiveModel,
      baseURL: effectiveBaseUrl
    };

    const result = await testAiConnection(providerKey, configToTest);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error(`[AI Test] Underlying error testing ${req.body?.providerKey || 'unknown'}:`, err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error while testing AI connection' });
  }
});

// List available models for a provider
app.post('/api/config/ai/models', async (req, res) => {
  try {
    const { providerKey, apiKey, selectedKeyId } = req.body || {};
    if (!providerKey) {
      return res.status(400).json({ success: false, error: 'providerKey is required' });
    }

    let effectiveApiKey = (apiKey && typeof apiKey === 'string' && !apiKey.includes('...') && !apiKey.includes('••')) ? apiKey.trim() : '';
    if (!effectiveApiKey) {
      try {
        const fullConfig = storage.getDecryptedConfig();
        const savedProvider = fullConfig?.aiProviders?.[providerKey];
        if (savedProvider && Array.isArray(savedProvider.savedKeys) && savedProvider.savedKeys.length > 0) {
          const lookupId = selectedKeyId || savedProvider.selectedKeyId;
          const selected = savedProvider.savedKeys.find(k => k.id === lookupId) || savedProvider.savedKeys[0];
          if (selected?.apiKey && !selected.apiKey.includes('...') && !selected.apiKey.includes('••')) {
            effectiveApiKey = selected.apiKey;
          }
        } else if (savedProvider && savedProvider.apiKey && !savedProvider.apiKey.includes('...') && !savedProvider.apiKey.includes('••')) {
          effectiveApiKey = savedProvider.apiKey;
        }
        if (!effectiveApiKey && savedProvider?.apiKey && !savedProvider.apiKey.includes('...') && !savedProvider.apiKey.includes('••')) {
          effectiveApiKey = savedProvider.apiKey;
        }
        if (!effectiveApiKey && Array.isArray(savedProvider?.savedKeys)) {
          const anyValid = savedProvider.savedKeys.find(k => k.apiKey && !k.apiKey.includes('...') && !k.apiKey.includes('••'));
          if (anyValid) effectiveApiKey = anyValid.apiKey;
        }
      } catch (storageErr) {
        console.error(`[AI Models] Warning reading storage for ${providerKey}:`, storageErr.message);
      }
    } else {
      // Sync valid key to local storage so server stays in sync
      try {
        storage.updateAiProvider(providerKey, { apiKey: effectiveApiKey, selectedKeyId });
      } catch (syncErr) {
        console.error(`[AI Models] Notice syncing key for ${providerKey}:`, syncErr.message);
      }
    }

    if (!effectiveApiKey) {
      if (providerKey === 'copilot') {
        const result = await listProviderModels('copilot', '');
        return res.status(200).json(result);
      }
      return res.status(400).json({ success: false, error: 'API key is required to list models.' });
    }

    const result = await listProviderModels(providerKey, effectiveApiKey);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error(`[AI Models] Error listing models for ${req.body?.providerKey}:`, err.message);
    return res.status(500).json({ success: false, error: err.message || 'Failed to list models' });
  }
});

// Start GitHub Copilot Device Code Authorization Flow
app.post('/api/copilot/device-code', async (req, res) => {
  try {
    const flowData = await copilotService.startDeviceFlow();
    res.json(flowData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Current Active GitHub Copilot Device Flow (if pending)
app.get('/api/copilot/current-flow', (req, res) => {
  try {
    const flow = copilotService.getPendingDeviceFlow();
    res.json({ active: Boolean(flow), flow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel GitHub Copilot Device Code Authorization Flow
app.post('/api/copilot/cancel-flow', (req, res) => {
  try {
    copilotService.clearPendingDeviceFlow();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check GitHub Copilot Device Code Authorization Status
app.post('/api/copilot/check-status', async (req, res) => {
  try {
    const { deviceCode, autoActivate } = req.body || {};
    const result = await copilotService.checkDeviceStatus(deviceCode);

    if (result.status === 'authorized' && result.accessToken) {
      // Automatically save and encrypt token under 'copilot' provider
      storage.updateAiProvider('copilot', {
        apiKey: result.accessToken,
        keyName: 'GitHub Copilot Token',
        enabled: true
      });

      let updatedConfig;
      if (autoActivate) {
        updatedConfig = storage.setActiveAiProvider('copilot');
      } else {
        updatedConfig = storage.getPublicConfig();
      }

      return res.json({
        status: 'authorized',
        message: 'Successfully authenticated with GitHub Copilot!',
        config: updatedConfig
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Save or Update SMTP Profile
app.post('/api/config/smtp', (req, res) => {
  try {
    const profileData = req.body;
    if (!profileData.host || !profileData.username) {
      return res.status(400).json({ error: 'Host and username/email are required' });
    }
    const updated = storage.saveSmtpProfile(profileData);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete SMTP Profile
app.delete('/api/config/smtp/:id', (req, res) => {
  try {
    const updated = storage.deleteSmtpProfile(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set Default SMTP Profile
app.post('/api/config/smtp/:id/default', (req, res) => {
  try {
    const updated = storage.setDefaultSmtpProfile(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test SMTP Connection
app.post('/api/config/smtp/test', async (req, res) => {
  try {
    let profile = { ...req.body };
    if (!profile.password && profile.appPassword) {
      profile.password = profile.appPassword;
    }
    // If testing an existing profile without re-typing password
    if ((profile.id || profile.username || profile.email) && !profile.password) {
      const fullConfig = storage.getDecryptedConfig();
      const existing = (fullConfig.smtpProfiles || []).find(p =>
        (profile.id && p.id === profile.id) ||
        (profile.username && (p.username === profile.username || p.fromEmail === profile.username)) ||
        (profile.email && (p.username === profile.email || p.fromEmail === profile.email))
      );
      if (existing) {
        profile.password = existing.password;
        profile.host = profile.host || existing.host;
        profile.port = profile.port || existing.port;
        profile.username = profile.username || existing.username;
        profile.encryption = profile.encryption || existing.encryption;
      }
    }

    const result = await testSmtpConnection(profile);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update sending preferences
app.post('/api/config/preferences', (req, res) => {
  try {
    const updated = storage.updatePreferences(req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update custom AI prompts
app.post('/api/config/prompts', (req, res) => {
  try {
    const updated = storage.updateCustomPrompts(req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update candidate profile
app.post('/api/config/candidate-profile', (req, res) => {
  try {
    const updated = storage.updateCandidateProfile(req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync full or partial settings to server storage
app.post('/api/config/sync', (req, res) => {
  try {
    const updated = storage.saveFullSettings(req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset all stored credentials, profiles, uploads, and logs (Danger Zone)
app.post('/api/config/reset', (req, res) => {
  try {
    const publicConfig = storage.getPublicConfig();
    // Clear all AI provider credentials
    for (const key of Object.keys(publicConfig.aiProviders || {})) {
      storage.updateAiProvider(key, { apiKey: '', enabled: true });
    }
    // Delete all SMTP profiles
    for (const profile of (publicConfig.smtpProfiles || [])) {
      storage.deleteSmtpProfile(profile.id);
    }
    // Reset preferences and candidate profile to default
    storage.updatePreferences({ delaySeconds: 3, attachResume: true });
    storage.updateCandidateProfile({ fullName: '', email: '', phone: '' });
    // Reset custom AI prompts to default
    storage.updateCustomPrompts({
      coldEmail: { enabled: false, content: '' },
      jdParser: { enabled: false, content: '' }
    });
    // Clear outreach audit logs
    storage.clearCampaignLogs();

    // Purge uploaded candidate resumes from disk to protect PII
    if (fs.existsSync(UPLOADS_DIR)) {
      const files = fs.readdirSync(UPLOADS_DIR);
      for (const file of files) {
        if (file !== '.gitkeep' && file !== '.DS_Store') {
          try {
            fs.unlinkSync(path.join(UPLOADS_DIR, file));
          } catch (e) {
            console.error(`Error deleting upload file ${file}:`, e);
          }
        }
      }
    }

    // Clear in-memory token cache for Copilot
    try {
      copilotService.clearSessionCache();
    } catch {}

    res.json(storage.getPublicConfig());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------- UPLOADS & PARSING (EPHEMERAL ONLY) ----------------------

// Resume Upload & Parse (PDF / DOCX) - Ephemeral session storage only
app.post('/api/upload/resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No resume file uploaded' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!['.pdf', '.docx', '.txt'].includes(ext)) {
      safeUnlink(req.file.path);
      return res.status(400).json({ error: 'Unsupported file type. Please upload a PDF or DOCX file.' });
    }

    if (req.file.size > 5 * 1024 * 1024) {
      safeUnlink(req.file.path);
      return res.status(400).json({ error: 'Resume file size exceeds the 5MB limit.' });
    }

    // Prune any stale ephemeral resume files in UPLOADS_DIR (Zero File Retention)
    try {
      const files = fs.readdirSync(UPLOADS_DIR);
      for (const file of files) {
        if (file !== req.file.filename && file !== '.gitkeep') {
          safeUnlink(path.join(UPLOADS_DIR, file));
        }
      }
    } catch {}

    const parsed = await parseResumeFile(req.file.path, req.file.originalname);
    res.json({
      fileId: req.file.filename,
      originalFilename: req.file.originalname,
      sizeBytes: req.file.size,
      text: parsed.rawText,
      summarySnippet: parsed.summarySnippet,
      wordCount: parsed.wordCount,
      detectedName: parsed.detectedName,
      detectedEmail: parsed.detectedEmail,
      detectedPhone: parsed.detectedPhone
    });
  } catch (err) {
    safeUnlink(req.file?.path);
    console.error('Resume upload/parse error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Recipient Spreadsheet Upload & Parse (.xlsx, .xls, .csv) - Immediately deleted after parsing
app.post('/api/upload/recipients', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No spreadsheet file uploaded' });
  }

  try {
    const contactedMap = storage.getRecentlyContactedMap ? storage.getRecentlyContactedMap(30) : new Map();
    const parsed = parseRecipientSheet(req.file.path, req.file.originalname, { contactedMap });
    res.json(parsed);
  } catch (err) {
    console.error('Spreadsheet upload/parse error:', err);
    res.status(400).json({ error: err.message });
  } finally {
    // Guarantees uploaded spreadsheet is strictly ephemeral and deleted immediately after parsing
    safeUnlink(req.file?.path);
  }
});

// Explicit session cleanup for uploaded temporary files
app.post('/api/upload/cleanup', (req, res) => {
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    let cleaned = 0;
    for (const file of files) {
      if (file !== '.gitkeep') {
        safeUnlink(path.join(UPLOADS_DIR, file));
        cleaned++;
      }
    }
    res.json({ success: true, cleaned });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Explicit deletion of specific ephemeral resume file (TICK-CYC3-13 / C4)
app.delete('/api/upload/resume', (req, res) => {
  const fileId = req.body?.fileId || req.query?.fileId;
  if (!fileId) {
    return res.status(400).json({ error: 'fileId is required to delete resume' });
  }
  const { attachmentPath } = resolveResumeAttachment(fileId);
  if (attachmentPath && fs.existsSync(attachmentPath)) {
    safeUnlink(attachmentPath);
    console.log(`[Zero File Retention] Explicitly deleted ephemeral resume: ${fileId}`);
    return res.json({ success: true, message: 'Resume deleted successfully' });
  }
  return res.json({ success: true, message: 'Resume file already cleared or not found' });
});

// ---------------------- AI EMAIL GENERATION ----------------------

// Helper to resolve AI provider configuration from saved storage & client overrides
function resolveAiProviderConfig({ providerKey: requestedProvider, providerConfig: clientProviderConfig } = {}, callerUid) {
  const fullConfig = storage.getDecryptedConfig();
  const providerKey = requestedProvider || clientProviderConfig?.providerKey || fullConfig.activeProvider || 'gemini';
  const savedProvider = fullConfig.aiProviders?.[providerKey] || {};

  let apiKey = '';
  if (clientProviderConfig?.apiKey && typeof clientProviderConfig.apiKey === 'string' && !clientProviderConfig.apiKey.includes('...') && !clientProviderConfig.apiKey.includes('••')) {
    apiKey = clientProviderConfig.apiKey.trim();
  }

  // Fall back to saved decrypted server configuration for all callers (authenticated and offline)
  if (!apiKey) {
    if (savedProvider.apiKey && !savedProvider.apiKey.includes('...') && !savedProvider.apiKey.includes('••')) {
      apiKey = savedProvider.apiKey;
    } else if (Array.isArray(savedProvider.savedKeys) && savedProvider.savedKeys.length > 0) {
      const lookupId = clientProviderConfig?.selectedKeyId || savedProvider.selectedKeyId;
      const selected = savedProvider.savedKeys.find(k => k.id === lookupId) || savedProvider.savedKeys[0];
      if (selected?.apiKey && !selected.apiKey.includes('...') && !selected.apiKey.includes('••')) {
        apiKey = selected.apiKey;
      }
    }
  }

  const model = clientProviderConfig?.model || savedProvider.model || '';
  const baseURL = clientProviderConfig?.baseURL || savedProvider.baseURL || '';

  return {
    providerKey,
    providerConfig: {
      ...savedProvider,
      ...clientProviderConfig,
      apiKey,
      model: model || savedProvider.model,
      baseURL: baseURL || savedProvider.baseURL
    }
  };
}

// Helper to resolve custom prompt override from request or saved configuration
function resolveCustomPrompt(taskKey, explicitPrompt) {
  if (explicitPrompt && typeof explicitPrompt === 'string' && explicitPrompt.trim().length > 0) {
    return explicitPrompt.trim();
  }
  const config = storage.getDecryptedConfig();
  const taskPrompt = config.customPrompts?.[taskKey];
  if (taskPrompt?.enabled && typeof taskPrompt.content === 'string' && taskPrompt.content.trim().length > 0) {
    return taskPrompt.content.trim();
  }
  return undefined;
}

// Generate single cold email
app.post('/api/ai/generate', async (req, res) => {
  try {
    const {
      resumeText,
      jobDescription,
      recipient,
      customTone,
      senderName,
      customPrompt,
      customSystemPrompt: explicitSystemPrompt
    } = req.body;

    const { providerKey, providerConfig } = resolveAiProviderConfig(req.body, req.uid);

    if (!providerConfig || !providerConfig.apiKey) {
      return res.status(400).json({ error: `Provider ${providerKey} is not configured with an API key.` });
    }

    const customSystemPrompt = resolveCustomPrompt('coldEmail', explicitSystemPrompt || customPrompt);

    const effectiveJd = (jobDescription && typeof jobDescription === 'string' && jobDescription.trim())
      || (recipient?.jobDescription && typeof recipient.jobDescription === 'string' && recipient.jobDescription.trim())
      || '';

    const emailContent = await generateColdEmail({
      providerKey,
      providerConfig,
      resumeText,
      jobDescription: effectiveJd,
      recipient,
      customTone,
      senderName,
      customSystemPrompt
    });

    res.json({
      success: true,
      provider: providerKey,
      model: providerConfig.model,
      email: emailContent
    });
  } catch (err) {
    console.error('AI email generation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Adapt a single generic email draft for a specific recipient:
 * - Customizes greeting with recipient name and company if present, or preserves generated greeting
 * - Adapts subject line if it references placeholder company/team
 * - Preserves grounding audit and original formatting
 */
function adaptGenericEmailForRecipient(genericEmail, recipient, senderName) {
  if (!genericEmail || typeof genericEmail !== 'object') {
    return genericEmail;
  }

  // Defensive check: If genericEmail.body contains raw JSON or markdown fences, sanitize first
  let baseSubject = genericEmail.subject || '';
  let baseBody = genericEmail.body || '';

  if (typeof baseBody === 'string' && (baseBody.trim().startsWith('{') || baseBody.includes('```'))) {
    const recovered = cleanJsonOutput(baseBody);
    if (recovered && recovered.body) {
      baseBody = recovered.body;
      if (!baseSubject && recovered.subject) baseSubject = recovered.subject;
    } else {
      baseBody = baseBody.replace(/^```(?:json)?\s*/gi, '').replace(/\s*```\s*$/gi, '').trim();
    }
  }

  const rawName = (recipient?.name && typeof recipient.name === 'string') ? recipient.name.trim() : '';
  const rawCompany = (recipient?.company && typeof recipient.company === 'string') ? recipient.company.trim() : '';
  const rawRole = (recipient?.role && typeof recipient.role === 'string') ? recipient.role.trim() : '';
  const isGenericName = /^(hiring\s*manager|hiring\s*team|team|recruiter)$/i.test(rawName);
  const firstName = (rawName && !isGenericName) ? rawName.split(/\s+/)[0] : '';

  let subject = baseSubject || `Inquiry: Opportunities at ${rawCompany || 'your team'}`;
  let body = baseBody || '';

  // Strip outer quotes from subject
  subject = subject.replace(/^subject:\s*/i, '').replace(/^["']+|["']+$/g, '').trim();

  // 1. Personalize Subject Line
  if (rawCompany) {
    subject = subject.replace(/\[(?:Company\s*Name|Company|Organization)\]/gi, rawCompany);
    subject = subject.replace(/\bat\s+your\s+team\b/gi, `at ${rawCompany}`);
    subject = subject.replace(/\bat\s+\[?Company\]?\b/gi, `at ${rawCompany}`);
  }
  if (rawRole) {
    subject = subject.replace(/\[(?:Role|Target\s*Role|Position|Job\s*Title)\]/gi, rawRole);
  }

  // 2. Personalize Greeting & Body
  let greeting = '';
  if (firstName) {
    greeting = `Hi ${firstName},`;
  } else if (rawCompany) {
    greeting = `Hi ${rawCompany} Team,`;
  }

  if (greeting && body) {
    const greetingMatch = body.match(/^(?:Hi|Hello|Dear|Hey)\s+[^,\n]+,|\b(?:To the\s+)?Hiring\s+(?:Manager|Team)\b,?/i);
    if (greetingMatch) {
      body = body.replace(greetingMatch[0], greeting);
    } else {
      const firstLineEnd = body.indexOf('\n');
      if (firstLineEnd > 0 && firstLineEnd < 50 && /^(?:Hi|Hello|Dear|Hey)\b/i.test(body.slice(0, firstLineEnd))) {
        body = greeting + body.slice(firstLineEnd);
      }
    }
  }

  if (rawRole) {
    body = body.replace(/\[(?:Role|Target\s*Role|Position|Job\s*Title)\]/gi, rawRole);
  }
  if (firstName) {
    body = body.replace(/\[(?:Recipient\s*Name|Name|Hiring\s*Manager)\]/gi, firstName);
  }
  if (rawCompany) {
    body = body.replace(/\[(?:Company\s*Name|Company|Organization)\]/gi, rawCompany);
    body = body.replace(/\b(?:at\s+)?your\s+team(['’]s)?\b/gi, (match) => {
      if (/team['’]s/i.test(match)) return `${rawCompany}'s`;
      if (/^at\s+/i.test(match)) return `at ${rawCompany}`;
      return match;
    });
  }

  return {
    ...genericEmail,
    subject,
    body,
    groundingAudit: genericEmail.groundingAudit || null
  };
}

// Parse a raw job description (text or URL) using AI to extract structured recipient data
app.post('/api/ai/parse-jd', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || req.body?.requestId || generateRequestId();

  try {
    const { mode, rawText, url } = req.body;

    if (!mode || (mode !== 'text' && mode !== 'url')) {
      throw new ParsingError({
        code: ERROR_CODES.URL_INVALID,
        stage: STAGES.URL_VALIDATION,
        message: 'Invalid mode. Must be "text" or "url".',
        userMessage: 'Invalid mode selected. Please select either "Paste JD Text" or "Paste URL".',
        technicalMessage: `Received invalid mode: "${mode}"`,
        retryable: false,
        fallbackAvailable: false,
        requestId
      });
    }

    // Resolve AI configuration first to prevent open proxy abuse before any network fetch
    const { providerKey, providerConfig } = resolveAiProviderConfig(req.body, req.uid);

    if (!providerConfig || !providerConfig.apiKey) {
      throw new ParsingError({
        code: ERROR_CODES.AI_KEY_MISSING,
        stage: STAGES.AI_CONFIG,
        message: `AI provider ${providerKey} is not configured with an API key.`,
        userMessage: `AI provider "${providerKey}" is not configured with an API key. Please configure your key in Settings.`,
        technicalMessage: `Provider ${providerKey} has empty apiKey`,
        retryable: false,
        fallbackAvailable: false,
        requestId,
        details: { providerKey }
      });
    }

    let textToParse;
    let sourceUrl = null;
    let deterministicData = {};
    let scrapedMeta = null;

    if (mode === 'url') {
      if (!url || typeof url !== 'string' || !url.trim()) {
        throw new ParsingError({
          code: ERROR_CODES.URL_REQUIRED,
          stage: STAGES.URL_VALIDATION,
          message: 'URL is required when mode is "url".',
          userMessage: 'Please provide a job posting URL.',
          technicalMessage: 'Empty or missing url parameter in mode: "url"',
          retryable: false,
          fallbackAvailable: true,
          inputType: 'url',
          requestId
        });
      }

      const scraped = await fetchUrlAsText(url.trim(), { requestId });
      textToParse = scraped.text;
      sourceUrl = scraped.sourceUrl;
      deterministicData = scraped.jsonLd || {};
      scrapedMeta = {
        title: scraped.title,
        hasJsonLd: Boolean(scraped.jsonLd)
      };
    } else {
      if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 20) {
        throw new ParsingError({
          code: ERROR_CODES.JD_TOO_SHORT,
          stage: STAGES.JD_VALIDATION,
          message: 'Job description text is too short (minimum 20 characters).',
          userMessage: 'Job description text is too short (minimum 20 characters required). Please paste the complete job description.',
          technicalMessage: `Received text length: ${rawText ? rawText.trim().length : 0}`,
          retryable: false,
          fallbackAvailable: false,
          inputType: 'text',
          requestId
        });
      }
      textToParse = rawText.trim();
    }

    const customSystemPrompt = resolveCustomPrompt('jdParser', req.body.customSystemPrompt || req.body.customPrompt);

    const parsed = await parseJobDescription({
      providerKey,
      providerConfig,
      rawText: textToParse,
      customSystemPrompt,
      deterministic: deterministicData,
      requestId
    });

    const durationMs = Date.now() - startTime;
    console.log(`[${requestId}] stage=final_validation status=success duration=${durationMs}ms mode=${mode}`);

    res.json({
      success: true,
      parsed,
      sourceUrl,
      diagnostics: {
        requestId,
        inputType: mode,
        extractionMethod: mode === 'url' ? (scrapedMeta?.hasJsonLd ? 'jsonld+ai' : 'dom+ai') : 'direct_text+ai',
        durationMs
      }
    });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    console.error(`[${requestId}] parse-jd failure:`, err.message || err);

    if (err instanceof ParsingError || (err && err.name === 'ParsingError')) {
      return res.status(err.httpStatus || 400).json(err.toResponse());
    }

    const fallbackErr = new ParsingError({
      code: ERROR_CODES.UNKNOWN_ERROR,
      stage: STAGES.AI_PARSING,
      message: err.message || 'Failed to parse job description.',
      userMessage: err.message || 'Failed to parse job description. Please try pasting the text directly.',
      technicalMessage: err.stack || err.message,
      retryable: true,
      fallbackAvailable: true,
      requestId,
      httpStatus: 500
    });

    res.status(500).json(fallbackErr.toResponse());
  }
});

// Batch generate cold emails for multiple recipients:
// - Generates tailored emails individually (4-worker pool) for recipients with specific JDs
// - Generates ONE generic cold email for recipients without JDs and adapts greeting/company
app.post('/api/ai/batch-generate', async (req, res) => {
  try {
    const {
      resumeText,
      jobDescription,
      recipients,
      customTone,
      senderName,
      customPrompt,
      customSystemPrompt: explicitSystemPrompt
    } = req.body;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients provided' });
    }

    const { providerKey, providerConfig } = resolveAiProviderConfig(req.body, req.uid);

    if (!providerConfig || !providerConfig.apiKey) {
      return res.status(400).json({ error: `Provider ${providerKey} is not configured with an API key.` });
    }

    const customSystemPrompt = resolveCustomPrompt('coldEmail', explicitSystemPrompt || customPrompt);

    const fallbackJd = (typeof jobDescription === 'string' && jobDescription.trim()) ? jobDescription.trim() : '';

    // Inspect incoming recipients and partition them into:
    // a) Those with specific tailoring (dedicated JD or specific target role)
    // b) Those without any specific role or JD (pure generic outreach)
    const withJd = [];
    const withoutJd = [];

    recipients.forEach((recipient, idx) => {
      const hasSpecificJd = Boolean(
        recipient &&
        recipient.jobDescription &&
        typeof recipient.jobDescription === 'string' &&
        recipient.jobDescription.trim().length > 0
      );
      const hasSpecificRole = Boolean(
        recipient &&
        recipient.role &&
        typeof recipient.role === 'string' &&
        recipient.role.trim().length > 0
      );

      if (hasSpecificJd || hasSpecificRole) {
        withJd.push({ recipient, index: idx });
      } else {
        withoutJd.push({ recipient, index: idx });
      }
    });

    const results = Array.from({ length: recipients.length });

    // 1. Process tailored recipients (specific JD or target role) using a 4-worker concurrency pool
    const jdTask = (async () => {
      if (withJd.length === 0) return;

      const CONCURRENCY_LIMIT = 4;
      let nextIndex = 0;

      async function worker() {
        while (nextIndex < withJd.length) {
          const item = withJd[nextIndex++];
          const { recipient, index } = item;
          try {
            const recipientJd = (recipient.jobDescription && typeof recipient.jobDescription === 'string' && recipient.jobDescription.trim())
              ? recipient.jobDescription.trim()
              : fallbackJd;

            const emailContent = await generateColdEmail({
              providerKey,
              providerConfig,
              resumeText,
              jobDescription: recipientJd,
              recipient,
              customTone,
              senderName,
              customSystemPrompt
            });
            results[index] = {
              recipientId: recipient.id,
              recipientEmail: recipient.email,
              success: true,
              email: emailContent
            };
          } catch (genErr) {
            results[index] = {
              recipientId: recipient.id,
              recipientEmail: recipient.email,
              success: false,
              error: genErr.message
            };
          }
        }
      }

      const workers = [];
      const numWorkers = Math.min(CONCURRENCY_LIMIT, withJd.length);
      for (let w = 0; w < numWorkers; w++) {
        workers.push(worker());
      }
      await Promise.all(workers);
    })();

    // 2. For recipients WITHOUT specific Job Descriptions or target roles:
    // Generate ONE generic cold email via generateColdEmail (focusing on candidate core strengths & achievements),
    // then adapt that single generic email for each recipient.
    const genericTask = (async () => {
      if (withoutJd.length === 0) return;

      const genericJd = fallbackJd;

      try {
        const genericEmail = await generateColdEmail({
          providerKey,
          providerConfig,
          resumeText,
          jobDescription: genericJd,
          recipient: {
            name: 'Hiring Manager',
            company: 'your team',
            role: genericJd ? 'the open position' : 'relevant opportunities'
          },
          customTone,
          senderName,
          customSystemPrompt
        });

        // Adapt the single generic email for each recipient without a specific JD
        for (const item of withoutJd) {
          const { recipient, index } = item;
          const adaptedEmail = adaptGenericEmailForRecipient(genericEmail, recipient, senderName);
          results[index] = {
            recipientId: recipient.id,
            recipientEmail: recipient.email,
            success: true,
            email: adaptedEmail
          };
        }
      } catch (genErr) {
        for (const item of withoutJd) {
          const { recipient, index } = item;
          results[index] = {
            recipientId: recipient.id,
            recipientEmail: recipient.email,
            success: false,
            error: genErr.message
          };
        }
      }
    })();

    await Promise.all([jdTask, genericTask]);

    res.json({ success: true, results });
  } catch (err) {
    console.error('Batch generation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------- EMAIL SENDING WITH SSE PROGRESS ----------------------

// Send emails to recipients with real-time SSE progress streaming
// Helpers to resolve SMTP profile & attachment for email sending
function resolveSmtpProfile({ smtpProfileId, smtpProfile: clientSmtpProfile } = {}, fullConfig = {}, callerUid) {
  let profile = null;
  const targetId = smtpProfileId || clientSmtpProfile?.id;
  if (targetId && Array.isArray(fullConfig.smtpProfiles)) {
    profile = fullConfig.smtpProfiles.find(p => p.id === targetId);
  }
  if (!profile && Array.isArray(fullConfig.smtpProfiles) && fullConfig.smtpProfiles.length > 0) {
    profile = fullConfig.smtpProfiles.find(p => p.isDefault) || fullConfig.smtpProfiles[0];
  }

  // Prioritize and merge client-provided SMTP profile (from user's Firebase config)
  if (clientSmtpProfile) {
    profile = {
      ...(profile || {}),
      ...clientSmtpProfile,
      password: (clientSmtpProfile.password && !clientSmtpProfile.password.includes('•••'))
        ? clientSmtpProfile.password
        : (clientSmtpProfile.appPassword && !clientSmtpProfile.appPassword.includes('•••'))
          ? clientSmtpProfile.appPassword
          : (profile?.password || profile?.appPassword || '')
    };
  }

  if (profile && !profile.password && profile.appPassword) {
    profile = { ...profile, password: profile.appPassword };
  }

  return profile;
}

function resolveResumeAttachment(resumeFileId) {
  let attachmentPath = null;
  let attachmentName = null;
  if (resumeFileId && typeof resumeFileId === 'string') {
    const safeFilename = path.basename(resumeFileId);
    const candidatePath = path.resolve(UPLOADS_DIR, safeFilename);
    const uploadsDirResolved = path.resolve(UPLOADS_DIR);
    if (candidatePath.startsWith(uploadsDirResolved + path.sep) && fs.existsSync(candidatePath)) {
      attachmentPath = candidatePath;
      attachmentName = safeFilename.replace(/^\d+-\d+-/, '');
    }
  }
  return { attachmentPath, attachmentName };
}

// Get daily sending statistics and remaining quota (TICK-CYC3-12 / C3)
app.get('/api/send/daily-stats', (req, res) => {
  try {
    const smtpProfileId = req.query.smtpProfileId || null;
    const stats = storage.getDailySendingStats(smtpProfileId);
    res.json({ success: true, ...stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/send/stream', async (req, res) => {
  const {
    recipients, // Array of { id, email, name, company, subject, body }
    resumeFileId,
    delaySeconds = 3,
    concurrency = 1
  } = req.body;

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'No recipients provided for sending.' });
  }
  if (req.body.sendApproved !== true || recipients.some(recipient => recipient?.isApproved !== true)) {
    return res.status(400).json({ error: 'Explicit send confirmation and approval for every recipient are required.' });
  }

  const fullConfig = storage.getDecryptedConfig();
  const profile = resolveSmtpProfile(req.body, fullConfig, req.uid);

  if (!profile || (!profile.password && !profile.appPassword)) {
    return res.status(400).json({
      error: 'No active SMTP account configured. Please configure an SMTP account in Settings first.'
    });
  }

  const { attachmentPath, attachmentName } = resolveResumeAttachment(resumeFileId);

  // Ephemeral cleanup: remove temporary resume once stream finishes
  const cleanupEphemeralResume = () => {
    if (attachmentPath) {
      safeUnlink(attachmentPath);
      console.log(`[Zero File Retention] Cleaned up ephemeral resume: ${attachmentName}`);
    }
  };

  res.on('finish', cleanupEphemeralResume);
  res.on('close', cleanupEphemeralResume);

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const { campaignLogs } = await dispatchCampaign({
    recipients,
    profile,
    attachmentPath,
    attachmentName,
    delaySeconds: Number(delaySeconds) || 3,
    concurrency: Number(concurrency) || 1,
    sendEvent
  });

  // Save campaign logs to persistent store
  storage.addCampaignLogs(campaignLogs);

  res.end();
});

// Standard POST send endpoint (alternative to SSE)
app.post('/api/send', async (req, res) => {
  const {
    recipients,
    resumeFileId,
    delaySeconds = 3,
    concurrency = 1
  } = req.body;

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'No recipients provided.' });
  }
  if (req.body.sendApproved !== true || recipients.some(recipient => recipient?.isApproved !== true)) {
    return res.status(400).json({ error: 'Explicit send confirmation and approval for every recipient are required.' });
  }

  const fullConfig = storage.getDecryptedConfig();
  const profile = resolveSmtpProfile(req.body, fullConfig, req.uid);

  if (!profile || (!profile.password && !profile.appPassword)) {
    return res.status(400).json({
      error: 'No active SMTP account configured. Please add an SMTP profile in Settings.'
    });
  }

  const { attachmentPath, attachmentName } = resolveResumeAttachment(resumeFileId);

  try {
    const { results, campaignLogs } = await dispatchCampaign({
      recipients,
      profile,
      attachmentPath,
      attachmentName,
      delaySeconds: Number(delaySeconds) || 3,
      concurrency: Number(concurrency) || 1
    });

    storage.addCampaignLogs(campaignLogs);
    res.json({ success: true, results });
  } finally {
    // Ephemeral cleanup: remove temporary resume once sending finishes
    if (attachmentPath) {
      safeUnlink(attachmentPath);
      console.log(`[Zero File Retention] Cleaned up ephemeral resume: ${attachmentName}`);
    }
  }
});

// ---------------------- STATUS & AUDIT LOGS ----------------------

// Get outreach logs
app.get('/api/logs', (req, res) => {
  try {
    const logs = storage.getCampaignLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear outreach logs
app.delete('/api/logs', (req, res) => {
  try {
    const empty = storage.clearCampaignLogs();
    res.json(empty);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Global JSON error handler — ensures API never falls through to Express HTML error page
app.use((err, req, res, next) => {
  console.error('[Global Server Error]', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`JDMail Server running on port ${PORT}`);
  });
}

module.exports = { app, isOriginAllowed, adaptGenericEmailForRecipient };
