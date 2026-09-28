import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import RecipientManager from '../components/RecipientManager';
import { fetchOutreachLogs } from '../services/api';

// Mock API calls
vi.mock('../services/api', () => ({
  uploadRecipientsSheet: vi.fn(),
  fetchOutreachLogs: vi.fn().mockImplementation(() => new Promise(() => {}))
}));

describe('RecipientManager Component Refactor', () => {
  const sampleRecipients = [
    {
      id: 'rec_1',
      name: 'Sarah Jenkins',
      email: 'sarah.jenkins@techcorp.io',
      company: 'TechCorp Labs',
      role: 'Senior Engineering Recruiter',
      jobDescription: 'Frontend React specialist with cloud background',
      isValidEmail: true,
      isSelected: false,
      isApproved: true,
      status: 'pending'
    },
    {
      id: 'rec_2',
      name: 'David Zhao',
      email: 'david.zhao@finscale.ai',
      company: 'FinScale AI',
      role: 'VP of Engineering',
      jobDescription: '',
      isValidEmail: true,
      isSelected: false,
      isApproved: true,
      status: 'pending'
    }
  ];

  it('renders correct tab names: Import Spreadsheet (.xlsx, .csv) and Add Manually', () => {
    render(
      <RecipientManager
        recipients={sampleRecipients}
        onUpdateRecipients={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Import Spreadsheet \(\.xlsx, \.csv\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Manually/i })).toBeInTheDocument();
  });

  it('renders the side-by-side layout with Recipients List on the right', () => {
    render(
      <RecipientManager
        recipients={sampleRecipients}
        onUpdateRecipients={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    expect(screen.getByText('Spreadsheet Upload')).toBeInTheDocument();
    expect(screen.getByText('Recipients List')).toBeInTheDocument();
    expect(screen.getByText('Sarah Jenkins')).toBeInTheDocument();
    expect(screen.getByText('David Zhao')).toBeInTheDocument();
  });

  it('displays JD Added badge for contacts with JD and Generic Pitch badge for contacts without JD', () => {
    render(
      <RecipientManager
        recipients={sampleRecipients}
        onUpdateRecipients={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    expect(screen.getByText('JD Added')).toBeInTheDocument();
    expect(screen.getByText('Generic Pitch')).toBeInTheDocument();
  });

  it('displays RFC indicators for valid email format', () => {
    render(
      <RecipientManager
        recipients={sampleRecipients}
        onUpdateRecipients={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    const rfcBadges = screen.getAllByText(/RFC Valid/i);
    expect(rfcBadges.length).toBe(2);
  });

  it('switches to Add Manually tab and includes Job Description in submission', () => {
    const onUpdateRecipients = vi.fn();
    const onShowToast = vi.fn();

    render(
      <RecipientManager
        recipients={sampleRecipients}
        onUpdateRecipients={onUpdateRecipients}
        onShowToast={onShowToast}
      />
    );

    // Switch to Add Manually
    fireEvent.click(screen.getByRole('button', { name: /Add Manually/i }));
    expect(screen.getByText('Add Contact Manually')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Paste job description or key requirements/i)).toBeInTheDocument();

    // Fill in form fields
    fireEvent.change(screen.getByPlaceholderText('e.g. Jessica Taylor'), {
      target: { value: 'Alice Morgan' }
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. jessica@company.com'), {
      target: { value: 'alice@innovate.co' }
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. Stripe, OpenAI, Figma'), {
      target: { value: 'Innovate Labs' }
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. Technical Recruiter or Senior SWE'), {
      target: { value: 'Staff AI Engineer' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Paste job description or key requirements/i), {
      target: { value: 'Looking for PyTorch and distributed systems experience' }
    });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /Add Recipient to Queue/i }));

    expect(onUpdateRecipients).toHaveBeenCalledTimes(1);
    const updatedList = onUpdateRecipients.mock.calls[0][0];
    expect(updatedList.length).toBe(3);

    const added = updatedList[2];
    expect(added.name).toBe('Alice Morgan');
    expect(added.email).toBe('alice@innovate.co');
    expect(added.company).toBe('Innovate Labs');
    expect(added.role).toBe('Staff AI Engineer');
    expect(added.jobDescription).toBe('Looking for PyTorch and distributed systems experience');
    expect(added.isApproved).toBe(true);

    // Form fields should be cleanly reset
    expect(screen.getByPlaceholderText('e.g. Jessica Taylor').value).toBe('');
    expect(screen.getByPlaceholderText('e.g. jessica@company.com').value).toBe('');
    expect(screen.getByPlaceholderText(/Paste job description or key requirements/i).value).toBe('');

    // Toast discipline: No noisy toast on successful contact addition
    expect(onShowToast).not.toHaveBeenCalled();
  });

  it('shows error toast on invalid email submission (validation error)', () => {
    const onShowToast = vi.fn();
    render(
      <RecipientManager
        recipients={[]}
        onUpdateRecipients={vi.fn()}
        onShowToast={onShowToast}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Add Manually/i }));

    fireEvent.change(screen.getByPlaceholderText('e.g. jessica@company.com'), {
      target: { value: 'not-an-email' }
    });

    const form = screen.getByRole('button', { name: /Add Recipient to Queue/i }).closest('form');
    fireEvent.submit(form);

    expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error',
      title: 'Invalid Email Format'
    }));
  });

  it('renders inviting placeholder when queue is empty', () => {
    render(
      <RecipientManager
        recipients={[]}
        onUpdateRecipients={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    expect(screen.getByText('No contacts in queue')).toBeInTheDocument();
    expect(screen.getByText(/Upload a sheet or add contacts manually to begin\./i)).toBeInTheDocument();
  });

  it('displays 30-day "Previously Contacted" badge on queue cards for contacted recipients', () => {
    const recipientsWithDedup = [
      {
        id: 'rec_prev_1',
        name: 'Carlos Rivera',
        email: 'carlos@example.com',
        company: 'DataCorp',
        role: 'Engineering Director',
        isValidEmail: true,
        isSelected: false,
        isApproved: true,
        isPreviouslyContacted: true,
        lastContactedDate: '2026-09-15T12:00:00Z',
        status: 'pending'
      },
      {
        id: 'rec_fresh_2',
        name: 'Dana White',
        email: 'dana@example.com',
        company: 'NewCo',
        role: 'Recruiter',
        isValidEmail: true,
        isSelected: false,
        isApproved: true,
        isPreviouslyContacted: false,
        status: 'pending'
      }
    ];

    render(
      <RecipientManager
        recipients={recipientsWithDedup}
        onUpdateRecipients={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    const prevContactedBadges = screen.getAllByText(/Previously Contacted/i);
    expect(prevContactedBadges.length).toBe(1);
    expect(prevContactedBadges[0].closest('.status-badge-attention')).toBeInTheDocument();
    expect(screen.getByText('Carlos Rivera')).toBeInTheDocument();
    expect(screen.getByText('Dana White')).toBeInTheDocument();
  });

  it('preserves isPreviouslyContacted and lastContactedDate on manual addition with confirmed 30-day duplicate', async () => {
    const recentTimestamp = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    fetchOutreachLogs.mockResolvedValueOnce([
      {
        recipientEmail: 'dup@example.com',
        status: 'sent',
        timestamp: recentTimestamp,
        company: 'Prior Company'
      }
    ]);

    const onUpdateRecipients = vi.fn();
    const onShowToast = vi.fn();

    render(
      <RecipientManager
        recipients={[]}
        onUpdateRecipients={onUpdateRecipients}
        onShowToast={onShowToast}
      />
    );

    // Allow fetchOutreachLogs promise to resolve
    await act(async () => {
      await Promise.resolve();
    });

    // Switch to Add Manually tab
    fireEvent.click(screen.getByRole('button', { name: /Add Manually/i }));

    // Fill in form with the previously contacted email
    fireEvent.change(screen.getByPlaceholderText('e.g. Jessica Taylor'), {
      target: { value: 'Dup Recipient' }
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. jessica@company.com'), {
      target: { value: 'dup@example.com' }
    });

    // First submit: triggers 30-day dedup confirmation warning
    fireEvent.click(screen.getByRole('button', { name: /Add Recipient to Queue/i }));

    // Dedup warning banner should be displayed asking confirmation
    expect(screen.getByText(/Contacted on/i)).toBeInTheDocument();
    const confirmAddBtn = screen.getByRole('button', { name: 'Yes, Add' });
    expect(confirmAddBtn).toBeInTheDocument();
    expect(onUpdateRecipients).not.toHaveBeenCalled();

    // Confirm addition by clicking "Yes, Add"
    fireEvent.click(confirmAddBtn);

    // onUpdateRecipients should now be called with new recipient preserving dedup info
    expect(onUpdateRecipients).toHaveBeenCalledTimes(1);
    const addedList = onUpdateRecipients.mock.calls[0][0];
    expect(addedList.length).toBe(1);
    const added = addedList[0];
    expect(added.email).toBe('dup@example.com');
    expect(added.isPreviouslyContacted).toBe(true);
    expect(added.lastContactedDate).toBe(recentTimestamp);
  });

  it('correctly updates contactedLogsMap with the most recent timestamp when contact appears multiple times in 30 days', async () => {
    const olderTimestamp = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const newerTimestamp = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    fetchOutreachLogs.mockResolvedValueOnce([
      {
        recipientEmail: 'multi@example.com',
        status: 'sent',
        timestamp: olderTimestamp,
        company: 'Old Log'
      },
      {
        recipientEmail: 'multi@example.com',
        status: 'sent',
        timestamp: newerTimestamp,
        company: 'New Log'
      }
    ]);

    const onUpdateRecipients = vi.fn();
    render(
      <RecipientManager
        recipients={[]}
        onUpdateRecipients={onUpdateRecipients}
        onShowToast={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Manually/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Jessica Taylor'), {
      target: { value: 'Multi Recipient' }
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. jessica@company.com'), {
      target: { value: 'multi@example.com' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Add Recipient to Queue/i }));

    const confirmAddBtn = screen.getByRole('button', { name: 'Yes, Add' });
    fireEvent.click(confirmAddBtn);

    expect(onUpdateRecipients).toHaveBeenCalledTimes(1);
    const addedList = onUpdateRecipients.mock.calls[0][0];
    expect(addedList[0].lastContactedDate).toBe(newerTimestamp);
  });

  it('paginates recipient queue when contacts exceed 10', () => {
    const manyRecipients = Array.from({ length: 15 }, (_, i) => ({
      id: `rec_${i + 1}`,
      name: `Candidate ${i + 1}`,
      email: `candidate${i + 1}@domain.com`,
      company: `Company ${i + 1}`,
      role: 'Engineer',
      jobDescription: '',
      isValidEmail: true,
      isSelected: false,
      isApproved: true,
      status: 'pending'
    }));

    render(
      <RecipientManager
        recipients={manyRecipients}
        onUpdateRecipients={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    // Page 1: contacts 1-10 visible, 11-15 not visible
    expect(screen.getByText('candidate1@domain.com')).toBeInTheDocument();
    expect(screen.getByText('candidate10@domain.com')).toBeInTheDocument();
    expect(screen.queryByText('candidate11@domain.com')).not.toBeInTheDocument();
    expect(screen.getByText('1–10', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: 'Previous queue page' });
    const nextBtn = screen.getByRole('button', { name: 'Next queue page' });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    // Navigate to Page 2
    fireEvent.click(nextBtn);
    expect(screen.queryByText('candidate1@domain.com')).not.toBeInTheDocument();
    expect(screen.getByText('candidate11@domain.com')).toBeInTheDocument();
    expect(screen.getByText('candidate15@domain.com')).toBeInTheDocument();
    expect(screen.getByText('11–15', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/Page 2 of 2/i)).toBeInTheDocument();
    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).toBeDisabled();

    // Navigate back to Page 1
    fireEvent.click(prevBtn);
    expect(screen.getByText('candidate1@domain.com')).toBeInTheDocument();
    expect(screen.getByText('1–10', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument();
  });
});
