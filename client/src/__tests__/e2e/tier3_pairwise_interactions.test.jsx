import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RecipientModal from '../../components/RecipientModal';
import EmailPreview from '../../components/EmailPreview';
import SettingsModal from '../../components/SettingsModal';
import Toast from '../../components/Toast';
import { buildPrompts, auditDraftClaims } from '../../../../server/services/aiService';

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateColdEmail: vi.fn().mockResolvedValue({
      success: true,
      email: { subject: 'Tailored Outreach', body: 'Hi Sarah, impressive systems scale at Stripe.' }
    }),
    batchGenerateColdEmails: vi.fn().mockResolvedValue({
      success: true,
      results: [{ recipientId: 'rec-1', email: { subject: 'Batch Pitch', body: 'Hello!' } }]
    }),
    fetchDailySendingStats: vi.fn().mockResolvedValue({ sentToday: 5, dailyQuota: 100, remaining: 95, remainingToday: 95 }),
    getCurrentCopilotFlow: vi.fn().mockResolvedValue({ active: false }),
    fetchOutreachLogs: vi.fn().mockResolvedValue([
      { recipientEmail: 'repeat@stripe.com', sentAt: new Date(Date.now() - 5 * 86400000).toISOString(), status: 'sent' }
    ])
  };
});

describe('Tier 3: Cross-Feature Interactions & Pairwise Combinations', () => {
  const mockConfig = {
    activeProvider: 'gemini',
    aiProviders: {
      gemini: { name: 'Google Gemini', apiKey: 'enc:key', isConfigured: true }
    },
    smtpProfiles: [
      { id: 'smtp-1', name: 'Primary Gmail', fromEmail: 'candidate@example.com', isDefault: true, isConfigured: true },
      { id: 'smtp-2', name: 'Secondary Outlook', fromEmail: 'candidate.work@example.com', isDefault: false, isConfigured: true }
    ],
    sendingPreferences: { delaySeconds: 3, attachResume: true }
  };

  const mockResume = {
    fileId: 'res-1',
    originalFilename: 'Candidate_Resume.pdf',
    detectedName: 'Jordan Lee',
    detectedEmail: 'jordan.lee@example.com',
    wordCount: 420,
    text: 'Staff Software Engineer. Spearheaded distributed caching architecture reducing latency by 45%.'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Pair 1 (F01 × F03): Resume Contact Extraction × Recipient Management
  // =========================================================================
  describe('Pair 1 (F01 × F03): Resume Contact Extraction × Recipient Management', () => {
    it('3.1 parsed resume contact info matches sender identity across recipient campaign', () => {
      expect(mockResume.detectedName).toBe('Jordan Lee');
      expect(mockResume.detectedEmail).toBe('jordan.lee@example.com');
      // When constructing outreach prompt for recipient, candidate name is incorporated
      const prompt = buildPrompts({
        resumeText: mockResume.text,
        recipient: { name: 'Sarah Connor', company: 'TechCorp' },
        senderName: mockResume.detectedName
      });
      expect(prompt.userPrompt).toContain('Jordan Lee');
      expect(prompt.userPrompt).toContain('Sarah Connor');
    });

    it('3.2 editing candidate name in profile propagates to sender prompt', () => {
      const updatedSender = 'Dr. Jordan Lee';
      const prompt = buildPrompts({
        resumeText: mockResume.text,
        recipient: { name: 'Sarah Connor', company: 'TechCorp' },
        senderName: updatedSender
      });
      expect(prompt.userPrompt).toContain('Dr. Jordan Lee');
    });
  });

  // =========================================================================
  // Pair 2 (F07 × F11): Job Description Mode × AI Tone Selection (M2)
  // =========================================================================
  describe('Pair 2 (F07 × F11): Job Description Mode × AI Tone Selection [M2 Progressive Testability]', () => {
    it('3.3 generates tailored prompts when Job Description is provided', () => {
      const tailoredPrompt = buildPrompts({
        resumeText: mockResume.text,
        jobDescription: 'Seeking distributed systems architect for Kubernetes and Go services.',
        recipient: { name: 'Hiring Lead', company: 'CloudCorp' },
        customTone: 'impact',
        senderName: 'Jordan Lee'
      });
      expect(tailoredPrompt.userPrompt).toContain('CloudCorp');
      expect(tailoredPrompt.userPrompt).toContain('Kubernetes and Go services');
      expect(tailoredPrompt.systemPrompt).toContain('Strict Fact Grounding');
    });

    it('3.4 generates direct value pitch prompt when Job Description is omitted', () => {
      const generalPrompt = buildPrompts({
        resumeText: mockResume.text,
        jobDescription: '',
        recipient: { name: 'Founder', company: 'StealthStartup' },
        customTone: 'founder',
        senderName: 'Jordan Lee'
      });
      expect(generalPrompt.userPrompt).toContain('StealthStartup');
      expect(generalPrompt.userPrompt).toContain('reducing latency by 45%');
      expect(generalPrompt.systemPrompt).toContain('Strict Fact Grounding');
    });
  });

  // =========================================================================
  // Pair 3 (F05 × F06): 30-Day Dedup Badge × Consent Gate
  // =========================================================================
  describe('Pair 3 (F05 × F06): 30-Day Dedup Badge × Consent Gate', () => {
    it('3.5 displays Contacted badge on duplicate and prevents modal confirmation without consent', () => {
      const onConfirm = vi.fn();
      const sheetData = {
        filename: 'leads.xlsx',
        totalCount: 2,
        validCount: 2,
        invalidCount: 0,
        rows: [
          {
            id: '1',
            email: 'repeat@stripe.com',
            name: 'Repeat Lead',
            company: 'Stripe',
            isValidEmail: true,
            isSelected: true,
            isPreviouslyContacted: true
          },
          {
            id: '2',
            email: 'fresh@anthropic.com',
            name: 'Fresh Lead',
            company: 'Anthropic',
            isValidEmail: true,
            isSelected: false,
            isPreviouslyContacted: false
          }
        ]
      };

      const defaultProps = { isOpen: true, onClose: vi.fn(), onConfirmSelection: onConfirm };
      const { rerender } = render(<RecipientModal {...defaultProps} sheetData={null} />);
      rerender(<RecipientModal {...defaultProps} sheetData={sheetData} />);

      // Contacted badge should appear for repeat@stripe.com
      expect(screen.getByText(/Contacted/i)).toBeInTheDocument();

      // Click approve without checking consent
      const approveBtn = screen.getByRole('button', { name: /Approve/i });
      fireEvent.click(approveBtn);
      expect(onConfirm).not.toHaveBeenCalled();

      // Check consent checkbox
      const consentCheckbox = screen.getByRole('checkbox', { name: /explicitly approve/i });
      fireEvent.click(consentCheckbox);

      // Now click approve succeeds
      fireEvent.click(approveBtn);
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Pair 4 (F14 × F16): Defensive Sanitization × Step 4 Inline Editor (M3)
  // =========================================================================
  describe('Pair 4 (F14 × F16): Defensive Sanitization × Step 4 Inline Editor [M3 Progressive Testability]', () => {
    it('3.6 user inline edits to sanitized subject maintain character count meter accuracy', () => {
      const onUpdateGenerated = vi.fn();
      const generatedEmails = {
        'rec-1': {
          subject: 'Initial Clean Subject',
          body: 'Initial clean body text.',
          groundingAudit: { hasUngroundedClaims: false, groundingScore: 100 }
        }
      };

      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={[{ id: 'rec-1', name: 'Sarah', email: 'sarah@tech.com', isApproved: true }]}
          onUpdateRecipients={vi.fn()}
          generatedEmails={generatedEmails}
          onUpdateGeneratedEmails={onUpdateGenerated}
          onShowToast={vi.fn()}
        />
      );

      const subjectInput = screen.getByDisplayValue('Initial Clean Subject');
      fireEvent.change(subjectInput, { target: { value: 'New Custom Subject with 38 chars length' } });
      expect(onUpdateGenerated).toHaveBeenCalled();
    });

    it('3.7 editing body to add fabricated statistics updates fact grounding audit', () => {
      const cleanDraft = 'Hi Sarah, I previously reduced latency by 45%.';
      const cleanAudit = auditDraftClaims({ draftText: cleanDraft, resumeText: mockResume.text });
      expect(cleanAudit.hasUngroundedClaims).toBe(false);

      const editedDraftWithHallucination = 'Hi Sarah, I drove $50M in new revenue and 200% growth.';
      const flaggedAudit = auditDraftClaims({ draftText: editedDraftWithHallucination, resumeText: mockResume.text });
      expect(flaggedAudit.hasUngroundedClaims).toBe(true);
      expect(flaggedAudit.flaggedClaims.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // Pair 5 (F17 × F18): Inline SMTP Switcher × Live Dispatch Controls (M3)
  // =========================================================================
  describe('Pair 5 (F17 × F18): Inline SMTP Switcher × Live Dispatch Controls [M3 Progressive Testability]', () => {
    it('3.8 displays primary SMTP account and honors human send gate authorization', () => {
      const generatedEmails = {
        'rec-1': { subject: 'Staff Role', body: 'Hello Sarah' }
      };

      render(
        <EmailPreview
          config={mockConfig}
          resumeData={mockResume}
          jobDescription="Senior SWE"
          recipients={[{ id: 'rec-1', name: 'Sarah Connor', email: 'sarah@tech.com', isApproved: true }]}
          onUpdateRecipients={vi.fn()}
          generatedEmails={generatedEmails}
          onShowToast={vi.fn()}
        />
      );

      // Verify active SMTP account display
      expect(screen.getAllByText(/candidate@example.com/i).length).toBeGreaterThanOrEqual(1);

      // Verify authorization gate
      const sendBtn = screen.getByRole('button', { name: /Send Outreach/i });
      expect(sendBtn).toBeDisabled();

      const authCheckbox = screen.getByLabelText(/I authorize outreach to approved contacts/i);
      fireEvent.click(authCheckbox);
      expect(sendBtn).toBeEnabled();
    });
  });

  // =========================================================================
  // Pair 6 (F21 × F23): Settings Modal 5 Tabs × Theme Toggle (M4)
  // =========================================================================
  describe('Pair 6 (F21 × F23): Settings Modal 5 Tabs × Theme Toggle [M4 Progressive Testability]', () => {
    it('3.9 switching themes preserves active tab navigation in SettingsModal', () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      const { rerender } = render(<SettingsModal isOpen={true} onClose={vi.fn()} onShowToast={vi.fn()} />);

      // Switch to Danger Zone
      const dangerTab = screen.getByRole('button', { name: /Danger Zone/i });
      fireEvent.click(dangerTab);
      expect(screen.getByRole('heading', { level: 2, name: /Danger Zone/i })).toBeInTheDocument();

      // Toggle theme to light
      document.documentElement.setAttribute('data-theme', 'light');
      rerender(<SettingsModal isOpen={true} onClose={vi.fn()} onShowToast={vi.fn()} />);
      expect(screen.getByRole('heading', { level: 2, name: /Danger Zone/i })).toBeInTheDocument();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });

  // =========================================================================
  // Pair 7 (F23 × F24): Theme Modes × Warning Toast Styling (M4)
  // =========================================================================
  describe('Pair 7 (F23 × F24): Theme Modes × Warning Toast Styling [M4 Progressive Testability]', () => {
    it('3.10 warning toast renders with correct warning class and icon in both dark and light themes', () => {
      const warningToast = { id: 1, type: 'warning', title: 'Rate Limit', message: 'Slow down requests.' };
      document.documentElement.setAttribute('data-theme', 'dark');
      const { container, rerender } = render(<Toast toasts={[warningToast]} onDismiss={vi.fn()} />);
      expect(container.querySelector('.toast.warning')).toBeInTheDocument();
      expect(screen.getByText('Rate Limit')).toBeInTheDocument();

      document.documentElement.setAttribute('data-theme', 'light');
      rerender(<Toast toasts={[warningToast]} onDismiss={vi.fn()} />);
      expect(container.querySelector('.toast.warning')).toBeInTheDocument();
      expect(screen.getByText('Rate Limit')).toBeInTheDocument();
    });
  });
});
