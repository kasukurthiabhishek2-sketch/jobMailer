import { describe, it, expect } from 'vitest';
import {
  getDefaultSettings,
  stripSecrets,
  stripUndefined,
  formatForFirestore
} from '../lib/settings';

describe('Firestore Settings Persistence & Local Secret Safeguards', () => {
  it('getDefaultSettings returns full structure with empty credentials', () => {
    const defaults = getDefaultSettings();
    expect(defaults.activeProvider).toBe('gemini');
    expect(defaults.aiProviders.gemini).toBeDefined();
    expect(defaults.aiProviders.gemini.apiKey).toBe('');
    expect(defaults.aiProviders.openai.apiKey).toBe('');
    expect(defaults.smtp).toBeDefined();
    expect(defaults.smtp.appPassword).toBe('');
    expect(defaults.candidateProfile).toBeDefined();
    expect(defaults.preferences).toBeDefined();
  });

  it('stripSecrets removes credentials while preserving configuration metadata', () => {
    const userSettings = {
      activeProvider: 'openai',
      aiProviders: {
        openai: {
          name: 'ChatGPT / OpenAI',
          apiKey: 'sk-test-live-key-12345',
          model: 'gpt-4o-mini',
          savedKeys: [{ id: 'primary', name: 'Primary Key', apiKey: 'sk-test-live-key-12345' }]
        }
      },
      smtp: {
        provider: 'gmail',
        email: 'user@gmail.com',
        appPassword: 'my-smtp-password',
        password: 'my-smtp-password'
      },
      smtpProfiles: [
        {
          id: 'smtp_1',
          name: 'Work Email',
          password: 'my-smtp-password',
          appPassword: 'my-smtp-password'
        }
      ]
    };

    const result = stripSecrets(userSettings);
    expect('apiKey' in result.aiProviders.openai).toBe(false);
    expect(result.aiProviders.openai.isConfigured).toBe(true);
    expect(result.aiProviders.openai.savedKeys).toEqual([{ id: 'primary', name: 'Primary Key' }]);
    expect('appPassword' in result.smtp).toBe(false);
    expect('password' in result.smtp).toBe(false);
    expect(result.smtp.isConfigured).toBe(true);
    expect('password' in result.smtpProfiles[0]).toBe(false);
    expect('appPassword' in result.smtpProfiles[0]).toBe(false);
    expect(result.smtpProfiles[0].isConfigured).toBe(true);
    expect(userSettings.aiProviders.openai.apiKey).toBe('sk-test-live-key-12345');
  });

  it('formatForFirestore keeps configured state but never emits credentials', () => {
    const legacy = {
      activeProvider: 'groq',
      aiProviders: {
        groq: {
          name: 'Groq',
          apiKey: 'gsk_12345678',
          model: 'qwen/qwen3.8-27b'
        }
      },
      smtpProfiles: [
        {
          id: 'smtp_gmail',
          name: 'Gmail',
          username: 'sender@gmail.com',
          password: 'app-password-xyz',
          isDefault: true
        }
      ],
      sendingPreferences: {
        delaySeconds: 5
      }
    };

    const formatted = formatForFirestore(legacy);
    expect(formatted.activeProvider).toBe('groq');
    expect(formatted.aiProviders.groq.isConfigured).toBe(true);
    expect('apiKey' in formatted.aiProviders.groq).toBe(false);
    expect(formatted.smtpProfiles[0].isConfigured).toBe(true);
    expect('password' in formatted.smtpProfiles[0]).toBe(false);
    expect('appPassword' in formatted.smtp).toBe(false);
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
});
