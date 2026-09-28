import React from 'react';
import { User } from 'lucide-react';
import { savePreferences } from '../../services/api';
import { saveSettings } from '../../lib/settings';

/**
 * PreferencesTab — Candidate profile defaults, outreach voice tone, and delivery rate-limiting.
 */
export default function PreferencesTab({ config, onRefreshConfig, user, onShowToast }) {
  const handleUpdatePreferences = async (partial) => {
    const updatedPreferences = {
      ...(config.preferences || {}),
      ...partial
    };
    const updated = {
      ...config,
      preferences: updatedPreferences,
      sendingPreferences: {
        ...(config.sendingPreferences || {}),
        ...partial
      }
    };
    try {
      await savePreferences(updatedPreferences);
    } catch (e) {
      console.warn('Local preferences save notice:', e.message);
    }
    if (user?.uid) {
      await saveSettings(user.uid, updated);
    }
    onRefreshConfig(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Candidate Profile */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <User size={16} style={{ color: 'var(--accent-primary)' }} />
          Candidate Profile (Default Outreach Identity)
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Stored in your Firestore account to automatically identify sender details across outreach sessions.
        </div>

        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            padding: 20,
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}
        >
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Alex Mercer"
              value={config.candidateProfile?.fullName || ''}
              onChange={async (e) => {
                const updated = {
                  ...config,
                  candidateProfile: {
                    ...(config.candidateProfile || {}),
                    fullName: e.target.value
                  }
                };
                if (user?.uid) await saveSettings(user.uid, updated);
                onRefreshConfig(updated);
              }}
            />
          </div>

          <div className="responsive-grid-2">
            <div className="form-group">
              <label className="form-label">Candidate Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="alex.mercer@gmail.com"
                value={config.candidateProfile?.email || ''}
                onChange={async (e) => {
                  const updated = {
                    ...config,
                    candidateProfile: {
                      ...(config.candidateProfile || {}),
                      email: e.target.value
                    }
                  };
                  if (user?.uid) await saveSettings(user.uid, updated);
                  onRefreshConfig(updated);
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                className="form-input"
                placeholder="+1 (555) 019-2834"
                value={config.candidateProfile?.phone || ''}
                onChange={async (e) => {
                  const updated = {
                    ...config,
                    candidateProfile: {
                      ...(config.candidateProfile || {}),
                      phone: e.target.value
                    }
                  };
                  if (user?.uid) await saveSettings(user.uid, updated);
                  onRefreshConfig(updated);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Outreach Tone Preference */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          Default Outreach Tone & Style
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Set your preferred AI voice for cold applications and recruiter outreach.
        </div>

        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            padding: 20,
            border: '1px solid var(--border-subtle)'
          }}
        >
          <div className="form-group">
            <label className="form-label">Outreach Style Tone</label>
            <select
              className="form-input"
              value={config.preferences?.outreachTone || 'direct'}
              onChange={async (e) => {
                await handleUpdatePreferences({ outreachTone: e.target.value });
                onShowToast?.({ type: 'success', title: 'Tone Saved', message: 'Outreach tone updated.' });
              }}
            >
              <option value="direct">Direct & High-Impact (Focus on quantified outcomes)</option>
              <option value="enthusiastic">Enthusiastic & Passionate (High energy, culture fit)</option>
              <option value="concise">Concise & Punchy (Under 100 words, direct ask)</option>
              <option value="executive">Executive & Strategic (Leadership and domain authority)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Delivery Safety & Rate Limiting */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
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
              Delay Between Outgoing Sends (Seconds): <strong>{config.preferences?.delaySeconds || config.sendingPreferences?.delaySeconds || 3}s</strong>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={config.preferences?.delaySeconds || config.sendingPreferences?.delaySeconds || 3}
              onChange={(e) => {
                handleUpdatePreferences({ delaySeconds: Number(e.target.value) });
              }}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              <span>1s (Faster)</span>
              <span>3s - 5s (Recommended to prevent spam filters)</span>
              <span>10s (Maximum Safety)</span>
            </div>
          </div>

          <div>
            <label className="form-label">
              Dispatch Concurrency: <strong>{config.preferences?.concurrency || config.sendingPreferences?.concurrency || 1} {((config.preferences?.concurrency || config.sendingPreferences?.concurrency || 1) === 1) ? '(Sequential / Safest)' : '(Concurrent Workers)'}</strong>
            </label>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              {[
                { val: 1, label: '1 (Sequential)', desc: 'Safest for inbox reputation' },
                { val: 2, label: '2 Workers', desc: 'Controlled parallel delivery' },
                { val: 3, label: '3 Workers', desc: 'Maximum concurrent throughput' }
              ].map(opt => {
                const currentVal = config.preferences?.concurrency || config.sendingPreferences?.concurrency || 1;
                const isSelected = currentVal === opt.val;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => handleUpdatePreferences({ concurrency: opt.val })}
                    className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, flexDirection: 'column', padding: '8px 12px', alignItems: 'flex-start', height: 'auto', gap: 2 }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{opt.label}</span>
                    <span style={{ fontSize: 10, opacity: 0.8, fontWeight: 400 }}>{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
                Attach Resume PDF Automatically
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Automatically attach candidate resume document to every outbound outreach email.
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.preferences?.attachResume ?? config.sendingPreferences?.attachResume ?? true}
              onChange={(e) => {
                handleUpdatePreferences({ attachResume: e.target.checked });
              }}
              style={{ transform: 'scale(1.3)', cursor: 'pointer' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
