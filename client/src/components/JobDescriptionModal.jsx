import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, X, Sparkles, Check } from 'lucide-react';

export default function JobDescriptionModal({
  isOpen,
  onClose,
  jobDescription = '',
  onSaveJd,
  onShowToast
}) {
  const [localJd, setLocalJd] = useState(jobDescription || '');
  const [prevProps, setPrevProps] = useState({ isOpen, jobDescription });

  if (prevProps.isOpen !== isOpen || prevProps.jobDescription !== jobDescription) {
    setPrevProps({ isOpen, jobDescription });
    if (isOpen) {
      setLocalJd(jobDescription || '');
    }
  }

  if (!isOpen) return null;

  const charCount = localJd.length;
  const wordCount = localJd.trim() ? localJd.trim().split(/\s+/).filter(Boolean).length : 0;

  const handleSave = () => {
    if (onSaveJd) {
      onSaveJd(localJd);
    }
    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Job Description Saved',
        message: localJd.trim()
          ? 'Target job description set for outreach emails.'
          : 'Job description cleared. Direct value pitch will be used.'
      });
    }
    onClose();
  };

  const modalMarkup = (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 640 }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="jd-modal-title"
      >
        <div className="modal-header">
          <div className="modal-title" id="jd-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(37, 99, 235, 0.12)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileText size={18} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Target Job Description</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>
                Enter the job description for your uploaded Excel recipients
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px' }}>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label
              htmlFor="excel-jd-textarea"
              className="form-label"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>Job Description / Role Requirements</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {wordCount} words • {charCount} chars
              </span>
            </label>
            <textarea
              id="excel-jd-textarea"
              className="form-textarea"
              style={{
                minHeight: 180,
                width: '100%',
                resize: 'vertical',
                lineHeight: 1.5,
                fontSize: 13
              }}
              placeholder="Paste target job description, responsibilities, or role requirements here..."
              value={localJd}
              onChange={e => setLocalJd(e.target.value)}
              autoFocus
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <span>AI will align candidate skills with these requirements in cold emails.</span>
          </div>
        </div>

        <div
          className="modal-footer"
          style={{
            padding: '14px 20px',
            background: 'var(--bg-surface-elevated)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Skip for Now
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
          >
            <Check size={16} />
            Save Job Description
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalMarkup, document.body);
}
