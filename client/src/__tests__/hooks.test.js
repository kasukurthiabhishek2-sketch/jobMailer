import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWizardState } from '../hooks/useWizardState';
import { useCampaignStream } from '../hooks/useCampaignStream';

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
