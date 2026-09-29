/**
 * Firestore-backed settings persistence for non-secret, per-user preferences.
 *
 * Document path: users/{uid}/app/settings
 *
 * Provider API keys and SMTP passwords stay in the server's encrypted local
 * configuration. Firestore keeps only the metadata needed to render the UI.
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
        supportedModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp']
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
 * Remove credentials before a settings document is read from or written to
 * Firestore. Keep configured state and key metadata so the UI remains useful.
 */
export function stripSecrets(settings) {
  if (!settings || typeof settings !== 'object') return settings;

  const { aiProviders, smtp, smtpProfiles, ...safeSettings } = settings;

  if (aiProviders && typeof aiProviders === 'object') {
    safeSettings.aiProviders = Object.fromEntries(
      Object.entries(aiProviders).map(([key, provider]) => {
        const { apiKey, savedKeys, ...safeProvider } = provider || {};
        const hasStoredKey = Boolean(
          apiKey || savedKeys?.some(savedKey => savedKey?.apiKey)
        );

        return [key, {
          ...safeProvider,
          isConfigured: Boolean(safeProvider.isConfigured || hasStoredKey),
          savedKeys: Array.isArray(savedKeys)
            ? savedKeys.map(({ apiKey: _apiKey, ...safeKey }) => safeKey)
            : []
        }];
      })
    );
  }

  if (smtp && typeof smtp === 'object') {
    const { password, appPassword, ...safeSmtp } = smtp;
    safeSettings.smtp = {
      ...safeSmtp,
      isConfigured: Boolean(safeSmtp.isConfigured || password || appPassword)
    };
  }

  if (Array.isArray(smtpProfiles)) {
    safeSettings.smtpProfiles = smtpProfiles.map(profile => {
      const { password, appPassword, ...safeProfile } = profile || {};
      return {
        ...safeProfile,
        isConfigured: Boolean(safeProfile.isConfigured || password || appPassword)
      };
    });
  }

  return safeSettings;
}

function containsSecrets(settings) {
  return Boolean(
    Object.values(settings?.aiProviders || {}).some(provider =>
      provider?.apiKey || provider?.savedKeys?.some(savedKey => savedKey?.apiKey)
    ) ||
    settings?.smtp?.password ||
    settings?.smtp?.appPassword ||
    settings?.smtpProfiles?.some(profile => profile?.password || profile?.appPassword)
  );
}

/**
 * Format legacy config (from server config.json) for the Firestore schema.
 * Credentials are deliberately removed at the boundary by stripSecrets().
 */
export function formatForFirestore(legacyConfig) {
  const defaults = getDefaultSettings();
  if (!legacyConfig) return defaults;

  const activeKey = legacyConfig.activeProvider || 'gemini';
  const aiProviders = { ...defaults.aiProviders };

  if (legacyConfig.aiProviders) {
    for (const [key, val] of Object.entries(legacyConfig.aiProviders)) {
      const hasSingleKey = Boolean(val.apiKey || val.maskedKey);
      let savedKeys = Array.isArray(val.savedKeys) ? val.savedKeys : undefined;
      let selectedKeyId = val.selectedKeyId;
      if (!savedKeys && hasSingleKey) {
        selectedKeyId = selectedKeyId || 'default';
        const masked = val.maskedKey || (val.apiKey ? (val.apiKey.length > 8 ? `${val.apiKey.slice(0, 4)}...${val.apiKey.slice(-4)}` : '••••••••') : '');
        savedKeys = [{
          id: selectedKeyId,
          name: 'Primary Key',
          apiKey: val.apiKey || '',
          maskedKey: masked,
          createdAt: new Date().toISOString()
        }];
      }
      aiProviders[key] = {
        ...aiProviders[key],
        name: val.name || aiProviders[key]?.name,
        apiKey: val.apiKey || '',
        maskedKey: val.maskedKey || '',
        model: val.model || aiProviders[key]?.model,
        active: key === activeKey,
        enabled: val.enabled !== false,
        isConfigured: Boolean(val.isConfigured || hasSingleKey || (savedKeys && savedKeys.length > 0) || (key === 'copilot' && (val.isConfigured || val.connected || hasSingleKey))),
        selectedKeyId,
        savedKeys
      };
    }
  }

  const smtpProfiles = Array.isArray(legacyConfig.smtpProfiles)
    ? legacyConfig.smtpProfiles.map(p => {
        const password = p.password || p.appPassword || '';
        return {
          ...p,
          password,
          appPassword: password,
          isConfigured: Boolean(p.isConfigured || password)
        };
      })
    : [];

  const defaultSmtp = smtpProfiles.find(p => p.isDefault) || smtpProfiles[0] || {};
  const defaultPassword = defaultSmtp.password || defaultSmtp.appPassword || '';
  const smtp = {
    provider: 'gmail',
    email: defaultSmtp.username || defaultSmtp.fromEmail || '',
    appPassword: defaultPassword,
    password: defaultPassword,
    host: defaultSmtp.host || 'smtp.gmail.com',
    port: defaultSmtp.port || 465,
    encryption: defaultSmtp.encryption || 'SSL',
    fromName: defaultSmtp.fromName || ''
  };

  const preferences = {
    ...defaults.preferences,
    ...(legacyConfig.sendingPreferences || {})
  };

  return stripSecrets(stripUndefined({
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
  if (typeof window !== 'undefined' && window.__E2E_MOCK_SETTINGS__) {
    return window.__E2E_MOCK_SETTINGS__;
  }
  const snap = await getDoc(settingsRef(uid));
  if (!snap.exists()) return null;
  const storedSettings = snap.data();
  const data = stripSecrets(storedSettings);
  if (containsSecrets(storedSettings)) {
    await setDoc(
      settingsRef(uid),
      { ...stripUndefined(data), updatedAt: serverTimestamp() }
    );
  }
  const defaults = stripSecrets(getDefaultSettings());
  
  // Merge defaults per-provider to ensure newly added keys & supportedModels are always preserved
  const mergedAiProviders = {};

  for (const [key, defaultProv] of Object.entries(defaults.aiProviders)) {
    const p = data.aiProviders?.[key] || {};
    const hasKeys = Array.isArray(p.savedKeys) && p.savedKeys.length > 0;
    const hasSingleKey = Boolean((p.apiKey && p.apiKey.trim().length > 0) || (p.maskedKey && p.maskedKey.trim().length > 0));
    let savedKeys = p.savedKeys;
    let selectedKeyId = p.selectedKeyId;
    if (!hasKeys && hasSingleKey) {
      selectedKeyId = selectedKeyId || 'default';
      const masked = p.maskedKey || (p.apiKey ? (p.apiKey.length > 8 ? `${p.apiKey.slice(0, 4)}...${p.apiKey.slice(-4)}` : '••••••••') : '');
      savedKeys = [{
        id: selectedKeyId,
        name: 'Primary Key',
        apiKey: p.apiKey || '',
        maskedKey: masked,
        createdAt: new Date().toISOString()
      }];
    }
    const isConfigured = Boolean(p.isConfigured || hasKeys || hasSingleKey);
    const supportedModels = (Array.isArray(p.supportedModels) && p.supportedModels.length > 0)
      ? p.supportedModels
      : defaultProv.supportedModels;

    mergedAiProviders[key] = {
      ...defaultProv,
      ...p,
      supportedModels,
      savedKeys: savedKeys || [],
      selectedKeyId: selectedKeyId || (savedKeys?.[0]?.id || ''),
      isConfigured
    };
  }

  return {
    ...defaults,
    ...data,
    aiProviders: mergedAiProviders,
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
 * Save partial settings for a user in Firestore without dropping unrelated fields.
 * Scoped per-user with owner-only access rules.
 */
export async function saveSettings(uid, partial) {
  if (typeof window !== 'undefined' && window.__E2E_MOCK_SETTINGS__) {
    window.__E2E_MOCK_SETTINGS__ = stripSecrets({
      ...window.__E2E_MOCK_SETTINGS__,
      ...partial
    });
    return;
  }
  const snap = await getDoc(settingsRef(uid));
  const existing = snap.exists() ? snap.data() : {};
  const merged = {
    ...existing,
    ...partial,
    aiProviders: { ...existing.aiProviders, ...partial.aiProviders },
    smtp: { ...existing.smtp, ...partial.smtp },
    candidateProfile: { ...existing.candidateProfile, ...partial.candidateProfile },
    preferences: { ...existing.preferences, ...partial.preferences }
  };
  const sanitized = stripSecrets(stripUndefined(merged));
  await setDoc(settingsRef(uid), { ...sanitized, updatedAt: serverTimestamp() });
}

/**
 * Delete the entire settings document (Danger Zone reset).
 */
export async function deleteSettings(uid) {
  await deleteDoc(settingsRef(uid));
}
