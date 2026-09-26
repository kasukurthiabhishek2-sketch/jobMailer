const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = require('./services/storageService');
const { generateColdEmail, testAiConnection } = require('./services/aiService');
const { parseResumeFile } = require('./services/resumeParser');
const { parseRecipientSheet } = require('./services/sheetParser');
const { testSmtpConnection, sendEmailMessage } = require('./services/smtpService');

const app = express();
const PORT = process.env.PORT || 5001;

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

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

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------- CONFIG & SETTINGS ----------------------

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
    const { providerKey, apiKey, model, baseURL, enabled } = req.body;
    if (!providerKey) {
      return res.status(400).json({ error: 'providerKey is required' });
    }
    const updated = storage.updateAiProvider(providerKey, { apiKey, model, baseURL, enabled });
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
  try {
    const { providerKey, apiKey, model, baseURL } = req.body;
    if (!providerKey) {
      return res.status(400).json({ error: 'providerKey is required' });
    }

    let configToTest = { apiKey, model, baseURL };
    // If apiKey not sent (user testing existing saved key), get from decrypted storage
    if (!apiKey) {
      const fullConfig = storage.getDecryptedConfig();
      const savedProvider = fullConfig.aiProviders[providerKey];
      if (savedProvider && savedProvider.apiKey) {
        configToTest.apiKey = savedProvider.apiKey;
        configToTest.model = model || savedProvider.model;
        configToTest.baseURL = baseURL || savedProvider.baseURL;
      }
    }

    const result = await testAiConnection(providerKey, configToTest);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start GitHub Copilot Device Code Authorization Flow
app.post('/api/copilot/device-code', async (req, res) => {
  try {
    const copilotService = require('./services/copilotService');
    const flowData = await copilotService.startDeviceFlow();
    res.json(flowData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check GitHub Copilot Device Code Authorization Status
app.post('/api/copilot/check-status', async (req, res) => {
  try {
    const { deviceCode } = req.body;
    if (!deviceCode) {
      return res.status(400).json({ error: 'deviceCode is required' });
    }

    const copilotService = require('./services/copilotService');
    const result = await copilotService.checkDeviceStatus(deviceCode);

    if (result.status === 'authorized' && result.accessToken) {
      // Automatically save and encrypt token under 'copilot' provider
      const updated = storage.updateAiProvider('copilot', {
        apiKey: result.accessToken,
        enabled: true
      });
      return res.json({
        status: 'authorized',
        message: 'Successfully authenticated with GitHub Copilot!',
        config: updated
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
    let profile = req.body;
    // If testing an existing profile without re-typing password
    if (profile.id && !profile.password) {
      const fullConfig = storage.getDecryptedConfig();
      const existing = (fullConfig.smtpProfiles || []).find(p => p.id === profile.id);
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

// Reset all stored credentials, profiles, and logs (Danger Zone)
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
    // Reset preferences to default
    storage.updatePreferences({ delaySeconds: 3, attachResume: true });
    // Clear outreach audit logs
    storage.clearCampaignLogs();
    res.json(storage.getPublicConfig());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------- UPLOADS & PARSING ----------------------

// Resume Upload & Parse (PDF / DOCX)
app.post('/api/upload/resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No resume file uploaded' });
    }

    const parsed = await parseResumeFile(req.file.path, req.file.originalname);
    res.json({
      fileId: req.file.filename,
      filePath: req.file.path,
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
    console.error('Resume upload/parse error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Recipient Spreadsheet Upload & Parse (.xlsx, .xls, .csv)
app.post('/api/upload/recipients', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No spreadsheet file uploaded' });
    }

    const parsed = parseRecipientSheet(req.file.path, req.file.originalname);
    
    // Clean up temporary spreadsheet file after parsing
    try {
      fs.unlinkSync(req.file.path);
    } catch (e) {}

    res.json(parsed);
  } catch (err) {
    console.error('Spreadsheet upload/parse error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ---------------------- AI EMAIL GENERATION ----------------------

// Generate single cold email
app.post('/api/ai/generate', async (req, res) => {
  try {
    const {
      providerKey: requestedProvider,
      resumeText,
      jobDescription,
      recipient,
      customTone,
      senderName
    } = req.body;

    const fullConfig = storage.getDecryptedConfig();
    const providerKey = requestedProvider || fullConfig.activeProvider;
    const providerConfig = fullConfig.aiProviders[providerKey];

    if (!providerConfig) {
      return res.status(400).json({ error: `Provider ${providerKey} is not configured.` });
    }

    const emailContent = await generateColdEmail({
      providerKey,
      providerConfig,
      resumeText,
      jobDescription,
      recipient,
      customTone,
      senderName
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

// Batch generate cold emails for multiple recipients
app.post('/api/ai/batch-generate', async (req, res) => {
  try {
    const {
      providerKey: requestedProvider,
      resumeText,
      jobDescription,
      recipients,
      customTone,
      senderName
    } = req.body;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients provided' });
    }

    const fullConfig = storage.getDecryptedConfig();
    const providerKey = requestedProvider || fullConfig.activeProvider;
    const providerConfig = fullConfig.aiProviders[providerKey];

    if (!providerConfig) {
      return res.status(400).json({ error: `Provider ${providerKey} is not configured.` });
    }

    const results = [];
    for (const recipient of recipients) {
      try {
        const emailContent = await generateColdEmail({
          providerKey,
          providerConfig,
          resumeText,
          jobDescription,
          recipient,
          customTone,
          senderName
        });
        results.push({
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          success: true,
          email: emailContent
        });
      } catch (genErr) {
        results.push({
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          success: false,
          error: genErr.message
        });
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('Batch generation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------- EMAIL SENDING WITH SSE PROGRESS ----------------------

// Send emails to recipients with real-time SSE progress streaming
app.post('/api/send/stream', async (req, res) => {
  const {
    recipients, // Array of { id, email, name, company, subject, body }
    resumeFileId,
    smtpProfileId,
    delaySeconds = 3
  } = req.body;

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'No recipients provided for sending.' });
  }

  // Get active or specified SMTP profile
  const fullConfig = storage.getDecryptedConfig();
  let profile = null;
  if (smtpProfileId) {
    profile = (fullConfig.smtpProfiles || []).find(p => p.id === smtpProfileId);
  }
  if (!profile) {
    profile = (fullConfig.smtpProfiles || []).find(p => p.isDefault) || fullConfig.smtpProfiles?.[0];
  }

  if (!profile || !profile.password) {
    return res.status(400).json({
      error: 'No active SMTP account configured. Please configure an SMTP account in Settings first.'
    });
  }

  // Find resume file path if attach is enabled
  let attachmentPath = null;
  let attachmentName = null;
  if (resumeFileId) {
    const candidatePath = path.join(UPLOADS_DIR, resumeFileId);
    if (fs.existsSync(candidatePath)) {
      attachmentPath = candidatePath;
      attachmentName = resumeFileId.replace(/^\d+-\d+-/, '');
    }
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('start', {
    total: recipients.length,
    fromEmail: profile.fromEmail || profile.username,
    smtpProfileName: profile.name
  });

  const campaignLogs = [];

  for (let i = 0; i < recipients.length; i++) {
    const item = recipients[i];
    const currentIndex = i + 1;

    sendEvent('progress', {
      current: currentIndex,
      total: recipients.length,
      recipientEmail: item.email,
      recipientName: item.name,
      status: 'sending'
    });

    try {
      const sendResult = await sendEmailMessage({
        profile,
        to: item.email,
        recipientName: item.name,
        subject: item.subject || `Application / Discussion - ${profile.fromName || 'Candidate'}`,
        bodyText: item.body || item.text,
        attachmentPath,
        attachmentName
      });

      const logItem = {
        id: 'log_' + Date.now() + '_' + i,
        timestamp: new Date().toISOString(),
        recipientEmail: item.email,
        recipientName: item.name,
        company: item.company,
        subject: item.subject,
        status: 'sent',
        messageId: sendResult.messageId,
        smtpAccount: profile.name
      };
      campaignLogs.push(logItem);

      sendEvent('item_complete', {
        current: currentIndex,
        total: recipients.length,
        recipientEmail: item.email,
        status: 'sent',
        logItem
      });
    } catch (err) {
      console.error(`Failed sending to ${item.email}:`, err);
      const logItem = {
        id: 'log_' + Date.now() + '_' + i,
        timestamp: new Date().toISOString(),
        recipientEmail: item.email,
        recipientName: item.name,
        company: item.company,
        subject: item.subject,
        status: 'failed',
        error: err.message || 'SMTP delivery failure',
        smtpAccount: profile.name
      };
      campaignLogs.push(logItem);

      sendEvent('item_complete', {
        current: currentIndex,
        total: recipients.length,
        recipientEmail: item.email,
        status: 'failed',
        error: err.message,
        logItem
      });
    }

    // Rate limiting delay between sends (if not the last one)
    if (i < recipients.length - 1 && delaySeconds > 0) {
      sendEvent('throttling', {
        waitingSeconds: delaySeconds,
        nextIndex: currentIndex + 1
      });
      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
    }
  }

  // Save campaign logs to persistent store
  storage.addCampaignLogs(campaignLogs);

  sendEvent('finished', {
    total: recipients.length,
    sentCount: campaignLogs.filter(l => l.status === 'sent').length,
    failedCount: campaignLogs.filter(l => l.status === 'failed').length,
    logs: campaignLogs
  });

  res.end();
});

// Standard POST send endpoint (alternative to SSE)
app.post('/api/send', async (req, res) => {
  const {
    recipients,
    resumeFileId,
    smtpProfileId,
    delaySeconds = 3
  } = req.body;

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'No recipients provided.' });
  }

  const fullConfig = storage.getDecryptedConfig();
  let profile = null;
  if (smtpProfileId) {
    profile = (fullConfig.smtpProfiles || []).find(p => p.id === smtpProfileId);
  }
  if (!profile) {
    profile = (fullConfig.smtpProfiles || []).find(p => p.isDefault) || fullConfig.smtpProfiles?.[0];
  }

  if (!profile || !profile.password) {
    return res.status(400).json({
      error: 'No active SMTP account configured. Please add an SMTP profile in Settings.'
    });
  }

  let attachmentPath = null;
  let attachmentName = null;
  if (resumeFileId) {
    const candidatePath = path.join(UPLOADS_DIR, resumeFileId);
    if (fs.existsSync(candidatePath)) {
      attachmentPath = candidatePath;
      attachmentName = resumeFileId.replace(/^\d+-\d+-/, '');
    }
  }

  const results = [];
  for (let i = 0; i < recipients.length; i++) {
    const item = recipients[i];
    try {
      const sendResult = await sendEmailMessage({
        profile,
        to: item.email,
        recipientName: item.name,
        subject: item.subject,
        bodyText: item.body,
        attachmentPath,
        attachmentName
      });
      results.push({
        id: 'log_' + Date.now() + '_' + i,
        timestamp: new Date().toISOString(),
        recipientEmail: item.email,
        recipientName: item.name,
        company: item.company,
        subject: item.subject,
        status: 'sent',
        messageId: sendResult.messageId
      });
    } catch (err) {
      results.push({
        id: 'log_' + Date.now() + '_' + i,
        timestamp: new Date().toISOString(),
        recipientEmail: item.email,
        recipientName: item.name,
        company: item.company,
        subject: item.subject,
        status: 'failed',
        error: err.message
      });
    }

    if (i < recipients.length - 1 && delaySeconds > 0) {
      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
    }
  }

  storage.addCampaignLogs(results);
  res.json({ success: true, results });
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

app.listen(PORT, () => {
  console.log(`JDMail Server running on port ${PORT}`);
});
