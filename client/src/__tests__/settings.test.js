import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDefaultSettings,
  loadSettings,
  saveSettings,
  deleteSettings,
  stripSecrets,
  stripUndefined,
  formatForFirestore
} from '../lib/settings';
import * as api from '../services/api';

vi.mock('../services/api', async () => {
  const actual = await vi.importActual('../services/api');
  return {
    ...actual,
    authFetch: vi.fn()
  };
});

describe('Server-Backed Settings Persistence & Zero Firestore Data Boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.__E2E_MOCK_SETTINGS__;
  });

  it('getDefaultSettings returns full structure with empty credentials and all schema keys', () => {
    const defaults = getDefaultSettings();
    expect(defaults.activeProvider).toBe('gemini');
    expect(defaults.aiProviders.gemini).toBeDefined();
    expect(defaults.aiProviders.gemini.apiKey).toBe('');
    expect(defaults.aiProviders.openai.apiKey).toBe('');
    expect(defaults.aiProviders.groq.apiKey).toBe('');
    expect(defaults.smtp).toBeDefined();
    expect(defaults.smtp.appPassword).toBe('');
    expect(defaults.candidateProfile).toEqual({
      fullName: '',
      email: '',
      phone: ''
    });
    expect(defaults.preferences).toEqual({
      outreachTone: 'direct',
      delaySeconds: 8,
      attachResume: true
    });
    expect(defaults.customPrompts).toBeDefined();
    expect(defaults.customPrompts.coldEmail).toEqual({ enabled: false, content: '' });
    expect(defaults.customPrompts.jdParser).toEqual({ enabled: false, content: '' });
  });

  it('loadSettings fetches configuration from /api/config and derives configured state', async () => {
    const mockServerResponse = {
      activeProvider: 'groq',
      aiProviders: {
        groq: {
          name: 'Groq',
          maskedKey: 'gsk_...9999',
          model: 'qwen/qwen3.8-27b',
          isConfigured: true,
          savedKeys: [
            { id: 'key_1', name: 'Primary Key', maskedKey: 'gsk_...9999', createdAt: '2026-01-01' }
          ]
        },
        gemini: {
          name: 'Google Gemini',
          maskedKey: '',
          apiKey: '',
          isConfigured: false
        }
      },
      candidateProfile: {
        fullName: 'Alex Mercer',
        email: 'alex.mercer.dev@example.com',
        phone: '+1 555-382-9912'
      },
      preferences: {
        outreachTone: 'punchy',
        delaySeconds: 5,
        attachResume: true
      }
    };

    api.authFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => mockServerResponse
    });

    const settings = await loadSettings();

    expect(api.authFetch).toHaveBeenCalledWith('/api/config');
    expect(settings.activeProvider).toBe('groq');
    expect(settings.aiProviders.groq.isConfigured).toBe(true);
    expect(settings.aiProviders.gemini.isConfigured).toBe(false);
    expect(settings.candidateProfile.fullName).toBe('Alex Mercer');
    expect(settings.preferences.outreachTone).toBe('punchy');
  });

  it('loadSettings falls back to getDefaultSettings if server /api/config is unreachable', async () => {
    api.authFetch.mockRejectedValueOnce(new Error('Network error connecting to backend'));

    const settings = await loadSettings();
    expect(settings.activeProvider).toBe('gemini');
    expect(settings.candidateProfile).toBeDefined();
    expect(settings.aiProviders.gemini.apiKey).toBe('');
  });

  it('saveSettings dispatches partial updates to /api/config/sync via authFetch with stripUndefined', async () => {
    api.authFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    const partialUpdate = {
      activeProvider: 'gemini',
      candidateProfile: {
        fullName: 'Alex Mercer',
        email: 'alex@example.com',
        phone: undefined
      },
      preferences: {
        outreachTone: 'concise',
        invalidField: undefined
      }
    };

    await saveSettings('test-uid', partialUpdate);

    expect(api.authFetch).toHaveBeenCalledTimes(1);
    const [url, options] = api.authFetch.mock.calls[0];
    expect(url).toBe('/api/config/sync');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');

    const parsedBody = JSON.parse(options.body);
    expect(parsedBody.candidateProfile.fullName).toBe('Alex Mercer');
    expect('phone' in parsedBody.candidateProfile).toBe(false);
    expect('invalidField' in parsedBody.preferences).toBe(false);
  });

  it('deleteSettings dispatches request to /api/config/reset via authFetch', async () => {
    api.authFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    await deleteSettings();

    expect(api.authFetch).toHaveBeenCalledWith('/api/config/reset', { method: 'POST' });
  });

  it('stripUndefined recursively purges undefined properties without throwing', () => {
    const raw = {
      active: true,
      apiKey: 'key_abc',
      nested: {
        definedVal: 42,
        undefinedVal: undefined
      },
      arr: [1, undefined, { a: undefined, b: 'keep' }]
    };

    const cleaned = stripUndefined(raw);
    expect(cleaned.active).toBe(true);
    expect(cleaned.apiKey).toBe('key_abc');
    expect('undefinedVal' in cleaned.nested).toBe(false);
    expect(cleaned.nested.definedVal).toBe(42);
    expect(cleaned.arr[2].b).toBe('keep');
    expect('a' in cleaned.arr[2]).toBe(false);
  });

  it('stripSecrets preserves API keys and credentials without data loss', () => {
    const userSettings = {
      activeProvider: 'openai',
      aiProviders: {
        openai: {
          name: 'ChatGPT / OpenAI',
          apiKey: 'sk-test-live-key-12345',
          model: 'gpt-4o-mini',
          isConfigured: true
        }
      },
      smtp: {
        provider: 'gmail',
        email: 'user@gmail.com',
        appPassword: 'my-smtp-password',
        password: 'my-smtp-password'
      }
    };

    const result = stripSecrets(userSettings);
    expect(result.aiProviders.openai.apiKey).toBe('sk-test-live-key-12345');
    expect(result.smtp.appPassword).toBe('my-smtp-password');
  });

  it('formatForFirestore converts legacy config while retaining full credentials and candidate profile', () => {
    const legacy = {
      activeProvider: 'groq',
      aiProviders: {
        groq: {
          name: 'Groq',
          apiKey: 'gsk_12345678',
          model: 'qwen/qwen3.8-27b'
        }
      },
      candidateProfile: {
        fullName: 'Jane Candidate',
        email: 'jane@example.com',
        phone: '+1 234 567 8900'
      },
      smtpProfiles: [
        {
          id: 'smtp_gmail',
          name: 'Gmail',
          username: 'sender@gmail.com',
          password: 'app-password-xyz',
          isDefault: true
        }
      ]
    };

    const formatted = formatForFirestore(legacy);
    expect(formatted.activeProvider).toBe('groq');
    expect(formatted.aiProviders.groq.apiKey).toBe('gsk_12345678');
    expect(formatted.aiProviders.groq.isConfigured).toBe(true);
    expect(formatted.candidateProfile.fullName).toBe('Jane Candidate');
    expect(formatted.smtpProfiles[0].password).toBe('app-password-xyz');
    expect(formatted.smtp.appPassword).toBe('app-password-xyz');
  });
});
