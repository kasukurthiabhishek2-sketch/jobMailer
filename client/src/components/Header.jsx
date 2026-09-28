import { useState } from 'react';
import { Send, Settings, Sparkles, Mail, FileText, Sun, Moon, HelpCircle, X, LogOut } from 'lucide-react';
import { WIZARD_STEPS } from '../constants/wizardSteps';

export default function Header({ config, onOpenSettings, onOpenLogs, theme, onToggleTheme, user, onSignOut }) {
  const [showQuickStart, setShowQuickStart] = useState(false);

  const activeAiKey = config?.activeProvider || 'gemini';
  const activeAi = config?.aiProviders?.[activeAiKey];
  const activeAiConfigured = Boolean(
    activeAi?.isConfigured ||
    (activeAi?.apiKey && activeAi.apiKey.trim().length > 0) ||
    (activeAiKey === 'copilot' && (activeAi?.connected || activeAi?.isConfigured))
  );

  const getAiTooltip = () => {
    if (activeAiKey === 'copilot') {
      return activeAiConfigured ? 'GitHub Copilot Connected' : 'GitHub Copilot Needs Verification';
    }
    return activeAiConfigured ? 'API Key Configured' : 'API Key Missing';
  };

  const defaultSmtp = (config?.smtpProfiles || []).find(p => p.isDefault) || config?.smtpProfiles?.[0];
  const smtpConfigured = Boolean(defaultSmtp && (defaultSmtp.isConfigured || defaultSmtp.password || defaultSmtp.appPassword));

  return (
    <aside className="app-sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="logo-icon-box" style={{ width: 36, height: 36 }}>
          <Send size={18} style={{ transform: 'rotate(-20deg)' }} />
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">JDMail</span>
          <span className="logo-tag">AI</span>
        </div>
      </div>

      {/* Status pills */}
      <div className="sidebar-section">
        <div
          className="sidebar-status-pill"
          onClick={() => onOpenSettings('ai')}
          title="Click to manage AI Providers"
        >
          <Sparkles size={14} style={{ color: 'var(--primary-light)' }} />
          <div className="sidebar-status-text">
            <span className="sidebar-status-label">AI Provider</span>
            <span className="sidebar-status-value">{activeAi?.name || 'Gemini'}</span>
          </div>
          <span
            className={`status-dot ${activeAiConfigured ? 'active' : 'warning'}`}
            title={getAiTooltip()}
          />
        </div>

        <div
          className="sidebar-status-pill"
          onClick={() => onOpenSettings('smtp')}
          title="Click to manage SMTP Accounts"
        >
          <Mail size={14} style={{ color: 'var(--accent-cyan)' }} />
          <div className="sidebar-status-text">
            <span className="sidebar-status-label">SMTP</span>
            <span className="sidebar-status-value">
              {defaultSmtp ? defaultSmtp.name : 'Not Set'}
            </span>
          </div>
          <span
            className={`status-dot ${smtpConfigured ? 'active' : 'warning'}`}
            title={smtpConfigured ? 'SMTP Ready' : 'SMTP Credentials Needed'}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="sidebar-actions">
        <button
          className="sidebar-action-btn"
          onClick={() => onOpenSettings('ai')}
          title="Settings"
          aria-label="Open settings panel"
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>
        <button
          className="sidebar-action-btn"
          onClick={onOpenLogs}
          title="Delivery Logs"
        >
          <FileText size={16} />
          <span>Logs</span>
        </button>
        <button
          className="sidebar-action-btn"
          onClick={() => setShowQuickStart(true)}
          title="Quick-Start Guide"
          aria-label="Quick-start help guide"
        >
          <HelpCircle size={16} />
          <span>Help</span>
        </button>
        <button
          className="sidebar-action-btn"
          onClick={onToggleTheme}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
        </button>
      </div>

      {/* Spacer pushes user profile to bottom */}
      <div style={{ flex: 1 }} />

      {/* User profile */}
      {user && (
        <div className="sidebar-user">
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.displayName || 'User'} className="user-avatar" />
          ) : (
            <div className="user-avatar-placeholder">
              {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user.displayName || user.email?.split('@')[0]}</span>
          </div>
          <button
            className="btn-icon btn-signout"
            onClick={onSignOut}
            title="Sign out"
            aria-label="Sign out"
            style={{ width: 28, height: 28, marginLeft: 'auto' }}
          >
            <LogOut size={14} />
          </button>
        </div>
      )}

      {/* Quick Start Guide Modal */}
      {showQuickStart && (
        <div className="modal-overlay" onClick={() => setShowQuickStart(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div className="modal-title">
                <Sparkles size={20} style={{ color: 'var(--accent-primary)' }} />
                <span>JDMail Quick-Start Guide</span>
              </div>
              <button
                className="btn-icon"
                onClick={() => setShowQuickStart(false)}
                aria-label="Close help guide"
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {WIZARD_STEPS.map((step) => (
                <div key={step.id} className="quickstart-card">
                  <div className="quickstart-number">{step.stepNumber}</div>
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: 2 }}>
                      {step.label} {step.optional ? '(Optional)' : ''}
                    </strong>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {step.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={() => setShowQuickStart(false)}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
