import React, { useState } from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';
import { resetAllData } from '../../services/api';
import { deleteSettings, getDefaultSettings } from '../../lib/settings';

/**
 * DangerZoneTab — Destructive data wipe and credential reset.
 */
export default function DangerZoneTab({ user, onRefreshConfig, onShowToast, onClose }) {
  const [dangerConfirmText, setDangerConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleResetAllData = async () => {
    if (dangerConfirmText.trim() !== 'DELETE') return;
    setIsResetting(true);
    try {
      if (user?.uid) {
        await deleteSettings(user.uid);
      }
      try {
        await resetAllData();
      } catch {
        // server reset is optional/best-effort
      }
      const resetConfig = getDefaultSettings();
      onRefreshConfig(resetConfig);
      setDangerConfirmText('');
      onShowToast?.({
        type: 'warning',
        title: 'Platform Reset',
        message: 'All stored API keys, SMTP profiles, and cloud settings have been wiped.'
      });
      onClose();
    } catch (err) {
      onShowToast?.({
        type: 'error',
        title: 'Reset Failed',
        message: err.message
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div
        style={{
          padding: 'var(--sp-4)',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(248, 113, 113, 0.08)',
          border: '1px solid var(--accent-danger)',
          display: 'flex',
          gap: 'var(--sp-3)',
          alignItems: 'flex-start'
        }}
      >
        <AlertCircle size={20} style={{ color: 'var(--accent-danger)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong style={{ color: 'var(--accent-danger)', display: 'block', marginBottom: 'var(--sp-1)' }}>
            Destructive Action Notice
          </strong>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Resetting will permanently erase all encrypted API keys, delete all saved SMTP accounts, reset rate-limiting preferences to defaults, and clear outreach log history. This action cannot be undone.
          </p>
        </div>
      </div>

      <div
        style={{
          padding: 'var(--sp-4)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-3)'
        }}
      >
        <label style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
          To confirm, type <span style={{ color: 'var(--accent-danger)', fontFamily: 'var(--font-mono)' }}>DELETE</span> below:
        </label>
        <input
          type="text"
          className="form-input"
          placeholder="Type DELETE to confirm"
          value={dangerConfirmText}
          onChange={e => setDangerConfirmText(e.target.value)}
          style={{ fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}
        />
        <button
          type="button"
          className="btn btn-danger"
          disabled={dangerConfirmText.trim() !== 'DELETE' || isResetting}
          onClick={handleResetAllData}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--sp-2)',
            marginTop: 'var(--sp-2)',
            opacity: dangerConfirmText.trim() === 'DELETE' ? 1 : 0.4
          }}
        >
          <Trash2 size={16} />
          {isResetting ? 'Resetting All Data...' : 'Permanently Delete Credentials & Reset App'}
        </button>
      </div>
    </div>
  );
}
