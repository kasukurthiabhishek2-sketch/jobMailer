const fs = require('fs');
const path = require('path');
const { encrypt, decrypt, maskApiKey, maskPassword } = require('../utils/crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_CONFIG = {
  activeProvider: 'gemini',
  aiProviders: {
    gemini: {
      name: 'Google Gemini',
      apiKey: '', // encrypted
      model: 'gemini-1.5-flash',
      enabled: true,
      supportedModels: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp']
    },
    openai: {
      name: 'ChatGPT / OpenAI',
      apiKey: '',
      model: 'gpt-4o-mini',
      enabled: true,
      supportedModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo']
    },
    groq: {
      name: 'Groq (LPU Inference)',
      apiKey: '',
      model: 'qwen/qwen3.8-27b',
      enabled: true,
      supportedModels: ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b']
    },
    grok: {
      name: 'Grok (xAI)',
      apiKey: '',
      model: 'grok-2-1212',
      enabled: true,
      supportedModels: ['grok-2-1212', 'grok-2-vision-1212', 'grok-beta']
    },
    nvidia: {
      name: 'NVIDIA (NIM API)',
      apiKey: '',
      model: 'meta/llama-3.1-70b-instruct',
      enabled: true,
      supportedModels: [
        'meta/llama-3.1-70b-instruct',
        'meta/llama-3.1-8b-instruct',
        'mistralai/mixtral-8x22b-instruct-v0.1'
      ]
    },
    copilot: {
      name: 'GitHub Copilot',
      apiKey: '', // stores encrypted GitHub OAuth access token (ghu_...)
      model: 'gpt-4o',
      enabled: true,
      authType: 'device_flow',
      supportedModels: ['gpt-4o', 'gpt-4o-mini', 'claude-3.5-sonnet', 'o1-mini']
    },
    custom: {
      name: 'Custom (OpenAI-Compatible Endpoint)',
      apiKey: '',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      enabled: true,
      supportedModels: ['custom-model', 'gpt-4o']
    }
  },
  smtpProfiles: [],
  sendingPreferences: {
    delaySeconds: 3,
    attachResume: true
  }
};

function readConfigFile() {
  if (!fs.existsSync(CONFIG_FILE)) {
    saveConfigFile(DEFAULT_CONFIG);
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      aiProviders: {
        ...DEFAULT_CONFIG.aiProviders,
        ...(parsed.aiProviders || {})
      },
      sendingPreferences: {
        ...DEFAULT_CONFIG.sendingPreferences,
        ...(parsed.sendingPreferences || {})
      }
    };
  } catch (err) {
    console.error('Failed reading config file:', err);
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
}

function saveConfigFile(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed saving config file:', err);
  }
}

function readLogsFile() {
  if (!fs.existsSync(LOGS_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed reading logs file:', err);
    return [];
  }
}

function saveLogsFile(logs) {
  try {
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed saving logs file:', err);
  }
}

/**
 * Returns raw internal config with decrypted passwords & API keys
 */
function getDecryptedConfig() {
  const config = readConfigFile();
  const decrypted = JSON.parse(JSON.stringify(config));

  // Decrypt AI keys
  for (const key of Object.keys(decrypted.aiProviders)) {
    if (decrypted.aiProviders[key].apiKey) {
      decrypted.aiProviders[key].apiKey = decrypt(decrypted.aiProviders[key].apiKey);
    }
  }

  // Decrypt SMTP passwords
  if (Array.isArray(decrypted.smtpProfiles)) {
    decrypted.smtpProfiles = decrypted.smtpProfiles.map(p => ({
      ...p,
      password: decrypt(p.password)
    }));
  }

  return decrypted;
}

/**
 * Returns masked config safe to send across network to client
 */
function getPublicConfig() {
  const config = readConfigFile();
  const publicConfig = JSON.parse(JSON.stringify(config));

  for (const key of Object.keys(publicConfig.aiProviders)) {
    const rawEncrypted = publicConfig.aiProviders[key].apiKey;
    const plain = decrypt(rawEncrypted);
    publicConfig.aiProviders[key].isConfigured = Boolean(plain && plain.trim().length > 0);
    publicConfig.aiProviders[key].maskedKey = plain ? maskApiKey(plain) : '';
    delete publicConfig.aiProviders[key].apiKey; // NEVER send raw key
  }

  if (Array.isArray(publicConfig.smtpProfiles)) {
    publicConfig.smtpProfiles = publicConfig.smtpProfiles.map(p => {
      const plain = decrypt(p.password);
      return {
        ...p,
        isConfigured: Boolean(plain && plain.length > 0),
        maskedPassword: plain ? maskPassword(plain) : '',
        password: undefined // NEVER send raw password
      };
    });
  }

  return publicConfig;
}

/**
 * Update AI provider settings
 */
function updateAiProvider(providerKey, { apiKey, model, baseURL, enabled }) {
  const config = readConfigFile();
  if (!config.aiProviders[providerKey]) {
    config.aiProviders[providerKey] = {
      name: providerKey,
      model: model || '',
      enabled: true
    };
  }

  if (apiKey !== undefined && apiKey !== null && apiKey !== '') {
    config.aiProviders[providerKey].apiKey = encrypt(apiKey.trim());
  }
  if (model) config.aiProviders[providerKey].model = model;
  if (baseURL !== undefined) config.aiProviders[providerKey].baseURL = baseURL;
  if (enabled !== undefined) config.aiProviders[providerKey].enabled = enabled;

  saveConfigFile(config);
  return getPublicConfig();
}

/**
 * Set active AI provider
 */
function setActiveAiProvider(providerKey) {
  const config = readConfigFile();
  if (config.aiProviders[providerKey]) {
    config.activeProvider = providerKey;
    saveConfigFile(config);
  }
  return getPublicConfig();
}

/**
 * Add or update SMTP profile
 */
function saveSmtpProfile(profileData) {
  const config = readConfigFile();
  if (!Array.isArray(config.smtpProfiles)) config.smtpProfiles = [];

  let profileId = profileData.id;
  if (!profileId) {
    profileId = 'smtp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  }

  const existingIndex = config.smtpProfiles.findIndex(p => p.id === profileId);

  // If password provided, encrypt it; otherwise preserve existing encrypted password if editing
  let encryptedPassword = '';
  if (profileData.password) {
    encryptedPassword = encrypt(profileData.password);
  } else if (existingIndex >= 0) {
    encryptedPassword = config.smtpProfiles[existingIndex].password;
  }

  const isFirst = config.smtpProfiles.length === 0;
  const isDefault = profileData.isDefault ?? (isFirst || (existingIndex >= 0 ? config.smtpProfiles[existingIndex].isDefault : false));

  const newProfile = {
    id: profileId,
    name: profileData.name || 'SMTP Account',
    host: profileData.host || '',
    port: Number(profileData.port) || 587,
    encryption: profileData.encryption || 'TLS', // 'SSL' | 'TLS' | 'STARTTLS' | 'NONE'
    username: profileData.username || '',
    password: encryptedPassword,
    fromName: profileData.fromName || '',
    fromEmail: profileData.fromEmail || profileData.username || '',
    isDefault: Boolean(isDefault),
    updatedAt: new Date().toISOString()
  };

  if (newProfile.isDefault) {
    config.smtpProfiles.forEach(p => { p.isDefault = false; });
  }

  if (existingIndex >= 0) {
    config.smtpProfiles[existingIndex] = newProfile;
  } else {
    config.smtpProfiles.push(newProfile);
  }

  // Ensure at least one is default
  if (!config.smtpProfiles.some(p => p.isDefault) && config.smtpProfiles.length > 0) {
    config.smtpProfiles[0].isDefault = true;
  }

  saveConfigFile(config);
  return getPublicConfig();
}

/**
 * Delete SMTP profile
 */
function deleteSmtpProfile(id) {
  const config = readConfigFile();
  config.smtpProfiles = (config.smtpProfiles || []).filter(p => p.id !== id);
  if (config.smtpProfiles.length > 0 && !config.smtpProfiles.some(p => p.isDefault)) {
    config.smtpProfiles[0].isDefault = true;
  }
  saveConfigFile(config);
  return getPublicConfig();
}

/**
 * Set default SMTP profile
 */
function setDefaultSmtpProfile(id) {
  const config = readConfigFile();
  (config.smtpProfiles || []).forEach(p => {
    p.isDefault = p.id === id;
  });
  saveConfigFile(config);
  return getPublicConfig();
}

/**
 * Update preferences
 */
function updatePreferences(prefs) {
  const config = readConfigFile();
  config.sendingPreferences = {
    ...config.sendingPreferences,
    ...prefs
  };
  saveConfigFile(config);
  return getPublicConfig();
}

/**
 * Append to campaign logs
 */
function addCampaignLogs(newLogs) {
  const logs = readLogsFile();
  const updated = [...(Array.isArray(newLogs) ? newLogs : [newLogs]), ...logs].slice(0, 500); // keep last 500
  saveLogsFile(updated);
  return updated;
}

function getCampaignLogs() {
  return readLogsFile();
}

function clearCampaignLogs() {
  saveLogsFile([]);
  return [];
}

/**
 * Returns a map of lowercased emails previously contacted within `days` days
 */
function getRecentlyContactedMap(days = 30) {
  const logs = readLogsFile();
  const map = new Map();
  const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

  for (const item of logs) {
    if (item && item.recipientEmail) {
      const email = item.recipientEmail.trim().toLowerCase();
      const itemTime = item.timestamp ? new Date(item.timestamp).getTime() : 0;
      if (itemTime >= cutoffTime) {
        if (!map.has(email) || itemTime > map.get(email).timestamp) {
          map.set(email, {
            timestamp: itemTime,
            dateStr: item.timestamp,
            status: item.status,
            company: item.company
          });
        }
      }
    }
  }
  return map;
}

module.exports = {
  getDecryptedConfig,
  getPublicConfig,
  updateAiProvider,
  setActiveAiProvider,
  saveSmtpProfile,
  deleteSmtpProfile,
  setDefaultSmtpProfile,
  updatePreferences,
  addCampaignLogs,
  getCampaignLogs,
  clearCampaignLogs,
  getRecentlyContactedMap
};
