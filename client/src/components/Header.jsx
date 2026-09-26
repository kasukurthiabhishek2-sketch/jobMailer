import React, { useState } from 'react';
import { Send, Settings, Sparkles, Mail, FileText, Sun, Moon, HelpCircle, X } from 'lucide-react';

export default function Header({ config, onOpenSettings, onOpenLogs, theme, onToggleTheme }) {
  const [showQuickStart, setShowQuickStart] = useState(false);

  const activeAiKey = config?.activeProvider || 'gemini';
  const activeAi = config?.aiProviders?.[activeAiKey];
  const activeAiConfigured = Boolean(activeAi?.isConfigured);

  const defaultSmtp = (config?.smtpProfiles || []).find(p => p.isDefault) || config?.smtpProfiles?.[0];
  const smtpConfigured = Boolean(defaultSmtp && defaultSmtp.isConfigured);

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="logo-group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="logo-icon-box">
            <Send size={22} style={{ transform: 'rotate(-20deg)' }} />
          </div>
          <div className="logo-text">
            <h1>
              JDMail <span className="logo-tag">AI Outreach</span>
            </h1>
            <div className="logo-subtitle">Cold Job Outreach & Tailored Application Engine</div>
          </div>
        </div>

        <div className="header-actions">
          {/* Active AI Status Pill */}
          <div
            className="status-badge-chip"
            onClick={() => onOpenSettings('ai')}
            title="Click to manage AI Providers"
          >
            <Sparkles size={14} style={{ color: 'var(--primary-light)' }} />
            <span>AI: {activeAi?.name || 'Gemini'} ({activeAi?.model || '1.5-flash'})</span>
            <span
              className={`status-dot ${activeAiConfigured ? 'active' : 'warning'}`}
              title={activeAiConfigured ? 'API Key Configured' : 'API Key Missing'}
            />
          </div>

          {/* Active SMTP Status Pill */}
          <div
            className="status-badge-chip"
            onClick={() => onOpenSettings('smtp')}
            title="Click to manage SMTP Accounts"
          >
            <Mail size={14} style={{ color: 'var(--accent-cyan)' }} />
            <span>
              SMTP: {defaultSmtp ? `${defaultSmtp.name}` : 'Not Configured'}
            </span>
            <span
              className={`status-dot ${smtpConfigured ? 'active' : 'warning'}`}
              title={smtpConfigured ? 'SMTP Ready' : 'SMTP Credentials Needed'}
            />
          </div>

          {/* Activity Logs Button */}
          <button
            className="btn-icon"
            onClick={onOpenLogs}
            title="View Delivery History & Status Logs"
          >
            <FileText size={18} />
          </button>

          {/* Theme Toggle Button */}
          <button
            className="btn-icon"
            onClick={onToggleTheme}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {/* Quick-Start Help Button */}
          <button
            className="btn-icon"
            onClick={() => setShowQuickStart(true)}
            title="Quick-Start Guide & Help"
            aria-label="Quick-start help guide"
          >
            <HelpCircle size={18} />
          </button>

          {/* Settings Slide-over Button */}
          <button
            className="btn-icon"
            onClick={() => onOpenSettings('ai')}
            title="Settings (AI Keys, SMTP, Preferences, Danger Zone)"
            aria-label="Open settings panel"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* In-App Quick Start Guide Modal */}
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
              <div className="quickstart-card">
                <div className="quickstart-number">1</div>
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: 2 }}>
                    Resume & AI Setup
                  </strong>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Upload your resume (.pdf or .docx). Configure and test at least one AI provider (Gemini, Groq, OpenAI, or Copilot) to generate personalized outreach.
                  </span>
                </div>
              </div>

              <div className="quickstart-card">
                <div className="quickstart-number">2</div>
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: 2 }}>
                    Recipient Management
                  </strong>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Import recruiters and hiring managers from Excel/CSV or add them manually. RFC-standard validation highlights formatting errors automatically.
                  </span>
                </div>
              </div>

              <div className="quickstart-card">
                <div className="quickstart-number">3</div>
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: 2 }}>
                    Tailored Job Description (Optional)
                  </strong>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Paste a specific job description to spotlight relevant skills and metrics, or skip to generate a high-impact intro pitch.
                  </span>
                </div>
              </div>

              <div className="quickstart-card">
                <div className="quickstart-number">4</div>
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: 2 }}>
                    Review, Polish & Safe Send
                  </strong>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Scan and refine drafts in the split-pane editor, then dispatch safely with anti-spam rate limiting and real-time delivery logs.
                  </span>
                </div>
              </div>
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
    </header>
  );
}
