import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AiJdParserPanel from '../components/AiJdParserPanel';
import * as api from '../services/api';

vi.mock('../services/api', async () => {
  const actual = await vi.importActual('../services/api');
  return {
    ...actual,
    parseJobDescriptionApi: vi.fn()
  };
});

describe('AiJdParserPanel Component', () => {
  const mockConfig = {
    activeProvider: 'gemini',
    aiProviders: {
      gemini: {
        name: 'Google Gemini',
        isConfigured: true,
        apiKey: 'test-api-key',
        model: 'gemini-1.5-flash'
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders input mode toggles and input fields properly', () => {
    render(
      <AiJdParserPanel
        config={mockConfig}
        onShowToast={vi.fn()}
        onAddRecipient={vi.fn()}
      />
    );

    expect(screen.getByText('AI Parse Job Description')).toBeInTheDocument();
    expect(screen.getByText('Paste JD Text')).toBeInTheDocument();
    expect(screen.getByText('Paste URL')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Paste the full job description here/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Parse with AI/i })).toBeDisabled();
  });

  it('enables parse button when JD text exceeds 20 characters', () => {
    render(
      <AiJdParserPanel
        config={mockConfig}
        onShowToast={vi.fn()}
        onAddRecipient={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText(/Paste the full job description here/i);
    fireEvent.change(textarea, { target: { value: 'Senior Backend Engineer role at Stripe with Node.js and Redis.' } });

    const parseBtn = screen.getByRole('button', { name: /Parse with AI/i });
    expect(parseBtn).not.toBeDisabled();
  });

  it('switches to URL input mode and enforces URL length validation', () => {
    render(
      <AiJdParserPanel
        config={mockConfig}
        onShowToast={vi.fn()}
        onAddRecipient={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Paste URL'));
    const urlInput = screen.getByPlaceholderText(/boards.greenhouse.io/i);
    expect(urlInput).toBeInTheDocument();

    const parseBtn = screen.getByRole('button', { name: /Parse with AI/i });
    expect(parseBtn).toBeDisabled();

    fireEvent.change(urlInput, { target: { value: 'https://jobs.lever.co/stripe/12345' } });
    expect(parseBtn).not.toBeDisabled();
  });

  it('renders multi-layered diagnostic error banner with reference ID on failure', async () => {
    const error = new Error('The job board blocked automated access (HTTP 403 Forbidden).');
    error.code = 'URL_HTTP_403';
    error.stage = 'url_fetch';
    error.requestId = 'REQ-20260930-A1B2C3';
    error.technicalMessage = 'Cloudflare bot protection triggered on boards.greenhouse.io';
    error.fallbackAvailable = true;

    vi.mocked(api.parseJobDescriptionApi).mockRejectedValueOnce(error);

    render(
      <AiJdParserPanel
        config={mockConfig}
        onShowToast={vi.fn()}
        onAddRecipient={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Paste URL'));
    fireEvent.change(screen.getByPlaceholderText(/boards.greenhouse.io/i), {
      target: { value: 'https://boards.greenhouse.io/company/jobs/123' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Parse with AI/i }));

    await waitFor(() => {
      expect(screen.getByText(/The job board blocked automated access/i)).toBeInTheDocument();
      expect(screen.getByText('REQ-20260930-A1B2C3')).toBeInTheDocument();
      expect(screen.getByText('Switch to Paste JD')).toBeInTheDocument();
      expect(screen.getByText('View diagnostic details')).toBeInTheDocument();
    });

    // Toggle diagnostic details drawer
    fireEvent.click(screen.getByText('View diagnostic details'));
    expect(screen.getByText(/Stage: url_fetch/i)).toBeInTheDocument();
    expect(screen.getByText(/Code: URL_HTTP_403/i)).toBeInTheDocument();
    expect(screen.getByText(/Cloudflare bot protection triggered/i)).toBeInTheDocument();

    // Click "Switch to Paste JD" recovery action
    fireEvent.click(screen.getByText('Switch to Paste JD'));
    expect(screen.getByPlaceholderText(/Paste the full job description here/i)).toBeInTheDocument();
    expect(screen.queryByText(/The job board blocked automated access/i)).not.toBeInTheDocument();
  });

  it('successfully populates editable preview and adds recipient to queue', async () => {
    const mockSuccessResponse = {
      success: true,
      sourceUrl: null,
      parsed: {
        company: 'Figma',
        role: 'Senior Frontend Engineer',
        location: 'San Francisco, CA',
        contacts: [
          { name: 'Sarah Miller', email: 'sarah.recruiter@figma.com', title: 'Tech Recruiter' }
        ],
        responsibilities: ['Build collaborative canvas engines', 'Scale real-time web socket layers'],
        requirements: ['5+ years React and TypeScript', 'Deep WebGL or canvas experience'],
        jobDescriptionClean: 'Figma is hiring a Senior Frontend Engineer...',
        confidence: {
          emailFound: true,
          companyFound: true,
          roleFound: true
        }
      }
    };

    vi.mocked(api.parseJobDescriptionApi).mockResolvedValueOnce(mockSuccessResponse);
    const mockAddRecipient = vi.fn();
    const mockToast = vi.fn();

    render(
      <AiJdParserPanel
        config={mockConfig}
        onShowToast={mockToast}
        onAddRecipient={mockAddRecipient}
        existingEmails={[]}
      />
    );

    const textarea = screen.getByPlaceholderText(/Paste the full job description here/i);
    fireEvent.change(textarea, { target: { value: 'Senior Frontend Engineer at Figma. Contact sarah.recruiter@figma.com for details.' } });
    fireEvent.click(screen.getByRole('button', { name: /Parse with AI/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('sarah.recruiter@figma.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Sarah Miller')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Figma')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Senior Frontend Engineer')).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: /Add to Recipient Queue/i });
    expect(addBtn).not.toBeDisabled();
    fireEvent.click(addBtn);

    expect(mockAddRecipient).toHaveBeenCalledWith({
      name: 'Sarah Miller',
      email: 'sarah.recruiter@figma.com',
      company: 'Figma',
      role: 'Senior Frontend Engineer',
      jobDescription: 'Figma is hiring a Senior Frontend Engineer...'
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      type: 'success',
      title: 'Recipient Added'
    }));
  });

  it('detects duplicate email and disables add to queue button', async () => {
    const mockSuccessResponse = {
      success: true,
      parsed: {
        company: 'Stripe',
        role: 'Software Engineer',
        contacts: [
          { name: 'Alex', email: 'alex@stripe.com', title: '' }
        ],
        confidence: { emailFound: true, companyFound: true, roleFound: true }
      }
    };

    vi.mocked(api.parseJobDescriptionApi).mockResolvedValueOnce(mockSuccessResponse);

    render(
      <AiJdParserPanel
        config={mockConfig}
        onShowToast={vi.fn()}
        onAddRecipient={vi.fn()}
        existingEmails={['alex@stripe.com']}
      />
    );

    const textarea = screen.getByPlaceholderText(/Paste the full job description here/i);
    fireEvent.change(textarea, { target: { value: 'Software Engineer at Stripe. Reach out to alex@stripe.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Parse with AI/i }));

    await waitFor(() => {
      expect(screen.getByText('This email is already in your recipient queue.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add to Recipient Queue/i })).toBeDisabled();
    });
  });
});
