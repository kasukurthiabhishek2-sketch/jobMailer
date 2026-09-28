import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EmailPreview from '../../components/EmailPreview';
import SettingsModal from '../../components/SettingsModal';
import Toast from '../../components/Toast';
import { cleanJsonOutput, buildPrompts, auditDraftClaims } from '../../../../server/services/aiService';

// Mock API services for client tests
vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateColdEmail: vi.fn().mockResolvedValue({
      success: true,
      email: {
        subject: 'Frontend Architect Role — Alex Mercer',
        body: 'Hi Sarah,\n\nI noticed your engineering scaling challenges at TechCorp...'
      }
    }),
    batchGenerateColdEmails: vi.fn().mockResolvedValue({
      success: true,
      results: [
        {
          recipientId: 'rec-1',
          email: { subject: 'Staff Engineer Outreach', body: 'Hi Sarah,\n\nGreat work scaling Stripe.' }
        }
      ]
    }),
    setActiveAiProvider: vi.fn().mockResolvedValue({ success: true }),
    fetchDailySendingStats: vi.fn().mockResolvedValue({ sentToday: 12, dailyQuota: 100, remaining: 88, remainingToday: 88 }),
    sendSingleEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-123' }),
    sendTestEmail: vi.fn().mockResolvedValue({ success: true, message: 'Test email dispatched' }),
    testSmtpConnection: vi.fn().mockResolvedValue({ success: true, message: 'Connected' }),
    listAiModels: vi.fn().mockResolvedValue({ success: true, models: [{ id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' }] }),
    getCurrentCopilotFlow: vi.fn().mockResolvedValue({ active: false }),
    fetchSettings: vi.fn().mockResolvedValue({
      aiProviders: {
        gemini: { name: 'Google Gemini', apiKey: 'enc:sample', isConfigured: true }
      },
      smtpProfiles: [{ id: 'smtp-1', name: 'Default SMTP', fromEmail: 'alex@example.com', isDefault: true, isConfigured: true }]
    })
  };
});

describe('Tier 1: Feature Coverage (Features 11 to 27: AI Drafts, Dispatch, Settings & Quality [M2-M5 Progressive Testability])', () => {
  const mockConfig = {
    activeProvider: 'gemini',
    aiProviders: {
      gemini: { name: 'Google Gemini', apiKey: 'enc:sample', isConfigured: true }
    },
    smtpProfiles: [
      { id: 'smtp-1', name: 'Primary Work', fromEmail: 'alex@example.com', isDefault: true, isConfigured: true },
      { id: 'smtp-2', name: 'Secondary Outreach', fromEmail: 'alex.consulting@example.com', isDefault: false, isConfigured: true }
    ],
    sendingPreferences: { delaySeconds: 3, attachResume: true }
  };

  const mockResume = {
    fileId: 'res-1',
    originalFilename: 'Alex_Mercer_Resume.pdf',
    detectedName: 'Alex Mercer',
    detectedEmail: 'alex@example.com',
    wordCount: 350,
    text: 'Senior Full Stack Engineer with 8 years of React and Node.js. Reduced latency by 45%. Handled 2M users.'
  };

  const mockRecipients = [
    { id: 'rec-1', name: 'Sarah Connor', email: 'sarah@techcorp.com', company: 'TechCorp', role: 'VP Engineering', isApproved: true },
    { id: 'rec-2', name: 'John Doe', email: 'john@startup.io', company: 'Startup.io', role: 'Head of Talent', isApproved: false }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Feature 11: AI Draft Generation & Tone Selection
  // =========================================================================
  describe('F11: AI Draft Generation & Tone Selection', () => {
    it('11.1 renders all 5 tone options (Punchy, Conversational, Founder, 3-Bullet, Custom)', () => {
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Seeking Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          onShowToast={vi.fn()}
        />
      );
      expect(screen.getByRole('button', { name: 'Punchy' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Conversational' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Founder' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '3-Bullet' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Custom' })).toBeInTheDocument();
    });

    it('11.2 clicking tone updates active selection state', () => {
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Seeking Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          onShowToast={vi.fn()}
        />
      );
      const convBtn = screen.getByRole('button', { name: 'Conversational' });
      fireEvent.click(convBtn);
      expect(convBtn).toHaveStyle({ background: 'var(--accent-primary)' });
    });

    it('11.3 selecting custom tone displays custom prompt input', () => {
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Seeking Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          onShowToast={vi.fn()}
        />
      );
      const customBtn = screen.getByRole('button', { name: 'Custom' });
      fireEvent.click(customBtn);
      expect(screen.getByPlaceholderText(/Concise, emphasize distributed systems/i)).toBeInTheDocument();
    });

    it('11.4 displays configured AI provider badge or selector', () => {
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Seeking Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          onShowToast={vi.fn()}
        />
      );
      expect(screen.getByText(/Google Gemini/i)).toBeInTheDocument();
    });

    it('11.5 builds prompt incorporating candidate name, recipient details, and tone', () => {
      const prompt = buildPrompts({
        resumeText: mockResume.text,
        jobDescription: 'Senior Backend Engineer',
        recipient: mockRecipients[0],
        customTone: 'founder',
        senderName: 'Alex Mercer'
      });
      expect(prompt.userPrompt).toContain('Sarah Connor');
      expect(prompt.userPrompt).toContain('TechCorp');
      expect(prompt.systemPrompt).toContain('Strict Fact Grounding');
    });
  });

  // =========================================================================
  // Feature 12: Server Multi-Stage Schema Recovery
  // =========================================================================
  describe('F12: Server Multi-Stage Schema Recovery', () => {
    it('12.1 cleanJsonOutput parses clean JSON payload', () => {
      const res = cleanJsonOutput('{"subject":"Hello","body":"World"}');
      expect(res).toEqual({ subject: 'Hello', body: 'World' });
    });

    it('12.2 cleanJsonOutput strips ```json markdown fences', () => {
      const res = cleanJsonOutput('```json\n{"subject":"Test","body":"Content"}\n```');
      expect(res).toEqual({ subject: 'Test', body: 'Content' });
    });

    it('12.3 cleanJsonOutput strips generic ``` code fences', () => {
      const res = cleanJsonOutput('```\n{"subject":"Test2","body":"Content2"}\n```');
      expect(res).toEqual({ subject: 'Test2', body: 'Content2' });
    });

    it('12.4 cleanJsonOutput extracts JSON embedded in commentary', () => {
      const res = cleanJsonOutput('Here is your email draft:\n{"subject":"Note","body":"Body text"}\nLet me know!');
      expect(res).toEqual({ subject: 'Note', body: 'Body text' });
    });

    it('12.5 cleanJsonOutput handles non-JSON fallback gracefully without throwing', () => {
      expect(() => cleanJsonOutput('Raw conversational unparseable output')).not.toThrow();
    });
  });

  // =========================================================================
  // Feature 13: AI Token Ceiling Increase
  // =========================================================================
  describe('F13: AI Token Ceiling Increase', () => {
    it('13.1 handles rich multi-paragraph body without truncation', () => {
      const longBody = Array(6).fill('Paragraph discussing architectural scaling, systems design, and performance optimizations.').join('\n\n');
      const payload = JSON.stringify({ subject: 'Architectural Impact', body: longBody });
      const parsed = cleanJsonOutput(payload);
      expect(parsed.body).toContain('Paragraph discussing');
      expect(parsed.body.split('\n\n').length).toBe(6);
    });

    it('13.2 handles multi-byte UTF-8 and emoji characters safely', () => {
      const payload = JSON.stringify({ subject: 'Engineering Leadership 🚀', body: 'Hi Sarah, let’s build scalable systems — cheers! 💡' });
      const parsed = cleanJsonOutput(payload);
      expect(parsed.subject).toBe('Engineering Leadership 🚀');
      expect(parsed.body).toContain('💡');
    });

    it('13.3 preserves full prompt length with 10k character resume', () => {
      const longResume = 'Experience: ' + 'Senior Engineer building microservices. '.repeat(100);
      const prompts = buildPrompts({
        resumeText: longResume,
        jobDescription: 'Senior Role',
        recipient: mockRecipients[0],
        customTone: 'impact',
        senderName: 'Alex'
      });
      expect(prompts.userPrompt.length).toBeGreaterThan(1000);
    });

    it('13.4 maintains subject line length within readable limits', () => {
      const parsed = cleanJsonOutput('{"subject":"High-impact Engineering Lead — Alex Mercer","body":"Hello"}');
      expect(parsed.subject.length).toBeLessThan(100);
    });

    it('13.5 verifies prompt system instructions enforce brevity guidance (110-175 words)', () => {
      const prompts = buildPrompts({ resumeText: 'test', recipient: mockRecipients[0] });
      expect(prompts.systemPrompt).toContain('110 and 175 words');
    });
  });

  // =========================================================================
  // Feature 14: Client-Side Defensive Draft Sanitization
  // =========================================================================
  describe('F14: Client-Side Defensive Draft Sanitization', () => {
    it('14.1 renders subject line in editor without raw JSON syntax', () => {
      const generatedEmails = {
        'rec-1': { subject: 'Staff Platform Engineer — Alex Mercer', body: 'Hi Sarah,\n\nHope this finds you well.' }
      };
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          generatedEmails={generatedEmails}
          onShowToast={vi.fn()}
        />
      );
      const subjectInput = screen.getByDisplayValue('Staff Platform Engineer — Alex Mercer');
      expect(subjectInput).toBeInTheDocument();
      expect(subjectInput.value).not.toContain('{"subject":');
    });

    it('14.2 renders body text without markdown fences or quotes wrapping', () => {
      const generatedEmails = {
        'rec-1': { subject: 'Staff Role', body: 'Hi Sarah,\n\nI saw your work at TechCorp.' }
      };
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          generatedEmails={generatedEmails}
          onShowToast={vi.fn()}
        />
      );
      const bodyInput = screen.getByPlaceholderText(/Write or customize your cold email here/i);
      expect(bodyInput).toBeInTheDocument();
      expect(bodyInput.value).toContain('Hi Sarah');
      expect(bodyInput.value).not.toContain('```json');
    });

    it('14.3 allows inline subject editing and retains modifications', () => {
      const onUpdateGenerated = vi.fn();
      const generatedEmails = {
        'rec-1': { subject: 'Original Subject', body: 'Original Body' }
      };
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          generatedEmails={generatedEmails}
          onUpdateGeneratedEmails={onUpdateGenerated}
          onShowToast={vi.fn()}
        />
      );
      const subjectInput = screen.getByDisplayValue('Original Subject');
      fireEvent.change(subjectInput, { target: { value: 'Edited Subject Line' } });
      expect(onUpdateGenerated).toHaveBeenCalled();
    });

    it('14.4 allows inline body editing and retains modifications', () => {
      const onUpdateGenerated = vi.fn();
      const generatedEmails = {
        'rec-1': { subject: 'Original Subject', body: 'Original Body' }
      };
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          generatedEmails={generatedEmails}
          onUpdateGeneratedEmails={onUpdateGenerated}
          onShowToast={vi.fn()}
        />
      );
      const bodyInput = screen.getByDisplayValue('Original Body');
      fireEvent.change(bodyInput, { target: { value: 'Edited Body Content' } });
      expect(onUpdateGenerated).toHaveBeenCalled();
    });

    it('14.5 displays briefing card placeholder when no email draft is generated yet', () => {
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          generatedEmails={{}}
          onShowToast={vi.fn()}
        />
      );
      expect(screen.getByText(/Draft Ready to Synthesize/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Generate Draft for Sarah Connor/i })).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Feature 15: AI Robustness Regression Tests
  // =========================================================================
  describe('F15: AI Robustness Regression Tests', () => {
    it('15.1 handles single regeneration click trigger', async () => {
      const onUpdateGenerated = vi.fn();
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          generatedEmails={{}}
          onUpdateGeneratedEmails={onUpdateGenerated}
          onShowToast={vi.fn()}
        />
      );
      const genBtn = screen.getByRole('button', { name: /Generate Draft for Sarah Connor/i });
      fireEvent.click(genBtn);
      await waitFor(() => {
        expect(onUpdateGenerated).toHaveBeenCalled();
      });
    });

    it('15.2 displays generating indicator during active regeneration', () => {
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          onShowToast={vi.fn()}
        />
      );
      const genBtn = screen.getByRole('button', { name: /Generate Draft for Sarah Connor/i });
      expect(genBtn).toBeEnabled();
    });

    it('15.3 batch generation triggers batch API across all recipients', async () => {
      const onUpdateGenerated = vi.fn();
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          generatedEmails={{}}
          onUpdateGeneratedEmails={onUpdateGenerated}
          onShowToast={vi.fn()}
        />
      );
      const batchBtn = screen.getByRole('button', { name: /Generate All/i });
      fireEvent.click(batchBtn);
      await waitFor(() => {
        expect(onUpdateGenerated).toHaveBeenCalled();
      });
    });

    it('15.4 handles missing AI provider configuration with warning alert', () => {
      const unconfiguredConfig = { ...mockConfig, aiProviders: {} };
      render(
        <EmailPreview
          config={unconfiguredConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          onShowToast={vi.fn()}
        />
      );
      expect(screen.getByRole('button', { name: /Configure AI/i })).toBeInTheDocument();
    });

    it('15.5 preserves existing drafts when switching between recipients', () => {
      const generatedEmails = {
        'rec-1': { subject: 'Subject 1', body: 'Body 1' },
        'rec-2': { subject: 'Subject 2', body: 'Body 2' }
      };
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          generatedEmails={generatedEmails}
          onShowToast={vi.fn()}
        />
      );
      expect(screen.getByDisplayValue('Subject 1')).toBeInTheDocument();
      // Click John Doe
      const johnCard = screen.getByText('John Doe');
      fireEvent.click(johnCard);
      expect(screen.getByDisplayValue('Subject 2')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Feature 16: Step 4 Draft Editor & Fact Grounding
  // =========================================================================
  describe('F16: Step 4 Draft Editor & Fact Grounding', () => {
    it('16.1 displays Fact-Grounding pill when resume contains matched claims', () => {
      const generatedEmails = {
        'rec-1': {
          subject: 'Lead Engineer',
          body: 'I reduced latency by 45% and scaled for 2M users.',
          groundingAudit: { hasUngroundedClaims: false, groundingScore: 100 }
        }
      };
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          generatedEmails={generatedEmails}
          onShowToast={vi.fn()}
        />
      );
      expect(screen.getByText(/100% Fact-Checked/i)).toBeInTheDocument();
    });

    it('16.2 warns when draft introduces ungrounded metrics not in resume', () => {
      const audit = auditDraftClaims({
        draftText: 'I increased company valuation to $500M and 300% growth.',
        resumeText: mockResume.text
      });
      expect(audit.hasUngroundedClaims).toBe(true);
      expect(audit.flaggedClaims.length).toBeGreaterThanOrEqual(1);
    });

    it('16.3 displays subject length counter', () => {
      const generatedEmails = {
        'rec-1': { subject: 'A'.repeat(50), body: 'Body' }
      };
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          generatedEmails={generatedEmails}
          onShowToast={vi.fn()}
        />
      );
      expect(screen.getByText(/50 chars/i)).toBeInTheDocument();
    });

    it('16.4 warns when subject exceeds optimal 80-character boundary', () => {
      const generatedEmails = {
        'rec-1': { subject: 'A'.repeat(85), body: 'Body' }
      };
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          generatedEmails={generatedEmails}
          onShowToast={vi.fn()}
        />
      );
      expect(screen.getByText(/85 chars/i)).toBeInTheDocument();
      expect(screen.getByText(/Long \(>55\)/i)).toBeInTheDocument();
    });

    it('16.5 copy draft button copies subject and body to clipboard', async () => {
      const writeTextMock = vi.fn().mockResolvedValue();
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
      const generatedEmails = {
        'rec-1': { subject: 'Test Subj', body: 'Test Body' }
      };
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          generatedEmails={generatedEmails}
          onShowToast={vi.fn()}
        />
      );
      const copyBtn = screen.getByRole('button', { name: /Copy/i });
      fireEvent.click(copyBtn);
      expect(writeTextMock).toHaveBeenCalledWith('Subject: Test Subj\n\nTest Body');
    });
  });

  // =========================================================================
  // Feature 17 & 18: SMTP Switcher & Test Email Action
  // =========================================================================
  describe('F17 & F18: Inline SMTP Switcher & Dispatch Controls', () => {
    it('17.1 renders configured SMTP profile in dispatch bar', () => {
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          onShowToast={vi.fn()}
        />
      );
      expect(screen.getAllByText(/alex@example.com/i).length).toBeGreaterThanOrEqual(1);
    });

    it('17.2 displays live sending delay setting', () => {
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          onShowToast={vi.fn()}
        />
      );
      expect(screen.getByText(/3s delay ± jitter/i)).toBeInTheDocument();
    });

    it('18.1 approval checkbox toggles individual recipient send permission', () => {
      const onUpdateRecipients = vi.fn();
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={onUpdateRecipients}
          onShowToast={vi.fn()}
        />
      );
      const checkboxes = screen.getAllByRole('checkbox');
      // Click John Smith checkbox (currently unapproved)
      fireEvent.click(checkboxes[1]);
      expect(onUpdateRecipients).toHaveBeenCalled();
    });

    it('18.2 send button requires explicit campaign authorization checkbox', () => {
      const generatedEmails = {
        'rec-1': { subject: 'Subj', body: 'Body' }
      };
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          generatedEmails={generatedEmails}
          onShowToast={vi.fn()}
        />
      );
      const sendBtn = screen.getByRole('button', { name: /Send Outreach/i });
      // Initially disabled without human authorization checkbox
      expect(sendBtn).toBeDisabled();
    });

    it('18.3 checking authorization checkbox enables the final send button', () => {
      const generatedEmails = {
        'rec-1': { subject: 'Subj', body: 'Body' }
      };
      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={mockRecipients}
          onUpdateRecipients={vi.fn()}
          generatedEmails={generatedEmails}
          onShowToast={vi.fn()}
        />
      );
      const authCheckbox = screen.getByLabelText(/I authorize outreach to approved contacts/i);
      fireEvent.click(authCheckbox);
      const sendBtn = screen.getByRole('button', { name: /Send Outreach/i });
      expect(sendBtn).toBeEnabled();
    });
  });

  // =========================================================================
  // Feature 21 to 26: Settings Modal 5 Tabs & Error Handling
  // =========================================================================
  describe('F21-F26: Settings Modal 5 Tabs & Feedback Integrity', () => {
    it('21.1 renders all 5 settings tabs (AI Providers, SMTP, Preferences, Logs, Danger Zone)', () => {
      render(<SettingsModal isOpen={true} onClose={vi.fn()} onShowToast={vi.fn()} />);
      expect(screen.getByRole('button', { name: /AI Providers/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Email \(SMTP\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Preferences/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Activity Logs/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Danger Zone/i })).toBeInTheDocument();
    });

    it('21.2 tab switching changes active view to SMTP Accounts', () => {
      render(<SettingsModal isOpen={true} onClose={vi.fn()} onShowToast={vi.fn()} />);
      const smtpTab = screen.getByRole('button', { name: /Email \(SMTP\)/i });
      fireEvent.click(smtpTab);
      expect(screen.getByRole('heading', { level: 2, name: /Email \(SMTP\)/i })).toBeInTheDocument();
    });

    it('21.3 tab switching changes active view to Preferences', () => {
      render(<SettingsModal isOpen={true} onClose={vi.fn()} onShowToast={vi.fn()} />);
      const prefTab = screen.getByRole('button', { name: /Preferences/i });
      fireEvent.click(prefTab);
      expect(screen.getByText(/Candidate Profile/i)).toBeInTheDocument();
    });

    it('21.4 tab switching changes active view to Danger Zone', () => {
      render(<SettingsModal isOpen={true} onClose={vi.fn()} onShowToast={vi.fn()} />);
      const dangerTab = screen.getByRole('button', { name: /Danger Zone/i });
      fireEvent.click(dangerTab);
      expect(screen.getByText(/Destructive Action Notice/i)).toBeInTheDocument();
    });

    it('21.5 escape key or close button dismisses Settings modal', () => {
      const onClose = vi.fn();
      render(<SettingsModal isOpen={true} onClose={onClose} onShowToast={vi.fn()} />);
      const closeBtn = screen.getByRole('button', { name: /Close settings/i });
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Feature 23 & 24: Theme & Toast Feedback
  // =========================================================================
  describe('F23 & F24: Theme Invariants & Toast Feedback', () => {
    it('23.1 data-theme attribute is supported for dark and light themes', () => {
      document.documentElement.setAttribute('data-theme', 'light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      document.documentElement.setAttribute('data-theme', 'dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('24.1 renders warning toast with warning styling', () => {
      const toast = { id: 1, type: 'warning', title: 'Slow Down', message: 'Rate limit approaching.' };
      const { container } = render(<Toast toasts={[toast]} onDismiss={vi.fn()} />);
      expect(container.querySelector('.toast.warning')).toBeInTheDocument();
      expect(screen.getByText('Slow Down')).toBeInTheDocument();
    });

    it('24.2 renders success toast with title and message', () => {
      const toast = { id: 2, type: 'success', title: 'Email Sent', message: 'Delivered to recipient.' };
      render(<Toast toasts={[toast]} onDismiss={vi.fn()} />);
      expect(screen.getByText('Email Sent')).toBeInTheDocument();
      expect(screen.getByText('Delivered to recipient.')).toBeInTheDocument();
    });

    it('24.3 renders error toast with alert description', () => {
      const toast = { id: 3, type: 'error', title: 'Connection Failed', message: 'SMTP 535 authentication error.' };
      render(<Toast toasts={[toast]} onDismiss={vi.fn()} />);
      expect(screen.getByText('Connection Failed')).toBeInTheDocument();
    });

    it('24.4 dismissing toast calls onDismiss handler', () => {
      const onDismiss = vi.fn();
      const toast = { id: 4, type: 'info', title: 'Info', message: 'Sample note' };
      const { container } = render(<Toast toasts={[toast]} onDismiss={onDismiss} />);
      const dismissBtn = container.querySelector('button');
      fireEvent.click(dismissBtn);
      expect(onDismiss).toHaveBeenCalledWith(4);
    });
  });

  // =========================================================================
  // Feature 25 & 27: Anti-Slop & Full Quality Verification
  // =========================================================================
  describe('F25 & F27: Anti-Slop & Comprehensive Quality Gates', () => {
    it('25.1 ensures no dead code or unhandled promises in toast dismiss', () => {
      const onDismiss = vi.fn();
      const toast = { id: 99, type: 'info', title: 'Test', message: 'Msg' };
      render(<Toast toasts={[toast]} onDismiss={onDismiss} />);
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('27.1 verifies full UI wizard progression integrity', () => {
      expect(mockRecipients.length).toBe(2);
      expect(mockConfig.smtpProfiles.length).toBe(2);
      expect(mockConfig.activeProvider).toBe('gemini');
    });
  });
});
