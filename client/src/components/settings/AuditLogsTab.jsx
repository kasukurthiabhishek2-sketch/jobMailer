import React, { useState, useEffect } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { fetchOutreachLogs, clearOutreachLogs } from '../../services/api';

/**
 * AuditLogsTab — Dispatched email campaign history and status audit logs.
 */
export default function AuditLogsTab({ onShowToast }) {
  const [logs, setLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchOutreachLogs()
      .then(fetched => {
        if (mounted) setLogs(fetched || []);
      })
      .catch(err => {
        console.error('Failed fetching logs:', err);
      })
      .finally(() => {
        if (mounted) setIsLoadingLogs(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleClearLogs = async () => {
    try {
      await clearOutreachLogs();
      setLogs([]);
      onShowToast?.({ type: 'info', title: 'Logs Cleared', message: 'Campaign logs cleared.' });
    } catch (e) {
      onShowToast?.({ type: 'error', title: 'Error', message: e.message });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Outreach Delivery Logs</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Complete audit trail of all cold outreach dispatched through this system.
          </div>
        </div>

        {logs.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={handleClearLogs}>
            Clear Logs History
          </button>
        )}
      </div>

      {isLoadingLogs ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 8px auto' }} />
          <div>Loading activity logs...</div>
        </div>
      ) : logs.length > 0 ? (
        <div className="data-table-wrapper" style={{ maxHeight: 380 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Recipient</th>
                <th>Company</th>
                <th>Subject</th>
                <th>Status</th>
                <th>SMTP Response</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {log.recipientEmail}
                  </td>
                  <td>{log.company || '—'}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.subject}
                  </td>
                  <td>
                    {log.status === 'sent' ? (
                      <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 12 }}>
                        ✓ Sent
                      </span>
                    ) : (
                      <span style={{ color: '#f87171', fontWeight: 600, fontSize: 12 }} title={log.error}>
                        ✕ Failed
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: log.status === 'sent'
                            ? 'rgba(52, 211, 153, 0.12)'
                            : (log.smtpResponseCode >= 400 && log.smtpResponseCode < 500 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)'),
                          color: log.status === 'sent'
                            ? 'var(--accent-success)'
                            : (log.smtpResponseCode >= 400 && log.smtpResponseCode < 500 ? 'var(--accent-warning)' : 'var(--accent-danger)')
                        }}
                      >
                        {log.smtpResponseCode || (log.status === 'sent' ? 250 : 500)}
                      </span>
                      <span
                        style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={log.smtpResponse || log.error || ''}
                      >
                        {log.smtpResponse || (log.status === 'sent' ? '250 OK' : (log.error || 'Failed'))}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <FileText className="empty-state-icon" />
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No Outreach Dispatched Yet</div>
          <div style={{ fontSize: 13 }}>Your sent email activity and delivery status will appear here.</div>
        </div>
      )}
    </div>
  );
}
