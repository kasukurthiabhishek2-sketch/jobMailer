import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWizardState } from '../hooks/useWizardState';
import { useCampaignStream } from '../hooks/useCampaignStream';
import { streamEmailSending } from '../services/api';

vi.mock('../lib/firebase', () => ({ getIdToken: vi.fn().mockResolvedValue('verified-token') }));

describe('Send approval request contract', () => {
  it('preserves recipient approval and confirms sending through the hook and HTTP client', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, body: { getReader: () => ({ read: async () => ({ done: true }) }) }
    });
    try {
      const { result } = renderHook(() => useCampaignStream());
      await act(async () => {
        await result.current.triggerSend({
          config: { smtpProfiles: [{ id: 'p1', isDefault: true, isConfigured: true }] },
          resumeData: { fileId: 'res-1' },
          recipients: [{ id: 'r1', email: 'recipient@example.com', isApproved: true }],
          generatedEmails: { r1: { subject: 'Role', body: 'Hello' } }
        });
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toMatch(/\/api\/send\/stream$/);
      expect(JSON.parse(options.body)).toMatchObject({
        sendApproved: true,
        recipients: [{ id: 'r1', isApproved: true, subject: 'Role', body: 'Hello' }]
      });
    } finally { fetchMock.mockRestore(); }
  });

  it('does not infer explicit confirmation from recipient approval alone', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, body: { getReader: () => ({ read: async () => ({ done: true }) }) }
    });
    try {
      await streamEmailSending({ recipients: [{ isApproved: true }] });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).sendApproved).toBe(false);
    } finally { fetchMock.mockRestore(); }
  });
});

describe('useWizardState Hook (TICK-CYC3-08 / B2)', () => {
  it('initializes with default step 1 and empty state', () => {
    const { result } = renderHook(() => useWizardState());
    expect(result.current.currentStep).toBe(1);
    expect(result.current.direction).toBe('forward');
    expect(result.current.resumeData).toBeNull();
    expect(result.current.recipients).toEqual([]);
    expect(result.current.jobDescription).toBe('');
    expect(result.current.generatedEmails).toEqual({});
    expect(result.current.resumeReady).toBe(false);
  });

  it('correctly reports step lock states based on wizard progression', () => {
    const { result } = renderHook(() => useWizardState());

    // Step 1 is always unlocked
    expect(result.current.canGoToStep(1)).toBe(true);

    // Step 2, 3, 4, 5 are locked without resume
    expect(result.current.canGoToStep(2)).toBe(false);
    expect(result.current.canGoToStep(3)).toBe(false);
    expect(result.current.canGoToStep(4)).toBe(false);
    expect(result.current.canGoToStep(5)).toBe(false);

    expect(result.current.getLockReason(2)).toContain('Upload candidate resume');
  });

  it('auto-advances from step 1 to step 2 when resume is uploaded', () => {
    const { result } = renderHook(() => useWizardState());

    act(() => {
      result.current.handleResumeUploaded({
        fileId: 'res-123',
        originalFilename: 'resume.pdf',
        detectedName: 'Jane Doe'
      });
    });

    expect(result.current.resumeData?.fileId).toBe('res-123');
    expect(result.current.currentStep).toBe(2);
    expect(result.current.resumeReady).toBe(true);
    expect(result.current.canGoToStep(2)).toBe(true);
    expect(result.current.canGoToStep(3)).toBe(true);
  });

  it('updates resumeData without advancing currentStep when handleResumeChange is called', () => {
    const { result } = renderHook(() => useWizardState());

    expect(result.current.currentStep).toBe(1);

    act(() => {
      result.current.handleResumeChange({
        fileId: 'res-456',
        detectedName: 'Alice Smith',
        detectedEmail: 'alice@example.com'
      });
    });

    expect(result.current.resumeData?.fileId).toBe('res-456');
    expect(result.current.resumeData?.detectedName).toBe('Alice Smith');
    expect(result.current.resumeData?.detectedEmail).toBe('alice@example.com');
    expect(result.current.currentStep).toBe(1);
    expect(result.current.resumeReady).toBe(true);
  });

  it('updates resumeData without advancing currentStep when handleResumeUploaded is called with autoAdvance: false', () => {
    const { result } = renderHook(() => useWizardState());

    expect(result.current.currentStep).toBe(1);

    act(() => {
      result.current.handleResumeUploaded(
        {
          fileId: 'res-789',
          detectedName: 'Bob Jones'
        },
        { autoAdvance: false }
      );
    });

    expect(result.current.resumeData?.fileId).toBe('res-789');
    expect(result.current.resumeData?.detectedName).toBe('Bob Jones');
    expect(result.current.currentStep).toBe(1);
    expect(result.current.resumeReady).toBe(true);
  });

  it('prevents forward navigation to locked steps but permits backward navigation', () => {
    const { result } = renderHook(() => useWizardState());

    // Upload resume to reach step 2
    act(() => {
      result.current.handleResumeUploaded({ fileId: 'res-1' });
    });

    // Try jumping straight to step 4 without recipients or drafts
    let transitioned;
    act(() => {
      transitioned = result.current.goToStep(4);
    });
    expect(transitioned).toBe(false);
    expect(result.current.currentStep).toBe(2);

    // Backward navigation to step 1 is always allowed
    act(() => {
      transitioned = result.current.goToStep(1);
    });
    expect(transitioned).toBe(true);
    expect(result.current.currentStep).toBe(1);
    expect(result.current.direction).toBe('backward');
  });

  it('resets all state back to initial values on resetWizard', () => {
    const { result } = renderHook(() => useWizardState());

    act(() => {
      result.current.handleResumeUploaded({ fileId: 'res-1' });
      result.current.setRecipients([{ id: 'r1', name: 'Alice', email: 'alice@example.com' }]);
      result.current.setJobDescription('Software Engineer');
      result.current.setGeneratedEmails({ r1: { subject: 'Hi', body: 'Body' } });
    });

    expect(result.current.recipientsCount).toBe(1);
    expect(result.current.emailReady).toBe(true);

    act(() => {
      result.current.resetWizard();
    });

    expect(result.current.currentStep).toBe(1);
    expect(result.current.resumeData).toBeNull();
    expect(result.current.recipients).toEqual([]);
    expect(result.current.jobDescription).toBe('');
    expect(result.current.generatedEmails).toEqual({});
  });
});

describe('useCampaignStream Hook (TICK-CYC3-08 / B2)', () => {
  it('initializes with idle sending state', () => {
    const { result } = renderHook(() => useCampaignStream());
    expect(result.current.isSending).toBe(false);
    expect(result.current.sendModalOpen).toBe(false);
    expect(result.current.progressData).toBeNull();
    expect(result.current.campaignSendLogs).toEqual([]);
  });

  it('blocks dispatch when no SMTP profile is configured', async () => {
    const { result } = renderHook(() => useCampaignStream());
    const addToast = vi.fn();
    const onOpenSettings = vi.fn();

    let success;
    await act(async () => {
      success = await result.current.triggerSend({
        config: { smtpProfiles: [] },
        resumeData: { fileId: 'res-1' },
        recipients: [{ id: 'r1', email: 'test@example.com', isApproved: true }],
        generatedEmails: { r1: { subject: 'Subject', body: 'Body' } },
        onOpenSettings,
        addToast
      });
    });

    expect(success).toBe(false);
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'SMTP Profile Required' })
    );
    expect(onOpenSettings).toHaveBeenCalledWith('smtp');
  });

  it('blocks dispatch when resume is missing', async () => {
    const { result } = renderHook(() => useCampaignStream());
    const addToast = vi.fn();

    let success;
    await act(async () => {
      success = await result.current.triggerSend({
        config: { smtpProfiles: [{ id: 'p1', isDefault: true, isConfigured: true }] },
        resumeData: null,
        recipients: [{ id: 'r1', email: 'test@example.com', isApproved: true }],
        generatedEmails: { r1: { subject: 'Subject', body: 'Body' } },
        addToast
      });
    });

    expect(success).toBe(false);
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Resume Required' })
    );
  });

  it('blocks dispatch when recipients lack approval (two-stage human gate invariant)', async () => {
    const { result } = renderHook(() => useCampaignStream());
    const addToast = vi.fn();

    let success;
    await act(async () => {
      success = await result.current.triggerSend({
        config: { smtpProfiles: [{ id: 'p1', isDefault: true, isConfigured: true }] },
        resumeData: { fileId: 'res-1' },
        recipients: [{ id: 'r1', email: 'test@example.com', isApproved: false }],
        generatedEmails: { r1: { subject: 'Subject', body: 'Body' } },
        addToast
      });
    });

    expect(success).toBe(false);
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Approval Required' })
    );
  });
});
