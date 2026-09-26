import React, { useState } from 'react';
import { HelpCircle, ExternalLink, Key, ShieldCheck, Check, Copy } from 'lucide-react';

const GUIDES = [
  {
    id: 'gmail',
    name: 'Google Gmail / Workspace',
    iconColor: '#ea4335',
    host: 'smtp.gmail.com',
    port: 465,
    encryption: 'SSL',
    steps: [
      'Enable 2-Step Verification on your Google Account (Security -> 2-Step Verification).',
      'Go directly to https://myaccount.google.com/apppasswords or search "App Passwords" in your Google Account.',
      'Enter an app name like "JDMail" and click "Create".',
      'Copy the 16-character generated code (e.g., abcd efgh ijkl mnop) without spaces into the Password field.',
      'Note: Your regular Google login password will NOT work for SMTP; an App Password is required.'
    ],
    link: 'https://myaccount.google.com/apppasswords'
  },
  {
    id: 'outlook',
    name: 'Microsoft Outlook / Office 365',
    iconColor: '#0078d4',
    host: 'smtp.office365.com',
    port: 587,
    encryption: 'STARTTLS',
    steps: [
      'Go to Microsoft Account Security (account.microsoft.com/security).',
      'Click "Advanced security options" and ensure Two-Step Verification is turned on.',
      'Under "App passwords", select "Create a new app password".',
      'Copy the generated password into JDMail.',
      'For Office 365 enterprise tenants: ensure your IT admin has enabled "Authenticated SMTP" in the Exchange Admin Center.'
    ],
    link: 'https://account.microsoft.com/security'
  },
  {
    id: 'yahoo',
    name: 'Yahoo Mail',
    iconColor: '#6001d2',
    host: 'smtp.mail.yahoo.com',
    port: 465,
    encryption: 'SSL',
    steps: [
      'Sign in to Yahoo Account Info (login.yahoo.com/account/security).',
      'Click "Account Security" and scroll down to "Generate app password".',
      'Click "Generate", enter "JDMail" as the app name.',
      'Copy the generated password into JDMail.'
    ],
    link: 'https://login.yahoo.com/account/security'
  },
  {
    id: 'zoho',
    name: 'Zoho Mail',
    iconColor: '#009688',
    host: 'smtp.zoho.com',
    port: 465,
    encryption: 'SSL',
    steps: [
      'Sign in to Zoho Accounts (accounts.zoho.com).',
      'Navigate to "Security" -> "App Passwords".',
      'Click "Generate New Password", name it "JDMail".',
      'Use your full Zoho email as username and the generated password.'
    ],
    link: 'https://accounts.zoho.com'
  }
];

export default function SmtpGuideModal({ isOpen, onClose, onApplyPreset }) {
  const [activeGuideId, setActiveGuideId] = useState('gmail');
  const [copiedHost, setCopiedHost] = useState(false);

  if (!isOpen) return null;

  const currentGuide = GUIDES.find(g => g.id === activeGuideId) || GUIDES[0];

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedHost(true);
    setTimeout(() => setCopiedHost(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 60 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <div className="modal-title">
            <HelpCircle size={20} style={{ color: 'var(--primary-light)' }} />
            <span>SMTP App Password Setup Guide</span>
          </div>
          <button className="btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Provider Tabs */}
          <div className="tab-pill-group" style={{ marginBottom: 20 }}>
            {GUIDES.map(guide => (
              <button
                key={guide.id}
                className={`tab-pill ${activeGuideId === guide.id ? 'active' : ''}`}
                onClick={() => setActiveGuideId(guide.id)}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: guide.iconColor,
                    display: 'inline-block'
                  }}
                />
                {guide.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Guide Content */}
          <div
            style={{
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              padding: 20,
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                {currentGuide.name}
              </h3>
              <a
                href={currentGuide.link}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ gap: 6, textDecoration: 'none' }}
              >
                <span>Open {currentGuide.name.split('/')[0]} Security</span>
                <ExternalLink size={13} />
              </a>
            </div>

            {/* Presets Box */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                padding: 12,
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                marginBottom: 16,
                fontSize: 12
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Host:</span>{' '}
                <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{currentGuide.host}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Port:</span>{' '}
                <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{currentGuide.port}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Security:</span>{' '}
                <strong style={{ color: '#fff' }}>{currentGuide.encryption}</strong>
              </div>
            </div>

            {/* Step-by-step instructions */}
            <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-main)' }}>
              <div style={{ fontWeight: 600, color: 'var(--primary-light)', marginBottom: 8 }}>
                Step-by-step instructions:
              </div>
              <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {currentGuide.steps.map((step, idx) => (
                  <li key={idx} style={{ color: '#cbd5e1' }}>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          {onApplyPreset && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                onApplyPreset({
                  host: currentGuide.host,
                  port: currentGuide.port,
                  encryption: currentGuide.encryption,
                  name: `${currentGuide.name.split('/')[0]} Account`
                });
                onClose();
              }}
            >
              Autofill Form with this Provider Preset
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
