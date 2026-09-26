import React from 'react';
import { CheckCircle2, AlertCircle, Clock, RefreshCw, X, ShieldAlert } from 'lucide-react';

export default function SendProgressModal({
  isOpen,
  onClose,
  isSending,
  progressData, // { current, total, recipientEmail, status }
  throttlingData, // { waitingSeconds, nextIndex }
  sendLogs, // array of completed log items
  summaryData // { total, sentCount, failedCount }
}) {
  if (!isOpen) return null;

  const total = progressData?.total || summaryData?.total || 1;
  const current = progressData?.current || summaryData?.total || 0;
  const percent = Math.min(100, Math.round((current / total) * 100));

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
          {!isSending && (
            <button className="btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Progress Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
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
            <div className="throttling-indicator">
              <Clock size={14} className="spin-icon" />
              <span>
                Anti-Spam Safety Throttle: Waiting {throttlingData.waitingSeconds}s before next send to preserve domain reputation...
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
                <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{summaryData.total}</div>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {item.status === 'sent' ? (
                        <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                      ) : (
                        <AlertCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                      )}
                      <div>
                        <div style={{ fontWeight: 600, color: '#fff' }}>
                          {item.recipientName || 'Contact'} ({item.recipientEmail})
                        </div>
                        {item.company && (
                          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{item.company}</div>
                        )}
                      </div>
                    </div>

                    <div>
                      {item.status === 'sent' ? (
                        <span
                          style={{
                            color: 'var(--success)',
                            background: 'var(--success-bg)',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontWeight: 600
                          }}
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
                          title={item.error}
                        >
                          Failed: {item.error ? item.error.slice(0, 30) + '...' : 'Error'}
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
