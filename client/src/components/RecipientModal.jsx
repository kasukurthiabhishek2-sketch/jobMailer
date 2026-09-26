import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  AlertCircle,
  Search,
  Check,
  ShieldCheck,
  CheckCircle,
  FileSpreadsheet,
  Edit2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i;

function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Empty or missing email' };
  }
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: 'Empty email' };
  }
  if (!trimmed.includes('@')) {
    return { valid: false, reason: "Missing '@' symbol" };
  }
  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return { valid: false, reason: "Must have exactly one '@' symbol" };
  }
  const [local, domain] = parts;
  if (!local) {
    return { valid: false, reason: 'Missing username before @' };
  }
  if (!domain || !domain.includes('.')) {
    return { valid: false, reason: 'Missing domain extension' };
  }
  if (domain.startsWith('.') || domain.endsWith('.')) {
    return { valid: false, reason: 'Invalid domain syntax' };
  }
  const domainLower = domain.toLowerCase();
  if (domainLower === 'gamil.com' || domainLower === 'gnail.com') {
    return { valid: false, reason: `Possible typo in domain "@${domain}" (did you mean @gmail.com?)` };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, reason: 'Malformed email syntax' };
  }
  return { valid: true };
}

export default function RecipientModal({ isOpen, onClose, sheetData, onConfirmSelection }) {
  const [rows, setRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'valid' | 'selected' | 'invalid'
  const [lastClickedIndex, setLastClickedIndex] = useState(null);

  // Inline editing state for fixing email or name
  const [editingRowId, setEditingRowId] = useState(null);
  const [editingField, setEditingField] = useState('email'); // 'email' | 'name'
  const [editingValue, setEditingValue] = useState('');
  const [editError, setEditError] = useState('');

  // Explicit Approval Checkbox State
  const [isExplicitlyApproved, setIsExplicitlyApproved] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50); // 50 | 100 | 250 | 'all'

  useEffect(() => {
    if (sheetData?.rows) {
      setRows(sheetData.rows);
      setIsExplicitlyApproved(false);
      setFilterTab('all');
      setSearchTerm('');
      setEditingRowId(null);
      setCurrentPage(1);
    }
  }, [sheetData]);

  // Reset to first page when filtering or searching
  useEffect(() => {
    setCurrentPage(1);
  }, [filterTab, searchTerm]);

  const totalCount = rows.length;
  const validCount = useMemo(() => rows.filter(r => r.isValidEmail).length, [rows]);
  const invalidCount = totalCount - validCount;
  const selectedCount = useMemo(() => rows.filter(r => r.isSelected).length, [rows]);

  // Filter rows by search term and filter tab
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      // Tab filter
      if (filterTab === 'valid' && !r.isValidEmail) return false;
      if (filterTab === 'selected' && !r.isSelected) return false;
      if (filterTab === 'invalid' && r.isValidEmail) return false;

      // Search term filter
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (r.name && r.name.toLowerCase().includes(term)) ||
        (r.email && r.email.toLowerCase().includes(term)) ||
        (r.company && r.company.toLowerCase().includes(term)) ||
        (r.role && r.role.toLowerCase().includes(term)) ||
        String(r.excelRowNum || '').includes(term)
      );
    });
  }, [rows, filterTab, searchTerm]);

  // Derived pagination calculations
  const totalPages = useMemo(() => {
    if (pageSize === 'all') return 1;
    return Math.max(1, Math.ceil(filteredRows.length / pageSize));
  }, [filteredRows.length, pageSize]);

  const paginatedRows = useMemo(() => {
    if (pageSize === 'all') return filteredRows;
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  if (!isOpen || !sheetData) return null;

  // Toggle individual row with Shift-click range support
  const handleToggleRow = (indexInFiltered, e) => {
    const targetRow = filteredRows[indexInFiltered];
    if (!targetRow) return;
    const targetRealIndex = rows.findIndex(r => r.id === targetRow.id);

    if (e.shiftKey && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, targetRealIndex);
      const end = Math.max(lastClickedIndex, targetRealIndex);
      const targetState = !targetRow.isSelected;

      setRows(prev =>
        prev.map((row, i) => {
          if (i >= start && i <= end) {
            return { ...row, isSelected: row.isValidEmail ? targetState : false };
          }
          return row;
        })
      );
    } else {
      setRows(prev =>
        prev.map(row => (row.id === targetRow.id ? { ...row, isSelected: !row.isSelected } : row))
      );
      setLastClickedIndex(targetRealIndex);
    }
  };

  // Select all valid rows
  const handleSelectAll = (checked) => {
    setRows(prev =>
      prev.map(row => ({
        ...row,
        isSelected: checked ? row.isValidEmail : false
      }))
    );
  };

  // Select only visible filtered valid rows
  const handleSelectFilteredValid = (checked) => {
    const filteredValidIds = new Set(filteredRows.filter(r => r.isValidEmail).map(r => r.id));
    setRows(prev =>
      prev.map(row => {
        if (filteredValidIds.has(row.id)) {
          return { ...row, isSelected: checked };
        }
        return row;
      })
    );
  };

  // Start inline editing
  const handleStartEdit = (rowId, field, currentValue, e) => {
    e.stopPropagation();
    setEditingRowId(rowId);
    setEditingField(field);
    setEditingValue(currentValue || '');
    setEditError('');
  };

  // Save inline edit (email or name)
  const handleSaveEdit = (rowId) => {
    if (editingField === 'email') {
      const val = validateEmail(editingValue);
      setRows(prev =>
        prev.map(r => {
          if (r.id !== rowId) return r;
          return {
            ...r,
            email: editingValue.trim().toLowerCase(),
            isValidEmail: val.valid,
            errorReason: val.valid ? null : val.reason,
            isSelected: val.valid ? true : false
          };
        })
      );
      if (val.valid) {
        setEditingRowId(null);
        setEditError('');
      } else {
        setEditError(val.reason);
      }
    } else {
      // Editing Name
      setRows(prev =>
        prev.map(r => {
          if (r.id !== rowId) return r;
          return {
            ...r,
            name: editingValue.trim()
          };
        })
      );
      setEditingRowId(null);
      setEditError('');
    }
  };

  // Confirm and explicitly approve selected contacts
  const handleApproveAndConfirm = () => {
    if (!isExplicitlyApproved || selectedCount === 0) return;

    const selectedRows = rows
      .filter(r => r.isSelected)
      .map(r => ({
        ...r,
        isApproved: true,
        approvedAt: new Date().toISOString()
      }));

    onConfirmSelection(selectedRows);
    onClose();
  };

  const allFilteredValidSelected =
    filteredRows.filter(r => r.isValidEmail).length > 0 &&
    filteredRows.filter(r => r.isValidEmail).every(r => r.isSelected);

  const modalMarkup = (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 1040,
          width: '95vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, rgba(124, 92, 255, 0.25) 0%, rgba(52, 211, 153, 0.2) 100%)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(124, 92, 255, 0.2)'
              }}
            >
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', letterSpacing: '-0.2px' }}>
                Review & Explicitly Approve Extracted Contacts
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Row-by-Row Isolation: Each email address is paired strictly with the HR contact from the same spreadsheet row.
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {/* Isolation & Column Mapping Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(124, 92, 255, 0.08) 0%, rgba(52, 211, 153, 0.05) 100%)',
              border: '1px solid rgba(124, 92, 255, 0.22)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              marginBottom: 14
            }}
          >
            {/* Top row: File name & stats */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                  📄 {sheetData.filename}
                </span>
                {sheetData.sheetName && (
                  <span className="info-pill" style={{ background: 'rgba(255, 255, 255, 0.06)', fontSize: 11 }}>
                    Sheet: <strong>{sheetData.sheetName}</strong>
                  </span>
                )}
                <span className="info-pill" style={{ background: 'rgba(255, 255, 255, 0.06)', fontSize: 11 }}>
                  Header: <strong>{sheetData.headerRowIndex >= 0 ? `Row ${sheetData.headerRowIndex + 1}` : 'First Row (Data)'}</strong>
                </span>
              </div>

              {/* Status Counters */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span className="info-pill" style={{ background: 'var(--bg-tertiary)', fontSize: 11 }}>
                  <strong>{totalCount}</strong> Total Rows
                </span>
                <span className="info-pill" style={{ background: 'rgba(52, 211, 153, 0.12)', borderColor: 'rgba(52, 211, 153, 0.35)', color: 'var(--accent-success)', fontSize: 11 }}>
                  ✓ <strong>{validCount}</strong> Valid
                </span>
                {invalidCount > 0 && (
                  <span className="info-pill" style={{ background: 'rgba(248, 113, 113, 0.12)', borderColor: 'rgba(248, 113, 113, 0.35)', color: 'var(--accent-danger)', fontSize: 11 }}>
                    ⚠️ <strong>{invalidCount}</strong> Need Fix
                  </span>
                )}
                <span className="info-pill" style={{ background: 'rgba(124, 92, 255, 0.15)', borderColor: 'rgba(124, 92, 255, 0.4)', color: 'var(--accent-primary-hover)', fontSize: 11 }}>
                  <strong>{selectedCount}</strong> Selected
                </span>
              </div>
            </div>

            {/* Column Mapping Strip */}
            {sheetData.columnMapping && (
              <div
                style={{
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px solid rgba(255, 255, 255, 0.07)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  flexWrap: 'wrap'
                }}
              >
                <span>
                  Email Column: <strong style={{ color: 'var(--text-primary)' }}>{sheetData.columnMapping.emailCol || 'Row Scan'}</strong>
                </span>
                <span>•</span>
                <span>
                  Name Column: <strong style={{ color: 'var(--text-primary)' }}>{sheetData.columnMapping.nameCol || 'Row Heuristic'}</strong>
                </span>
                {sheetData.columnMapping.companyCol && (
                  <>
                    <span>•</span>
                    <span>Company: <strong style={{ color: 'var(--text-primary)' }}>{sheetData.columnMapping.companyCol}</strong></span>
                  </>
                )}
                {sheetData.columnMapping.roleCol && (
                  <>
                    <span>•</span>
                    <span>Role: <strong style={{ color: 'var(--text-primary)' }}>{sheetData.columnMapping.roleCol}</strong></span>
                  </>
                )}
                <span style={{ marginLeft: 'auto', color: 'var(--accent-success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck size={12} /> Row-by-Row Isolation Verified
                </span>
              </div>
            )}
          </div>

          {/* Search & Filter Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              gap: 12,
              flexWrap: 'wrap'
            }}
          >
            {/* Search Box */}
            <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 380 }}>
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
                placeholder="Search extracted names, emails, companies..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="form-input"
                style={{ paddingLeft: 30, fontSize: 12, height: 32 }}
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
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 2
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filter Tabs & Bulk Select Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: 2, border: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  style={{
                    padding: '3px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: 'none',
                    cursor: 'pointer',
                    background: filterTab === 'all' ? 'var(--accent-primary)' : 'transparent',
                    color: filterTab === 'all' ? '#fff' : 'var(--text-muted)'
                  }}
                >
                  All ({totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('valid')}
                  style={{
                    padding: '3px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: 'none',
                    cursor: 'pointer',
                    background: filterTab === 'valid' ? 'var(--accent-primary)' : 'transparent',
                    color: filterTab === 'valid' ? '#fff' : 'var(--accent-success)'
                  }}
                >
                  Valid ({validCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('selected')}
                  style={{
                    padding: '3px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: 'none',
                    cursor: 'pointer',
                    background: filterTab === 'selected' ? 'var(--accent-primary)' : 'transparent',
                    color: filterTab === 'selected' ? '#fff' : 'var(--text-muted)'
                  }}
                >
                  Selected ({selectedCount})
                </button>
                {invalidCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterTab('invalid')}
                    style={{
                      padding: '3px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 4,
                      border: 'none',
                      cursor: 'pointer',
                      background: filterTab === 'invalid' ? 'var(--accent-danger)' : 'transparent',
                      color: filterTab === 'invalid' ? '#fff' : 'var(--accent-danger)'
                    }}
                  >
                    Need Fix ({invalidCount})
                  </button>
                )}
              </div>

              {/* Quick Select All / Deselect All */}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleSelectFilteredValid(true)}
                style={{ fontSize: 11, height: 26, padding: '2px 8px' }}
                title="Select all visible valid contacts"
              >
                Select All
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleSelectFilteredValid(false)}
                style={{ fontSize: 11, height: 26, padding: '2px 8px' }}
                title="Deselect all visible contacts"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Extracted Data Table */}
          <div className="data-table-wrapper" style={{ maxHeight: 380 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={allFilteredValidSelected}
                      onChange={e => handleSelectAll(e.target.checked)}
                      style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
                      title="Select / Deselect all valid rows"
                      aria-label="Select all valid rows"
                    />
                  </th>
                  <th style={{ width: 85, textAlign: 'center' }}>Excel Row</th>
                  <th style={{ minWidth: 170 }}>Extracted HR Name</th>
                  <th style={{ minWidth: 230 }}>Extracted HR Email</th>
                  <th style={{ minWidth: 140 }}>Company / Firm</th>
                  <th style={{ minWidth: 130 }}>Target Role</th>
                  <th style={{ minWidth: 150 }}>Validation Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                      No contacts matching your search/filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, idxInPage) => {
                    const realFilteredIdx = pageSize === 'all' ? idxInPage : (currentPage - 1) * pageSize + idxInPage;
                    const isInvalid = !row.isValidEmail;
                    const isEditing = editingRowId === row.id;

                    return (
                      <tr
                        key={row.id}
                        className={`${isInvalid ? 'row-invalid' : ''} ${row.isSelected ? 'row-selected' : ''}`}
                        onClick={e => {
                          if (!isInvalid && !isEditing) handleToggleRow(realFilteredIdx, e);
                        }}
                        style={{
                          cursor: isInvalid || isEditing ? 'default' : 'pointer',
                          background: row.isSelected ? 'rgba(124, 92, 255, 0.07)' : undefined
                        }}
                      >
                        {/* Checkbox */}
                        <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={row.isSelected}
                            disabled={isInvalid}
                            onChange={e => handleToggleRow(idx, e)}
                            style={{ cursor: isInvalid ? 'not-allowed' : 'pointer', transform: 'scale(1.15)' }}
                            aria-label={`Select row ${row.rowIndex}`}
                          />
                        </td>

                        {/* Excel Row # */}
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                          Row {row.excelRowNum || row.rowIndex}
                        </td>

                        {/* Extracted HR Name */}
                        <td>
                          {isEditing && editingField === 'name' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editingValue}
                                onChange={e => setEditingValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveEdit(row.id);
                                  if (e.key === 'Escape') setEditingRowId(null);
                                }}
                                autoFocus
                                className="form-input"
                                placeholder="HR Contact Name"
                                style={{ fontSize: 12, padding: '2px 8px', height: 26, width: 140 }}
                              />
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ padding: '2px 6px', fontSize: 10, height: 26 }}
                                onClick={() => handleSaveEdit(row.id)}
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 600, color: row.name ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                {row.name || 'Hiring Lead'}
                              </span>
                              <button
                                type="button"
                                onClick={e => handleStartEdit(row.id, 'name', row.name, e)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  padding: 2,
                                  opacity: 0.6
                                }}
                                title="Click to edit extracted name"
                              >
                                <Edit2 size={11} />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Extracted HR Email */}
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                          {isEditing && editingField === 'email' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="email"
                                  value={editingValue}
                                  onChange={e => {
                                    setEditingValue(e.target.value);
                                    setEditError('');
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveEdit(row.id);
                                    if (e.key === 'Escape') setEditingRowId(null);
                                  }}
                                  autoFocus
                                  className="form-input"
                                  placeholder="user@example.com"
                                  style={{ fontSize: 12, padding: '3px 8px', height: 28, width: 190, fontFamily: 'var(--font-mono)' }}
                                />
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  style={{ padding: '2px 8px', fontSize: 11, height: 28 }}
                                  onClick={() => handleSaveEdit(row.id)}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '2px 8px', fontSize: 11, height: 28 }}
                                  onClick={() => setEditingRowId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                              {editError && (
                                <span style={{ fontSize: 11, color: 'var(--accent-danger)' }}>
                                  {editError}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: isInvalid ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
                                {row.email || <span style={{ color: 'var(--text-muted)' }}>[Empty Cell]</span>}
                              </span>
                              {row.rawEmail && row.rawEmail !== row.email && (
                                <span
                                  className="badge-counter"
                                  style={{ fontSize: 9, padding: '1px 5px', color: 'var(--text-muted)' }}
                                  title={`Original cell text: "${row.rawEmail}"`}
                                >
                                  Cleaned
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Company */}
                        <td>{row.company || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>

                        {/* Role */}
                        <td style={{ fontSize: 12 }}>{row.role || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>

                        {/* Status & Fix Button */}
                        <td>
                          {isInvalid ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span className="email-invalid-tag" title={row.errorReason || 'Invalid email format'}>
                                <AlertCircle size={11} /> {row.errorReason || 'Invalid format'}
                              </span>
                              {!isEditing && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{
                                    padding: '2px 6px',
                                    fontSize: 10,
                                    height: 22,
                                    color: 'var(--text-primary)'
                                  }}
                                  onClick={e => handleStartEdit(row.id, 'email', row.email || row.rawEmail || '', e)}
                                >
                                  Fix
                                </button>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--accent-success)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Check size={13} /> Verified
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredRows.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                marginTop: 8,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                color: 'var(--text-secondary)',
                flexWrap: 'wrap',
                gap: 8
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>
                  Showing{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {pageSize === 'all'
                      ? `1 - ${filteredRows.length}`
                      : `${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, filteredRows.length)}`}
                  </strong>{' '}
                  of <strong style={{ color: 'var(--text-primary)' }}>{filteredRows.length}</strong> contacts
                </span>
                <span style={{ color: 'var(--border-strong)' }}>|</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={e => {
                      const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                      setPageSize(val);
                      setCurrentPage(1);
                    }}
                    className="form-select"
                    style={{ padding: '2px 6px', fontSize: 11, height: 24, width: 'auto' }}
                  >
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value="all">All</option>
                  </select>
                </label>
              </div>

              {pageSize !== 'all' && totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={{ padding: '2px 6px', height: 26, fontSize: 11 }}
                    aria-label="Previous Page"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <span style={{ fontSize: 11, fontWeight: 500, minWidth: 70, textAlign: 'center' }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={{ padding: '2px 6px', height: 26, fontSize: 11 }}
                    aria-label="Next Page"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tip row */}
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>💡 Tip: Hold <kbd style={{ padding: '1px 4px', background: 'var(--bg-tertiary)', borderRadius: 3 }}>Shift</kbd> to range-select multiple rows.</span>
            <span>Click the pencil icon next to any contact name to rename.</span>
          </div>

          {/* EXPLICIT APPROVAL CHECKBOX SECTION */}
          <div
            style={{
              marginTop: 14,
              padding: '12px 16px',
              background: isExplicitlyApproved ? 'rgba(52, 211, 153, 0.08)' : 'rgba(251, 191, 36, 0.08)',
              border: '1px solid',
              borderColor: isExplicitlyApproved ? 'rgba(52, 211, 153, 0.45)' : 'rgba(251, 191, 36, 0.4)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              transition: 'all 0.2s ease'
            }}
          >
            <input
              type="checkbox"
              id="explicitApprovalCheckbox"
              checked={isExplicitlyApproved}
              onChange={e => setIsExplicitlyApproved(e.target.checked)}
              style={{
                width: 18,
                height: 18,
                cursor: 'pointer',
                accentColor: 'var(--accent-success)',
                flexShrink: 0
              }}
            />
            <label
              htmlFor="explicitApprovalCheckbox"
              style={{
                fontSize: 12,
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontWeight: 600,
                lineHeight: 1.4,
                userSelect: 'none'
              }}
            >
              <span>I have reviewed the row-by-row extracted contacts and <strong>explicitly approve</strong> sending cold outreach to these {selectedCount} verified HR contacts.</span>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>
                Explicit user approval is strictly mandatory before any emails can be generated or sent.
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Selected: <strong style={{ color: selectedCount > 0 ? 'var(--accent-success)' : 'var(--text-muted)' }}>{selectedCount}</strong> of {validCount} verified contacts
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>

            <button
              className="btn btn-primary"
              onClick={handleApproveAndConfirm}
              disabled={!isExplicitlyApproved || selectedCount === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: isExplicitlyApproved && selectedCount > 0 ? 'var(--primary-gradient)' : 'var(--bg-tertiary)',
                color: isExplicitlyApproved && selectedCount > 0 ? '#fff' : 'var(--text-muted)',
                boxShadow: isExplicitlyApproved && selectedCount > 0 ? '0 4px 14px var(--primary-glow)' : 'none',
                cursor: !isExplicitlyApproved || selectedCount === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <CheckCircle size={16} />
              Approve & Import {selectedCount} Verified Contacts
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalMarkup, document.body);
}
