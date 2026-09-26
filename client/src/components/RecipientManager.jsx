import React, { useRef, useState } from 'react';
import { Users, UserPlus, FileSpreadsheet, Trash2, CheckCircle2, Upload, Sparkles, Building, Briefcase, Mail } from 'lucide-react';
import { uploadRecipientsSheet } from '../services/api';
import RecipientModal from './RecipientModal';

const SAMPLE_RECIPIENTS = [
  {
    id: 'sample_rec_1',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@techcorp.io',
    company: 'TechCorp Labs',
    role: 'Senior Engineering Recruiter',
    isValidEmail: true,
    isSelected: true
  },
  {
    id: 'sample_rec_2',
    name: 'David Zhao',
    email: 'david.zhao@finscale.ai',
    company: 'FinScale AI',
    role: 'VP of Engineering',
    isValidEmail: true,
    isSelected: true
  },
  {
    id: 'sample_rec_3',
    name: 'Elena Rostova',
    email: 'elena@hypergrowth.ventures',
    company: 'HyperGrowth Talent',
    role: 'Head of Technical Recruiting',
    isValidEmail: true,
    isSelected: true
  }
];

export default function RecipientManager({
  recipients,
  onUpdateRecipients,
  onShowToast
}) {
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('single'); // 'single' | 'sheet'
  const [isParsingSheet, setIsParsingSheet] = useState(false);
  const [sheetModalData, setSheetModalData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Single recipient form state
  const [singleName, setSingleName] = useState('');
  const [singleEmail, setSingleEmail] = useState('');
  const [singleCompany, setSingleCompany] = useState('');
  const [singleRole, setSingleRole] = useState('');

  const handleAddSingle = (e) => {
    e.preventDefault();
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

    // Check duplicate
    if (recipients.some(r => r.email.toLowerCase() === singleEmail.trim().toLowerCase())) {
      onShowToast({
        type: 'error',
        title: 'Duplicate Email',
        message: 'This recipient email is already in your outreach list.'
      });
      return;
    }

    const newRecipient = {
      id: 'rec_single_' + Date.now(),
      name: singleName.trim(),
      email: singleEmail.trim(),
      company: singleCompany.trim(),
      role: singleRole.trim(),
      isValidEmail: true,
      isSelected: true
    };

    onUpdateRecipients([...recipients, newRecipient]);
    setSingleName('');
    setSingleEmail('');
    setSingleCompany('');
    setSingleRole('');

    onShowToast({
      type: 'success',
      title: 'Recipient Added',
      message: `Added ${newRecipient.email} to queue.`
    });
  };

  const handleSheetUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingSheet(true);
    try {
      const data = await uploadRecipientsSheet(file);
      setSheetModalData(data);
      setIsModalOpen(true);
      onShowToast({
        type: 'info',
        title: 'Spreadsheet Parsed',
        message: `Found ${data.totalCount} contacts in ${file.name}. Review and confirm.`
      });
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
    // Merge new rows, avoiding duplicate emails
    const existingEmails = new Set(recipients.map(r => r.email.toLowerCase()));
    const newItems = selectedRows.filter(r => !existingEmails.has(r.email.toLowerCase()));

    onUpdateRecipients([...recipients, ...newItems]);
    onShowToast({
      type: 'success',
      title: 'Recipients Added',
      message: `Added ${newItems.length} contacts from sheet to outreach queue.`
    });
  };

  const handleRemoveRecipient = (id) => {
    onUpdateRecipients(recipients.filter(r => r.id !== id));
  };

  const handleClearAll = () => {
    onUpdateRecipients([]);
  };

  const handleLoadSampleRecipients = () => {
    onUpdateRecipients(SAMPLE_RECIPIENTS);
    onShowToast({
      type: 'info',
      title: 'Sample Leads Loaded',
      message: 'Added 3 sample HR & Talent contacts for quick testing.'
    });
  };

  return (
    <div className="glass-card">
      <div className="card-header">
        <div className="card-title">
          <Users className="card-title-icon" size={20} />
          <span>Step 2: HR & Hiring Recipients</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge-counter">
            {recipients.length} {recipients.length === 1 ? 'Contact' : 'Contacts'}
          </span>
          {recipients.length > 0 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleClearAll}
              title="Clear all recipients"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-pill-group">
        <button
          className={`tab-pill ${activeTab === 'single' ? 'active' : ''}`}
          onClick={() => setActiveTab('single')}
        >
          <UserPlus size={15} />
          Single Contact
        </button>
        <button
          className={`tab-pill ${activeTab === 'sheet' ? 'active' : ''}`}
          onClick={() => setActiveTab('sheet')}
        >
          <FileSpreadsheet size={15} />
          Import Excel / CSV
        </button>
      </div>

      {/* Tab 1: Single Contact */}
      {activeTab === 'single' && (
        <form onSubmit={handleAddSingle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Contact Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Jessica Taylor"
                value={singleName}
                onChange={e => setSingleName(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                placeholder="e.g. jessica@company.com"
                value={singleEmail}
                onChange={e => setSingleEmail(e.target.value)}
                className="form-input"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Company / Organization (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Stripe, OpenAI, Figma"
                value={singleCompany}
                onChange={e => setSingleCompany(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
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

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              <UserPlus size={16} />
              Add Recipient to Queue
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleLoadSampleRecipients}
              title="Load demo sample contacts"
            >
              <Sparkles size={15} style={{ color: 'var(--primary-light)' }} />
              Demo Contacts
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Excel / CSV Import */}
      {activeTab === 'sheet' && (
        <div>
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
          >
            <div className="dropzone-icon">
              <Upload size={24} />
            </div>
            <div className="dropzone-title">
              {isParsingSheet ? 'Parsing Spreadsheet...' : 'Upload Recipient List (.xlsx, .xls, .csv)'}
            </div>
            <div className="dropzone-desc">
              Auto-detects Name, Email, Company, and Role columns • Flags invalid emails
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleLoadSampleRecipients}
              style={{ gap: 6 }}
            >
              <Sparkles size={14} style={{ color: 'var(--primary-light)' }} />
              Or Load 3 Sample HR Contacts
            </button>
          </div>
        </div>
      )}

      {/* Recipient Queue Summary List */}
      {recipients.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Outreach Queue ({recipients.length} Ready):
          </div>
          <div className="recipient-list-mini">
            {recipients.map(r => (
              <div key={r.id} className="recipient-row-mini">
                <div>
                  <div style={{ fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {r.name || 'Hiring Contact'}
                    {r.company && (
                      <span className="badge-counter" style={{ fontSize: 11 }}>
                        {r.company}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {r.email} {r.role ? `• ${r.role}` : ''}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveRecipient(r.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 4
                  }}
                  title="Remove from queue"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
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
