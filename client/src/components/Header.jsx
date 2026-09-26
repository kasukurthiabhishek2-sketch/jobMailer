import React from 'react';
import { Send, Settings, Sparkles, Mail, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function Header({ config, onOpenSettings, onOpenLogs }) {
  const activeAiKey = config?.activeProvider || 'gemini';
  const activeAi = config?.aiProviders?.[activeAiKey];
  const activeAiConfigured = activeAi?.isConfigured;

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

          {/* Settings Button */}
          <button
            className="btn-icon"
            onClick={() => onOpenSettings('ai')}
            title="Settings (AI Keys, SMTP Profiles, Guides)"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
