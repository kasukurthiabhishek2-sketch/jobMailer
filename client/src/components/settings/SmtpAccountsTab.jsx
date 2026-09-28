import React, { useState } from 'react';
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Trash2,
  RefreshCw,
  Plus
} from 'lucide-react';
import {
  saveSmtpProfile,
  deleteSmtpProfile,
  setDefaultSmtpProfile,
  testSmtpConnection
} from '../../services/api';
import { saveSettings } from '../../lib/settings';
import SmtpGuideModal from '../SmtpGuideModal';

/**
 * SmtpAccountsTab — Outbound email account profiles (Gmail, Outlook, Custom SMTP).
 */
export default function SmtpAccountsTab({ config, onRefreshConfig, onShowToast, user }) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
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

  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    try {
      const newProfile = {
        ...smtpForm,
        id: smtpForm.id || `smtp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        isConfigured: Boolean(smtpForm.password),
        updatedAt: new Date().toISOString()
      };

      let updatedProfiles = [...(config?.smtpProfiles || [])];
      const existingIdx = updatedProfiles.findIndex(p => p.id === newProfile.id);
      if (existingIdx >= 0) {
        if (!newProfile.password) {
          newProfile.password = updatedProfiles[existingIdx].password;
          newProfile.isConfigured = updatedProfiles[existingIdx].isConfigured;
        }
        updatedProfiles[existingIdx] = newProfile;
      } else {
        if (updatedProfiles.length === 0) {
          newProfile.isDefault = true;
        }
        updatedProfiles.push(newProfile);
      }

      if (newProfile.isDefault) {
        updatedProfiles = updatedProfiles.map(p => ({
          ...p,
          isDefault: p.id === newProfile.id
        }));
      }

      const defaultProfile = updatedProfiles.find(p => p.isDefault) || updatedProfiles[0] || {};
      const updatedConfig = {
        ...config,
        smtpProfiles: updatedProfiles,
        smtp: {
          provider: 'gmail',
          email: defaultProfile.username || defaultProfile.fromEmail || '',
          appPassword: defaultProfile.password || '',
          host: defaultProfile.host || 'smtp.gmail.com',
          port: defaultProfile.port || 465,
          encryption: defaultProfile.encryption || 'SSL',
          fromName: defaultProfile.fromName || ''
        }
      };

      try {
        await saveSmtpProfile(newProfile);
      } catch (backendErr) {
        console.warn('Local backend SMTP save notice:', backendErr.message);
      }

      if (user?.uid) {
        await saveSettings(user.uid, updatedConfig);
      }
      onRefreshConfig(updatedConfig);
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
      onShowToast?.({
        type: 'success',
        title: 'SMTP Profile Saved',
        message: `Saved ${newProfile.name} profile successfully.`
      });
    } catch (err) {
      onShowToast?.({ type: 'error', title: 'Error', message: err.message });
    }
  };

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

  const handleDeleteSmtp = async (id) => {
    try {
      const updatedProfiles = (config?.smtpProfiles || []).filter(p => p.id !== id);
      const defaultProfile = updatedProfiles.find(p => p.isDefault) || updatedProfiles[0] || {};
      const updatedConfig = {
        ...config,
        smtpProfiles: updatedProfiles,
        smtp: {
          provider: 'gmail',
          email: defaultProfile.username || defaultProfile.fromEmail || '',
          appPassword: defaultProfile.password || '',
          host: defaultProfile.host || 'smtp.gmail.com',
          port: defaultProfile.port || 465,
          encryption: defaultProfile.encryption || 'SSL',
          fromName: defaultProfile.fromName || ''
        }
      };

      try {
        await deleteSmtpProfile(id);
      } catch (backendErr) {
        console.warn('Local backend delete SMTP notice:', backendErr.message);
      }

      if (user?.uid) {
        await saveSettings(user.uid, updatedConfig);
      }
      onRefreshConfig(updatedConfig);
      onShowToast?.({ type: 'info', title: 'Profile Deleted', message: 'SMTP account removed.' });
    } catch (err) {
      onShowToast?.({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleSetDefaultSmtp = async (id) => {
    try {
      const updatedProfiles = (config?.smtpProfiles || []).map(p => ({
        ...p,
        isDefault: p.id === id
      }));
      const defaultProfile = updatedProfiles.find(p => p.id === id) || {};
      const updatedConfig = {
        ...config,
        smtpProfiles: updatedProfiles,
        smtp: {
          provider: 'gmail',
          email: defaultProfile.username || defaultProfile.fromEmail || '',
          appPassword: defaultProfile.password || '',
          host: defaultProfile.host || 'smtp.gmail.com',
          port: defaultProfile.port || 465,
          encryption: defaultProfile.encryption || 'SSL',
          fromName: defaultProfile.fromName || ''
        }
      };

      try {
        await setDefaultSmtpProfile(id);
      } catch (backendErr) {
        console.warn('Local backend default SMTP notice:', backendErr.message);
      }

      if (user?.uid) {
        await saveSettings(user.uid, updatedConfig);
      }
      onRefreshConfig(updatedConfig);
      onShowToast?.({ type: 'success', title: 'Active SMTP Set', message: 'Default sender profile updated.' });
    } catch (err) {
      onShowToast?.({ type: 'error', title: 'Error', message: err.message });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Saved SMTP Accounts</div>
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
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
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
        {config?.smtpProfiles && config.smtpProfiles.length > 0 ? (
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
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>
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
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No SMTP Accounts Configured</div>
            <div style={{ fontSize: 13 }}>Add your Gmail, Outlook, or corporate email credentials to send outreach.</div>
          </div>
        )}
      </div>

      {/* Embedded Smtp Guide Modal */}
      <SmtpGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onApplyPreset={handleApplyPreset}
      />
    </div>
  );
}
