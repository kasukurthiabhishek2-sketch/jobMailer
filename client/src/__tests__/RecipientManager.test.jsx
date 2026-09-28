import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RecipientManager from '../components/RecipientManager';

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
});
