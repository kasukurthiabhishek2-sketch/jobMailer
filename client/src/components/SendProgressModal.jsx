import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  X,
  Minimize2,
  Maximize2
} from 'lucide-react';

/**
 * SendProgressModal — Live campaign dispatch monitor.
 * Supports full-screen modal inspect mode and bottom-right minimized floating dock (TICK-CYC3-19 / C10).
 */
export default function SendProgressModal({
  isOpen,
  onClose,
  isSending,
  progressData, // { current, total, recipientEmail, status }
  throttlingData, // { waitingSeconds, nextIndex }
  sendLogs, // array of completed log items
  summaryData // { total, sentCount, failedCount }
}) {
  const [isMinimized, setIsMinimized] = useState(false);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setIsMinimized(false);
    }
  }

  if (!isOpen) return null;

  const total = progressData?.total || summaryData?.total || 1;
  const current = progressData?.current || summaryData?.total || 0;
  const percent = Math.min(100, Math.round((current / total) * 100));

  // Minimized Floating Pill Dock (TICK-CYC3-19 / C10)
  if (isMinimized) {
    return (
      <aside
        className="glass-card"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1050,
          width: 340,
          maxWidth: 'calc(100vw - 32px)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
          border: '1px solid var(--border-glow)',
          background: 'var(--bg-surface-elevated)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}
        aria-label="Campaign Dispatch Progress"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isSending ? (
              <RefreshCw size={16} className="spin-icon" style={{ color: 'var(--accent-primary)' }} />
            ) : (
              <CheckCircle2 size={16} style={{ color: 'var(--accent-success)' }} />
            )}
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              {isSending ? `Sending (${current}/${total})` : 'Campaign Complete'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              className="btn-icon"
              onClick={() => setIsMinimized(false)}
              title="Expand progress details"
              aria-label="Expand progress modal"
              style={{ width: 28, height: 28 }}
            >
              <Maximize2 size={14} />
            </button>
            {!isSending && (
              <button
                type="button"
                className="btn-icon"
                onClick={onClose}
                title="Dismiss"
                aria-label="Close"
                style={{ width: 28, height: 28 }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Compact Progress Bar */}
        <div className="progress-bar-container" style={{ height: 6, margin: '2px 0' }}>
          <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
          <span>
            {throttlingData && isSending
              ? `Throttling: ${throttlingData.waitingSeconds}s`
              : progressData?.recipientEmail || (isSending ? 'Dispatching...' : `${summaryData?.sentCount || current} sent`)}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{percent}%</span>
        </div>
      </aside>
    );
  }

  // Full Expanded Modal View
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 720 }}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            {isSending ? (
              <RefreshCw size={20} className="spin-icon" style={{ color: 'var(--primary-light)' }} />
            ) : (
              <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
            )}
            <span>{isSending ? 'Sending Cold Emails...' : 'Outreach Campaign Complete'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="btn-icon"
              onClick={() => setIsMinimized(true)}
              title="Minimize progress to bottom-right"
              aria-label="Minimize progress modal"
            >
              <Minimize2 size={16} />
            </button>
            {!isSending && (
              <button className="btn-icon" onClick={onClose} aria-label="Close modal">
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Progress Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {isSending ? `Dispatching ${current} of ${total}` : `All ${total} emails processed`}
            </span>
            <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--primary-light)' }}>
              {percent}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
          </div>

          {/* Throttling Anti-Spam Notification */}
          {throttlingData && isSending && (
            <div
              className="throttling-indicator"
              style={
                throttlingData.isSlowdown
                  ? { borderColor: 'rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.08)', color: 'var(--accent-warning)' }
                  : undefined
              }
            >
              <Clock size={14} className="spin-icon" style={{ color: throttlingData.isSlowdown ? 'var(--accent-warning)' : undefined }} />
              <span>
                {throttlingData.reason || `Anti-Spam Safety Throttle: Waiting ${throttlingData.waitingSeconds}s before next send to preserve domain reputation...`}
              </span>
            </div>
          )}

          {/* Completed Summary (if finished) */}
          {summaryData && !isSending && (
            <div
              style={{
                display: 'flex',
                gap: 12,
                margin: '16px 0',
                padding: 14,
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{summaryData.total}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Targeted</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', borderInline: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>{summaryData.sentCount}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Successfully Sent</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: summaryData.failedCount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {summaryData.failedCount}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Failed</div>
              </div>
            </div>
          )}

          {/* Real-time Send Log */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Real-Time Delivery Logs:
            </div>
            <div
              style={{
                maxHeight: 250,
                overflowY: 'auto',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-secondary)',
                fontSize: 12
              }}
            >
              {sendLogs && sendLogs.length > 0 ? (
                sendLogs.map(item => (
                  <div
                    key={item.id}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      {item.status === 'sent' ? (
                        <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                      ) : (
                        <AlertCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                      )}
                      <div style={{ minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.recipientName || 'Contact'} ({item.recipientEmail})
                        </div>
                        {item.company && (
                          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{item.company}</div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {item.smtpResponseCode && (
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            padding: '2px 5px',
                            borderRadius: 3,
                            fontWeight: 700,
                            background: item.status === 'sent'
                              ? 'rgba(52, 211, 153, 0.12)'
                              : (item.smtpResponseCode >= 400 && item.smtpResponseCode < 500 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)'),
                            color: item.status === 'sent'
                              ? 'var(--accent-success)'
                              : (item.smtpResponseCode >= 400 && item.smtpResponseCode < 500 ? 'var(--accent-warning)' : 'var(--accent-danger)'),
                            border: '1px solid currentColor'
                          }}
                          title={item.smtpResponse || ''}
                        >
                          {item.smtpResponseCode}
                        </span>
                      )}

                      {item.status === 'sent' ? (
                        <span
                          style={{
                            color: 'var(--success)',
                            background: 'var(--success-bg)',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontWeight: 600
                          }}
                          title={item.smtpResponse || '250 OK'}
                        >
                          Sent
                        </span>
                      ) : (
                        <span
                          style={{
                            color: '#f87171',
                            background: 'var(--danger-bg)',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontWeight: 600
                          }}
                          title={item.smtpResponse || item.error}
                        >
                          Failed: {item.error ? item.error.slice(0, 24) + '...' : 'Error'}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Awaiting delivery activity...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose} disabled={isSending}>
            {isSending ? 'Sending in Progress...' : 'Close & View Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
