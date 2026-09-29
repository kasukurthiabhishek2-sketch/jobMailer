import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Globe,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  UserPlus,
  MapPin,
  Building2,
  Briefcase,
  Mail,
  User,
  RotateCcw
} from 'lucide-react';
import { parseJobDescriptionApi } from '../services/api';

/**
 * AiJdParserPanel — AI-powered JD parsing tab for RecipientManager.
 * Accepts raw text or URL, sends to AI for structured extraction, shows editable preview.
 */
export default function AiJdParserPanel({
  onAddRecipient,
  onShowToast,
  config,
  existingEmails = []
}) {
  // Input state
  const [inputMode, setInputMode] = useState('text'); // 'text' | 'url'
  const [rawText, setRawText] = useState('');
  const [urlInput, setUrlInput] = useState('');

  // Parsing state
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState(null);

  // Parsed results (editable)
  const [parsedData, setParsedData] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [selectedContactIdx, setSelectedContactIdx] = useState(0);

  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Resolve active AI provider
  const activeProviderKey = config?.activeProvider || 'gemini';
  const activeProviderConfig = config?.aiProviders?.[activeProviderKey];
  const isAiConfigured = Boolean(
    activeProviderConfig?.isConfigured ||
    activeProviderConfig?.apiKey ||
    activeProviderConfig?.maskedKey ||
    (Array.isArray(activeProviderConfig?.savedKeys) && activeProviderConfig.savedKeys.length > 0) ||
    (activeProviderKey === 'copilot' && (activeProviderConfig?.connected || activeProviderConfig?.isConfigured))
  );

  const inputValid = useMemo(() => {
    if (inputMode === 'url') return urlInput.trim().length > 10;
    return rawText.trim().length >= 20;
  }, [inputMode, urlInput, rawText]);

  const emailValid = useMemo(() => {
    if (!editEmail.trim()) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim());
  }, [editEmail]);

  const isDuplicate = useMemo(() => {
    if (!editEmail.trim()) return false;
    return existingEmails.some(e => e.toLowerCase() === editEmail.trim().toLowerCase());
  }, [editEmail, existingEmails]);

  const handleParse = async () => {
    if (!isAiConfigured) {
      onShowToast?.({
        type: 'error',
        title: 'AI Not Configured',
        message: `Please configure an API key for ${activeProviderConfig?.name || 'your AI provider'} in Settings.`
      });
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setShowDiagnostics(false);
    setParsedData(null);

    try {
      const result = await parseJobDescriptionApi({
        mode: inputMode,
        rawText: inputMode === 'text' ? rawText.trim() : undefined,
        url: inputMode === 'url' ? urlInput.trim() : undefined,
        providerKey: activeProviderKey,
        providerConfig: activeProviderConfig
      });

      const p = result.parsed;
      setParsedData(p);

      // Auto-populate editable fields
      const primaryContact = p.contacts?.[0];
      setEditName(primaryContact?.name || '');
      setEditEmail(primaryContact?.email || '');
      setEditCompany(p.company || '');
      setEditRole(p.role || '');
      setEditLocation(p.location || '');
      setSelectedContactIdx(0);

      if (!p.confidence?.emailFound) {
        onShowToast?.({
          type: 'warning',
          title: 'No Email Found',
          message: 'AI could not find an HR/recruiter email in this JD. Please enter one manually.'
        });
      }
    } catch (err) {
      setParseError({
        message: err.message || 'Failed to parse job description',
        code: err.code || 'UNKNOWN_ERROR',
        stage: err.stage || 'unknown',
        requestId: err.requestId || null,
        technicalMessage: err.technicalMessage || null,
        fallbackAvailable: Boolean(err.fallbackAvailable),
        retryable: Boolean(err.retryable),
        details: err.details || null
      });
      onShowToast?.({
        type: 'error',
        title: 'Parsing Failed',
        message: err.message
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleContactSelect = (idx) => {
    if (!parsedData?.contacts?.[idx]) return;
    setSelectedContactIdx(idx);
    setEditName(parsedData.contacts[idx].name || '');
    setEditEmail(parsedData.contacts[idx].email || '');
  };

  const handleAddToQueue = () => {
    if (!emailValid) {
      onShowToast?.({
        type: 'error',
        title: 'Email Required',
        message: 'Please enter a valid HR/recruiter email address.'
      });
      return;
    }

    if (isDuplicate) {
      onShowToast?.({
        type: 'error',
        title: 'Duplicate Email',
        message: 'This email is already in your recipient queue.'
      });
      return;
    }

    onAddRecipient({
      name: editName.trim(),
      email: editEmail.trim(),
      company: editCompany.trim(),
      role: editRole.trim(),
      jobDescription: parsedData?.jobDescriptionClean || rawText.trim()
    });

    onShowToast?.({
      type: 'success',
      title: 'Recipient Added',
      message: `${editName.trim() || editEmail.trim()} added with tailored JD.`
    });

    // Reset for next entry
    handleReset();
  };

  const handleReset = () => {
    setParsedData(null);
    setRawText('');
    setUrlInput('');
    setEditName('');
    setEditEmail('');
    setEditCompany('');
    setEditRole('');
    setEditLocation('');
    setParseError(null);
    setShowDiagnostics(false);
    setSelectedContactIdx(0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="recipient-panel-header">
        <h3 className="recipient-panel-title">
          <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
          AI Parse Job Description
        </h3>
        <p className="recipient-panel-subtitle">
          Paste a JD or URL — AI extracts company, role, HR email & requirements automatically.
        </p>
      </div>

      {/* Input Mode Toggle */}
      {!parsedData && (
        <>
          <div style={{
            display: 'flex',
            gap: 4,
            marginBottom: 'var(--sp-3)',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            padding: 3
          }}>
            <button
              type="button"
              onClick={() => setInputMode('text')}
              className={`btn btn-sm ${inputMode === 'text' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, fontSize: 12, padding: '6px 10px', gap: 4 }}
            >
              <FileText size={13} /> Paste JD Text
            </button>
            <button
              type="button"
              onClick={() => setInputMode('url')}
              className={`btn btn-sm ${inputMode === 'url' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, fontSize: 12, padding: '6px 10px', gap: 4 }}
            >
              <Globe size={13} /> Paste URL
            </button>
          </div>

          {/* Input Area */}
          {inputMode === 'text' ? (
            <div className="form-group" style={{ marginBottom: 'var(--sp-3)', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <textarea
                className="form-input"
                rows={7}
                placeholder={"Paste the full job description here...\n\nInclude the role title, company name, requirements, responsibilities, and any HR/recruiter contact email if available."}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                style={{
                  resize: 'vertical',
                  fontSize: 12,
                  lineHeight: 1.5,
                  minHeight: 140,
                  flex: 1
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {rawText.trim().length < 20
                  ? 'Minimum 20 characters required'
                  : `${rawText.trim().split(/\s+/).filter(Boolean).length} words`}
              </span>
            </div>
          ) : (
            <div className="form-group" style={{ marginBottom: 'var(--sp-3)' }}>
              <label className="form-label">Job Posting URL</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://boards.greenhouse.io/company/jobs/12345"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                Works with most job boards (Greenhouse, Lever, Workday, company career pages)
              </span>
            </div>
          )}

          {/* Parse Error with Multi-Layered Diagnostics & Recovery */}
          {parseError && (
            <div style={{
              padding: '10px 12px',
              background: 'var(--error-bg, rgba(239,68,68,0.08))',
              border: '1px solid var(--accent-error, #ef4444)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--sp-3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: 'var(--accent-error, #ef4444)' }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>
                    {typeof parseError === 'object' ? parseError.message : parseError}
                  </div>
                  {typeof parseError === 'object' && parseError.requestId && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Reference ID: <code style={{ userSelect: 'all', fontSize: 10, background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 3 }}>{parseError.requestId}</code>
                    </div>
                  )}
                </div>
              </div>

              {/* Actionable Recovery Suggestion for URL mode */}
              {inputMode === 'url' && (
                <div style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 2
                }}>
                  <span>Can't access this URL?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('text');
                      setParseError(null);
                      setShowDiagnostics(false);
                    }}
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize: 11, padding: '2px 8px', height: 'auto' }}
                  >
                    Switch to Paste JD
                  </button>
                </div>
              )}

              {/* Diagnostic Details Toggle */}
              {typeof parseError === 'object' && (parseError.code || parseError.stage || parseError.technicalMessage) && (
                <div style={{ marginTop: 2 }}>
                  <button
                    type="button"
                    onClick={() => setShowDiagnostics(!showDiagnostics)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      color: 'var(--text-muted)',
                      fontSize: 10,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    {showDiagnostics ? 'Hide diagnostic details' : 'View diagnostic details'}
                  </button>
                  {showDiagnostics && (
                    <pre style={{
                      margin: '4px 0 0 0',
                      padding: 6,
                      background: 'var(--bg-tertiary)',
                      borderRadius: 4,
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      fontFamily: 'monospace',
                      maxHeight: 100,
                      overflowY: 'auto'
                    }}>
                      {`Stage: ${parseError.stage}\nCode: ${parseError.code}\nRequest: ${parseError.requestId || 'N/A'}${parseError.technicalMessage ? `\nDetails: ${parseError.technicalMessage}` : ''}`}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Parse Button */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleParse}
            disabled={!inputValid || isParsing}
            style={{ width: '100%', marginTop: 'auto' }}
          >
            {isParsing ? (
              <>
                <Loader2 size={16} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                AI is analyzing the job posting...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Parse with AI
              </>
            )}
          </button>
        </>
      )}

      {/* Parsed Results (Editable Preview) */}
      {parsedData && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {/* Confidence Summary */}
          <div style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 'var(--sp-1)'
          }}>
            {parsedData.confidence?.companyFound && (
              <span style={{ fontSize: 11, color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <CheckCircle2 size={12} /> Company
              </span>
            )}
            {parsedData.confidence?.roleFound && (
              <span style={{ fontSize: 11, color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <CheckCircle2 size={12} /> Role
              </span>
            )}
            {parsedData.confidence?.emailFound ? (
              <span style={{ fontSize: 11, color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <CheckCircle2 size={12} /> Email
              </span>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--accent-warning)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <AlertTriangle size={12} /> No Email Found
              </span>
            )}
          </div>

          {/* Multiple contacts selector */}
          {parsedData.contacts?.length > 1 && (
            <div className="form-group" style={{ marginBottom: 4 }}>
              <label className="form-label" style={{ fontSize: 11 }}>
                {parsedData.contacts.length} contacts found — select primary:
              </label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {parsedData.contacts.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`btn btn-sm ${i === selectedContactIdx ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleContactSelect(i)}
                    style={{ fontSize: 11, padding: '3px 8px' }}
                  >
                    {c.name || c.email}{c.title ? ` (${c.title})` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Editable Fields */}
          <div className="responsive-grid-2" style={{ gap: 'var(--sp-2)' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Mail size={11} /> HR / Recruiter Email *
              </label>
              <input
                type="email"
                className="form-input"
                placeholder="recruiter@company.com"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                style={{
                  fontSize: 12,
                  borderColor: !editEmail.trim() ? 'var(--accent-warning)' : emailValid ? 'var(--accent-success)' : 'var(--accent-error)'
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                <User size={11} /> Contact Name
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Jessica Taylor"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                style={{ fontSize: 12 }}
              />
            </div>
          </div>

          <div className="responsive-grid-2" style={{ gap: 'var(--sp-2)' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Building2 size={11} /> Company
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Company name"
                value={editCompany}
                onChange={e => setEditCompany(e.target.value)}
                style={{ fontSize: 12 }}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Briefcase size={11} /> Job Role
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Job title / role"
                value={editRole}
                onChange={e => setEditRole(e.target.value)}
                style={{ fontSize: 12 }}
              />
            </div>
          </div>

          {editLocation && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
              <MapPin size={11} /> {editLocation}
            </div>
          )}

          {/* Responsibilities & Requirements Summary */}
          {(parsedData.responsibilities?.length > 0 || parsedData.requirements?.length > 0) && (
            <div style={{
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 10px',
              fontSize: 11,
              lineHeight: 1.6,
              maxHeight: 120,
              overflowY: 'auto'
            }}>
              {parsedData.responsibilities?.length > 0 && (
                <div style={{ marginBottom: parsedData.requirements?.length > 0 ? 6 : 0 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Responsibilities:</strong>
                  {parsedData.responsibilities.slice(0, 3).map((r, i) => (
                    <div key={i} style={{ color: 'var(--text-secondary)', paddingLeft: 8 }}>• {r}</div>
                  ))}
                  {parsedData.responsibilities.length > 3 && (
                    <div style={{ color: 'var(--text-muted)', paddingLeft: 8 }}>
                      +{parsedData.responsibilities.length - 3} more
                    </div>
                  )}
                </div>
              )}
              {parsedData.requirements?.length > 0 && (
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Requirements:</strong>
                  {parsedData.requirements.slice(0, 3).map((r, i) => (
                    <div key={i} style={{ color: 'var(--text-secondary)', paddingLeft: 8 }}>• {r}</div>
                  ))}
                  {parsedData.requirements.length > 3 && (
                    <div style={{ color: 'var(--text-muted)', paddingLeft: 8 }}>
                      +{parsedData.requirements.length - 3} more
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Duplicate Warning */}
          {isDuplicate && (
            <div style={{
              padding: '6px 10px',
              background: 'var(--warning-bg)',
              border: '1px solid var(--accent-warning)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <AlertTriangle size={13} style={{ color: 'var(--accent-warning)' }} />
              This email is already in your recipient queue.
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'auto' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleReset}
              style={{ fontSize: 12 }}
            >
              <RotateCcw size={14} />
              Parse Another
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAddToQueue}
              disabled={!emailValid || isDuplicate}
              style={{ flex: 1, fontSize: 12 }}
            >
              <UserPlus size={14} />
              Add to Recipient Queue
            </button>
          </div>
        </div>
      )}

      {/* Inline spinner keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
