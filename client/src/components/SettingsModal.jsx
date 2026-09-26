import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Mail,
  Sliders,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  Trash2,
  Check,
  RefreshCw,
  Plus,
  Shield,
  Server,
  Copy,
  ExternalLink
} from 'lucide-react';
import {
  saveAiProviderConfig,
  setActiveAiProvider,
  testAiConnection,
  saveSmtpProfile,
  deleteSmtpProfile,
  setDefaultSmtpProfile,
  testSmtpConnection,
  savePreferences,
  fetchOutreachLogs,
  clearOutreachLogs,
  startCopilotAuth,
  checkCopilotStatus,
  resetAllData
} from '../services/api';
import SmtpGuideModal from './SmtpGuideModal';

export default function SettingsModal({
  isOpen,
  onClose,
  initialTab = 'ai',
  config,
  onRefreshConfig,
  onShowToast
}) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'ai' | 'smtp' | 'preferences' | 'logs' | 'danger'
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Danger Zone state
  const [dangerConfirmText, setDangerConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // AI settings edit states
  const [editingKeys, setEditingKeys] = useState({}); // { [providerKey]: inputApiKey }
  const [editingModels, setEditingModels] = useState({});
  const [editingBaseUrls, setEditingBaseUrls] = useState({});
  const [aiTestStatus, setAiTestStatus] = useState({}); // { [providerKey]: { loading, success, message, error } }

  // Logs state
  const [logs, setLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Sync activeTab when initialTab changes
  useEffect(() => {
    setActiveTab(initialTab);
    if (initialTab === 'logs') {
      setIsLoadingLogs(true);
      fetchOutreachLogs()
        .then(setLogs)
        .catch(console.error)
        .finally(() => setIsLoadingLogs(false));
    }
  }, [initialTab]);

  // Copilot Device Code Auth State
  const [copilotFlow, setCopilotFlow] = useState({
    active: false,
    deviceCode: '',
    userCode: '',
    verificationUri: '',
    expiresIn: 0,
    polling: false,
    copied: false,
    error: null
  });
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  const handleStartCopilotAuth = async () => {
    try {
      setCopilotFlow({ active: true, deviceCode: '', userCode: '', verificationUri: '', polling: true, copied: false, error: null });
      const data = await startCopilotAuth();
      setCopilotFlow(prev => ({
        ...prev,
        deviceCode: data.deviceCode,
        userCode: data.userCode,
        verificationUri: data.verificationUri,
        expiresIn: data.expiresIn,
        polling: true
      }));

      const intervalSec = (data.interval || 5) * 1000;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await checkCopilotStatus(data.deviceCode);
          if (res.status === 'authorized') {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            setCopilotFlow({ active: false, deviceCode: '', userCode: '', verificationUri: '', polling: false, copied: false, error: null });
            if (res.config) onRefreshConfig(res.config);
            onShowToast({
              type: 'success',
              title: 'GitHub Copilot Connected',
              message: 'Successfully authenticated with your GitHub Copilot subscription!'
            });
          } else if (res.status === 'expired' || res.status === 'denied' || res.status === 'error') {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            setCopilotFlow(prev => ({ ...prev, polling: false, error: res.error || 'Authorization failed' }));
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, intervalSec);
    } catch (err) {
      setCopilotFlow(prev => ({ ...prev, polling: false, error: err.message }));
      onShowToast({ type: 'error', title: 'GitHub Error', message: err.message });
    }
  };

  const handleCancelCopilotAuth = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setCopilotFlow({ active: false, deviceCode: '', userCode: '', verificationUri: '', polling: false, copied: false, error: null });
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopilotFlow(prev => ({ ...prev, copied: true }));
    setTimeout(() => {
      setCopilotFlow(prev => ({ ...prev, copied: false }));
    }, 2000);
  };

  // SMTP form states
  const [showAddSmtpForm, setShowAddSmtpForm] = useState(false);
  const [smtpForm, setSmtpForm] = useState({
    name: 'Personal Gmail',
    host: 'smtp.gmail.com',
    port: 465,
    encryption: 'SSL',
    username: '',
    password: '',
    fromName: '',
    fromEmail: '',
    isDefault: true
  });
  const [smtpTestStatus, setSmtpTestStatus] = useState({}); // { [id]: { loading, success, message, error } }



  if (!isOpen) return null;

  // Handle AI provider save
  const handleSaveAiProvider = async (providerKey) => {
    try {
      const apiKey = editingKeys[providerKey];
      const model = editingModels[providerKey];
      const baseURL = editingBaseUrls[providerKey];

      const updated = await saveAiProviderConfig({
        providerKey,
        apiKey,
        model,
        baseURL,
        enabled: true
      });

      onRefreshConfig(updated);
      setEditingKeys(prev => ({ ...prev, [providerKey]: '' }));
      onShowToast({
        type: 'success',
        title: 'Settings Saved',
        message: `Saved configuration for ${config.aiProviders[providerKey]?.name || providerKey}`
      });
    } catch (err) {
      onShowToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message
      });
    }
  };

  // Set active AI
  const handleSetActiveAi = async (providerKey) => {
    try {
      const updated = await setActiveAiProvider(providerKey);
      onRefreshConfig(updated);
      setSelectedAiProvider(providerKey);
      onShowToast({
        type: 'success',
        title: 'Active Provider Updated',
        message: `Active AI provider set to ${config.aiProviders[providerKey]?.name}`
      });
    } catch (err) {
      onShowToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  // Test AI Connection
  const handleTestAi = async (providerKey) => {
    setAiTestStatus(prev => ({
      ...prev,
      [providerKey]: { loading: true }
    }));

    try {
      const apiKey = editingKeys[providerKey];
      const model = editingModels[providerKey] || config.aiProviders[providerKey]?.model;
      const baseURL = editingBaseUrls[providerKey] || config.aiProviders[providerKey]?.baseURL;

      const res = await testAiConnection({ providerKey, apiKey, model, baseURL });
      if (res.success) {
        setAiTestStatus(prev => ({
          ...prev,
          [providerKey]: { loading: false, success: true, message: res.message }
        }));
      } else {
        setAiTestStatus(prev => ({
          ...prev,
          [providerKey]: { loading: false, success: false, error: res.error }
        }));
      }
    } catch (err) {
      setAiTestStatus(prev => ({
        ...prev,
        [providerKey]: { loading: false, success: false, error: err.message }
      }));
    }
  };

  // Handle SMTP form save
  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    try {
      const updated = await saveSmtpProfile(smtpForm);
      onRefreshConfig(updated);
      setShowAddSmtpForm(false);
      setSmtpForm({
        name: 'Work Email',
        host: 'smtp.gmail.com',
        port: 465,
        encryption: 'SSL',
        username: '',
        password: '',
        fromName: '',
        fromEmail: '',
        isDefault: false
      });
      onShowToast({
        type: 'success',
        title: 'SMTP Profile Saved',
        message: `Saved ${smtpForm.name} profile successfully.`
      });
    } catch (err) {
      onShowToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  // Test SMTP connection
  const handleTestSmtp = async (profileOrFormData) => {
    const testId = profileOrFormData.id || 'form';
    setSmtpTestStatus(prev => ({ ...prev, [testId]: { loading: true } }));

    try {
      const res = await testSmtpConnection(profileOrFormData);
      if (res.success) {
        setSmtpTestStatus(prev => ({
          ...prev,
          [testId]: { loading: false, success: true, message: res.message }
        }));
      } else {
        setSmtpTestStatus(prev => ({
          ...prev,
          [testId]: { loading: false, success: false, error: res.error }
        }));
      }
    } catch (err) {
      setSmtpTestStatus(prev => ({
        ...prev,
        [testId]: { loading: false, success: false, error: err.message }
      }));
    }
  };

  // Delete SMTP profile
  const handleDeleteSmtp = async (id) => {
    try {
      const updated = await deleteSmtpProfile(id);
      onRefreshConfig(updated);
      onShowToast({ type: 'info', title: 'Profile Deleted', message: 'SMTP account removed.' });
    } catch (err) {
      onShowToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  // Set default SMTP profile
  const handleSetDefaultSmtp = async (id) => {
    try {
      const updated = await setDefaultSmtpProfile(id);
      onRefreshConfig(updated);
      onShowToast({ type: 'success', title: 'Active SMTP Set', message: 'Default sender profile updated.' });
    } catch (err) {
      onShowToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  // Load audit logs
  const handleTabChange = async (tab) => {
    setActiveTab(tab);
    if (tab === 'logs') {
      setIsLoadingLogs(true);
      try {
        const fetched = await fetchOutreachLogs();
        setLogs(fetched);
      } catch (e) {
        console.error('Failed fetching logs:', e);
      } finally {
        setIsLoadingLogs(false);
      }
    }
  };

  // Clear audit logs
  const handleClearLogs = async () => {
    try {
      await clearOutreachLogs();
      setLogs([]);
      onShowToast({ type: 'info', title: 'Logs Cleared', message: 'Campaign logs cleared.' });
    } catch (e) {
      onShowToast({ type: 'error', title: 'Error', message: e.message });
    }
  };

  // Reset all stored credentials and logs
  const handleResetAllData = async () => {
    if (dangerConfirmText.trim() !== 'DELETE') return;
    setIsResetting(true);
    try {
      const resetConfig = await resetAllData();
      onRefreshConfig(resetConfig);
      setDangerConfirmText('');
      onShowToast({
        type: 'warning',
        title: 'Platform Reset',
        message: 'All stored API keys, SMTP profiles, and logs have been wiped.'
      });
      onClose();
    } catch (err) {
      onShowToast({
        type: 'error',
        title: 'Reset Failed',
        message: err.message
      });
    } finally {
      setIsResetting(false);
    }
  };

  // Autofill preset from guide
  const handleApplyPreset = (preset) => {
    setShowAddSmtpForm(true);
    setSmtpForm(prev => ({
      ...prev,
      host: preset.host,
      port: preset.port,
      encryption: preset.encryption,
      name: preset.name
    }));
  };

  const aiProvidersList = config?.aiProviders ? Object.entries(config.aiProviders) : [];

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
            onClick={() => handleTabChange('ai')}
          >
            <Sparkles size={14} />
            AI Providers
          </button>
          <button
            type="button"
            className={`slideover-tab-btn ${activeTab === 'smtp' ? 'active' : ''}`}
            onClick={() => handleTabChange('smtp')}
          >
            <Mail size={14} />
            SMTP
          </button>
          <button
            type="button"
            className={`slideover-tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => handleTabChange('preferences')}
          >
            <Sliders size={14} />
            Preferences
          </button>
          <button
            type="button"
            className={`slideover-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => handleTabChange('logs')}
          >
            <FileText size={14} />
            Logs
          </button>
          <button
            type="button"
            className={`slideover-tab-btn danger-tab ${activeTab === 'danger' ? 'active' : ''}`}
            onClick={() => handleTabChange('danger')}
          >
            <AlertTriangle size={14} />
            Danger Zone
          </button>
        </div>

        {/* Body */}
        <div className="slideover-body">
          {/* TAB 1: AI PROVIDERS */}
          {activeTab === 'ai' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 12,
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: 20,
                  fontSize: 13
                }}
              >
                <Shield size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <span>
                  <strong>Encrypted at Rest:</strong> All API keys are securely encrypted using AES-256-GCM. Keys are never logged or exposed in client responses.
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {aiProvidersList.map(([key, provider]) => {
                  const isActive = config.activeProvider === key;
                  const testRes = aiTestStatus[key];

                  return (
                    <div
                      key={key}
                      style={{
                        padding: 18,
                        borderRadius: 'var(--radius-md)',
                        background: isActive ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-secondary)',
                        border: `1px solid ${isActive ? 'var(--primary-light)' : 'var(--border-subtle)'}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                            {provider.name}
                          </span>
                          {isActive && (
                            <span className="badge-counter" style={{ color: 'var(--primary-light)', borderColor: 'var(--border-focus)' }}>
                              Active Model
                            </span>
                          )}
                          {provider.isConfigured ? (
                            <span style={{ color: 'var(--success)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Check size={13} /> Key Configured
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                              No Key Set
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                          onClick={() => handleSetActiveAi(key)}
                          disabled={isActive}
                        >
                          {isActive ? 'Current Default' : 'Set as Active'}
                        </button>
                      </div>

                      {/* Inputs */}
                      {key === 'copilot' ? (
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                            GitHub Copilot authenticates securely through GitHub's Device Flow. No API key required.
                          </div>

                          {copilotFlow.active && copilotFlow.userCode ? (
                            <div
                              style={{
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--primary-light)',
                                borderRadius: 'var(--radius-md)',
                                padding: 18,
                                marginBottom: 14
                              }}
                            >
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                                1. Copy your one-time verification code:
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                <div
                                  style={{
                                    padding: '8px 16px',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-glow)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: 24,
                                    fontWeight: 800,
                                    letterSpacing: 4,
                                    fontFamily: 'var(--font-mono)',
                                    color: '#fff'
                                  }}
                                >
                                  {copilotFlow.userCode}
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleCopyCode(copilotFlow.userCode)}
                                  style={{ gap: 6 }}
                                >
                                  {copilotFlow.copied ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                                  {copilotFlow.copied ? 'Copied!' : 'Copy Code'}
                                </button>
                              </div>

                              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                                2. Click below to open GitHub device verification and enter the code:
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                <a
                                  href={copilotFlow.verificationUri || 'https://github.com/login/device'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-primary"
                                  style={{ textDecoration: 'none', gap: 6 }}
                                >
                                  <span>Open github.com/login/device</span>
                                  <ExternalLink size={14} />
                                </a>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--primary-light)' }}>
                                  <RefreshCw size={13} className="spin-icon" />
                                  <span>Waiting for you to authorize on GitHub...</span>
                                </div>

                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={handleCancelCopilotAuth}
                                  style={{ marginLeft: 'auto' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleStartCopilotAuth}
                                style={{ gap: 8 }}
                              >
                                <Server size={15} />
                                {provider.isConfigured ? 'Re-Verify GitHub Copilot Account' : 'Verify & Connect GitHub Copilot'}
                              </button>

                              {provider.isConfigured && (
                                <span style={{ fontSize: 13, color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                  <CheckCircle2 size={16} /> Subscription Connected
                                </span>
                              )}
                            </div>
                          )}

                          {/* Model Selection for Copilot */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                            <div>
                              <label className="form-label" style={{ fontSize: 12 }}>Copilot Model</label>
                              <select
                                className="form-select"
                                value={editingModels[key] || provider.model}
                                onChange={e => setEditingModels({ ...editingModels, [key]: e.target.value })}
                              >
                                {(provider.supportedModels || ['gpt-4o', 'gpt-4o-mini', 'claude-3.5-sonnet', 'o1-mini']).map(m => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleSaveAiProvider(key)}
                                style={{ width: '100%', height: 38 }}
                              >
                                Save Model Preference
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: key === 'custom' ? '1.5fr 1fr 1fr' : '1.5fr 1fr', gap: 12 }}>
                          {/* API Key Input */}
                          <div>
                            <label className="form-label" style={{ fontSize: 12 }}>
                              API Key {provider.isConfigured && <span style={{ color: 'var(--text-muted)' }}>(Saved: {provider.maskedKey})</span>}
                            </label>
                            <input
                              type="password"
                              placeholder={provider.isConfigured ? 'Enter new key to update...' : 'Paste your API key here (sk-...)'}
                              value={editingKeys[key] || ''}
                              onChange={e => setEditingKeys({ ...editingKeys, [key]: e.target.value })}
                              className="form-input"
                              style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                            />
                          </div>

                          {/* Model Dropdown */}
                          <div>
                            <label className="form-label" style={{ fontSize: 12 }}>Model</label>
                            {provider.supportedModels && provider.supportedModels.length > 0 ? (
                              <select
                                className="form-select"
                                value={editingModels[key] || provider.model}
                                onChange={e => setEditingModels({ ...editingModels, [key]: e.target.value })}
                              >
                                {provider.supportedModels.map(m => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={editingModels[key] !== undefined ? editingModels[key] : provider.model}
                                onChange={e => setEditingModels({ ...editingModels, [key]: e.target.value })}
                                className="form-input"
                                placeholder="model name"
                              />
                            )}
                          </div>

                          {/* Custom Base URL if custom provider */}
                          {key === 'custom' && (
                            <div>
                              <label className="form-label" style={{ fontSize: 12 }}>Base URL</label>
                              <input
                                type="text"
                                value={editingBaseUrls[key] !== undefined ? editingBaseUrls[key] : (provider.baseURL || 'https://api.openai.com/v1')}
                                onChange={e => setEditingBaseUrls({ ...editingBaseUrls, [key]: e.target.value })}
                                className="form-input"
                                placeholder="https://api.openai.com/v1"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Test Connection Banner if present */}
                      {testRes && (
                        <div
                          style={{
                            marginTop: 10,
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            background: testRes.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                            color: testRes.success ? 'var(--success)' : '#f87171'
                          }}
                        >
                          {testRes.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                          <span>{testRes.message || testRes.error}</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleTestAi(key)}
                          disabled={testRes?.loading}
                        >
                          {testRes?.loading ? (
                            <>
                              <RefreshCw size={13} className="spin-icon" /> Testing...
                            </>
                          ) : (
                            'Test Connection'
                          )}
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSaveAiProvider(key)}
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: SMTP PROFILES */}
          {activeTab === 'smtp' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Saved SMTP Accounts</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Add your personal or work email accounts to dispatch personalized cold outreach.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsGuideOpen(true)}
                    style={{ gap: 6 }}
                  >
                    <HelpCircle size={14} style={{ color: 'var(--primary-light)' }} />
                    App Password Setup Guide
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowAddSmtpForm(!showAddSmtpForm)}
                    style={{ gap: 6 }}
                  >
                    <Plus size={14} />
                    {showAddSmtpForm ? 'Cancel' : 'Add New SMTP Profile'}
                  </button>
                </div>
              </div>

              {/* Add SMTP Profile Form */}
              {showAddSmtpForm && (
                <form
                  onSubmit={handleSaveSmtp}
                  style={{
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    padding: 20,
                    border: '1px solid var(--border-subtle)',
                    marginBottom: 20
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 14 }}>
                    New SMTP Profile
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label">Profile Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Personal Gmail or Work Outlook"
                        value={smtpForm.name}
                        onChange={e => setSmtpForm({ ...smtpForm, name: e.target.value })}
                        className="form-input"
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label">Display From Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Alex Mercer"
                        value={smtpForm.fromName}
                        onChange={e => setSmtpForm({ ...smtpForm, fromName: e.target.value })}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label">SMTP Host *</label>
                      <input
                        type="text"
                        placeholder="smtp.gmail.com"
                        value={smtpForm.host}
                        onChange={e => setSmtpForm({ ...smtpForm, host: e.target.value })}
                        className="form-input"
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label">Port *</label>
                      <input
                        type="number"
                        placeholder="465 or 587"
                        value={smtpForm.port}
                        onChange={e => setSmtpForm({ ...smtpForm, port: e.target.value })}
                        className="form-input"
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label">Encryption *</label>
                      <select
                        className="form-select"
                        value={smtpForm.encryption}
                        onChange={e => setSmtpForm({ ...smtpForm, encryption: e.target.value })}
                      >
                        <option value="SSL">SSL (Port 465)</option>
                        <option value="TLS">TLS / STARTTLS (Port 587)</option>
                        <option value="STARTTLS">STARTTLS</option>
                        <option value="NONE">None</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label">Username / Email Address *</label>
                      <input
                        type="email"
                        placeholder="your.email@gmail.com"
                        value={smtpForm.username}
                        onChange={e => setSmtpForm({ ...smtpForm, username: e.target.value, fromEmail: e.target.value })}
                        className="form-input"
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label">App Password *</label>
                      <input
                        type="password"
                        placeholder="16-character App Password"
                        value={smtpForm.password}
                        onChange={e => setSmtpForm({ ...smtpForm, password: e.target.value })}
                        className="form-input"
                        required
                      />
                    </div>
                  </div>

                  {/* Test Status feedback */}
                  {smtpTestStatus['form'] && (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 12,
                        marginBottom: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: smtpTestStatus['form'].success ? 'var(--success-bg)' : 'var(--danger-bg)',
                        color: smtpTestStatus['form'].success ? 'var(--success)' : '#f87171'
                      }}
                    >
                      {smtpTestStatus['form'].success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      <span>{smtpTestStatus['form'].message || smtpTestStatus['form'].error}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleTestSmtp(smtpForm)}
                      disabled={smtpTestStatus['form']?.loading}
                    >
                      {smtpTestStatus['form']?.loading ? 'Testing...' : 'Test Connection'}
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm">
                      Save SMTP Account
                    </button>
                  </div>
                </form>
              )}

              {/* Profiles List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {config.smtpProfiles && config.smtpProfiles.length > 0 ? (
                  config.smtpProfiles.map(p => {
                    const testRes = smtpTestStatus[p.id];

                    return (
                      <div
                        key={p.id}
                        style={{
                          padding: 16,
                          borderRadius: 'var(--radius-md)',
                          background: p.isDefault ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-secondary)',
                          border: `1px solid ${p.isDefault ? 'var(--primary-light)' : 'var(--border-subtle)'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>
                                {p.name}
                              </span>
                              {p.isDefault && (
                                <span className="badge-counter" style={{ color: 'var(--primary-light)' }}>
                                  Active Default
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                              {p.fromName ? `"${p.fromName}" ` : ''}&lt;{p.fromEmail || p.username}&gt; • {p.host}:{p.port} ({p.encryption})
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleTestSmtp(p)}
                              disabled={testRes?.loading}
                            >
                              {testRes?.loading ? <RefreshCw size={13} className="spin-icon" /> : 'Test Connection'}
                            </button>
                            {!p.isDefault && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleSetDefaultSmtp(p.id)}
                              >
                                Set Default
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteSmtp(p.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Test Status feedback */}
                        {testRes && (
                          <div
                            style={{
                              padding: '8px 12px',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 12,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              background: testRes.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                              color: testRes.success ? 'var(--success)' : '#f87171'
                            }}
                          >
                            {testRes.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                            <span>{testRes.message || testRes.error}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state">
                    <Mail className="empty-state-icon" />
                    <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>No SMTP Accounts Configured</div>
                    <div style={{ fontSize: 13 }}>Add your Gmail, Outlook, or corporate email credentials to send outreach.</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PREFERENCES */}
          {activeTab === 'preferences' && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 14 }}>
                Delivery Safety & Rate Limiting Preferences
              </div>

              <div
                style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  padding: 20,
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 20
                }}
              >
                <div>
                  <label className="form-label">
                    Delay Between Outgoing Sends (Seconds): <strong>{config.sendingPreferences?.delaySeconds || 3}s</strong>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={config.sendingPreferences?.delaySeconds || 3}
                    onChange={async (e) => {
                      const val = Number(e.target.value);
                      const updated = await savePreferences({ delaySeconds: val });
                      onRefreshConfig(updated);
                    }}
                    style={{ width: '100%', accentColor: 'var(--primary)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    <span>1s (Faster)</span>
                    <span>3s - 5s (Recommended to prevent spam filters)</span>
                    <span>10s (Maximum Safety)</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>
                      Attach Resume PDF Automatically
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Automatically attach candidate resume document to every outbound outreach email.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.sendingPreferences?.attachResume ?? true}
                    onChange={async (e) => {
                      const updated = await savePreferences({ attachResume: e.target.checked });
                      onRefreshConfig(updated);
                    }}
                    style={{ transform: 'scale(1.3)', cursor: 'pointer' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Outreach Delivery Logs</div>
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
                          <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <FileText className="empty-state-icon" />
                  <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>No Outreach Dispatched Yet</div>
                  <div style={{ fontSize: 13 }}>Your sent email activity and delivery status will appear here.</div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: DANGER ZONE */}
          {activeTab === 'danger' && (
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
          )}
        </div>

        {/* Footer */}
        <div className="slideover-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </aside>

      {/* Embedded Smtp Guide Modal */}
      <SmtpGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onApplyPreset={handleApplyPreset}
      />
    </div>
  );
}
