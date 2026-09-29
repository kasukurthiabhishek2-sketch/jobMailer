import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Mail,
  Sliders,
  FileText,
  AlertTriangle,
  Terminal,
} from 'lucide-react';
import AiProvidersTab from './settings/AiProvidersTab';
import SmtpAccountsTab from './settings/SmtpAccountsTab';
import PreferencesTab from './settings/PreferencesTab';
import AuditLogsTab from './settings/AuditLogsTab';
import DangerZoneTab from './settings/DangerZoneTab';
import CustomPromptsTab from './settings/CustomPromptsTab';

const SETTINGS_TABS = [
  { key: 'ai', label: 'AI Providers', icon: Sparkles },
  { key: 'prompts', label: 'AI Prompts', icon: Terminal },
  { key: 'smtp', label: 'Email (SMTP)', icon: Mail },
  { key: 'preferences', label: 'Preferences', icon: Sliders },
  { key: 'logs', label: 'Activity Logs', icon: FileText },
  { key: 'danger', label: 'Danger Zone', icon: AlertTriangle }
];

export default function SettingsModal({
  isOpen,
  onClose,
  initialTab = 'ai',
  config,
  onRefreshConfig,
  onShowToast,
  user
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);

  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setActiveTab(initialTab);
  }

  if (!isOpen) return null;

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="slideover-overlay" onClick={onClose} role="presentation">
      <aside
        className="slideover-panel settings-redesign"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        onKeyDown={handleKeyDown}
      >
        <div className="settings-layout">
          {/* Left sidebar navigation */}
          <div className="settings-sidebar">
            <div className="settings-sidebar-header" id="settings-dialog-title">
              Settings & Preferences
            </div>
            <nav className="settings-nav" aria-label="Settings sections">
              {SETTINGS_TABS.map(tab => {
                const Icon = tab.icon;
                const isDanger = tab.key === 'danger';
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    className={`settings-nav-item ${isActive ? 'active' : ''} ${isDanger ? 'danger' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right content area */}
          <div className="settings-content">
            <div className="settings-content-header">
              <h2 className="settings-content-title">
                {SETTINGS_TABS.find(t => t.key === activeTab)?.label}
              </h2>
              <button className="btn-icon" onClick={onClose} aria-label="Close settings">
                <X size={18} />
              </button>
            </div>
            <div className="settings-content-body">
              {activeTab === 'ai' && (
                <AiProvidersTab
                  config={config}
                  onRefreshConfig={onRefreshConfig}
                  onShowToast={onShowToast}
                  user={user}
                />
              )}
              {activeTab === 'prompts' && (
                <CustomPromptsTab
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
                <AuditLogsTab onShowToast={onShowToast} />
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
          </div>
        </div>
      </aside>
    </div>
  );
}
