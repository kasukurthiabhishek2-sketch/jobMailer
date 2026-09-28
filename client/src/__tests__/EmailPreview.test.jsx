import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmailPreview from '../components/EmailPreview';

describe('Unified EmailPreview Component (Step 4 Drafts & Send)', () => {
  const mockConfig = {
    activeProvider: 'gemini',
    aiProviders: {
      gemini: { name: 'Google Gemini', model: '1.5-flash', isConfigured: true }
    },
    smtpProfiles: [
      {
        id: 'smtp-1',
        name: 'Gmail Default',
        fromName: 'Jane Candidate',
        fromEmail: 'jane@example.com',
        host: 'smtp.gmail.com',
        port: 465,
        isDefault: true,
        isConfigured: true
      }
    ],
    sendingPreferences: {
      delaySeconds: 5,
      attachResume: true
    }
  };

  const mockResumeData = {
    fileId: 'res-1',
    originalFilename: 'Jane_Resume.pdf',
    wordCount: 450,
    text: 'Experienced Full Stack Engineer'
  };

  const mockRecipients = [
    {
      id: 'rec-1',
      name: 'Sarah Connor',
      email: 'sarah@tech.co',
      company: 'TechCo',
      role: 'Engineering Director',
      isApproved: true
    },
    {
      id: 'rec-2',
      name: 'John Smith',
      email: 'john@startup.io',
      company: 'StartupIO',
      role: 'Head of Talent',
      isApproved: false
    }
  ];

  const mockGeneratedEmails = {
    'rec-1': {
      subject: 'Exploring Full Stack Engineering Roles at TechCo',
      body: 'Hi Sarah, I noticed your team is scaling distributed systems...',
      groundingAudit: {
        hasUngroundedClaims: false,
        groundingScore: 100
      }
    },
    'rec-2': {
      subject: 'Exploring Opportunities at StartupIO',
      body: 'Hi John, I am reaching out regarding technical opportunities...',
      groundingAudit: null
    }
  };

  it('renders unified Step 4 workspace with rich drafts UI and dispatch bar', () => {
    render(
      <EmailPreview
        config={mockConfig}
        resumeData={mockResumeData}
        jobDescription="Senior React Developer"
        recipients={mockRecipients}
        generatedEmails={mockGeneratedEmails}
        onUpdateRecipients={() => {}}
        onUpdateGeneratedEmails={() => {}}
        onOpenSettings={() => {}}
        onShowToast={() => {}}
        onTriggerSend={() => {}}
      />
    );

    // Title and counters
    expect(screen.getByText('AI Drafts & Safe Outreach Dispatch')).toBeInTheDocument();
    expect(screen.getByText('2 / 2 Drafted')).toBeInTheDocument();
    expect(screen.getByText('1 / 2 Approved')).toBeInTheDocument();

    // Toolbar elements
    expect(screen.getByText('Punchy')).toBeInTheDocument();
    expect(screen.getByText('Conversational')).toBeInTheDocument();
    expect(screen.getByText(/Generate All/)).toBeInTheDocument();

    // Recipient list in left sidebar & active contact header
    expect(screen.getAllByText('Sarah Connor').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('John Smith')).toBeInTheDocument();

    // Active draft editor elements
    expect(screen.getByDisplayValue('Exploring Full Stack Engineering Roles at TechCo')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Hi Sarah, I noticed your team/)).toBeInTheDocument();

    // Bottom dispatch bar controls
    expect(screen.getAllByText(/jane@example.com/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/5s delay ± jitter/)).toBeInTheDocument();
    expect(screen.getByLabelText(/I authorize outreach to approved contacts/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Outreach/ })).toBeInTheDocument();
  });

  it('allows toggling recipient approval checkbox', () => {
    const onUpdateRecipients = vi.fn();
    render(
      <EmailPreview
        config={mockConfig}
        resumeData={mockResumeData}
        recipients={mockRecipients}
        generatedEmails={mockGeneratedEmails}
        onUpdateRecipients={onUpdateRecipients}
      />
    );

    // Checkbox for John Smith (currently unapproved)
    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox in list is Sarah (approved), second is John (unapproved)
    fireEvent.click(checkboxes[1]);

    expect(onUpdateRecipients).toHaveBeenCalledWith([
      mockRecipients[0],
      { ...mockRecipients[1], isApproved: true }
    ]);
  });

  it('approves all unapproved contacts when Approve All is clicked', () => {
    const onUpdateRecipients = vi.fn();
    const onShowToast = vi.fn();

    render(
      <EmailPreview
        config={mockConfig}
        resumeData={mockResumeData}
        recipients={mockRecipients}
        generatedEmails={mockGeneratedEmails}
        onUpdateRecipients={onUpdateRecipients}
        onShowToast={onShowToast}
      />
    );

    const approveAllBtn = screen.getByRole('button', { name: /Approve All/ });
    fireEvent.click(approveAllBtn);

    expect(onUpdateRecipients).toHaveBeenCalledWith([
      { ...mockRecipients[0], isApproved: true },
      { ...mockRecipients[1], isApproved: true }
    ]);
    expect(onShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Contacts Approved' })
    );
  });

  it('gates dispatch button until SMTP configured, all approved, and authorized', () => {
    const onTriggerSend = vi.fn();
    const onShowToast = vi.fn();

    // When John Smith is not approved, send button is disabled
    const { rerender } = render(
      <EmailPreview
        config={mockConfig}
        resumeData={mockResumeData}
        recipients={mockRecipients}
        generatedEmails={mockGeneratedEmails}
        onTriggerSend={onTriggerSend}
        onShowToast={onShowToast}
      />
    );

    const sendBtn = screen.getByRole('button', { name: /Send Outreach/ });
    expect(sendBtn).toBeDisabled();

    // When all recipients are approved
    const allApprovedRecipients = mockRecipients.map(r => ({ ...r, isApproved: true }));
    rerender(
      <EmailPreview
        config={mockConfig}
        resumeData={mockResumeData}
        recipients={allApprovedRecipients}
        generatedEmails={mockGeneratedEmails}
        onTriggerSend={onTriggerSend}
        onShowToast={onShowToast}
      />
    );

    // Still disabled because authorization checkbox is unchecked
    expect(sendBtn).toBeDisabled();

    // Check authorization checkbox
    const authCheckbox = screen.getByLabelText(/I authorize outreach to approved contacts/);
    fireEvent.click(authCheckbox);

    // Now button should be enabled!
    expect(sendBtn).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Send Outreach \(2 Approved\)/ })).toBeInTheDocument();

    // Click dispatch
    fireEvent.click(sendBtn);
    expect(onTriggerSend).toHaveBeenCalledTimes(1);
  });

  it('updates draft subject and body inline', () => {
    const onUpdateGeneratedEmails = vi.fn();

    render(
      <EmailPreview
        config={mockConfig}
        resumeData={mockResumeData}
        recipients={mockRecipients}
        generatedEmails={mockGeneratedEmails}
        onUpdateGeneratedEmails={onUpdateGeneratedEmails}
      />
    );

    const subjectInput = screen.getByDisplayValue('Exploring Full Stack Engineering Roles at TechCo');
    fireEvent.change(subjectInput, { target: { value: 'New Custom Subject' } });

    expect(onUpdateGeneratedEmails).toHaveBeenCalledWith(
      expect.objectContaining({
        'rec-1': expect.objectContaining({ subject: 'New Custom Subject' })
      })
    );

    const bodyTextarea = screen.getByDisplayValue(/Hi Sarah, I noticed your team/);
    fireEvent.change(bodyTextarea, { target: { value: 'Updated email body content' } });

    expect(onUpdateGeneratedEmails).toHaveBeenCalledWith(
      expect.objectContaining({
        'rec-1': expect.objectContaining({ body: 'Updated email body content' })
      })
    );
  });
});
