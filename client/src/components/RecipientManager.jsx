import React, { useRef, useState, useMemo, useCallback } from 'react';
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  Trash2,
  Upload,
  Sparkles,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  X
} from 'lucide-react';
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
    isSelected: true,
    status: 'pending'
  },
  {
    id: 'sample_rec_2',
    name: 'David Zhao',
    email: 'david.zhao@finscale.ai',
    company: 'FinScale AI',
    role: 'VP of Engineering',
    isValidEmail: true,
    isSelected: true,
    status: 'pending'
  },
  {
    id: 'sample_rec_3',
    name: 'Elena Rostova',
    email: 'elena@hypergrowth.ventures',
    company: 'HyperGrowth Talent',
    role: 'Head of Technical Recruiting',
    isValidEmail: true,
    isSelected: true,
    status: 'pending'
  }
];

export default function RecipientManager({
  recipients = [],
  onUpdateRecipients,
  onShowToast,
  generatedEmails = {}
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

  // Table filtering & sorting & selection
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'generated' | 'sent' | 'failed'
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Confirmation modal state for destructive actions
  const [destructiveModal, setDestructiveModal] = useState(null); // { type: 'bulk' | 'all', count: number }

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
      isSelected: true,
      status: 'pending'
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
    const existingEmails = new Set(recipients.map(r => r.email.toLowerCase()));
    const newItems = selectedRows
      .filter(r => !existingEmails.has(r.email.toLowerCase()))
      .map(r => ({
        ...r,
        status: r.status || 'pending'
      }));

    onUpdateRecipients([...recipients, ...newItems]);
    onShowToast({
      type: 'success',
      title: 'Recipients Added',
      message: `Added ${newItems.length} contacts from sheet to outreach queue.`
    });
  };

  const handleLoadSampleRecipients = () => {
    onUpdateRecipients(SAMPLE_RECIPIENTS);
    onShowToast({
      type: 'info',
      title: 'Sample Leads Loaded',
      message: 'Added 3 sample HR & Talent contacts for quick testing.'
    });
  };

  // Determine row status (pending | generated | sent | failed)
  const getRecipientStatus = useCallback((r) => {
    if (r.status === 'sent') return 'sent';
    if (r.status === 'failed') return 'failed';
    if (generatedEmails[r.id]?.body) return 'generated';
    return 'pending';
  }, [generatedEmails]);

  // Toggle sort
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filtered and sorted recipients
  const filteredRecipients = useMemo(() => {
    return recipients.filter(r => {
      const status = getRecipientStatus(r);
      if (statusFilter !== 'all' && status !== statusFilter) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (r.name && r.name.toLowerCase().includes(term)) ||
        (r.email && r.email.toLowerCase().includes(term)) ||
        (r.company && r.company.toLowerCase().includes(term)) ||
        (r.role && r.role.toLowerCase().includes(term)) ||
        status.includes(term)
      );
    });
  }, [recipients, searchTerm, statusFilter, getRecipientStatus]);

  const sortedRecipients = useMemo(() => {
    const list = [...filteredRecipients];
    list.sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortColumn === 'status') {
        valA = getRecipientStatus(a);
        valB = getRecipientStatus(b);
      } else {
        valA = (a[sortColumn] || '').toString().toLowerCase();
        valB = (b[sortColumn] || '').toString().toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredRecipients, sortColumn, sortDirection, getRecipientStatus]);

  // Paginated list
  const totalPages = Math.max(1, Math.ceil(sortedRecipients.length / pageSize));
  const paginatedRecipients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecipients.slice(start, start + pageSize);
  }, [sortedRecipients, currentPage, pageSize]);

  // Row selection handlers
  const handleToggleSelectAll = (checked) => {
    if (checked) {
      const allIds = new Set(paginatedRecipients.map(r => r.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelectRow = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allVisibleSelected =
    paginatedRecipients.length > 0 &&
    paginatedRecipients.every(r => selectedIds.has(r.id));

  // Bulk actions
  const handleBulkDeleteConfirm = () => {
    if (destructiveModal?.type === 'all') {
      onUpdateRecipients([]);
      setSelectedIds(new Set());
      setDestructiveModal(null);
      onShowToast({ type: 'info', title: 'Queue Cleared', message: 'All recipients removed.' });
    } else if (destructiveModal?.type === 'bulk') {
      onUpdateRecipients(recipients.filter(r => !selectedIds.has(r.id)));
      onShowToast({
        type: 'info',
        title: 'Recipients Deleted',
        message: `Removed ${selectedIds.size} recipient(s).`
      });
      setSelectedIds(new Set());
      setDestructiveModal(null);
    }
  };

  const handleBulkRevalidate = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let validCount = 0;
    let invalidCount = 0;

    const updated = recipients.map(r => {
      if (selectedIds.size === 0 || selectedIds.has(r.id)) {
        const isValid = emailRegex.test((r.email || '').trim());
        if (isValid) validCount++;
        else invalidCount++;
        return { ...r, isValidEmail: isValid };
      }
      return r;
    });

    onUpdateRecipients(updated);
    onShowToast({
      type: invalidCount === 0 ? 'success' : 'warning',
      title: 'Re-validation Complete',
      message: `Checked emails: ${validCount} valid, ${invalidCount} invalid format.`
    });
  };

  const handleRemoveSingle = (id) => {
    onUpdateRecipients(recipients.filter(r => r.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  return (
    <div className="glass-card">
      <div className="card-header">
        <div className="card-title">
          <Users className="card-title-icon" size={20} />
          <span>Step 2: HR & Hiring Recipients</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <span className="badge-counter">
            {recipients.length} {recipients.length === 1 ? 'Contact' : 'Contacts'}
          </span>
          {recipients.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDestructiveModal({ type: 'all', count: recipients.length })}
              title="Clear all recipients"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-pill-group">
        <button
          type="button"
          className={`tab-pill ${activeTab === 'single' ? 'active' : ''}`}
          onClick={() => setActiveTab('single')}
        >
          <UserPlus size={15} />
          Single Contact
        </button>
        <button
          type="button"
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            <div className="form-group" style={{ marginBottom: 'var(--sp-3)' }}>
              <label className="form-label">Contact Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Jessica Taylor"
                value={singleName}
                onChange={e => setSingleName(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 'var(--sp-3)' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            <div className="form-group" style={{ marginBottom: 'var(--sp-3)' }}>
              <label className="form-label">Company / Organization (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Stripe, OpenAI, Figma"
                value={singleCompany}
                onChange={e => setSingleCompany(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 'var(--sp-3)' }}>
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

          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
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
              <Sparkles size={15} style={{ color: 'var(--accent-primary)' }} />
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

          <div style={{ marginTop: 'var(--sp-3)', display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleLoadSampleRecipients}
              style={{ gap: 'var(--sp-2)' }}
            >
              <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
              Or Load 3 Sample HR Contacts
            </button>
          </div>
        </div>
      )}

      {/* Recipient Data Table */}
      {recipients.length > 0 && (
        <div style={{ marginTop: 'var(--sp-6)' }}>
          {/* Table Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--sp-2)',
              marginBottom: 'var(--sp-3)',
              flexWrap: 'wrap'
            }}
          >
            {/* Search Box */}
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
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
                placeholder="Search recipients by name, company, email..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="form-input"
                style={{ paddingLeft: 30, height: 34, fontSize: 12 }}
              />
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <Filter size={13} style={{ color: 'var(--text-muted)' }} />
              <select
                className="form-select"
                value={statusFilter}
                onChange={e => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ height: 34, fontSize: 12, padding: '0 var(--sp-2)' }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="generated">Generated</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {/* Bulk Action Controls */}
          {selectedIds.size > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--sp-2) var(--sp-3)',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--accent-primary)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--sp-2)',
                fontSize: 12
              }}
            >
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {selectedIds.size} recipient(s) selected
              </span>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleBulkRevalidate}
                  style={{ fontSize: 11, height: 28 }}
                >
                  <RefreshCw size={11} /> Re-validate Selected
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setDestructiveModal({ type: 'bulk', count: selectedIds.size })}
                  style={{ fontSize: 11, height: 28 }}
                >
                  <Trash2 size={11} /> Delete Selected
                </button>
              </div>
            </div>
          )}

          {/* Data Table */}
          <div className="data-table-wrapper" style={{ maxHeight: 380 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={e => handleToggleSelectAll(e.target.checked)}
                      style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                      title="Select / deselect all visible rows"
                    />
                  </th>
                  <th className="sortable" onClick={() => handleSort('name')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>Name</span>
                      {sortColumn === 'name' ? (
                        sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                      )}
                    </div>
                  </th>
                  <th className="sortable" onClick={() => handleSort('email')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>Email</span>
                      {sortColumn === 'email' ? (
                        sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                      )}
                    </div>
                  </th>
                  <th className="sortable" onClick={() => handleSort('company')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>Company</span>
                      {sortColumn === 'company' ? (
                        sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                      )}
                    </div>
                  </th>
                  <th className="sortable" onClick={() => handleSort('role')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>Role</span>
                      {sortColumn === 'role' ? (
                        sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                      )}
                    </div>
                  </th>
                  <th className="sortable" onClick={() => handleSort('status')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>Status</span>
                      {sortColumn === 'status' ? (
                        sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                      )}
                    </div>
                  </th>
                  <th style={{ width: 44, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecipients.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                      No recipients match the current filter.
                    </td>
                  </tr>
                ) : (
                  paginatedRecipients.map(r => {
                    const status = getRecipientStatus(r);
                    const isChecked = selectedIds.has(r.id);

                    return (
                      <tr
                        key={r.id}
                        className={isChecked ? 'row-selected' : ''}
                        style={{ background: isChecked ? 'rgba(124, 92, 255, 0.05)' : undefined }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelectRow(r.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {r.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                          {r.email}
                        </td>
                        <td>
                          {r.company ? (
                            <span className="badge-counter" style={{ fontSize: 11 }}>
                              {r.company}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {r.role || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td>
                          <span className={`status-chip ${status}`}>
                            {status === 'sent' && '✓ '}
                            {status === 'failed' && '✕ '}
                            {status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveSingle(r.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: 4
                            }}
                            title="Remove recipient"
                            aria-label={`Remove ${r.email}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {sortedRecipients.length > pageSize && (
            <div className="table-pagination">
              <span>
                Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedRecipients.length)} of {sortedRecipients.length}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} />
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Destructive Action Confirmation Modal */}
      {destructiveModal && (
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
                {destructiveModal.type === 'all'
                  ? `Are you sure you want to remove all ${destructiveModal.count} recipients from your outreach list? This action cannot be undone.`
                  : `Are you sure you want to remove the ${destructiveModal.count} selected recipient(s)?`}
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
