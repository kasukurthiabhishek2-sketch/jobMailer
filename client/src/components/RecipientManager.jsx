import React, { useRef, useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  UserPlus,
  FileSpreadsheet,
  Trash2,
  Upload,
  Sparkles,
  Search,
  AlertTriangle,
  X,
  Check,
  CheckCircle2,
  Users,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { uploadRecipientsSheet, fetchOutreachLogs } from '../services/api';
import RecipientModal from './RecipientModal';
import AiJdParserPanel from './AiJdParserPanel';

export default function RecipientManager({
  recipients = [],
  onUpdateRecipients,
  onShowToast,
  _generatedEmails = {},
  config
}) {
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('sheet'); // 'sheet' | 'single'
  const [isParsingSheet, setIsParsingSheet] = useState(false);
  const [sheetModalData, setSheetModalData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Manual contact form state
  const [singleName, setSingleName] = useState('');
  const [singleEmail, setSingleEmail] = useState('');
  const [singleCompany, setSingleCompany] = useState('');
  const [singleRole, setSingleRole] = useState('');
  const [singleJd, setSingleJd] = useState('');

  // 30-Day Dedup Check State
  const [contactedLogsMap, setContactedLogsMap] = useState(new Map());
  const [recentContactWarning, setRecentContactWarning] = useState(null);

  useEffect(() => {
    let mounted = true;
    fetchOutreachLogs()
      .then(logs => {
        if (!mounted || !Array.isArray(logs)) return;
        const map = new Map();
        const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
        for (const item of logs) {
          if (item?.recipientEmail && item?.status === 'sent') {
            const time = item.timestamp ? new Date(item.timestamp).getTime() : 0;
            if (time >= cutoff) {
              const email = item.recipientEmail.trim().toLowerCase();
              const existingTime = map.get(email)?.timestamp ? new Date(map.get(email).timestamp).getTime() : 0;
              if (!map.has(email) || time > existingTime) {
                map.set(email, item);
              }
            }
          }
        }
        setContactedLogsMap(map);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Search & Selection state
  const [searchTerm, setSearchTerm] = useState('');
  const [destructiveModal, setDestructiveModal] = useState(null); // { type: 'all', count: number }

  const approvedCount = useMemo(() => recipients.filter(r => r.isApproved).length, [recipients]);
  const unapprovedCount = recipients.length - approvedCount;

  const handleAddSingle = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!singleEmail.trim()) {
      onShowToast({
        type: 'error',
        title: 'Email Required',
        message: 'Please enter a valid recipient email address.'
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(singleEmail.trim())) {
      onShowToast({
        type: 'error',
        title: 'Invalid Email Format',
        message: 'Please check the email format (e.g. name@company.com).'
      });
      return;
    }

    if (recipients.some(r => r.email.toLowerCase() === singleEmail.trim().toLowerCase())) {
      onShowToast({
        type: 'error',
        title: 'Duplicate Email',
        message: 'This recipient email is already in your outreach list.'
      });
      return;
    }

    // 30-day deduplication check
    const trimmedEmail = singleEmail.trim().toLowerCase();
    const previousContact = contactedLogsMap.get(trimmedEmail);
    if (previousContact && !recentContactWarning) {
      setRecentContactWarning(previousContact);
      return;
    }

    const isPrevContacted = Boolean(previousContact || recentContactWarning);
    const lastContactDate = (previousContact || recentContactWarning)?.timestamp || null;

    const newRecipient = {
      id: 'rec_single_' + Date.now(),
      name: singleName.trim(),
      email: singleEmail.trim(),
      company: singleCompany.trim(),
      role: singleRole.trim(),
      jobDescription: singleJd.trim(),
      isValidEmail: true,
      isSelected: true,
      isApproved: true,
      isPreviouslyContacted: isPrevContacted,
      lastContactedDate: lastContactDate,
      status: 'pending'
    };

    onUpdateRecipients([...recipients, newRecipient]);
    setSingleName('');
    setSingleEmail('');
    setSingleCompany('');
    setSingleRole('');
    setSingleJd('');
    setRecentContactWarning(null);
  };

  const handleSheetUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingSheet(true);
    try {
      const data = await uploadRecipientsSheet(file);
      setSheetModalData(data);
      setIsModalOpen(true);
    } catch (err) {
      onShowToast({
        type: 'error',
        title: 'Parse Failed',
        message: err.message
      });
    } finally {
      setIsParsingSheet(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmSheetSelection = (selectedRows) => {
    const existingEmails = new Set(recipients.map(r => r.email.toLowerCase()));
    const newItems = selectedRows
      .filter(r => !existingEmails.has(r.email.toLowerCase()))
      .map(r => ({
        ...r,
        jobDescription: r.jobDescription || '',
        isApproved: true,
        status: r.status || 'pending'
      }));

    onUpdateRecipients([...recipients, ...newItems]);
    onShowToast({
      type: 'success',
      title: 'Recipients Queued',
      message: `Added ${newItems.length} approved contact(s) to outreach queue.`
    });
  };

  const handleToggleApproval = (id) => {
    onUpdateRecipients(
      recipients.map(r => (r.id === id ? { ...r, isApproved: !r.isApproved } : r))
    );
  };

  const handleRemoveSingle = (id) => {
    onUpdateRecipients(recipients.filter(r => r.id !== id));
  };

  const filteredRecipients = useMemo(() => {
    if (!searchTerm.trim()) return recipients;
    const term = searchTerm.toLowerCase().trim();
    return recipients.filter(r => (
      (r.name && r.name.toLowerCase().includes(term)) ||
      (r.email && r.email.toLowerCase().includes(term)) ||
      (r.company && r.company.toLowerCase().includes(term)) ||
      (r.role && r.role.toLowerCase().includes(term)) ||
      (r.jobDescription && r.jobDescription.toLowerCase().includes(term))
    ));
  }, [recipients, searchTerm]);

  const [queuePage, setQueuePage] = useState(1);
  const queuePageSize = 10;

  const [prevSearchTerm, setPrevSearchTerm] = useState(searchTerm);
  if (prevSearchTerm !== searchTerm) {
    setPrevSearchTerm(searchTerm);
    setQueuePage(1);
  }

  const totalQueuePages = Math.max(1, Math.ceil(filteredRecipients.length / queuePageSize));
  const safeQueuePage = Math.min(Math.max(1, queuePage), totalQueuePages);

  const queueStartIndex = (safeQueuePage - 1) * queuePageSize;
  const queueEndIndex = Math.min(queueStartIndex + queuePageSize, filteredRecipients.length);
  const paginatedRecipients = useMemo(() => {
    return filteredRecipients.slice(queueStartIndex, queueEndIndex);
  }, [filteredRecipients, queueStartIndex, queueEndIndex]);

  const handleBulkDeleteConfirm = () => {
    if (destructiveModal?.type === 'all') {
      onUpdateRecipients([]);
      setDestructiveModal(null);
      onShowToast({ type: 'info', title: 'Queue Cleared', message: 'All recipients removed.' });
    }
  };

  return (
    <div className="glass-card">
      {/* Header */}
      <div className="step-hero-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="step-hero-title">Recipients</h2>
          <p className="step-hero-subtitle">
            Upload a spreadsheet of hiring leads or add contacts directly.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <span
            className="badge-counter"
            style={{
              color: unapprovedCount === 0 && recipients.length > 0 ? 'var(--accent-success)' : undefined,
              borderColor: unapprovedCount === 0 && recipients.length > 0 ? 'rgba(52, 211, 153, 0.4)' : undefined,
              padding: '4px 10px',
              fontSize: 13
            }}
          >
            {recipients.length} {recipients.length === 1 ? 'Contact' : 'Contacts'} ({approvedCount} Approved)
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-pill-group" style={{ marginBottom: 'var(--sp-4)' }}>
        <button
          type="button"
          className={`tab-pill ${activeTab === 'sheet' ? 'active' : ''}`}
          onClick={() => setActiveTab('sheet')}
        >
          <FileSpreadsheet size={15} />
          Import Spreadsheet (.xlsx, .csv)
        </button>
        <button
          type="button"
          className={`tab-pill ${activeTab === 'single' ? 'active' : ''}`}
          onClick={() => setActiveTab('single')}
        >
          <UserPlus size={15} />
          Add Manually
        </button>
        <button
          type="button"
          className={`tab-pill ${activeTab === 'aiparse' ? 'active' : ''}`}
          onClick={() => setActiveTab('aiparse')}
        >
          <Sparkles size={15} />
          AI Parse JD
        </button>
      </div>

      {/* 2-Column Side-by-Side Layout */}
      <div className="recipient-manager-grid">
        {/* Left Column: Action / Details Container */}
        <div className="recipient-panel-card">
          {activeTab === 'sheet' ? (
            <div>
              <div className="recipient-panel-header">
                <h3 className="recipient-panel-title">Spreadsheet Upload</h3>
                <p className="recipient-panel-subtitle">
                  Import multiple hiring leads from an Excel or CSV file.
                </p>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleSheetUpload}
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
              />

              <div
                className="dropzone"
                onClick={() => fileInputRef.current?.click()}
                style={{ minHeight: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
              >
                <div className="dropzone-icon">
                  <Upload size={24} />
                </div>
                <div className="dropzone-title">
                  {isParsingSheet ? 'Parsing Spreadsheet...' : 'Upload Recipient List (.xlsx, .xls, .csv)'}
                </div>
                <div className="dropzone-desc">
                  Auto-detects Name, Email, Company, Role & JD columns • Flags formatting errors
                </div>
              </div>

              <div style={{ marginTop: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                <div
                  style={{
                    padding: '12px 14px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12,
                    color: 'var(--text-secondary)'
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Expected Column Headers:
                  </div>
                  <div style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    <code>Name</code>, <code>Email</code>, <code>Company</code>, <code>Role / Title</code>, and optional <code>Job Description</code>.
                    Each row is validated against RFC standards before adding.
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'single' ? (
            <form onSubmit={handleAddSingle} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="recipient-panel-header">
                <h3 className="recipient-panel-title">Add Contact Manually</h3>
                <p className="recipient-panel-subtitle">
                  Enter contact information and optional target role requirements.
                </p>
              </div>

              <div className="responsive-grid-2" style={{ gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
                <div className="form-group">
                  <label className="form-label">Contact Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Jessica Taylor"
                    value={singleName}
                    onChange={e => setSingleName(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    placeholder="e.g. jessica@company.com"
                    value={singleEmail}
                    onChange={e => {
                      setSingleEmail(e.target.value);
                      if (recentContactWarning) setRecentContactWarning(null);
                    }}
                    className="form-input"
                    required
                  />
                </div>
              </div>

              <div className="responsive-grid-2" style={{ gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
                <div className="form-group">
                  <label className="form-label">Company / Organization (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Stripe, OpenAI, Figma"
                    value={singleCompany}
                    onChange={e => setSingleCompany(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Recruiter / Target Role (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Technical Recruiter or Senior SWE"
                    value={singleRole}
                    onChange={e => setSingleRole(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--sp-3)', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label className="form-label">Job Description for this Role (Optional)</label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="Paste job description or key requirements for this specific role..."
                  value={singleJd}
                  onChange={e => setSingleJd(e.target.value)}
                  style={{
                    resize: 'vertical',
                    fontSize: 12,
                    lineHeight: 1.5,
                    minHeight: 88
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Tailors the outreach email specifically to this role instead of a generic pitch.
                </span>
              </div>

              {/* 30-Day Dedup Warning */}
              {recentContactWarning && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'var(--warning-bg)',
                    border: '1px solid var(--accent-warning)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginBottom: 'var(--sp-3)',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={15} style={{ color: 'var(--accent-warning)', flexShrink: 0 }} />
                    <span>
                      Contacted on <strong>{new Date(recentContactWarning.timestamp).toLocaleDateString()}</strong>
                      {recentContactWarning.company ? ` (${recentContactWarning.company})` : ''} — still add?
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setRecentContactWarning(null)}
                      style={{ fontSize: 11, padding: '2px 8px' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleAddSingle()}
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        background: 'var(--accent-warning)',
                        borderColor: 'var(--accent-warning)',
                        color: '#000'
                      }}
                    >
                      Yes, Add
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'auto' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  <UserPlus size={16} />
                  Add Recipient to Queue
                </button>
              </div>
            </form>
          ) : activeTab === 'aiparse' ? (
            <AiJdParserPanel
              config={config}
              onShowToast={onShowToast}
              existingEmails={recipients.map(r => r.email)}
              onAddRecipient={({ name, email, company, role, jobDescription }) => {
                const newRecipient = {
                  id: 'rec_ai_' + Date.now(),
                  name,
                  email,
                  company,
                  role,
                  jobDescription,
                  isValidEmail: true,
                  isSelected: true,
                  isApproved: true,
                  isPreviouslyContacted: false,
                  lastContactedDate: null,
                  status: 'pending'
                };
                onUpdateRecipients([...recipients, newRecipient]);
              }}
            />
          ) : null}
        </div>

        {/* Right Column: Recipients List Queue (In BOTH tabs, placed beside the action container) */}
        <div className="recipient-panel-card">
          {/* Header with Title, Count & Bulk Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 className="recipient-panel-title" style={{ margin: 0 }}>
                Recipients List
              </h3>
              <span
                className="badge-counter"
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  color: unapprovedCount === 0 && recipients.length > 0 ? 'var(--accent-success)' : undefined
                }}
              >
                {recipients.length} {recipients.length === 1 ? 'Contact' : 'Contacts'}
              </span>
            </div>

            {/* Bulk Action Buttons: Clear All */}
            {recipients.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setDestructiveModal({ type: 'all', count: recipients.length })}
                  style={{ fontSize: 11, height: 26, padding: '0 8px', color: 'var(--accent-danger)' }}
                  title="Clear all contacts from queue"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {/* Search Input on top */}
          {recipients.length > 0 && (
            <div style={{ position: 'relative', marginBottom: 'var(--sp-3)' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type="text"
                placeholder="Search recipients by name, email, company, role..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="form-input"
                style={{ paddingLeft: 30, paddingRight: searchTerm ? 28 : 12, height: 32, fontSize: 12 }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 2
                  }}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Queue Content: Empty state or List of recipients */}
          {recipients.length === 0 ? (
            <div
              style={{
                flex: 1,
                minHeight: 240,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: 'var(--sp-6) var(--sp-4)'
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'var(--bg-surface-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                  color: 'var(--text-muted)'
                }}
              >
                <Users size={22} style={{ opacity: 0.6 }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                No contacts in queue
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 260, lineHeight: 1.4 }}>
                Upload a sheet or add contacts manually to begin.
              </div>
            </div>
          ) : filteredRecipients.length === 0 ? (
            <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No contacts match "{searchTerm}".
            </div>
          ) : (
            <div className="recipient-queue-scrollable" style={{ flex: 1 }}>
              {paginatedRecipients.map(r => {
                const isRfcValid = r.isValidEmail !== false && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((r.email || '').trim());
                const hasJd = Boolean(r.jobDescription && typeof r.jobDescription === 'string' && r.jobDescription.trim().length > 0);
                const emailLower = (r.email || '').trim().toLowerCase();
                const loggedContact = emailLower ? contactedLogsMap.get(emailLower) : null;
                const isPreviouslyContacted = Boolean(r.isPreviouslyContacted || loggedContact);
                const contactedDate = r.lastContactedDate || loggedContact?.timestamp;

                return (
                  <div
                    key={r.id}
                    className="recipient-card-item"
                  >
                    {/* Main Details */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {/* Name & Email with RFC indicator & 30-Day Dedup Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                          {r.name || 'Hiring Lead'}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {r.email}
                        </span>
                        {isRfcValid ? (
                          <span
                            className="rfc-badge valid"
                            title="RFC 5322 Compliant Email Format"
                          >
                            <CheckCircle2 size={10} /> RFC Valid
                          </span>
                        ) : (
                          <span
                            className="rfc-badge invalid"
                            title="Invalid RFC Email Format"
                          >
                            <AlertTriangle size={10} /> Invalid RFC
                          </span>
                        )}
                        {isPreviouslyContacted && (
                          <span
                            className="status-badge status-badge-attention"
                            style={{ fontSize: 10, padding: '1px 6px', height: 18, gap: 3 }}
                            title={contactedDate ? `Previously contacted on ${new Date(contactedDate).toLocaleDateString()}` : 'Previously contacted within the last 30 days'}
                          >
                            <AlertTriangle size={10} /> Previously Contacted
                          </span>
                        )}
                      </div>

                      {/* Company & Role */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                        {r.company && (
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {r.company}
                          </span>
                        )}
                        {r.company && r.role && <span>•</span>}
                        {r.role && (
                          <span>{r.role}</span>
                        )}
                        {!r.company && !r.role && <span>No company/role specified</span>}
                      </div>

                      {/* JD Badge & Approval Status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                        {hasJd ? (
                          <span
                            className="badge-jd-added"
                            title={r.jobDescription.length > 140 ? r.jobDescription.slice(0, 140) + '...' : r.jobDescription}
                          >
                            <Sparkles size={11} /> JD Added
                          </span>
                        ) : (
                          <span
                            className="badge-jd-generic"
                            title="No role-specific JD provided. Will use generic/core pitch."
                          >
                            Generic Pitch
                          </span>
                        )}

                        {r.isApproved ? (
                          <span
                            style={{
                              fontSize: 10,
                              padding: '1px 6px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'rgba(52, 211, 153, 0.1)',
                              color: 'var(--accent-success)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3
                            }}
                            title="Explicitly approved for outreach"
                          >
                            <Check size={9} /> Approved
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleToggleApproval(r.id)}
                            style={{ fontSize: 10, height: 20, padding: '0 6px', color: 'var(--accent-warning)' }}
                            title="Click to approve"
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Remove Button */}
                    <div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSingle(r.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 4,
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color var(--transition-fast)'
                        }}
                        title="Remove contact"
                        aria-label={`Remove ${r.email}`}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-danger)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Queue Pagination Footer */}
          {filteredRecipients.length > 0 && (
            <div
              className="table-pagination"
              style={{
                marginTop: 'var(--sp-2)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 12px',
                fontSize: 11
              }}
            >
              <span>
                Showing <strong style={{ color: 'var(--text-secondary)' }}>
                  {queueStartIndex + 1}–{queueEndIndex}
                </strong> of {filteredRecipients.length}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Page {safeQueuePage} of {totalQueuePages}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setQueuePage(p => Math.max(1, p - 1))}
                    disabled={safeQueuePage <= 1}
                    aria-label="Previous queue page"
                    title="Previous page"
                    style={{ padding: '2px 6px', height: 22 }}
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setQueuePage(p => Math.min(totalQueuePages, p + 1))}
                    disabled={safeQueuePage >= totalQueuePages}
                    aria-label="Next queue page"
                    title="Next page"
                    style={{ padding: '2px 6px', height: 22 }}
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Destructive Action Confirmation Modal */}
      {destructiveModal && createPortal(
        <div className="modal-overlay" onClick={() => setDestructiveModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--accent-danger)' }}>
                <AlertTriangle size={18} />
                <span>Confirm Recipient Deletion</span>
              </div>
              <button className="btn-icon" onClick={() => setDestructiveModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {`Are you sure you want to remove all ${destructiveModal.count} recipients from your outreach list? This action cannot be undone.`}
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDestructiveModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleBulkDeleteConfirm}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Recipient Table Selection Modal */}
      <RecipientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sheetData={sheetModalData}
        onConfirmSelection={handleConfirmSheetSelection}
      />
    </div>
  );
}
