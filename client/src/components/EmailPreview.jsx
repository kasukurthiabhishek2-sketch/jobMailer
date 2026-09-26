import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Edit3,
  Send,
  Check,
  Copy,
  AlertTriangle,
  ShieldCheck,
  Search,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { generateColdEmail } from '../services/api';

const TONE_OPTIONS = [
  { id: 'impact', label: 'Direct & Impact-Focused', prompt: 'Direct, confident, highlighting quantifiable engineering impact and architectural leadership.' },
  { id: 'warm', label: 'Warm & Conversational', prompt: 'Warm, highly approachable, expressing genuine excitement for the team culture and mission.' },
  { id: 'founder', label: 'Startup & Founder Pitch', prompt: 'Agile mindset, wearing multiple hats, rapid execution, and high ownership.' },
  { id: 'bullets', label: 'Executive 3-Bullet Value Pitch', prompt: 'Very brief opening, followed by 3 punchy bullet points of candidate achievements, ending with a low-friction CTA.' },
  { id: 'custom', label: 'Custom Tone / Prompt', prompt: '' }
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
  recipients,
  generatedEmails,
  onUpdateGeneratedEmails,
  onOpenSettings,
  onShowToast,
  onTriggerSend
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

  const activeAiKey = config?.activeProvider || 'gemini';
  const activeAi = config?.aiProviders?.[activeAiKey];
  const isAiConfigured = Boolean(activeAi?.isConfigured);

  const defaultSmtp = (config?.smtpProfiles || []).find(p => p.isDefault) || config?.smtpProfiles?.[0];
  const totalRecipients = recipients.length;
  const emailsReadyCount = recipients.filter(r => generatedEmails[r.id]?.body).length;

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

  // Current active recipient
  const currentRecipient = recipients[activeRecipientIndex] || recipients[0];
  const currentEmail = currentRecipient ? generatedEmails[currentRecipient.id] : null;

  // Real-time deliverability / spam detector
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
    if (subjectLen === 0) return { pct: 0, color: 'var(--text-muted)', label: 'Empty subject' };
    if (subjectLen < 20) return { pct: 35, color: 'var(--accent-warning)', label: 'Short (< 20 chars)' };
    if (subjectLen >= 20 && subjectLen <= 55) return { pct: 85, color: 'var(--accent-success)', label: 'Optimal (displays cleanly on mobile & desktop)' };
    return { pct: 100, color: 'var(--accent-warning)', label: 'Long (> 55 chars - may truncate in inbox previews)' };
  }, [subjectLen]);

  // Body word counter & advice
  const bodyText = currentEmail?.body || '';
  const bodyWordCount = bodyText ? bodyText.trim().split(/\s+/).filter(Boolean).length : 0;
  const bodyCharCount = bodyText.length;

  const bodyLengthAdvice = useMemo(() => {
    if (bodyWordCount === 0) return 'Empty';
    if (bodyWordCount < 50) return 'Brief intro';
    if (bodyWordCount >= 50 && bodyWordCount <= 140) return 'Optimal brevity (~30s read time for hiring managers)';
    return 'Detailed (consider keeping under 140 words for higher reply rates)';
  }, [bodyWordCount]);

  // Generate for all recipients
  const handleGenerateAll = async () => {
    if (!resumeData) {
      onShowToast({
        type: 'error',
        title: 'Resume Required',
        message: 'Please upload or load a resume in Step 1 first.'
      });
      return;
    }

    if (!recipients || recipients.length === 0) {
      onShowToast({
        type: 'error',
        title: 'Recipients Required',
        message: 'Please add at least one recipient in Step 2.'
      });
      return;
    }

    if (!isAiConfigured) {
      onShowToast({
        type: 'error',
        title: 'AI Key Missing',
        message: `Please configure an API key for ${activeAi?.name || 'your AI provider'} in Settings.`
      });
      onOpenSettings('ai');
      return;
    }

    setIsGenerating(true);
    setGeneratingProgress({ current: 0, total: recipients.length });

    const chosenToneObj = TONE_OPTIONS.find(t => t.id === selectedTone);
    const tonePrompt = selectedTone === 'custom' ? customToneText : chosenToneObj?.prompt;

    try {
      const newGenerated = { ...generatedEmails };
      let processed = 0;

      for (const rec of recipients) {
        try {
          const res = await generateColdEmail({
            providerKey: activeAiKey,
            resumeText: resumeData.text,
            jobDescription: jobDescription,
            recipient: rec,
            customTone: tonePrompt,
            senderName: resumeData.detectedName || defaultSmtp?.fromName || 'Candidate'
          });

          newGenerated[rec.id] = {
            subject: res.email?.subject || `Exploring Opportunities at ${rec.company || 'your team'}`,
            body: res.email?.body || '',
            generatedAt: new Date().toISOString()
          };
        } catch (err) {
          console.error(`Failed to generate email for ${rec.email}:`, err);
        }

        processed += 1;
        setGeneratingProgress({ current: processed, total: recipients.length });
        onUpdateGeneratedEmails({ ...newGenerated });
      }

      onShowToast({
        type: 'success',
        title: 'Emails Crafted',
        message: `Personalized cold emails generated for ${recipients.length} recipients.`
      });
    } catch (err) {
      onShowToast({
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
      onOpenSettings('ai');
      return;
    }

    setIsRegeneratingSingle(true);
    const chosenToneObj = TONE_OPTIONS.find(t => t.id === selectedTone);
    const tonePrompt = selectedTone === 'custom' ? customToneText : chosenToneObj?.prompt;

    try {
      const res = await generateColdEmail({
        providerKey: activeAiKey,
        resumeText: resumeData.text,
        jobDescription: jobDescription,
        recipient: currentRecipient,
        customTone: tonePrompt,
        senderName: resumeData.detectedName || defaultSmtp?.fromName || 'Candidate'
      });

      onUpdateGeneratedEmails({
        ...generatedEmails,
        [currentRecipient.id]: {
          subject: res.email?.subject || `Exploring Opportunities at ${currentRecipient.company || 'your team'}`,
          body: res.email?.body || '',
          generatedAt: new Date().toISOString()
        }
      });

      onShowToast({
        type: 'success',
        title: 'Draft Regenerated',
        message: `Updated email for ${currentRecipient.name || currentRecipient.email}`
      });
    } catch (err) {
      onShowToast({
        type: 'error',
        title: 'Regeneration Failed',
        message: err.message
      });
    } finally {
      setIsRegeneratingSingle(false);
    }
  };

  // Copy to clipboard
  const handleCopyEmail = (recId) => {
    if (!currentEmail) return;
    const fullText = `Subject: ${currentEmail.subject || ''}\n\n${currentEmail.body || ''}`;
    navigator.clipboard.writeText(fullText);
    setCopiedId(recId);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
    onShowToast({
      type: 'info',
      title: 'Copied to Clipboard',
      message: 'Email subject & body copied to clipboard.'
    });
  };

  // Inline subject edit
  const handleSubjectChange = (newSubject) => {
    if (!currentRecipient) return;
    onUpdateGeneratedEmails({
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
    onUpdateGeneratedEmails({
      ...generatedEmails,
      [currentRecipient.id]: {
        ...(generatedEmails[currentRecipient.id] || {}),
        body: newBody
      }
    });
  };

  return (
    <div className="glass-card">
      {/* Header */}
      <div className="card-header">
        <div className="card-title">
          <Sparkles className="card-title-icon" size={20} />
          <span>Step 4: AI Personalize, Preview & Edit</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {totalRecipients > 0 && (
            <span
              className="badge-counter"
              style={{
                color: emailsReadyCount === totalRecipients ? 'var(--accent-success)' : 'var(--text-secondary)',
                borderColor: emailsReadyCount === totalRecipients ? 'var(--accent-success)' : 'var(--border-subtle)'
              }}
            >
              {emailsReadyCount} of {totalRecipients} Drafted
            </span>
          )}
        </div>
      </div>

      {/* Tone & AI Model Controls */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: 16,
          marginBottom: 18
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Tone Selector Pills */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label className="form-label" style={{ margin: 0 }}>Outreach Style & Tone</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`status-dot ${isAiConfigured ? 'active' : 'warning'}`} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {activeAi?.name || 'Gemini'} ({activeAi?.model})
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onOpenSettings('ai')}
                  style={{ padding: '2px 8px', fontSize: 11 }}
                >
                  Change
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TONE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedTone(opt.id)}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    borderColor: selectedTone === opt.id ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    background: selectedTone === opt.id ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    color: selectedTone === opt.id ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {selectedTone === 'custom' && (
              <div style={{ marginTop: 10 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Ultra-concise, focus on distributed systems and open-source leadership..."
                  value={customToneText}
                  onChange={e => setCustomToneText(e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>
            )}
          </div>

          {/* Generate All Button & Progress */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGenerateAll}
              disabled={isGenerating || !resumeData || recipients.length === 0}
              style={{ flex: 1 }}
            >
              {isGenerating ? (
                <>
                  <RefreshCw size={16} className="spin-icon" />
                  Generating Drafts ({generatingProgress.current} / {generatingProgress.total})...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate All Cold Emails ({recipients.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Split-Pane Email Workspace */}
      {totalRecipients > 0 ? (
        <div className="email-split-container">
          {/* Left Pane: Recipient Queue Sidebar */}
          <div className="email-split-sidebar">
            {/* Sidebar Search & Tab Controls */}
            <div style={{ padding: 12, borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <Search
                  size={13}
                  style={{
                    position: 'absolute',
                    left: 9,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                  }}
                />
                <input
                  type="text"
                  placeholder="Filter recipients..."
                  value={searchRecipient}
                  onChange={e => setSearchRecipient(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: 28, fontSize: 12, height: 30 }}
                />
              </div>

              {/* Status Tabs */}
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  style={{
                    flex: 1,
                    padding: '3px 6px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    background: filterTab === 'all' ? 'var(--bg-tertiary)' : 'transparent',
                    color: filterTab === 'all' ? 'var(--text-primary)' : 'var(--text-muted)'
                  }}
                >
                  All ({recipients.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('ready')}
                  style={{
                    flex: 1,
                    padding: '3px 6px',
                    fontSize: 11,
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
                    flex: 1,
                    padding: '3px 6px',
                    fontSize: 11,
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
            </div>

            {/* Recipient Item List */}
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 440 }}>
              {filteredRecipients.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
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
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: isSelected ? '#fff' : 'var(--text-primary)' }}>
                          {rec.name || 'Hiring Lead'}
                        </span>
                        {hasEmail ? (
                          <span style={{ color: 'var(--accent-success)', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                            <CheckCircle size={12} /> Drafted
                          </span>
                        ) : (
                          <span style={{ color: 'var(--accent-warning)', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                            <Clock size={12} /> Pending
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{rec.company || '—'}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                          {rec.email}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Pane: Active Email Editor */}
          <div className="email-split-main">
            {currentRecipient ? (
              <>
                {/* Editor Header */}
                <div
                  style={{
                    padding: '12px 18px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 10
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'var(--primary-gradient)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 12
                      }}
                    >
                      {(currentRecipient.name || 'H').slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
                        {currentRecipient.name || 'Hiring Contact'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {currentRecipient.role ? `${currentRecipient.role} • ` : ''}
                        {currentRecipient.company || 'Company'}
                      </div>
                    </div>
                  </div>

                  {/* Navigation Arrows */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setActiveRecipientIndex(Math.max(0, activeRecipientIndex - 1))}
                      disabled={activeRecipientIndex === 0}
                      title="Previous Recipient"
                    >
                      <ChevronLeft size={14} /> Prev
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {activeRecipientIndex + 1} / {totalRecipients}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setActiveRecipientIndex(Math.min(totalRecipients - 1, activeRecipientIndex + 1))}
                      disabled={activeRecipientIndex === totalRecipients - 1}
                      title="Next Recipient"
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {/* Email Meta Header */}
                <div className="email-meta-header">
                  <div className="meta-row">
                    <span className="meta-label">From:</span>
                    <span className="meta-val">
                      {defaultSmtp ? (
                        <span>
                          <strong>{defaultSmtp.fromName || 'Candidate'}</strong> &lt;{defaultSmtp.fromEmail || defaultSmtp.username}&gt;
                        </span>
                      ) : (
                        <span style={{ color: 'var(--accent-warning)', fontSize: 12 }}>
                          ⚠️ No default SMTP profile configured in Settings
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="meta-row">
                    <span className="meta-label">To:</span>
                    <span className="meta-val" style={{ fontFamily: 'var(--font-mono)' }}>
                      {currentRecipient.name ? `"${currentRecipient.name}" ` : ''}&lt;{currentRecipient.email}&gt;
                    </span>
                  </div>

                  {/* Subject Line & Length Meter */}
                  <div className="meta-row" style={{ alignItems: 'flex-start' }}>
                    <span className="meta-label" style={{ paddingTop: 4 }}>Subject:</span>
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        className="subject-input-styled"
                        placeholder="Click to edit email subject line..."
                        value={currentEmail?.subject || ''}
                        onChange={e => handleSubjectChange(e.target.value)}
                      />
                      {/* Subject Length Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                        <div style={{ width: 140 }}>
                          <div className="subject-meter-bar">
                            <div
                              className="subject-meter-fill"
                              style={{
                                width: `${Math.min(100, subjectMeter.pct)}%`,
                                background: subjectMeter.color
                              }}
                            />
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: subjectMeter.color }}>
                          {subjectLen} chars • {subjectMeter.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Email Body Editor */}
                <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <textarea
                    className="email-body-editor"
                    style={{ flex: 1, minHeight: 260 }}
                    placeholder={
                      isGenerating
                        ? 'AI is crafting your tailored cold email...'
                        : 'Click "Generate All Cold Emails" above, or write custom text here...'
                    }
                    value={currentEmail?.body || ''}
                    onChange={e => handleBodyChange(e.target.value)}
                  />

                  {/* Real-time Deliverability & Spam Analysis Bar */}
                  <div
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8,
                      fontSize: 11
                    }}
                  >
                    {/* Deliverability Status */}
                    {spamAnalysis.clean ? (
                      <div className="spam-indicator-pill clean">
                        <ShieldCheck size={13} />
                        <span>Deliverability: Clean (No spam triggers detected)</span>
                      </div>
                    ) : (
                      <div className="spam-indicator-pill warning" title={`Flagged phrases: ${spamAnalysis.detected.join(', ')}`}>
                        <AlertTriangle size={13} />
                        <span>Deliverability: {spamAnalysis.detected.length} potential spam trigger(s): <strong>{spamAnalysis.detected.join(', ')}</strong></span>
                      </div>
                    )}

                    {/* Word & Char Counter */}
                    <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      <strong>{bodyWordCount}</strong> words • <strong>{bodyCharCount}</strong> chars ({bodyLengthAdvice})
                    </div>
                  </div>
                </div>

                {/* Footer Bar */}
                <div className="email-footer-bar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {resumeData && (
                      <div className="info-pill" style={{ background: 'rgba(99, 102, 241, 0.1)', borderColor: 'rgba(99, 102, 241, 0.3)' }}>
                        <Paperclip size={13} style={{ color: 'var(--primary-light)' }} />
                        <span>Attached: <strong>{resumeData.originalFilename}</strong></span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopyEmail(currentRecipient.id)}
                      disabled={!currentEmail}
                      title="Copy subject and body to clipboard"
                    >
                      {copiedId === currentRecipient.id ? (
                        <>
                          <Check size={13} style={{ color: 'var(--accent-success)' }} />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
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
                    >
                      <RefreshCw size={13} className={isRegeneratingSingle ? 'spin-icon' : ''} />
                      Regenerate This Draft
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <AlertCircle className="empty-state-icon" />
                <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>Recipient Not Found</div>
                <div style={{ fontSize: 13 }}>Select a contact from the list on the left to review their draft.</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <Edit3 className="empty-state-icon" />
          <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>No Recipients Selected</div>
          <div style={{ fontSize: 13 }}>Add at least one HR contact or upload an Excel sheet to preview drafts.</div>
        </div>
      )}

      {/* Step 5: Send Outreach CTA Bar */}
      <div
        style={{
          marginTop: 22,
          padding: 18,
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16
        }}
      >
        <div>
          <div style={{ fontWeight: 700, color: '#fff', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Ready to Dispatch Cold Outreach</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Via: {defaultSmtp ? `${defaultSmtp.name} (${defaultSmtp.fromEmail || defaultSmtp.username})` : 'No SMTP account configured'}
            {' '}• Attached: {resumeData ? resumeData.originalFilename : 'No resume'}
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={onTriggerSend}
          disabled={!defaultSmtp || totalRecipients === 0 || emailsReadyCount === 0}
        >
          <Send size={18} />
          Send {totalRecipients} Cold {totalRecipients === 1 ? 'Email' : 'Emails'}
        </button>
      </div>
    </div>
  );
}
