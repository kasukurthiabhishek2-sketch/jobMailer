import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  AlertCircle,
  Search,
  Check,
  CheckCircle,
  FileSpreadsheet,
  Edit2,
  Info,
  Columns3,
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
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const [prevFilter, setPrevFilter] = useState({ searchTerm, filterTab });
  if (prevFilter.searchTerm !== searchTerm || prevFilter.filterTab !== filterTab) {
    setPrevFilter({ searchTerm, filterTab });
    setCurrentPage(1);
  }

  // Inline editing state for fixing email or name
  const [editingRowId, setEditingRowId] = useState(null);
  const [editingField, setEditingField] = useState('email'); // 'email' | 'name'
  const [editingValue, setEditingValue] = useState('');
  const [editError, setEditError] = useState('');

  // Explicit Approval Checkbox State (TICK-CYC3-17 / C8)
  const [isExplicitlyApproved, setIsExplicitlyApproved] = useState(false);
  const [highlightApproval, setHighlightApproval] = useState(false);

  // Column visibility
  const [showRowCol, setShowRowCol] = useState(true);
  const [showRoleCol, setShowRoleCol] = useState(true);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef(null);

  const [prevSheetData, setPrevSheetData] = useState(sheetData);
  if (sheetData !== prevSheetData) {
    setPrevSheetData(sheetData);
    if (sheetData?.rows) {
      setRows(sheetData.rows);
      setIsExplicitlyApproved(false);
      setFilterTab('all');
      setSearchTerm('');
      setEditingRowId(null);
      setCurrentPage(1);
    }
  }

  const totalCount = rows.length;
  const validCount = useMemo(() => rows.filter(r => r.isValidEmail).length, [rows]);
  const invalidCount = totalCount - validCount;
  const selectedCount = useMemo(() => rows.filter(r => r.isSelected).length, [rows]);

  // Auto-hide Role column when every row's role is empty
  const anyRolePresent = useMemo(() => rows.some(r => r.role && r.role.trim()), [rows]);

  // Close columns popover on outside click
  useEffect(() => {
    if (!columnsOpen) return;
    const handler = (e) => {
      if (columnsRef.current && !columnsRef.current.contains(e.target)) {
        setColumnsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [columnsOpen]);

  // Filter rows by search term and filter tab
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (filterTab === 'valid' && !r.isValidEmail) return false;
      if (filterTab === 'selected' && !r.isSelected) return false;
      if (filterTab === 'invalid' && r.isValidEmail) return false;

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

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredRows.length);
  const paginatedRows = useMemo(() => {
    return filteredRows.slice(startIndex, endIndex);
  }, [filteredRows, startIndex, endIndex]);

  if (!isOpen || !sheetData) return null;

  const roleVisible = showRoleCol && anyRolePresent;
  const colCount = 5 + (showRowCol ? 1 : 0) + (roleVisible ? 1 : 0);

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

  // Confirm and explicitly approve selected contacts (TICK-CYC3-17 / C8)
  const handleApproveAndConfirm = () => {
    if (selectedCount === 0) return;

    if (!isExplicitlyApproved) {
      setHighlightApproval(true);
      setTimeout(() => setHighlightApproval(false), 2200);
      return;
    }

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

  // Describe the name column heuristic in plain language
  const nameColLabel = sheetData.columnMapping?.nameCol || null;
  const nameColDesc = nameColLabel ? nameColLabel : 'No name column found — using generic name';

  const modalMarkup = (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modal-review"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Review contacts before importing"
      >
        {/* 1. Header (fixed) */}
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(37, 99, 235, 0.12)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
                Review contacts before importing
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                Check the contacts found in {sheetData.filename}. Nothing is imported until you approve.
                <button
                  type="button"
                  className="info-tooltip-btn"
                  title="Each email is matched with the name and company from the same spreadsheet row."
                  aria-label="Row pairing info"
                >
                  <Info size={13} />
                </button>
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* 2. Summary bar (fixed) */}
        <div className="review-summary-bar">
          <span><strong>{sheetData.filename}</strong></span>
          {sheetData.sheetName && (
            <>
              <span className="review-summary-dot">·</span>
              <span>Sheet: <strong>{sheetData.sheetName}</strong></span>
            </>
          )}
          <span className="review-summary-dot">·</span>
          <span>Header: <strong>{sheetData.headerRowIndex >= 0 ? `Row ${sheetData.headerRowIndex + 1}` : 'First row (data)'}</strong></span>
          {sheetData.columnMapping?.emailCol && (
            <>
              <span className="review-summary-dot">·</span>
              <span>Email: <strong>{sheetData.columnMapping.emailCol}</strong></span>
            </>
          )}
          <span className="review-summary-dot">·</span>
          <span>Name: <strong>{nameColDesc}</strong></span>
          {sheetData.columnMapping?.companyCol && (
            <>
              <span className="review-summary-dot">·</span>
              <span>Company: <strong>{sheetData.columnMapping.companyCol}</strong></span>
            </>
          )}
          {/* TODO: Add "Edit mapping" action that returns to sheet/header/column step if one exists */}
        </div>

        {/* 3. Toolbar: search + segmented filter + actions (fixed) */}
        <div className="review-toolbar">
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 340 }}>
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
              placeholder="Search name, email or company"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ paddingLeft: 30, fontSize: 12, height: 32 }}
              aria-label="Search contacts"
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
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Search result count for screen readers */}
          <div aria-live="polite" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
            {searchTerm ? `${filteredRows.length} contacts found` : ''}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Segmented control: All · Ready · Needs attention · Selected */}
            <div className="segmented-control" role="radiogroup" aria-label="Filter contacts">
              <button
                type="button"
                className={`segmented-btn ${filterTab === 'all' ? 'active' : ''}`}
                onClick={() => setFilterTab('all')}
                role="radio"
                aria-checked={filterTab === 'all'}
              >
                All {totalCount}
              </button>
              <button
                type="button"
                className={`segmented-btn ${filterTab === 'valid' ? 'active' : ''}`}
                onClick={() => setFilterTab('valid')}
                role="radio"
                aria-checked={filterTab === 'valid'}
              >
                Ready {validCount}
              </button>
              {invalidCount > 0 && (
                <button
                  type="button"
                  className={`segmented-btn ${filterTab === 'invalid' ? 'active' : ''}`}
                  onClick={() => setFilterTab('invalid')}
                  role="radio"
                  aria-checked={filterTab === 'invalid'}
                >
                  <AlertCircle size={12} />
                  Needs attention {invalidCount}
                </button>
              )}
              <button
                type="button"
                className={`segmented-btn ${filterTab === 'selected' ? 'active' : ''}`}
                onClick={() => setFilterTab('selected')}
                role="radio"
                aria-checked={filterTab === 'selected'}
              >
                Selected {selectedCount}
              </button>
            </div>

            {/* Select All / Clear */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleSelectFilteredValid(true)}
              style={{ fontSize: 11, height: 28 }}
              title="Select all visible valid contacts"
            >
              Select All
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleSelectFilteredValid(false)}
              style={{ fontSize: 11, height: 28 }}
              title="Deselect all visible contacts"
            >
              Clear
            </button>

            {/* Columns toggle */}
            <div style={{ position: 'relative' }} ref={columnsRef}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setColumnsOpen(v => !v)}
                style={{ fontSize: 11, height: 28, gap: 4 }}
                title="Toggle columns"
                aria-expanded={columnsOpen}
              >
                <Columns3 size={13} />
                Columns
              </button>
              {columnsOpen && (
                <div className="columns-popover">
                  <label>
                    <input
                      type="checkbox"
                      checked={showRowCol}
                      onChange={e => setShowRowCol(e.target.checked)}
                    />
                    Row #
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={showRoleCol && anyRolePresent}
                      disabled={!anyRolePresent}
                      onChange={e => setShowRoleCol(e.target.checked)}
                    />
                    Role {!anyRolePresent && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(empty)</span>}
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4. Warning notice (only when needs-attention > 0) */}
        {invalidCount > 0 && filterTab !== 'invalid' && (
          <div className="review-notice">
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>
              {invalidCount} {invalidCount === 1 ? 'row has' : 'rows have'} a missing or invalid email and will be skipped.
            </span>
            <button
              type="button"
              className="review-notice-link"
              onClick={() => setFilterTab('invalid')}
            >
              Review them
            </button>
          </div>
        )}

        {/* 5. Table (flex-1, own scroll, sticky header) */}
        <div className="review-table-region">
          <table className="data-table review-table">
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
                <th style={{ width: 100 }}>Status</th>
                {showRowCol && <th style={{ width: 60, textAlign: 'center' }}>Row</th>}
                <th style={{ minWidth: 150 }}>Name</th>
                <th style={{ minWidth: 200 }}>Email</th>
                <th style={{ minWidth: 130 }}>Company</th>
                {roleVisible && <th style={{ minWidth: 120 }}>Role</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                    No contacts matching your search/filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => {
                  const isInvalid = !row.isValidEmail;
                  const isEditing = editingRowId === row.id;
                  const globalFilteredIdx = startIndex + idx;

                  return (
                    <tr
                      key={row.id}
                      className={`${isInvalid ? 'row-invalid' : ''} ${row.isSelected ? 'row-selected' : ''}`}
                      onClick={e => {
                        if (!isInvalid && !isEditing) handleToggleRow(globalFilteredIdx, e);
                      }}
                      style={{ cursor: isInvalid || isEditing ? 'default' : 'pointer' }}
                    >
                      {/* Checkbox */}
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={row.isSelected}
                          disabled={isInvalid}
                          onChange={e => handleToggleRow(globalFilteredIdx, e)}
                          style={{ cursor: isInvalid ? 'not-allowed' : 'pointer', transform: 'scale(1.15)' }}
                          aria-label={`Select row ${row.excelRowNum || row.rowIndex}`}
                        />
                      </td>

                      {/* Status */}
                      <td>
                        {isInvalid ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="email-invalid-tag" title={row.errorReason || 'Invalid email format'}>
                              <AlertCircle size={11} /> {row.errorReason ? 'Invalid' : 'Invalid'}
                            </span>
                            {!isEditing && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '2px 6px', fontSize: 10, height: 22 }}
                                onClick={e => handleStartEdit(row.id, 'email', row.email || row.rawEmail || '', e)}
                              >
                                Fix
                              </button>
                            )}
                          </div>
                        ) : row.isPreviouslyContacted ? (
                          <span
                            className="status-badge status-badge-attention"
                            title={`Previously contacted on ${row.lastContactedDate || 'previous campaign'}`}
                          >
                            Contacted
                          </span>
                        ) : (
                          <span className="status-badge status-badge-ready">
                            <Check size={11} /> Ready
                          </span>
                        )}
                      </td>

                      {/* Row # */}
                      {showRowCol && (
                        <td className="cell-row-num">
                          {row.excelRowNum || row.rowIndex}
                        </td>
                      )}

                      {/* Name */}
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
                              placeholder="Contact name"
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
                            <span
                              className="cell-truncate"
                              style={{ fontWeight: 600, color: row.name ? 'var(--text-primary)' : 'var(--text-muted)' }}
                              title={row.name || ''}
                            >
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
                                opacity: 0.5,
                                flexShrink: 0
                              }}
                              title="Edit name"
                            >
                              <Edit2 size={11} />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Email */}
                      <td className="cell-mono">
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
                            <span
                              className="cell-truncate"
                              style={{ color: isInvalid ? 'var(--accent-danger)' : 'var(--text-primary)' }}
                              title={row.email || ''}
                            >
                              {row.email || <span style={{ color: 'var(--text-muted)' }}>[Empty]</span>}
                            </span>
                            {row.rawEmail && row.rawEmail !== row.email && (
                              <span
                                className="badge-counter"
                                style={{ fontSize: 9, padding: '1px 5px', color: 'var(--text-muted)' }}
                                title={`Original cell: "${row.rawEmail}"`}
                              >
                                Cleaned
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Company */}
                      <td>
                        <span className="cell-truncate" title={row.company || ''}>
                          {row.company || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </span>
                      </td>

                      {/* Role */}
                      {roleVisible && (
                        <td className="cell-muted">
                          <span className="cell-truncate" title={row.role || ''}>
                            {row.role || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table pagination & range-select tip */}
        <div className="table-pagination" style={{ padding: '8px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>
              Showing <strong style={{ color: 'var(--text-secondary)' }}>
                {filteredRows.length === 0 ? 0 : `${startIndex + 1}–${endIndex}`}
              </strong> of {filteredRows.length} rows
              {filteredRows.length !== totalCount && ` (filtered from ${totalCount})`}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Hold <kbd style={{ padding: '1px 4px', background: 'var(--bg-tertiary)', borderRadius: 3, fontSize: 10 }}>Shift</kbd> to range-select
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Page <strong>{safePage}</strong> of <strong>{totalPages}</strong>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                aria-label="Previous Page"
                title="Previous Page"
                style={{ padding: '2px 8px', height: 26, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11 }}
              >
                <ChevronLeft size={13} />
                <span>Prev</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                aria-label="Next Page"
                title="Next Page"
                style={{ padding: '2px 8px', height: 26, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11 }}
              >
                <span>Next</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* 6. Consent section (fixed) */}
        <div
          className={`review-consent ${highlightApproval ? 'highlight' : isExplicitlyApproved ? 'approved' : 'pending'}`}
          data-testid="consent-section"
        >
          <input
            type="checkbox"
            id="explicitApprovalCheckbox"
            checked={isExplicitlyApproved}
            onChange={e => {
              setIsExplicitlyApproved(e.target.checked);
              if (highlightApproval) setHighlightApproval(false);
            }}
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
            <span>I have reviewed the extracted contacts and <strong>explicitly approve</strong> importing these {selectedCount} contacts for outreach.</span>
            <div
              style={{
                fontSize: 11,
                color: highlightApproval ? 'var(--accent-warning)' : 'var(--text-muted)',
                fontWeight: highlightApproval ? 700 : 400,
                marginTop: 2
              }}
            >
              {highlightApproval
                ? '⚠️ You must check this box before contacts can be imported.'
                : 'No emails are generated or sent until you approve.'}
            </div>
          </label>
        </div>

        {/* 7. Footer (fixed) */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Selected: <strong style={{ color: selectedCount > 0 ? 'var(--accent-success)' : 'var(--text-muted)' }}>{selectedCount}</strong> of {validCount} ready contacts
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>

            <button
              className="btn btn-primary"
              onClick={handleApproveAndConfirm}
              disabled={selectedCount === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: isExplicitlyApproved && selectedCount > 0
                  ? 'var(--primary-gradient)'
                  : selectedCount > 0
                  ? 'var(--bg-surface-elevated)'
                  : 'var(--bg-tertiary)',
                color: isExplicitlyApproved && selectedCount > 0
                  ? '#fff'
                  : selectedCount > 0
                  ? 'var(--text-primary)'
                  : 'var(--text-muted)',
                border: selectedCount > 0 && !isExplicitlyApproved ? '1px solid var(--accent-warning)' : undefined,
                boxShadow: isExplicitlyApproved && selectedCount > 0 ? '0 4px 14px var(--primary-glow)' : 'none',
                cursor: selectedCount === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <CheckCircle size={16} />
              Approve & Import {selectedCount} Contacts
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalMarkup, document.body);
}
