import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Square, AlertCircle, Search, Users, Check } from 'lucide-react';

export default function RecipientModal({ isOpen, onClose, sheetData, onConfirmSelection }) {
  if (!isOpen || !sheetData) return null;

  const [rows, setRows] = useState(sheetData.rows || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastClickedIndex, setLastClickedIndex] = useState(null);

  useEffect(() => {
    setRows(sheetData.rows || []);
  }, [sheetData]);

  // Filter rows by search term
  const filteredRows = rows.filter(r => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (r.name && r.name.toLowerCase().includes(term)) ||
      (r.email && r.email.toLowerCase().includes(term)) ||
      (r.company && r.company.toLowerCase().includes(term)) ||
      (r.role && r.role.toLowerCase().includes(term))
    );
  });

  const selectedCount = rows.filter(r => r.isSelected).length;
  const totalCount = rows.length;
  const validCount = rows.filter(r => r.isValidEmail).length;
  const invalidCount = totalCount - validCount;

  // Toggle individual row with Shift-click range support
  const handleToggleRow = (indexInFiltered, e) => {
    const targetRow = filteredRows[indexInFiltered];
    const targetRealIndex = rows.findIndex(r => r.id === targetRow.id);

    if (e.shiftKey && lastClickedIndex !== null) {
      // Range selection
      const start = Math.min(lastClickedIndex, targetRealIndex);
      const end = Math.max(lastClickedIndex, targetRealIndex);
      const targetState = !targetRow.isSelected;

      setRows(prev =>
        prev.map((row, i) => {
          if (i >= start && i <= end) {
            // Only toggle valid emails during bulk range selection
            return { ...row, isSelected: row.isValidEmail ? targetState : false };
          }
          return row;
        })
      );
    } else {
      // Single toggle
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

  // Are all filtered valid rows selected?
  const allFilteredValidSelected =
    filteredRows.filter(r => r.isValidEmail).length > 0 &&
    filteredRows.filter(r => r.isValidEmail).every(r => r.isSelected);

  const handleConfirm = () => {
    const selectedRows = rows.filter(r => r.isSelected);
    onConfirmSelection(selectedRows);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 940 }}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <Users size={20} style={{ color: 'var(--primary-light)' }} />
            <span>Review & Select Recipients from Spreadsheet</span>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Summary Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-tertiary)',
              padding: '12px 18px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                File: <strong>{sheetData.filename}</strong>
              </span>
              <span className="info-pill">
                <strong>{selectedCount}</strong> of <strong>{totalCount}</strong> selected
              </span>
              {invalidCount > 0 && (
                <span className="email-invalid-tag">
                  <AlertCircle size={12} />
                  {invalidCount} invalid excluded
                </span>
              )}
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: 220 }}>
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
                placeholder="Search name, company, email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="form-input"
                style={{ paddingLeft: 30, fontSize: 12, height: 34 }}
              />
            </div>
          </div>

          {/* Table */}
          <div className="data-table-wrapper">
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
                    />
                  </th>
                  <th>#</th>
                  <th>Contact Name</th>
                  <th>Email Address</th>
                  <th>Company / Firm</th>
                  <th>Target Role / Title</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                      No recipients matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => {
                    const isInvalid = !row.isValidEmail;
                    return (
                      <tr
                        key={row.id}
                        className={isInvalid ? 'row-invalid' : ''}
                        onClick={e => {
                          // Allow clicking anywhere on row to toggle if valid
                          if (!isInvalid) handleToggleRow(idx, e);
                        }}
                        style={{ cursor: isInvalid ? 'default' : 'pointer' }}
                      >
                        <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={row.isSelected}
                            disabled={isInvalid}
                            onChange={e => handleToggleRow(idx, e)}
                            style={{ cursor: isInvalid ? 'not-allowed' : 'pointer', transform: 'scale(1.15)' }}
                          />
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{row.rowIndex}</td>
                        <td style={{ fontWeight: 600 }}>{row.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                          {row.email || <span style={{ color: 'var(--text-muted)' }}>[Empty]</span>}
                        </td>
                        <td>{row.company || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                        <td>{row.role || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                        <td>
                          {isInvalid ? (
                            <span className="email-invalid-tag" title={row.errorReason}>
                              <AlertCircle size={11} /> {row.errorReason}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--success)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Check size={13} /> Valid
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

          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
            💡 Tip: Hold <kbd style={{ padding: '2px 4px', background: 'var(--bg-tertiary)', borderRadius: 3 }}>Shift</kbd> while clicking checkboxes to select multiple rows at once.
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={selectedCount === 0}
          >
            Confirm & Add {selectedCount} Recipients
          </button>
        </div>
      </div>
    </div>
  );
}
