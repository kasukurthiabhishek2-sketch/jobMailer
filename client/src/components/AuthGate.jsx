import React from 'react';
import { signInWithGoogle } from '../lib/firebase';
import { Send } from 'lucide-react';

/**
 * AuthGate — Full-screen sign-in screen shown when no user is authenticated.
 * Matches the app's existing visual system (glassmorphic dark theme, accent colors).
 */
export default function AuthGate({ onSignInError }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err.code === 'auth/popup-closed-by-user'
        ? 'Sign-in popup was closed. Please try again.'
        : err.message || 'Sign-in failed. Please try again.';
      setError(msg);
      if (onSignInError) onSignInError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-gate">
      <div className="auth-gate-card">
        <div className="auth-gate-logo">
          <div className="logo-icon-box">
            <Send size={28} style={{ transform: 'rotate(-20deg)' }} />
          </div>
          <h1 className="auth-gate-title">
            JDMail <span className="logo-tag">AI Outreach</span>
          </h1>
          <p className="auth-gate-subtitle">
            Cold Job Outreach & Tailored Application Engine
          </p>
        </div>

        <div className="auth-gate-divider" />

        <p className="auth-gate-desc">
          Sign in with your Google account to access your AI providers, SMTP accounts,
          and outreach settings — all securely stored in the cloud.
        </p>

        {error && (
          <div className="auth-gate-error">
            {error}
          </div>
        )}

        <button
          className="auth-gate-btn"
          onClick={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <span className="auth-gate-spinner" />
          ) : (
            <svg className="auth-gate-google-icon" viewBox="0 0 24 24" width="20" height="20">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          <span>{loading ? 'Signing in…' : 'Continue with Google'}</span>
        </button>


        <p className="auth-gate-footer">
          Your settings are encrypted and stored per-account in Firestore.
        </p>
      </div>
    </div>
  );
}
