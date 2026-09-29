import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ResumeUpload from '../components/ResumeUpload';
import EmailPreview from '../components/EmailPreview';
import AiProvidersTab from '../components/settings/AiProvidersTab';
import * as api from '../services/api';

vi.mock('../services/api', async () => {
  const actual = await vi.importActual('../services/api');
  return {
    ...actual,
    uploadResume: vi.fn(),
    deleteEphemeralResume: vi.fn(),
    testAiConnection: vi.fn(),
    batchGenerateColdEmails: vi.fn(),
    generateColdEmail: vi.fn(),
    listAiModels: vi.fn().mockResolvedValue({ success: true, models: [] }),
    saveAiProviderConfig: vi.fn().mockResolvedValue({ success: true }),
    getCurrentCopilotFlow: vi.fn().mockResolvedValue({ active: false })
  };
});

describe('Sample Resume Workflow & AI Key Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Verifies sample resume button is removed from ResumeUpload
  it('does not display "Try with Sample Resume" button in candidate intake', () => {
    render(
      <ResumeUpload
        resumeData={null}
        onResumeUploaded={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /Try with Sample Resume/i })).not.toBeInTheDocument();
  });

  // 2. EmailPreview works seamlessly with sample resume and server-configured AI
  it('recognizes server-configured AI with masked key and triggers batch generation without "AI Provider Not Configured" error', async () => {
    const mockConfigWithServerKey = {
      activeProvider: 'gemini',
      aiProviders: {
        gemini: {
          name: 'Google Gemini',
          apiKey: '', // Raw key is NOT in client memory
          maskedKey: 'AIza...9999', // Key is saved and masked on server
          model: 'gemini-1.5-flash',
          isConfigured: true,
          savedKeys: [
            { id: 'key_1', name: 'Primary Key', maskedKey: 'AIza...9999', createdAt: '2026-01-01' }
          ]
        }
      },
      smtpProfiles: [
        {
          id: 'smtp_1',
          name: 'Default SMTP',
          fromEmail: 'alex.mercer.dev@example.com',
          isDefault: true,
          isConfigured: true
        }
      ],
      preferences: {
        outreachTone: 'direct',
        delaySeconds: 5
      }
    };

    const sampleResumeData = {
      fileId: 'sample-resume-alex-mercer',
      originalFilename: 'Alex_Mercer_Resume.pdf',
      detectedName: 'Alex Mercer',
      detectedEmail: 'alex.mercer.dev@example.com',
      wordCount: 420,
      text: 'Alex Mercer\nSenior Full-Stack & AI Systems Engineer\nSpecialized in React, Node.js, and LLMs.'
    };

    const mockRecipients = [
      {
        id: 'rec-1',
        name: 'Jane Recruiter',
        email: 'jane@stripe.com',
        company: 'Stripe',
        role: 'Senior Staff Engineer',
        isApproved: false
      }
    ];

    api.batchGenerateColdEmails.mockResolvedValueOnce({
      success: true,
      results: [
        {
          recipientId: 'rec-1',
          success: true,
          email: {
            subject: 'Exploring Full-Stack Roles at Stripe',
            body: 'Hi Jane, as an engineer with experience scaling distributed systems...',
            groundingAudit: { hasUngroundedClaims: false, groundingScore: 100 }
          }
        }
      ]
    });

    const onShowToast = vi.fn();
    const onOpenSettings = vi.fn();
    const onUpdateGeneratedEmails = vi.fn();

    render(
      <EmailPreview
        config={mockConfigWithServerKey}
        resumeData={sampleResumeData}
        jobDescription="Senior React and Node.js Engineer"
        recipients={mockRecipients}
        generatedEmails={{}}
        onUpdateRecipients={() => {}}
        onUpdateGeneratedEmails={onUpdateGeneratedEmails}
        onOpenSettings={onOpenSettings}
        onShowToast={onShowToast}
        onTriggerSend={() => {}}
      />
    );

    // Verify Generate All is rendered and active
    const generateAllBtn = screen.getByRole('button', { name: /Generate All/i });
    expect(generateAllBtn).toBeInTheDocument();

    fireEvent.click(generateAllBtn);

    // Assert onOpenSettings was NEVER called because AI is recognized as configured
    expect(onOpenSettings).not.toHaveBeenCalled();

    // Assert batchGenerateColdEmails was dispatched with sample resume text
    await waitFor(() => {
      expect(api.batchGenerateColdEmails).toHaveBeenCalledTimes(1);
    });

    expect(api.batchGenerateColdEmails).toHaveBeenCalledWith(expect.objectContaining({
      providerKey: 'gemini',
      resumeText: sampleResumeData.text,
      senderName: 'Alex Mercer',
      recipients: mockRecipients
    }));
  });

  // 3. AI Providers Tab: Testing connection with server-configured key
  it('enables "Test connection" button when key is saved on server, triggers test, and displays feedback', async () => {
    const mockConfigWithServerKey = {
      activeProvider: 'gemini',
      aiProviders: {
        gemini: {
          name: 'Google Gemini',
          apiKey: '',
          maskedKey: 'AIza...8888',
          model: 'gemini-1.5-flash',
          isConfigured: true,
          savedKeys: [
            { id: 'key_gemini_1', name: 'Primary Key', maskedKey: 'AIza...8888', createdAt: '2026-01-01' }
          ]
        },
        openai: {
          name: 'ChatGPT / OpenAI',
          apiKey: '',
          maskedKey: '',
          isConfigured: false
        }
      }
    };

    api.testAiConnection.mockResolvedValueOnce({
      success: true,
      message: 'Connected to Gemini (gemini-1.5-flash) successfully!'
    });

    const onShowToast = vi.fn();
    const onRefreshConfig = vi.fn();

    render(
      <AiProvidersTab
        config={mockConfigWithServerKey}
        onRefreshConfig={onRefreshConfig}
        onShowToast={onShowToast}
      />
    );

    // Find the Gemini provider card and expand it
    const geminiCard = screen.getByText('Google Gemini');
    expect(geminiCard).toBeInTheDocument();
    fireEvent.click(geminiCard);

    // "Test connection" button should be present and enabled
    const testBtn = screen.getByRole('button', { name: /Test connection/i });
    expect(testBtn).toBeInTheDocument();
    expect(testBtn).not.toBeDisabled();

    // Click "Test connection"
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(api.testAiConnection).toHaveBeenCalledTimes(1);
    });

    expect(api.testAiConnection).toHaveBeenCalledWith(expect.objectContaining({
      providerKey: 'gemini',
      selectedKeyId: 'key_gemini_1'
    }));

    // Verify success toast notification
    await waitFor(() => {
      expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({
        type: 'success',
        title: 'Connection Verified',
        message: 'Connected to Gemini (gemini-1.5-flash) successfully!'
      }));
    });
  });

  // 4. AI Providers Tab: Handles connection error and displays guided message
  it('handles connection error gracefully and shows guidance toast', async () => {
    const mockConfigWithMismatchedKey = {
      activeProvider: 'grok',
      aiProviders: {
        grok: {
          name: 'Grok (xAI)',
          apiKey: '',
          maskedKey: 'gsk_...1234',
          model: 'grok-2-1212',
          isConfigured: true,
          savedKeys: [
            { id: 'key_grok_1', name: 'Primary Key', maskedKey: 'gsk_...1234', createdAt: '2026-01-01' }
          ]
        }
      }
    };

    api.testAiConnection.mockResolvedValueOnce({
      success: false,
      error: "This key starts with 'gsk_', which is a GroqCloud key (console.groq.com), not Grok (xAI). Please select the 'Groq (LPU Inference)' provider instead!"
    });

    const onShowToast = vi.fn();

    render(
      <AiProvidersTab
        config={mockConfigWithMismatchedKey}
        onRefreshConfig={vi.fn()}
        onShowToast={onShowToast}
      />
    );

    const grokCard = screen.getByText('Grok (xAI)');
    fireEvent.click(grokCard);

    const testBtn = screen.getByRole('button', { name: /Test connection/i });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(api.testAiConnection).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({
        type: 'error',
        title: 'Connection Failed',
        message: expect.stringContaining('GroqCloud key')
      }));
    });
  });
});
