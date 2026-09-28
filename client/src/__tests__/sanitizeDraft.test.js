import { describe, it, expect } from 'vitest';
import { sanitizeDraft } from '../lib/sanitizeDraft';

describe('Client-Side Defensive sanitizeDraft Utility', () => {
  const recipient = { name: 'Sarah Connor', company: 'TechCorp' };

  it('passes through clean plain-text drafts unmodified', () => {
    const draft = {
      subject: 'Exploring Opportunities at TechCorp',
      body: 'Hi Sarah,\n\nI admired TechCorp\'s distributed cache launch.',
      groundingAudit: { score: 95 }
    };
    const sanitized = sanitizeDraft(draft, recipient);
    expect(sanitized.subject).toBe('Exploring Opportunities at TechCorp');
    expect(sanitized.body).toBe('Hi Sarah,\n\nI admired TechCorp\'s distributed cache launch.');
    expect(sanitized.groundingAudit).toEqual({ score: 95 });
  });

  it('strips markdown code fences from JSON wrapped body', () => {
    const raw = '```json\n{\n  "subject": "Platform Role",\n  "body": "Hi Sarah,\\n\\nI am interested in TechCorp."\n}\n```';
    const sanitized = sanitizeDraft(raw, recipient);
    expect(sanitized.subject).toBe('Platform Role');
    expect(sanitized.body).toBe('Hi Sarah,\n\nI am interested in TechCorp.');
  });

  it('recovers from literal unescaped newlines inside string literals', () => {
    const raw = '{\n  "subject": "Senior SWE",\n  "body": "Hi Sarah,\n\nI am reaching out.\n\nBest,\nAlex"\n}';
    const sanitized = sanitizeDraft(raw, recipient);
    expect(sanitized.subject).toBe('Senior SWE');
    expect(sanitized.body).toContain('Hi Sarah,');
    expect(sanitized.body).toContain('Best,\nAlex');
  });

  it('recovers fields via regex on truncated JSON missing closing quotes/braces', () => {
    const truncated = '{"subject": "Staff Engineer Role", "body": "Hi Sarah,\\n\\nI have 8 years experience scaling systems';
    const sanitized = sanitizeDraft(truncated, recipient);
    expect(sanitized.subject).toBe('Staff Engineer Role');
    expect(sanitized.body).toContain('scaling systems');
    expect(sanitized.body).not.toContain('{"subject":');
  });

  it('strips redundant Subject: prefixes and nested quotes from subject', () => {
    const draft = {
      subject: 'Subject: ""Inquiry: Staff Role at TechCorp""',
      body: 'Hi Sarah, would love to talk.'
    };
    const sanitized = sanitizeDraft(draft, recipient);
    expect(sanitized.subject).toBe('Inquiry: Staff Role at TechCorp');
    expect(sanitized.body).toBe('Hi Sarah, would love to talk.');
  });

  it('extracts Subject: header from line 1 of plain text body if subject is default', () => {
    const plainText = 'Subject: Opportunity: Distributed Systems Lead\n\nHi Sarah,\n\nI saw your team is growing.';
    const sanitized = sanitizeDraft(plainText, recipient);
    expect(sanitized.subject).toBe('Opportunity: Distributed Systems Lead');
    expect(sanitized.body).toBe('Hi Sarah,\n\nI saw your team is growing.');
    expect(sanitized.body).not.toContain('Subject:');
  });

  it('strips conversational preambles and postscripts surrounding JSON', () => {
    const chatter = 'Here is your cold email draft:\n\n```json\n{"subject": "Engineering Role", "body": "Hi Sarah,\\n\\nI am excited to apply."}\n```\n\nLet me know if you want any edits!';
    const sanitized = sanitizeDraft(chatter, recipient);
    expect(sanitized.subject).toBe('Engineering Role');
    expect(sanitized.body).toBe('Hi Sarah,\n\nI am excited to apply.');
  });

  it('preserves groundingAudit metadata throughout sanitization', () => {
    const draftWithAudit = {
      subject: '"Lead Architect"',
      body: '```json\n{"subject": "Lead Architect", "body": "Clean body"}\n```',
      groundingAudit: { hasUngroundedClaims: false, groundingScore: 100 }
    };
    const sanitized = sanitizeDraft(draftWithAudit, recipient);
    expect(sanitized.subject).toBe('Lead Architect');
    expect(sanitized.body).toBe('Clean body');
    expect(sanitized.groundingAudit).toEqual({ hasUngroundedClaims: false, groundingScore: 100 });
  });

  it('handles null, undefined, or empty drafts gracefully with fallback values', () => {
    const nullRes = sanitizeDraft(null, recipient);
    expect(nullRes.subject).toBe('Exploring Opportunities at TechCorp');
    expect(nullRes.body).toBe('');
    expect(nullRes.groundingAudit).toBeNull();

    const emptyRes = sanitizeDraft('', null);
    expect(emptyRes.subject).toBe('Exploring Opportunities at your team');
    expect(emptyRes.body).toBe('');
  });

  it('safely treats XSS script tags as plain text without execution', () => {
    const xssPayload = {
      subject: '<script>alert("xss")</script>Inquiry',
      body: '<script>document.cookie</script>Hi Sarah, I would love to connect.'
    };
    const sanitized = sanitizeDraft(xssPayload, recipient);
    expect(sanitized.subject).toBe('<script>alert("xss")</script>Inquiry');
    expect(sanitized.body).toContain('<script>document.cookie</script>');
  });
});
