import React, { useState } from 'react';
import {
  Sparkles,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Edit3,
  Send,
  Sliders,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { generateColdEmail, batchGenerateColdEmails } from '../services/api';

const TONE_OPTIONS = [
  { id: 'impact', label: 'Direct & Impact-Focused (Recommended)', prompt: 'Direct, confident, highlighting quantifiable engineering impact and architectural leadership.' },
  { id: 'warm', label: 'Warm & Conversational', prompt: 'Warm, highly approachable, expressing genuine excitement for the team culture and mission.' },
  { id: 'founder', label: 'Startup & Founder Pitch', prompt: 'Agile mindset, wearing multiple hats, rapid execution, and high ownership.' },
  { id: 'bullets', label: 'Executive 3-Bullet Value Pitch', prompt: 'Very brief opening, followed by 3 punchy bullet points of candidate achievements, ending with a low-friction CTA.' }
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
  const [isRegeneratingSingle, setIsRegeneratingSingle] = useState(false);

  const activeAiKey = config?.activeProvider || 'gemini';
  const activeAi = config?.aiProviders?.[activeAiKey];
  const isAiConfigured = Boolean(activeAi?.isConfigured);

  const currentRecipient = recipients[activeRecipientIndex] || recipients[0];
  const currentEmail = generatedEmails[currentRecipient?.id] || null;

  // Handle generating emails for all recipients in queue
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
    const chosenToneObj = TONE_OPTIONS.find(t => t.id === selectedTone);
    const tonePrompt = customToneText ? customToneText : chosenToneObj?.prompt;

    try {
      const newGenerated = { ...generatedEmails };

      // We can generate for each recipient
      for (const rec of recipients) {
        try {
          const res = await generateColdEmail({
            providerKey: activeAiKey,
            resumeText: resumeData.text,
            jobDescription: jobDescription,
            recipient: rec,
            customTone: tonePrompt,
            senderName: resumeData.detectedName || config?.smtpProfiles?.find(p => p.isDefault)?.fromName || 'Candidate'
          });

          newGenerated[rec.id] = {
            subject: res.email?.subject || `Exploring Opportunities at ${rec.company || 'your team'}`,
            body: res.email?.body || '',
            generatedAt: new Date().toISOString()
          };
        } catch (err) {
          console.error(`Failed to generate email for ${rec.email}:`, err);
        }
      }

      onUpdateGeneratedEmails(newGenerated);
      onShowToast({
        type: 'success',
        title: 'Emails Crafted',
        message: `Successfully generated personalized emails for ${recipients.length} recipients.`
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

  // Regenerate single email for currently viewed recipient
  const handleRegenerateCurrent = async () => {
    if (!currentRecipient) return;
    if (!resumeData) return;

    if (!isAiConfigured) {
      onOpenSettings('ai');
      return;
    }

    setIsRegeneratingSingle(true);
    const chosenToneObj = TONE_OPTIONS.find(t => t.id === selectedTone);
    const tonePrompt = customToneText ? customToneText : chosenToneObj?.prompt;

    try {
      const res = await generateColdEmail({
        providerKey: activeAiKey,
        resumeText: resumeData.text,
        jobDescription: jobDescription,
        recipient: currentRecipient,
        customTone: tonePrompt,
        senderName: resumeData.detectedName || 'Candidate'
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
        title: 'Email Regenerated',
        message: `Updated email draft for ${currentRecipient.name || currentRecipient.email}`
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

  const defaultSmtp = (config?.smtpProfiles || []).find(p => p.isDefault) || config?.smtpProfiles?.[0];
  const totalRecipients = recipients.length;
  const emailsReadyCount = recipients.filter(r => generatedEmails[r.id]?.body).length;

  return (
    <div className="glass-card">
      <div className="card-header">
        <div className="card-title">
          <Sparkles className="card-title-icon" size={20} />
          <span>Step 4: AI Personalize, Preview & Edit</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {totalRecipients > 0 && (
            <span className="badge-counter" style={{ color: emailsReadyCount === totalRecipients ? 'var(--success)' : 'var(--text-secondary)' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
          {/* Tone Selector */}
          <div>
            <label className="form-label">Outreach Style & Tone</label>
            <select
              className="form-select"
              value={selectedTone}
              onChange={e => setSelectedTone(e.target.value)}
            >
              {TONE_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Active AI Provider Status */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label className="form-label" style={{ margin: 0 }}>Active AI Engine</label>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onOpenSettings('ai')}
                style={{ padding: '2px 8px', fontSize: 11 }}
              >
                Change in Settings
              </button>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontSize: 13
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`status-dot ${isAiConfigured ? 'active' : 'warning'}`} />
                <span style={{ fontWeight: 600 }}>{activeAi?.name || 'Gemini'}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>({activeAi?.model})</span>
              </div>
              {!isAiConfigured && (
                <span style={{ color: 'var(--warning)', fontSize: 11, fontWeight: 600 }}>
                  Key Required
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
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
                Generating Personalized Drafts with AI...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate Tailored Cold Emails ({recipients.length})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Email Viewer & Inline Editor */}
      {totalRecipients > 0 ? (
        currentRecipient && (
          <div className="email-preview-wrapper">
            {/* Header / Pager */}
            <div
              style={{
                padding: '12px 18px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Recipient {activeRecipientIndex + 1} of {totalRecipients}:
                </span>
                <span style={{ fontWeight: 700, color: '#fff' }}>
                  {currentRecipient.name || 'Hiring Contact'}
                </span>
                {currentRecipient.company && (
                  <span className="badge-counter">{currentRecipient.company}</span>
                )}
              </div>

              {/* Navigation Arrows */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveRecipientIndex(Math.max(0, activeRecipientIndex - 1))}
                  disabled={activeRecipientIndex === 0}
                >
                  <ChevronLeft size={15} /> Prev
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveRecipientIndex(Math.min(totalRecipients - 1, activeRecipientIndex + 1))}
                  disabled={activeRecipientIndex === totalRecipients - 1}
                >
                  Next <ChevronRight size={15} />
                </button>
              </div>
            </div>

            {/* Meta Rows */}
            <div className="email-meta-header">
              <div className="meta-row">
                <span className="meta-label">From:</span>
                <span className="meta-val">
                  {defaultSmtp ? (
                    <span>
                      <strong>{defaultSmtp.fromName || 'Candidate'}</strong> &lt;{defaultSmtp.fromEmail || defaultSmtp.username}&gt;
                    </span>
                  ) : (
                    <span style={{ color: 'var(--warning)' }}>⚠️ Configure SMTP profile in Settings</span>
                  )}
                </span>
              </div>

              <div className="meta-row">
                <span className="meta-label">To:</span>
                <span className="meta-val" style={{ fontFamily: 'var(--font-mono)' }}>
                  {currentRecipient.name ? `"${currentRecipient.name}" ` : ''}&lt;{currentRecipient.email}&gt;
                </span>
              </div>

              <div className="meta-row">
                <span className="meta-label">Subject:</span>
                <span className="meta-val">
                  <input
                    type="text"
                    className="subject-input-styled"
                    placeholder="Click to edit subject line..."
                    value={currentEmail?.subject || ''}
                    onChange={e => handleSubjectChange(e.target.value)}
                  />
                </span>
              </div>
            </div>

            {/* Email Body Editor */}
            <div style={{ position: 'relative' }}>
              <textarea
                className="email-body-editor"
                placeholder={
                  isGenerating
                    ? 'AI is crafting your tailored cold email...'
                    : 'Click "Generate Tailored Cold Emails" above to write with AI, or type custom message here...'
                }
                value={currentEmail?.body || ''}
                onChange={e => handleBodyChange(e.target.value)}
              />
            </div>

            {/* Footer with Attachment & Regenerate Button */}
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
                  onClick={handleRegenerateCurrent}
                  disabled={isRegeneratingSingle || !resumeData}
                  title="Re-write this specific email draft"
                >
                  <RefreshCw size={13} className={isRegeneratingSingle ? 'spin-icon' : ''} />
                  Regenerate This Draft
                </button>
              </div>
            </div>
          </div>
        )
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
