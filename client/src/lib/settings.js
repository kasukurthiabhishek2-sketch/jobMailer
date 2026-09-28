/**
 * Firestore-backed settings persistence — one settings document per user.
 *
 * Document path: users/{uid}/app/settings
 *
 * This module replaces the previous server-side config.json storage.
 * All settings (AI provider keys, SMTP profiles, candidateProfile, preferences)
 * are stored in Firestore with owner-only security rules.
 */
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const settingsRef = (uid) => doc(db, 'users', uid, 'app', 'settings');

/**
 * Returns the default settings structure conforming to the master prompt schema.
 */
export function getDefaultSettings() {
  return {
    activeProvider: 'gemini',
    aiProviders: {
      gemini: {
        name: 'Google Gemini',
        apiKey: '',
        model: 'gemini-1.5-flash',
        active: true,
        enabled: true,
        supportedModels: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp']
      },
      openai: {
        name: 'ChatGPT / OpenAI',
        apiKey: '',
        model: 'gpt-4o-mini',
        active: false,
        enabled: true,
        supportedModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo']
      },
      groq: {
        name: 'Groq (LPU Inference)',
        apiKey: '',
        model: 'qwen/qwen3.8-27b',
        active: false,
        enabled: true,
        supportedModels: ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b']
      },
      grok: {
        name: 'Grok (xAI)',
        apiKey: '',
        model: 'grok-2-1212',
        active: false,
        enabled: true,
        supportedModels: ['grok-2-1212', 'grok-2-vision-1212', 'grok-beta']
      },
      nvidia: {
        name: 'NVIDIA (NIM API)',
        apiKey: '',
        model: 'meta/llama-3.1-70b-instruct',
        active: false,
        enabled: true,
        supportedModels: ['meta/llama-3.1-70b-instruct', 'meta/llama-3.1-8b-instruct', 'mistralai/mixtral-8x22b-instruct-v0.1']
      },
      copilot: {
        name: 'GitHub Copilot',
        apiKey: '',
        model: 'gpt-4o',
        active: false,
        enabled: true,
        authType: 'device_flow',
        supportedModels: ['gpt-4o', 'gpt-4o-mini']
      },
      custom: {
        name: 'Custom / OpenAI Compatible',
        apiKey: '',
        baseURL: 'https://api.openai.com/v1',
        model: 'gpt-4o',
        active: false,
        enabled: true,
        supportedModels: ['custom-model', 'gpt-4o']
      }
    },
    smtp: {
      provider: 'gmail',
      email: '',
      appPassword: '',
      host: 'smtp.gmail.com',
      port: 465,
      encryption: 'SSL',
      fromName: ''
    },
    smtpProfiles: [],
    candidateProfile: {
      fullName: '',
      email: '',
      phone: ''
    },
    preferences: {
      outreachTone: 'direct',
      delaySeconds: 8,
      attachResume: true
    }
  };
}

/**
 * Strips all sensitive credentials (API keys, SMTP passwords) so they are
 * NEVER persisted in plaintext to cloud Firestore documents. (TICK-CYC3-01 / Option 1)
 */
export function stripSecrets(settings) {
  if (!settings || typeof settings !== 'object') return settings;
  const clone = JSON.parse(JSON.stringify(settings));
  if (clone.aiProviders) {
    for (const key of Object.keys(clone.aiProviders)) {
      delete clone.aiProviders[key].apiKey;
    }
  }
  if (clone.smtp) {
    delete clone.smtp.appPassword;
    delete clone.smtp.password;
  }
  if (Array.isArray(clone.smtpProfiles)) {
    clone.smtpProfiles = clone.smtpProfiles.map(p => {
      const { password: _password, appPassword: _appPassword, ...rest } = p;
      return rest;
    });
  }
  return clone;
}

/**
 * Format legacy config (from server config.json) for the Firestore schema.
 * Enforces Option 1: metadata and preferences are migrated, secrets remain local.
 */
export function formatForFirestore(legacyConfig) {
  const defaults = getDefaultSettings();
  if (!legacyConfig) return stripSecrets(defaults);

  const activeKey = legacyConfig.activeProvider || 'gemini';
  const aiProviders = { ...defaults.aiProviders };

  if (legacyConfig.aiProviders) {
    for (const [key, val] of Object.entries(legacyConfig.aiProviders)) {
      aiProviders[key] = {
        ...aiProviders[key],
        name: val.name || aiProviders[key]?.name,
        model: val.model || aiProviders[key]?.model,
        active: key === activeKey,
        enabled: val.enabled !== false,
        isConfigured: Boolean(val.isConfigured || val.apiKey)
      };
      delete aiProviders[key].apiKey; // Secrets stay local
    }
  }

  const smtpProfiles = Array.isArray(legacyConfig.smtpProfiles)
    ? legacyConfig.smtpProfiles.map(p => {
        const { password, appPassword, ...rest } = p;
        return {
          ...rest,
          isConfigured: Boolean(p.isConfigured || password || appPassword)
        };
      })
    : [];

  const defaultSmtp = smtpProfiles.find(p => p.isDefault) || smtpProfiles[0] || {};
  const smtp = {
    provider: 'gmail',
    email: defaultSmtp.username || defaultSmtp.fromEmail || '',
    host: defaultSmtp.host || 'smtp.gmail.com',
    port: defaultSmtp.port || 465,
    encryption: defaultSmtp.encryption || 'SSL',
    fromName: defaultSmtp.fromName || ''
  };

  const preferences = {
    ...defaults.preferences,
    ...(legacyConfig.sendingPreferences || {})
  };

  return stripUndefined(stripSecrets({
    activeProvider: activeKey,
    aiProviders,
    smtp,
    smtpProfiles,
    candidateProfile: legacyConfig.candidateProfile || defaults.candidateProfile,
    preferences
  }));
}

/**
 * Load the full settings document for a user.
 * Returns null if no settings exist yet (first-time user).
 */
export async function loadSettings(uid) {
  const snap = await getDoc(settingsRef(uid));
  if (!snap.exists()) return null;
  const data = stripSecrets(snap.data());
  const defaults = stripSecrets(getDefaultSettings());
  
  // Merge defaults to ensure newly added keys are always present
  return {
    ...defaults,
    ...data,
    aiProviders: {
      ...defaults.aiProviders,
      ...(data.aiProviders || {})
    },
    smtp: {
      ...defaults.smtp,
      ...(data.smtp || {})
    },
    smtpProfiles: data.smtpProfiles || defaults.smtpProfiles,
    candidateProfile: {
      ...defaults.candidateProfile,
      ...(data.candidateProfile || {})
    },
    preferences: {
      ...defaults.preferences,
      ...(data.preferences || {})
    }
  };
}

/**
 * Recursively removes undefined values from objects and arrays so Firestore
 * setDoc/updateDoc never throws "Unsupported field value: undefined".
 */
export function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)])
    );
  }
  return value;
}

/**
 * Save (merge) partial settings for a user.
 * Uses Firestore merge to avoid overwriting unrelated fields.
 * Guarantees zero secret leakage into Firestore.
 */
export async function saveSettings(uid, partial) {
  const sanitized = stripUndefined(stripSecrets(partial));
  await setDoc(settingsRef(uid), { ...sanitized, updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * Delete the entire settings document (Danger Zone reset).
 */
export async function deleteSettings(uid) {
  await deleteDoc(settingsRef(uid));
}
