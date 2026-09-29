import { describe, it, expect } from 'vitest';
import {
  getDefaultSettings,
  stripSecrets,
  stripUndefined,
  formatForFirestore
} from '../lib/settings';

describe('Firestore Settings Persistence & Zero Local Safeguards', () => {
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

  it('stripSecrets preserves API keys and SMTP credentials without stripping', () => {
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
    expect(result.aiProviders.openai.apiKey).toBe('sk-test-live-key-12345');
    expect(result.smtp.appPassword).toBe('my-smtp-password');
    expect(result.smtpProfiles[0].password).toBe('my-smtp-password');
  });

  it('formatForFirestore retains apiKey and passwords for Firestore storage', () => {
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
    expect(formatted.aiProviders.groq.apiKey).toBe('gsk_12345678');
    expect(formatted.aiProviders.groq.isConfigured).toBe(true);
    expect(formatted.smtpProfiles[0].password).toBe('app-password-xyz');
    expect(formatted.smtp.appPassword).toBe('app-password-xyz');
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
