import { useState, useCallback } from 'react';
import { streamEmailSending } from '../services/api';

/**
 * useCampaignStream — Hook managing real-time outbound email dispatch over SSE.
 *
 * Responsibilities:
 * - Active dispatch streaming lifecycle (isSending, progress, throttling, completion)
 * - Safe pre-flight validation (SMTP profile presence, resume attachment, recipient approvals)
 * - Real-time progress updates, anti-abuse throttling notifications, and audit log accumulation
 */
export function useCampaignStream() {
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [progressData, setProgressData] = useState(null);
  const [throttlingData, setThrottlingData] = useState(null);
  const [campaignSendLogs, setCampaignSendLogs] = useState([]);
  const [campaignSummary, setCampaignSummary] = useState(null);

  const resetCampaignState = useCallback(() => {
    setProgressData(null);
    setThrottlingData(null);
    setCampaignSendLogs([]);
    setCampaignSummary(null);
    setIsSending(false);
  }, []);

  const triggerSend = useCallback(async ({
    config,
    resumeData,
    recipients,
    generatedEmails,
    onOpenSettings,
    addToast
  }) => {
    const activeSmtp = (config?.smtpProfiles || []).find(p => p.isDefault) || config?.smtpProfiles?.[0];
    if (!activeSmtp || !activeSmtp.isConfigured) {
      addToast?.({
        type: 'error',
        title: 'SMTP Profile Required',
        message: 'Please add and configure your SMTP credentials in Settings before sending.'
      });
      if (onOpenSettings) onOpenSettings('smtp');
      return false;
    }

    if (!resumeData) {
      addToast?.({
        type: 'error',
        title: 'Resume Required',
        message: 'Please upload candidate resume in Step 1.'
      });
      return false;
    }

    const readyRecipients = (recipients || [])
      .filter(r => generatedEmails?.[r.id]?.body)
      .map(r => ({
        id: r.id,
        email: r.email,
        name: r.name,
        company: r.company,
        role: r.role,
        subject: generatedEmails[r.id].subject,
        body: generatedEmails[r.id].body
      }));

    if (readyRecipients.length === 0) {
      addToast?.({
        type: 'error',
        title: 'No Drafts Ready',
        message: 'Please click "Generate Tailored Cold Emails" in Step 4 before sending.'
      });
      return false;
    }

    // Two-stage human approval gate verification
    const unapproved = readyRecipients.filter(r => {
      const rec = (recipients || []).find(orig => orig.id === r.id);
      return !rec || !rec.isApproved;
    });

    if (unapproved.length > 0) {
      addToast?.({
        type: 'error',
        title: 'Approval Required',
        message: `${unapproved.length} recipient(s) lack explicit approval. Please approve them before sending.`
      });
      return false;
    }

    setProgressData({ current: 0, total: readyRecipients.length, recipientEmail: '', status: 'starting' });
    setThrottlingData(null);
    setCampaignSendLogs([]);
    setCampaignSummary(null);
    setIsSending(true);
    setSendModalOpen(true);

    const delay = config?.sendingPreferences?.delaySeconds || 3;
    const concurrency = config?.sendingPreferences?.concurrency || config?.preferences?.concurrency || 1;
    const attachResume = config?.sendingPreferences?.attachResume !== false;

    try {
      await streamEmailSending({
        recipients: readyRecipients,
        resumeFileId: attachResume ? resumeData.fileId : null,
        smtpProfileId: activeSmtp.id,
        smtpProfile: activeSmtp,
        delaySeconds: delay,
        concurrency,
        onEvent: (eventType, eventData) => {
          if (eventType === 'start') {
            setProgressData({ current: 0, total: eventData.total, status: 'started' });
          } else if (eventType === 'progress') {
            setThrottlingData(null);
            setProgressData({
              current: eventData.current,
              total: eventData.total,
              recipientEmail: eventData.recipientEmail,
              recipientName: eventData.recipientName,
              status: 'sending'
            });
          } else if (eventType === 'item_complete') {
            setCampaignSendLogs(prev => [eventData.logItem, ...prev]);
          } else if (eventType === 'throttling') {
            setThrottlingData({
              waitingSeconds: eventData.waitingSeconds,
              nextIndex: eventData.nextIndex
            });
          } else if (eventType === 'slowdown') {
            setThrottlingData({
              waitingSeconds: eventData.currentDelay,
              reason: eventData.reason,
              isSlowdown: true
            });
            addToast?.({
              type: 'warning',
              title: 'Pacing Slowed Down',
              message: eventData.reason
            });
          } else if (eventType === 'circuit_breaker') {
            setIsSending(false);
            addToast?.({
              type: 'error',
              title: 'Campaign Stopped (Circuit Breaker)',
              message: eventData.error
            });
          } else if (eventType === 'auth_error') {
            setIsSending(false);
            addToast?.({
              type: 'error',
              title: 'Authentication Error',
              message: eventData.error
            });
          } else if (eventType === 'finished') {
            setIsSending(false);
            setThrottlingData(null);
            setCampaignSummary({
              total: eventData.total,
              sentCount: eventData.sentCount,
              failedCount: eventData.failedCount,
              aborted: eventData.aborted,
              abortReason: eventData.abortReason
            });
            addToast?.({
              type: eventData.failedCount > 0 && eventData.sentCount === 0 ? 'error' : 'success',
              title: eventData.aborted ? 'Campaign Stopped' : 'Campaign Complete',
              message: `Finished sending ${eventData.sentCount} of ${eventData.total} emails.${eventData.abortReason ? ' ' + eventData.abortReason : ''}`
            });
          }
        },
        onError: (err) => {
          setIsSending(false);
          addToast?.({
            type: 'error',
            title: 'Sending Error',
            message: err.message
          });
        }
      });
      return true;
    } catch (err) {
      setIsSending(false);
      addToast?.({
        type: 'error',
        title: 'Dispatch Failed',
        message: err.message
      });
      return false;
    }
  }, []);

  return {
    sendModalOpen,
    setSendModalOpen,
    isSending,
    progressData,
    throttlingData,
    campaignSendLogs,
    campaignSummary,
    triggerSend,
    resetCampaignState
  };
}
