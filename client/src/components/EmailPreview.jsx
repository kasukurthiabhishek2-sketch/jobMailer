import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Send,
  Check,
  Copy,
  AlertTriangle,
  ShieldCheck,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  Mail,
  Settings as SettingsIcon,
  UserCheck
} from 'lucide-react';
import {
  generateColdEmail,
  batchGenerateColdEmails,
  setActiveAiProvider,
  fetchDailySendingStats
} from '../services/api';
import { saveSettings, stripUndefined } from '../lib/settings';

const TONE_OPTIONS = [
  { id: 'impact', label: 'Punchy', prompt: 'Direct, confident, highlighting quantifiable engineering impact and architectural leadership.' },
  { id: 'warm', label: 'Conversational', prompt: 'Warm, highly approachable, expressing genuine excitement for the team culture and mission.' },
  { id: 'founder', label: 'Founder', prompt: 'Agile mindset, wearing multiple hats, rapid execution, and high ownership.' },
  { id: 'bullets', label: '3-Bullet', prompt: 'Very brief opening, followed by 3 punchy bullet points of candidate achievements, ending with a low-friction CTA.' },
  { id: 'custom', label: 'Custom', prompt: '' }
];

const SPAM_TRIGGER_WORDS = [
  'urgent', 'act now', 'apply now', 'limited time', 'exclusive deal',
  'guarantee', 'guaranteed', 'risk-free', 'winner', 'congratulations',
  '100% free', 'free', 'no catch', 'no cost', 'no risk',
  '$$$', 'make money', 'cash bonus', 'hidden fees', 'instant',
  'unlimited', 'once in a lifetime', 'special promotion', 'order now',
  'buy now', 'promise', 'earn money'
];

export default function EmailPreview({
  config,
  resumeData,
  jobDescription,
  recipients = [],
  onUpdateRecipients,
  generatedEmails = {},
  onUpdateGeneratedEmails,
  onOpenSettings,
  onShowToast,
  onTriggerSend,
  onRefreshConfig,
  user
}) {
  const [selectedTone, setSelectedTone] = useState('impact');
  const [customToneText, setCustomToneText] = useState('');
  const [activeRecipientIndex, setActiveRecipientIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState({ current: 0, total: 0 });
  const [isRegeneratingSingle, setIsRegeneratingSingle] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [searchRecipient, setSearchRecipient] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'ready' | 'pending'

  // Sending and human-in-the-loop dispatch state (integrated from SendStep)
  const [explicitlyAuthorized, setExplicitlyAuthorized] = useState(false);
  const [dailyStats, setDailyStats] = useState(null);

  // Default SMTP Profile
  const defaultSmtp = (config?.smtpProfiles || []).find(p => p.isDefault) || config?.smtpProfiles?.[0];
  const isSmtpConfigured = Boolean(defaultSmtp && defaultSmtp.isConfigured);
  const delaySeconds = config?.sendingPreferences?.delaySeconds || 3;
  const attachResume = config?.sendingPreferences?.attachResume !== false;

  // Reactive live-refresh of daily sending stats on SMTP or config change
  useEffect(() => {
    let mounted = true;
    fetchDailySendingStats(defaultSmtp?.id || null)
      .then(stats => {
        if (mounted && stats) setDailyStats(stats);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [defaultSmtp?.id, defaultSmtp?.isConfigured, config]);

  // AI Providers Configuration
  const configuredAiProviders = useMemo(() => {
    if (!config?.aiProviders) return [];
    return Object.entries(config.aiProviders)
      .filter(([key, p]) => Boolean(
        p?.isConfigured ||
        (p?.apiKey && p.apiKey.trim().length > 0) ||
        (p?.maskedKey && p.maskedKey.trim().length > 0) ||
        (Array.isArray(p?.savedKeys) && p.savedKeys.length > 0) ||
        (key === 'copilot' && (p?.connected || p?.isConfigured || (Array.isArray(p?.savedKeys) && p.savedKeys.length > 0)))
      ))
      .map(([key, p]) => ({
        key,
        name: p.name || key,
        model: p.model || ''
      }));
  }, [config]);

  const effectiveAiKey = useMemo(() => {
    const activeProviderObj = config?.activeProvider ? config?.aiProviders?.[config.activeProvider] : null;
    const isActConfigured = Boolean(
      activeProviderObj?.isConfigured ||
      (activeProviderObj?.apiKey && activeProviderObj.apiKey.trim().length > 0) ||
      (activeProviderObj?.maskedKey && activeProviderObj.maskedKey.trim().length > 0) ||
      (Array.isArray(activeProviderObj?.savedKeys) && activeProviderObj.savedKeys.length > 0) ||
      (config?.activeProvider === 'copilot' && (activeProviderObj?.connected || activeProviderObj?.isConfigured || (Array.isArray(activeProviderObj?.savedKeys) && activeProviderObj.savedKeys.length > 0)))
    );
    if (activeProviderObj && isActConfigured) {
      return config.activeProvider;
    }
    if (configuredAiProviders.length > 0) {
      return configuredAiProviders[0].key;
    }
    return config?.activeProvider || 'gemini';
  }, [config, configuredAiProviders]);

  const activeAi = config?.aiProviders?.[effectiveAiKey];
  const isAiConfigured = Boolean(
    activeAi?.isConfigured ||
    (activeAi?.apiKey && activeAi.apiKey.trim().length > 0) ||
    (activeAi?.maskedKey && activeAi.maskedKey.trim().length > 0) ||
    (Array.isArray(activeAi?.savedKeys) && activeAi.savedKeys.length > 0) ||
    (effectiveAiKey === 'copilot' && (activeAi?.connected || activeAi?.isConfigured || (Array.isArray(activeAi?.savedKeys) && activeAi.savedKeys.length > 0)))
  );

  const handleSwitchAiProvider = async (providerKey) => {
    if (!config || providerKey === effectiveAiKey) return;
    try {
      const updatedAiProviders = { ...config.aiProviders };
      for (const k of Object.keys(updatedAiProviders)) {
        updatedAiProviders[k] = {
          ...updatedAiProviders[k],
          active: k === providerKey
        };
      }
      const updatedConfig = stripUndefined({
        ...config,
        activeProvider: providerKey,
        aiProviders: updatedAiProviders
      });

      try {
        await setActiveAiProvider(providerKey);
      } catch (e) {
        console.warn('Backend active provider update notice:', e.message);
      }

      if (user?.uid) {
        try {
          await saveSettings(user.uid, updatedConfig);
        } catch (e) {
          console.warn('Firestore settings save notice:', e.message);
        }
      }
      if (onRefreshConfig) {
        onRefreshConfig(updatedConfig);
      }
      onShowToast?.({
        type: 'info',
        title: 'AI Model Switched',
        message: `Using ${config.aiProviders?.[providerKey]?.name || providerKey} (${config.aiProviders?.[providerKey]?.model || ''})`
      });
    } catch (err) {
      onShowToast?.({ type: 'error', title: 'Error', message: err.message });
    }
  };

  // Recipient status & approvals calculation
  const totalRecipients = recipients.length;
  const readyRecipients = useMemo(() => {
    return recipients.filter(r => generatedEmails[r.id]?.body);
  }, [recipients, generatedEmails]);

  const unapprovedRecipients = useMemo(() => {
    return readyRecipients.filter(r => !r.isApproved);
  }, [readyRecipients]);

  const readyAndApprovedRecipients = useMemo(() => {
    return readyRecipients.filter(r => r.isApproved);
  }, [readyRecipients]);

  const allApproved = readyRecipients.length > 0 && unapprovedRecipients.length === 0;
  const emailsReadyCount = readyRecipients.length;

  // Single contact approval toggle (no spam toasts)
  const handleToggleApproval = (recId) => {
    if (!onUpdateRecipients) return;
    onUpdateRecipients(recipients.map(r => r.id === recId ? { ...r, isApproved: !r.isApproved } : r));
  };

  // Batch approve all remaining unapproved contacts
  const handleApproveAll = () => {
    if (!onUpdateRecipients) return;
    const count = unapprovedRecipients.length;
    onUpdateRecipients(recipients.map(r => ({ ...r, isApproved: true })));
    if (count > 0) {
      onShowToast?.({
        type: 'success',
        title: 'Contacts Approved',
        message: `Explicitly approved ${count} remaining contact(s).`
      });
    }
  };

  // Filtered recipient list for left sidebar
  const filteredRecipients = useMemo(() => {
    return recipients.filter(r => {
      const isDrafted = Boolean(generatedEmails[r.id]?.body);
      if (filterTab === 'ready' && !isDrafted) return false;
      if (filterTab === 'pending' && isDrafted) return false;

      if (!searchRecipient) return true;
      const term = searchRecipient.toLowerCase();
      return (
        (r.name && r.name.toLowerCase().includes(term)) ||
        (r.email && r.email.toLowerCase().includes(term)) ||
        (r.company && r.company.toLowerCase().includes(term)) ||
        (r.role && r.role.toLowerCase().includes(term))
      );
    });
  }, [recipients, generatedEmails, filterTab, searchRecipient]);

  // Current active recipient & draft
  const currentRecipient = recipients[activeRecipientIndex] || recipients[0];
  const currentEmail = currentRecipient ? generatedEmails[currentRecipient.id] : null;

  // Deliverability / Spam Analysis
  const spamAnalysis = useMemo(() => {
    const textToCheck = `${currentEmail?.subject || ''} ${currentEmail?.body || ''}`.toLowerCase();
    const found = [];
    SPAM_TRIGGER_WORDS.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      if (regex.test(textToCheck)) {
        found.push(word);
      }
    });
    return {
      clean: found.length === 0,
      detected: found
    };
  }, [currentEmail?.subject, currentEmail?.body]);

  // Subject line meter
  const subjectLen = (currentEmail?.subject || '').length;
  const subjectMeter = useMemo(() => {
    if (subjectLen === 0) return { pct: 0, color: 'var(--text-muted)', label: 'Empty' };
    if (subjectLen < 20) return { pct: 35, color: 'var(--accent-warning)', label: 'Short (<20)' };
    if (subjectLen >= 20 && subjectLen <= 55) return { pct: 85, color: 'var(--accent-success)', label: 'Optimal (20-55 chars)' };
    return { pct: 100, color: 'var(--accent-warning)', label: 'Long (>55)' };
  }, [subjectLen]);

  // Body word counter
  const bodyText = currentEmail?.body || '';
  const bodyWordCount = bodyText ? bodyText.trim().split(/\s+/).filter(Boolean).length : 0;
  const bodyCharCount = bodyText.length;

  const bodyLengthAdvice = useMemo(() => {
    if (bodyWordCount === 0) return 'Empty';
    if (bodyWordCount < 50) return 'Brief intro';
    if (bodyWordCount >= 50 && bodyWordCount <= 140) return 'Optimal (~30s read)';
    return 'Detailed (>140 words)';
  }, [bodyWordCount]);

  // Batch generation for all contacts
  const handleGenerateAll = async () => {
    if (!resumeData) {
      onShowToast?.({
        type: 'error',
        title: 'Resume Required',
        message: 'Please upload candidate resume in Step 1 first.'
      });
      return;
    }

    if (!recipients || recipients.length === 0) {
      onShowToast?.({
        type: 'error',
        title: 'Recipients Required',
        message: 'Please add at least one recipient in Step 3.'
      });
      return;
    }

    if (!isAiConfigured) {
      const isCopilot = effectiveAiKey === 'copilot';
      onShowToast?.({
        type: 'error',
        title: isCopilot ? 'GitHub Copilot Not Connected' : 'AI Provider Not Configured',
        message: isCopilot
          ? 'GitHub Copilot requires GitHub verification. Please connect your GitHub account in Settings.'
          : `Please configure an API key for ${activeAi?.name || 'your AI provider'} in Settings.`
      });
      onOpenSettings?.('ai');
      return;
    }

    setIsGenerating(true);
    setGeneratingProgress({ current: 0, total: recipients.length });

    const chosenToneObj = TONE_OPTIONS.find(t => t.id === selectedTone);
    const tonePrompt = selectedTone === 'custom' ? customToneText : chosenToneObj?.prompt;

    try {
      const res = await batchGenerateColdEmails({
        providerKey: effectiveAiKey,
        providerConfig: config?.aiProviders?.[effectiveAiKey],
        resumeText: resumeData.text,
        jobDescription: jobDescription,
        recipients,
        customTone: tonePrompt,
        senderName: resumeData.detectedName || defaultSmtp?.fromName || 'Candidate'
      });

      const newGenerated = { ...generatedEmails };
      let successCount = 0;

      for (const item of (res.results || [])) {
        if (item.success && item.email) {
          const rec = recipients.find(r => r.id === item.recipientId);
          newGenerated[item.recipientId] = {
            subject: item.email.subject || `Exploring Opportunities at ${rec?.company || 'your team'}`,
            body: item.email.body || '',
            groundingAudit: item.email.groundingAudit || null,
            generatedAt: new Date().toISOString()
          };
          successCount++;
        }
      }

      setGeneratingProgress({ current: successCount, total: recipients.length });
      onUpdateGeneratedEmails?.(newGenerated);

      onShowToast?.({
        type: 'success',
        title: 'Drafts Created',
        message: `Personalized cold emails synthesized for ${successCount} of ${recipients.length} recipients.`
      });
    } catch (err) {
      onShowToast?.({
        type: 'error',
        title: 'Generation Failed',
        message: err.message
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Regenerate single email
  const handleRegenerateCurrent = async () => {
    if (!currentRecipient || !resumeData) return;

    if (!isAiConfigured) {
      const isCopilot = effectiveAiKey === 'copilot';
      onShowToast?.({
        type: 'error',
        title: isCopilot ? 'GitHub Copilot Not Connected' : 'AI Provider Not Configured',
        message: isCopilot
          ? 'GitHub Copilot requires GitHub verification. Please connect your GitHub account in Settings.'
          : `Please configure an API key for ${activeAi?.name || 'your AI provider'} in Settings.`
      });
      onOpenSettings?.('ai');
      return;
    }

    setIsRegeneratingSingle(true);
    const chosenToneObj = TONE_OPTIONS.find(t => t.id === selectedTone);
    const tonePrompt = selectedTone === 'custom' ? customToneText : chosenToneObj?.prompt;

    try {
      const effectiveJd = (currentRecipient?.jobDescription && currentRecipient.jobDescription.trim())
        || (jobDescription && jobDescription.trim())
        || '';

      const res = await generateColdEmail({
        providerKey: effectiveAiKey,
        providerConfig: config?.aiProviders?.[effectiveAiKey],
        resumeText: resumeData.text,
        jobDescription: effectiveJd,
        recipient: currentRecipient,
        customTone: tonePrompt,
        senderName: resumeData.detectedName || defaultSmtp?.fromName || 'Candidate'
      });

      onUpdateGeneratedEmails?.({
        ...generatedEmails,
        [currentRecipient.id]: {
          subject: res.email?.subject || `Exploring Opportunities at ${currentRecipient.company || 'your team'}`,
          body: res.email?.body || '',
          groundingAudit: res.email?.groundingAudit || null,
          generatedAt: new Date().toISOString()
        }
      });

      onShowToast?.({
        type: 'success',
        title: 'Draft Regenerated',
        message: `Updated draft for ${currentRecipient.name || currentRecipient.email}`
      });
    } catch (err) {
      onShowToast?.({
        type: 'error',
        title: 'Regeneration Failed',
        message: err.message
      });
    } finally {
      setIsRegeneratingSingle(false);
    }
  };

  // Copy email to clipboard
  const handleCopyEmail = (recId) => {
    if (!currentEmail) return;
    const fullText = `Subject: ${currentEmail.subject || ''}\n\n${currentEmail.body || ''}`;
    navigator.clipboard.writeText(fullText);
    setCopiedId(recId);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
    onShowToast?.({
      type: 'info',
      title: 'Copied to Clipboard',
      message: 'Email subject & body copied to clipboard.'
    });
  };

  // Inline subject edit
  const handleSubjectChange = (newSubject) => {
    if (!currentRecipient) return;
    onUpdateGeneratedEmails?.({
      ...generatedEmails,
      [currentRecipient.id]: {
        ...(generatedEmails[currentRecipient.id] || {}),
        subject: newSubject
      }
    });
  };

  // Inline body edit
  const handleBodyChange = (newBody) => {
    if (!currentRecipient) return;
    onUpdateGeneratedEmails?.({
      ...generatedEmails,
      [currentRecipient.id]: {
        ...(generatedEmails[currentRecipient.id] || {}),
        body: newBody
      }
    });
  };

  // Direct send outreach handler with full invariant verification
  const handleDispatchOutreach = () => {
    if (!isSmtpConfigured) {
      onShowToast?.({
        type: 'error',
        title: 'SMTP Configuration Required',
        message: 'Please configure your verified SMTP sender profile in Settings before dispatching.'
      });
      onOpenSettings?.('smtp');
      return;
    }

    if (readyRecipients.length === 0) {
      onShowToast?.({
        type: 'error',
        title: 'Drafts Required',
        message: 'Please generate email drafts before dispatching.'
      });
      return;
    }

    if (!allApproved) {
      onShowToast?.({
        type: 'error',
        title: 'Approval Required',
        message: `${unapprovedRecipients.length} contact(s) lack explicit approval. Each recipient must be reviewed and approved prior to dispatch.`
      });
      return;
    }

    if (!explicitlyAuthorized) {
      onShowToast?.({
        type: 'error',
        title: 'Authorization Required',
        message: 'Please confirm explicit authorization by checking the box below.'
      });
      return;
    }

    onTriggerSend?.();
  };

  // Quota warning check
  const isQuotaExceeded = dailyStats && ((dailyStats.sentToday || 0) + readyAndApprovedRecipients.length) > (dailyStats.dailyLimit || 500);

  if (totalRecipients === 0) {
    return (
      <div className="glass-card email-unified-card" style={{ padding: 32, textAlign: 'center', justifyContent: 'center' }}>
        <AlertCircle size={44} style={{ color: 'var(--accent-warning)', margin: '0 auto 12px' }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>No Recipients Selected</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Add at least one HR contact or import from CSV/Excel in Step 3 to synthesize and dispatch drafts.</p>
      </div>
    );
  }

  return (
    <div className="glass-card email-unified-card">
      {/* 1. Compact Top Bar: Hero Title + Stats Pills + Tone Pills + AI Model + Generate All */}
      <div className="email-unified-topbar">
        {/* Row 1: Title & Status Counters */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              AI Drafts & Safe Outreach Dispatch
            </h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              • Review tailored emails, verify approvals, and safely dispatch
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              className="badge-counter"
              style={{
                fontSize: 11,
                padding: '2px 8px',
                color: emailsReadyCount === totalRecipients ? 'var(--accent-success)' : undefined,
                borderColor: emailsReadyCount === totalRecipients ? 'rgba(52, 211, 153, 0.4)' : undefined
              }}
            >
              {emailsReadyCount} / {totalRecipients} Drafted
            </span>

            <span
              className="badge-counter"
              style={{
                fontSize: 11,
                padding: '2px 8px',
                color: allApproved ? 'var(--accent-success)' : 'var(--accent-warning)',
                borderColor: allApproved ? 'rgba(52, 211, 153, 0.4)' : 'rgba(217, 119, 6, 0.4)'
              }}
            >
              {readyAndApprovedRecipients.length} / {readyRecipients.length} Approved
            </span>
          </div>
        </div>

        {/* Row 2: Tone Selectors & AI Model & Batch Action */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          {/* Tone Selector Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>
              Tone:
            </span>
            {TONE_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedTone(opt.id)}
                style={{
                  padding: '3px 9px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid',
                  borderColor: selectedTone === opt.id ? 'var(--accent-primary)' : 'var(--border-subtle)',
                  background: selectedTone === opt.id ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)',
                  color: selectedTone === opt.id ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* AI Model & Generate All Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Sparkles size={13} style={{ color: isAiConfigured ? 'var(--accent-primary)' : 'var(--accent-warning)' }} />
              {configuredAiProviders.length > 0 ? (
                <select
                  value={effectiveAiKey}
                  onChange={(e) => handleSwitchAiProvider(e.target.value)}
                  style={{
                    fontSize: 11,
                    padding: '3px 6px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface-elevated)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                  title="Switch active AI model"
                >
                  {configuredAiProviders.map(p => (
                    <option key={p.key} value={p.key}>
                      {p.name} ({p.model})
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenSettings?.('ai')}
                  style={{
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px dashed var(--accent-warning)',
                    background: 'rgba(245, 158, 11, 0.08)',
                    color: 'var(--accent-warning)',
                    cursor: 'pointer'
                  }}
                >
                  Configure AI
                </button>
              )}
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleGenerateAll}
              disabled={isGenerating || !resumeData || recipients.length === 0}
              style={{ height: 28, padding: '0 12px', fontSize: 12 }}
            >
              {isGenerating ? (
                <>
                  <RefreshCw size={12} className="spin-icon" />
                  Generating ({generatingProgress.current}/{generatingProgress.total})...
                </>
              ) : (
                <>
                  <Sparkles size={12} />
                  Generate All ({recipients.length})
                </>
              )}
            </button>
          </div>
        </div>

        {/* Custom Tone Input Row (if custom selected) */}
        {selectedTone === 'custom' && (
          <div style={{ paddingTop: 4 }}>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., Concise, emphasize distributed systems scale and cloud leadership..."
              value={customToneText}
              onChange={e => setCustomToneText(e.target.value)}
              style={{ fontSize: 11, height: 26 }}
            />
          </div>
        )}
      </div>

      {/* 2. Center Split View (Left Recipient Queue + Right Active Editor) */}
      <div className="email-unified-split">
        {/* Left Pane: Recipient List & Search & Filters & Batch Approval */}
        <div className="email-unified-sidebar">
          {/* Search bar */}
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)', position: 'relative' }}>
            <Search
              size={12}
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }}
            />
            <input
              type="text"
              placeholder="Filter contacts..."
              value={searchRecipient}
              onChange={e => setSearchRecipient(e.target.value)}
              className="form-input"
              style={{ paddingLeft: 24, fontSize: 11, height: 26 }}
            />
          </div>

          {/* Filter Tabs & Approve All Header */}
          <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', gap: 2 }}>
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                style={{
                  padding: '2px 5px',
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  background: filterTab === 'all' ? 'var(--bg-tertiary)' : 'transparent',
                  color: filterTab === 'all' ? 'var(--text-primary)' : 'var(--text-muted)'
                }}
              >
                All ({totalRecipients})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('ready')}
                style={{
                  padding: '2px 5px',
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  background: filterTab === 'ready' ? 'var(--bg-tertiary)' : 'transparent',
                  color: filterTab === 'ready' ? 'var(--accent-success)' : 'var(--text-muted)'
                }}
              >
                Ready ({emailsReadyCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('pending')}
                style={{
                  padding: '2px 5px',
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  background: filterTab === 'pending' ? 'var(--bg-tertiary)' : 'transparent',
                  color: filterTab === 'pending' ? 'var(--accent-warning)' : 'var(--text-muted)'
                }}
              >
                Pending ({totalRecipients - emailsReadyCount})
              </button>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleApproveAll}
              disabled={unapprovedRecipients.length === 0}
              title={unapprovedRecipients.length === 0 ? 'All ready contacts approved' : 'Explicitly approve all ready contacts'}
              style={{ fontSize: 10, padding: '1px 5px', height: 20 }}
            >
              <CheckCircle size={10} style={{ color: 'var(--accent-success)' }} />
              Approve All
            </button>
          </div>

          {/* Scrollable Recipient Items */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {filteredRecipients.length === 0 ? (
              <div style={{ padding: 14, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                No matching contacts.
              </div>
            ) : (
              filteredRecipients.map(rec => {
                const hasEmail = Boolean(generatedEmails[rec.id]?.body);
                const isSelected = currentRecipient?.id === rec.id;
                const realIndex = recipients.findIndex(r => r.id === rec.id);

                return (
                  <div
                    key={rec.id}
                    className={`recipient-queue-item ${isSelected ? 'active' : ''}`}
                    onClick={() => setActiveRecipientIndex(realIndex)}
                    style={{
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(rec.isApproved)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleApproval(rec.id);
                      }}
                      title={rec.isApproved ? 'Approved for outreach' : 'Click to approve contact'}
                      style={{ cursor: 'pointer', accentColor: 'var(--accent-success)', width: 14, height: 14, flexShrink: 0 }}
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {rec.name || 'Hiring Lead'}
                        </span>
                        {hasEmail ? (
                          <span style={{ color: 'var(--accent-success)', display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, flexShrink: 0 }}>
                            <CheckCircle size={10} /> Drafted
                          </span>
                        ) : (
                          <span style={{ color: 'var(--accent-warning)', display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, flexShrink: 0 }}>
                            <Clock size={10} /> Pending
                          </span>
                        )}
                      </div>

                      <div className="queue-meta-row" style={{ fontSize: 11 }}>
                        <span className="queue-company" title={rec.company || ''}>{rec.company || 'Direct'}</span>
                        <span className="queue-dot-separator">•</span>
                        <span className="queue-email" title={rec.email}>{rec.email}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Active Email Editor Workspace */}
        <div className="email-unified-main">
          {currentRecipient ? (
            <>
              {/* Header: Recipient Summary + Approve Button + Navigation */}
              <div
                style={{
                  padding: '8px 14px',
                  background: 'var(--bg-tertiary)',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexShrink: 0
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: 'var(--primary-gradient)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 11,
                      flexShrink: 0
                    }}
                  >
                    {(currentRecipient.name || 'H').slice(0, 1).toUpperCase()}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {currentRecipient.name || 'Hiring Contact'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {currentRecipient.role ? `${currentRecipient.role} • ` : ''}{currentRecipient.company || 'Company'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {/* Approval Toggle Button */}
                  <button
                    type="button"
                    className={`btn btn-sm ${currentRecipient.isApproved ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => handleToggleApproval(currentRecipient.id)}
                    style={{ fontSize: 11, padding: '2px 8px', height: 24, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {currentRecipient.isApproved ? (
                      <>
                        <Check size={11} style={{ color: 'var(--accent-success)' }} />
                        Approved
                      </>
                    ) : (
                      <>
                        <UserCheck size={11} />
                        Approve Contact
                      </>
                    )}
                  </button>

                  {/* Navigation Arrows */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setActiveRecipientIndex(Math.max(0, activeRecipientIndex - 1))}
                      disabled={activeRecipientIndex === 0}
                      title="Previous Contact"
                      style={{ padding: '2px 6px', height: 24 }}
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 40, textAlign: 'center' }}>
                      {activeRecipientIndex + 1} / {totalRecipients}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setActiveRecipientIndex(Math.min(totalRecipients - 1, activeRecipientIndex + 1))}
                      disabled={activeRecipientIndex === totalRecipients - 1}
                      title="Next Contact"
                      style={{ padding: '2px 6px', height: 24 }}
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Email Meta: From / To / Subject */}
              <div className="email-meta-header" style={{ padding: '8px 14px', gap: 6, flexShrink: 0 }}>
                <div className="meta-row">
                  <span className="meta-label">From:</span>
                  <span className="meta-val" style={{ fontSize: 12 }}>
                    {defaultSmtp ? (
                      <span>
                        <strong>{defaultSmtp.fromName || 'Candidate'}</strong> &lt;{defaultSmtp.fromEmail || defaultSmtp.username}&gt;
                      </span>
                    ) : (
                      <span style={{ color: 'var(--accent-warning)', fontSize: 11 }}>
                        ⚠️ No SMTP profile configured
                      </span>
                    )}
                  </span>
                </div>

                <div className="meta-row">
                  <span className="meta-label">To:</span>
                  <span className="meta-val" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {currentRecipient.name ? `"${currentRecipient.name}" ` : ''}&lt;{currentRecipient.email}&gt;
                  </span>
                </div>

                <div className="meta-row" style={{ alignItems: 'flex-start' }}>
                  <span className="meta-label" style={{ paddingTop: 3 }}>Subject:</span>
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      className="subject-input-styled"
                      placeholder="Click to edit subject line..."
                      value={currentEmail?.subject || ''}
                      onChange={e => handleSubjectChange(e.target.value)}
                      style={{ fontSize: 12, height: 24 }}
                    />
                    {/* Compact Subject Meter */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                      <div style={{ width: 100 }}>
                        <div className="subject-meter-bar" style={{ marginTop: 2 }}>
                          <div
                            className="subject-meter-fill"
                            style={{
                              width: `${Math.min(100, subjectMeter.pct)}%`,
                              background: subjectMeter.color
                            }}
                          />
                        </div>
                      </div>
                      <span style={{ fontSize: 10, color: subjectMeter.color }}>
                        {subjectLen} chars • {subjectMeter.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Email Body Editor or Pre-Generation Briefing Card */}
              {!currentEmail?.body && !isGenerating ? (
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14 }}>
                  <div className="pre-gen-briefing-card" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Draft Ready to Synthesize
                      </span>
                    </div>

                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, margin: '6px 0 10px' }}>
                      Generate a personalized email for <strong>{currentRecipient.name || 'this contact'}</strong> at <strong>{currentRecipient.company || 'their team'}</strong> based on your candidate profile.
                    </p>

                    <div className="pre-gen-grid" style={{ marginBottom: 12 }}>
                      <div className="pre-gen-item">
                        <span className="pre-gen-item-label">Target Lead</span>
                        <span className="pre-gen-item-val">{currentRecipient.name || 'Hiring Lead'} {currentRecipient.role ? `• ${currentRecipient.role}` : ''}</span>
                      </div>
                      <div className="pre-gen-item">
                        <span className="pre-gen-item-label">Company</span>
                        <span className="pre-gen-item-val">{currentRecipient.company || 'Direct Outreach'}</span>
                      </div>
                      <div className="pre-gen-item">
                        <span className="pre-gen-item-label">Candidate Resume</span>
                        <span className="pre-gen-item-val">{resumeData?.originalFilename || 'Loaded'} ({resumeData?.wordCount || 0} words)</span>
                      </div>
                      <div className="pre-gen-item">
                        <span className="pre-gen-item-label">Strategy</span>
                        <span className="pre-gen-item-val">{jobDescription ? 'Tailored to Role JD' : 'Value Pitch'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleRegenerateCurrent}
                      disabled={isRegeneratingSingle || !resumeData}
                      style={{ height: 30, padding: '0 14px' }}
                    >
                      <Sparkles size={13} />
                      Generate Draft for {currentRecipient.name || 'This Contact'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                  <textarea
                    className="email-body-editor"
                    style={{ flex: 1, minHeight: 120, resize: 'none', overflowY: 'auto', padding: '10px 14px', fontSize: 12 }}
                    placeholder={
                      isGenerating
                        ? 'AI is crafting your tailored cold email...'
                        : 'Write or customize your cold email here...'
                    }
                    value={currentEmail?.body || ''}
                    onChange={e => handleBodyChange(e.target.value)}
                  />

                  {/* Compact Insights Bar: Spam Detection + Grounding Guardrail Score */}
                  <div
                    style={{
                      padding: '6px 14px',
                      background: 'var(--bg-tertiary)',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 6,
                      fontSize: 11,
                      flexShrink: 0
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {/* Deliverability Status */}
                      {spamAnalysis.clean ? (
                        <div className="spam-indicator-pill clean" style={{ padding: '2px 6px', fontSize: 10 }}>
                          <ShieldCheck size={11} />
                          <span>Deliverability: Clean</span>
                        </div>
                      ) : (
                        <div className="spam-indicator-pill warning" style={{ padding: '2px 6px', fontSize: 10 }} title={`Flagged phrases: ${spamAnalysis.detected.join(', ')}`}>
                          <AlertTriangle size={11} />
                          <span>Deliverability: {spamAnalysis.detected.length} trigger(s)</span>
                        </div>
                      )}

                      {/* Claim Grounding Guardrail Pill */}
                      {currentEmail?.groundingAudit && (
                        currentEmail.groundingAudit.hasUngroundedClaims ? (
                          <div
                            className="spam-indicator-pill warning"
                            style={{
                              background: 'rgba(245, 158, 11, 0.15)',
                              borderColor: 'rgba(245, 158, 11, 0.35)',
                              color: 'var(--accent-warning)',
                              fontWeight: 600,
                              padding: '2px 6px',
                              fontSize: 10
                            }}
                            title="Ungrounded claims detected against candidate resume"
                          >
                            <AlertTriangle size={11} />
                            <span>Grounding: {currentEmail.groundingAudit.groundingScore || 0}% ({currentEmail.groundingAudit.flaggedClaims?.length || 1} unverified)</span>
                          </div>
                        ) : (
                          <div
                            className="spam-indicator-pill clean"
                            style={{
                              background: 'rgba(16, 185, 129, 0.12)',
                              borderColor: 'rgba(16, 185, 129, 0.3)',
                              color: 'var(--accent-success)',
                              fontWeight: 600,
                              padding: '2px 6px',
                              fontSize: 10
                            }}
                            title="All claims and metrics corroborated by resume"
                          >
                            <ShieldCheck size={11} />
                            <span>Grounding: 100% Fact-Checked</span>
                          </div>
                        )
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                      <strong>{bodyWordCount}</strong> words • <strong>{bodyCharCount}</strong> chars ({bodyLengthAdvice})
                    </div>
                  </div>

                  {/* Ungrounded Claims breakdown (if any) */}
                  {currentEmail?.groundingAudit?.hasUngroundedClaims && currentEmail.groundingAudit.flaggedClaims?.length > 0 && (
                    <div
                      style={{
                        padding: '6px 14px',
                        background: 'rgba(245, 158, 11, 0.08)',
                        borderTop: '1px solid rgba(245, 158, 11, 0.25)',
                        fontSize: 11,
                        flexShrink: 0
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, color: 'var(--accent-warning)' }}>
                        <AlertTriangle size={12} />
                        <span>Ungrounded Claims:</span>
                      </div>
                      <div style={{ margin: '2px 0 0', color: 'var(--text-secondary)' }}>
                        {currentEmail.groundingAudit.flaggedClaims.map((item, idx) => (
                          <span key={idx} style={{ marginRight: 10 }}>
                            <strong style={{ color: 'var(--accent-warning)' }}>"{item.claim}"</strong>
                            {item.reason ? ` (${item.reason})` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Editor Bottom Bar: Resume Pill + Copy + Regenerate */}
              <div
                style={{
                  padding: '6px 14px',
                  background: 'var(--bg-surface-elevated)',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexShrink: 0
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {attachResume && resumeData && (
                    <div className="info-pill" style={{ background: 'rgba(99, 102, 241, 0.1)', borderColor: 'rgba(99, 102, 241, 0.3)', padding: '2px 6px', fontSize: 10 }}>
                      <Paperclip size={11} style={{ color: 'var(--primary-light)' }} />
                      <span>Attached: <strong>{resumeData.originalFilename}</strong></span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCopyEmail(currentRecipient.id)}
                    disabled={!currentEmail}
                    title="Copy subject and body to clipboard"
                    style={{ fontSize: 11, padding: '2px 8px', height: 24 }}
                  >
                    {copiedId === currentRecipient.id ? (
                      <>
                        <Check size={11} style={{ color: 'var(--accent-success)' }} />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        Copy
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleRegenerateCurrent}
                    disabled={isRegeneratingSingle || !resumeData}
                    title="Re-write this specific email draft"
                    style={{ fontSize: 11, padding: '2px 8px', height: 24 }}
                  >
                    <RefreshCw size={11} className={isRegeneratingSingle ? 'spin-icon' : ''} />
                    Regenerate Draft
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ padding: 24 }}>
              <AlertCircle className="empty-state-icon" size={32} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Contact Not Selected</div>
              <div style={{ fontSize: 12 }}>Choose a contact from the list on the left to review their draft.</div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Compact Bottom Dispatch Bar: Sender Summary + Quota + Auth Checkbox + Dispatch Button */}
      <div className="email-unified-dispatch-bar">
        {/* Left: Sender Profile Summary, Daily Quota, Anti-Spam Pacing */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, minWidth: 0, overflow: 'hidden' }}>
          {/* SMTP Account Summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
            <Mail size={13} style={{ color: isSmtpConfigured ? 'var(--accent-primary)' : 'var(--accent-warning)', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {defaultSmtp ? `${defaultSmtp.fromName || 'Sender'} (${defaultSmtp.fromEmail || defaultSmtp.username})` : 'No SMTP Profile'}
            </span>
            <button
              type="button"
              onClick={() => onOpenSettings?.('smtp')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-light)',
                cursor: 'pointer',
                fontSize: 10,
                textDecoration: 'underline',
                padding: '0 2px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2
              }}
              title="Configure SMTP accounts"
            >
              <SettingsIcon size={10} /> Configure
            </button>
          </div>

          <span style={{ color: 'var(--border-subtle)' }}>|</span>

          {/* Daily Quota Counter */}
          {dailyStats && (
            <div style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
              Quota: <strong style={{ color: isQuotaExceeded ? 'var(--accent-warning)' : 'var(--text-primary)' }}>{dailyStats.sentToday}</strong> / {dailyStats.dailyLimit} sent today
            </div>
          )}

          <span style={{ color: 'var(--border-subtle)' }}>|</span>

          {/* Anti-Spam Pacing & Jitter */}
          <div style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={11} />
            <span>{delaySeconds}s delay ± jitter</span>
          </div>
        </div>

        {/* Right: Explicit Authorization Checkbox & Send Outreach Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <label
            htmlFor="dispatchExplicitAuth"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              color: explicitlyAuthorized ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <input
              type="checkbox"
              id="dispatchExplicitAuth"
              checked={explicitlyAuthorized}
              onChange={e => setExplicitlyAuthorized(e.target.checked)}
              style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
            />
            <span>I authorize outreach to approved contacts</span>
          </label>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDispatchOutreach}
            disabled={!isSmtpConfigured || readyRecipients.length === 0 || !allApproved || !explicitlyAuthorized}
            style={{
              height: 32,
              padding: '0 16px',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
            title={
              !isSmtpConfigured
                ? 'Configure SMTP in Settings first'
                : readyRecipients.length === 0
                ? 'Generate at least one email draft'
                : !allApproved
                ? `Approve all ${unapprovedRecipients.length} remaining contacts`
                : !explicitlyAuthorized
                ? 'Check explicit authorization checkbox'
                : 'Send approved emails'
            }
          >
            <Send size={13} />
            Send Outreach ({readyAndApprovedRecipients.length} Approved)
          </button>
        </div>
      </div>
    </div>
  );
}
