import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Mail,
  Sliders,
  FileText,
  AlertTriangle
} from 'lucide-react';
import AiProvidersTab from './settings/AiProvidersTab';
import SmtpAccountsTab from './settings/SmtpAccountsTab';
import PreferencesTab from './settings/PreferencesTab';
import AuditLogsTab from './settings/AuditLogsTab';
import DangerZoneTab from './settings/DangerZoneTab';

/**
 * SettingsModal — Modular slide-over shell managing application settings tabs.
 * Decomposed into dedicated tab modules (TICK-CYC3-09 / B3).
 */
export default function SettingsModal({
  isOpen,
  onClose,
  initialTab = 'ai',
  config,
  onRefreshConfig,
  onShowToast,
  user
}) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'ai' | 'smtp' | 'preferences' | 'logs' | 'danger'
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);

  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setActiveTab(initialTab);
  }

  if (!isOpen) return null;

  return (
    <div className="slideover-overlay" onClick={onClose}>
      <aside className="slideover-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="slideover-header">
          <div className="modal-title">
            <Sliders size={18} style={{ color: 'var(--accent-primary)' }} />
            <span>Settings & Preferences</span>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="slideover-tabs">
          <button
            type="button"
            className={`slideover-tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            <Sparkles size={14} />
            AI Providers
          </button>
          <button
            type="button"
            className={`slideover-tab-btn ${activeTab === 'smtp' ? 'active' : ''}`}
            onClick={() => setActiveTab('smtp')}
          >
            <Mail size={14} />
            SMTP
          </button>
          <button
            type="button"
            className={`slideover-tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            <Sliders size={14} />
            Preferences
          </button>
          <button
            type="button"
            className={`slideover-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <FileText size={14} />
            Logs
          </button>
          <button
            type="button"
            className={`slideover-tab-btn danger-tab ${activeTab === 'danger' ? 'active' : ''}`}
            onClick={() => setActiveTab('danger')}
          >
            <AlertTriangle size={14} />
            Danger Zone
          </button>
        </div>

        {/* Tab Body */}
        <div className="slideover-body">
          {activeTab === 'ai' && (
            <AiProvidersTab
              config={config}
              onRefreshConfig={onRefreshConfig}
              onShowToast={onShowToast}
              user={user}
            />
          )}

          {activeTab === 'smtp' && (
            <SmtpAccountsTab
              config={config}
              onRefreshConfig={onRefreshConfig}
              onShowToast={onShowToast}
              user={user}
            />
          )}

          {activeTab === 'preferences' && (
            <PreferencesTab
              config={config}
              onRefreshConfig={onRefreshConfig}
              user={user}
              onShowToast={onShowToast}
            />
          )}

          {activeTab === 'logs' && (
            <AuditLogsTab
              onShowToast={onShowToast}
            />
          )}

          {activeTab === 'danger' && (
            <DangerZoneTab
              user={user}
              onRefreshConfig={onRefreshConfig}
              onShowToast={onShowToast}
              onClose={onClose}
            />
          )}
        </div>
      </aside>
    </div>
  );
}
