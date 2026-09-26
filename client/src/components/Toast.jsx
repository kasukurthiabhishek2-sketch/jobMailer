import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => {
        let Icon = Info;
        if (toast.type === 'success') Icon = CheckCircle2;
        if (toast.type === 'error') Icon = AlertCircle;

        return (
          <div key={toast.id} className={`toast ${toast.type || 'info'}`}>
            <Icon size={18} style={{
              color: toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#818cf8',
              flexShrink: 0
            }} />
            <div style={{ flex: 1 }}>
              {toast.title && <div style={{ fontWeight: 600, marginBottom: 2 }}>{toast.title}</div>}
              <div>{toast.message}</div>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 2
              }}
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
