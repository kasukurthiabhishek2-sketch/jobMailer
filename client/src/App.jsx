import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import StepIndicator from './components/StepIndicator';
import ResumeUpload from './components/ResumeUpload';
import RecipientManager from './components/RecipientManager';
import JobDescriptionInput from './components/JobDescriptionInput';
import EmailPreview from './components/EmailPreview';
import SendProgressModal from './components/SendProgressModal';
import SettingsModal from './components/SettingsModal';
import AuthGate from './components/AuthGate';
import Toast from './components/Toast';
import { fetchMigrationConfig } from './services/api';
import { watchAuthState, signOutUser } from './lib/firebase';
import { loadSettings, saveSettings, formatForFirestore, getDefaultSettings } from './lib/settings';
import { useWizardState } from './hooks/useWizardState';
import { useCampaignStream } from './hooks/useCampaignStream';
import { ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = unauthenticated, User = authenticated
  const [offlineMode, setOfflineMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authRetryCount, setAuthRetryCount] = useState(0);
  const [config, setConfig] = useState(null);

  // Wizard state hook (TICK-CYC3-08 / B2)
  const {
    currentStep,
    direction,
    resumeData,
    recipients,
    setRecipients,
    jobDescription,
    setJobDescription,
    generatedEmails,
    setGeneratedEmails,
    goToStep,
    handleResumeUploaded,
    resetWizard,
    resumeReady,
    jdReady,
    recipientsCount,
    emailReady
  } = useWizardState(1);

  // Outbound campaign streaming hook (TICK-CYC3-08 / B2)
  const {
    sendModalOpen,
    setSendModalOpen,
    isSending,
    progressData,
    throttlingData,
    campaignSendLogs,
    campaignSummary,
    triggerSend
  } = useCampaignStream();

  // Settings modal navigation state
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('ai');

  // Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('jdmail-theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('jdmail-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  const addToast = ({ type = 'info', title, message }) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Watch Firebase authentication state and load user settings from Firestore (TICK-CYC3-14 / C5)
  useEffect(() => {
    // Timeout: If Firebase fails to respond within 4s, offer explicit retry or local mode
    const connectionTimer = setTimeout(() => {
      setAuthLoading(false);
      setAuthError('Unable to reach Firebase authentication.');
    }, 4000);

    const unsubscribe = watchAuthState(async (currentUser) => {
      clearTimeout(connectionTimer);
      setAuthError(null);
      setUser(currentUser);
      if (currentUser) {
        setAuthLoading(true);
        try {
          let userSettings = await loadSettings(currentUser.uid);
          if (!userSettings) {
            const legacy = await fetchMigrationConfig();
            userSettings = formatForFirestore(legacy);
            await saveSettings(currentUser.uid, userSettings);
          }
          setConfig(userSettings);
        } catch (err) {
          console.error('Failed to load user settings from Firestore:', err);
          addToast({
            type: 'error',
            title: 'Settings Issue',
            message: 'Unable to connect to Firestore settings. Using default profile.'
          });
          setConfig(getDefaultSettings());
        } finally {
          setAuthLoading(false);
        }
      } else {
        setConfig(null);
        setAuthLoading(false);
      }
    });

    return () => {
      clearTimeout(connectionTimer);
      unsubscribe();
    };
  }, [authRetryCount]);

  const handleRetryAuth = () => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthRetryCount(prev => prev + 1);
  };

  const handleOpenSettings = (tab = 'ai') => {
    setSettingsTab(tab);
    setSettingsModalOpen(true);
  };

  const handleOpenLogs = () => {
    setSettingsTab('logs');
    setSettingsModalOpen(true);
  };

  const handleTriggerSend = () => {
    return triggerSend({
      config,
      resumeData,
      recipients,
      generatedEmails,
      onOpenSettings: handleOpenSettings,
      addToast
    });
  };

  const handleContinueOffline = async () => {
    setOfflineMode(true);
    setUser({ isOffline: true, displayName: 'Local Mode', email: 'offline@localhost' });
    try {
      const legacy = await fetchMigrationConfig();
      if (legacy) {
        setConfig(formatForFirestore(legacy));
      } else {
        setConfig(getDefaultSettings());
      }
      addToast({
        type: 'info',
        title: 'Local Mode Active',
        message: 'Using local server configuration and credentials.'
      });
    } catch {
      setConfig(getDefaultSettings());
    }
  };

  const handleSignOut = async () => {
    try {
      if (!user?.isOffline) {
        await signOutUser();
      }
      setOfflineMode(false);
      setUser(null);
      setConfig(null);
      resetWizard();
      addToast({
        type: 'info',
        title: 'Signed Out',
        message: 'You have been signed out successfully.'
      });
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  if (authLoading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-spinner" />
        <span>Loading JDMail...</span>
      </div>
    );
  }

  // Explicit Error/Retry State on Firebase Timeout (TICK-CYC3-14 / C5)
  if (authError && !offlineMode && !user) {
    return (
      <div className="auth-loading-screen" style={{ flexDirection: 'column' }}>
        <div className="glass-card" style={{ maxWidth: 440, textAlign: 'center', padding: 32 }}>
          <AlertCircle size={36} style={{ color: 'var(--accent-warning)', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
            Unable to Reach Firebase Authentication
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
            Connection to Firebase services timed out or could not be established. You can retry connecting or continue immediately in local mode using your local encrypted configuration.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRetryAuth}
              style={{ justifyContent: 'center', gap: 8 }}
            >
              <RefreshCw size={14} />
              Retry Connection
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleContinueOffline}
              style={{ justifyContent: 'center' }}
            >
              Continue in Local Mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user && !offlineMode) {
    return (
      <>
        <AuthGate
          onContinueOffline={handleContinueOffline}
          onSignInError={(err) =>
            addToast({
              type: 'error',
              title: 'Sign-in Failed',
              message: err.message
            })
          }
        />
        <Toast toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  return (
    <>
      <Header
        config={config}
        onOpenSettings={handleOpenSettings}
        onOpenLogs={handleOpenLogs}
        theme={theme}
        onToggleTheme={toggleTheme}
        user={user}
        onSignOut={handleSignOut}
      />

      <main className="app-container">
        {/* Step Progression Bar — Single Canonical Step Indicator */}
        <StepIndicator
          currentStep={currentStep}
          onSelectStep={goToStep}
          resumeReady={resumeReady}
          recipientsCount={recipientsCount}
          jdReady={jdReady}
          emailReady={emailReady}
        />

        {/* Wizard Step Shell (TICK-CYC3-11: Stacked duplicate card stack removed) */}
        <div className="wizard-container">
          <div className="step-transition-wrapper">
            <div
              key={currentStep}
              className={`step-content-animating ${direction === 'forward' ? 'step-slide-forward' : 'step-slide-backward'}`}
            >
              {currentStep === 1 && (
                <div>
                  <ResumeUpload
                    resumeData={resumeData}
                    onResumeUploaded={handleResumeUploaded}
                    onShowToast={addToast}
                  />
                  <div className="wizard-nav-footer">
                    <div />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => goToStep(2)}
                      disabled={!resumeReady}
                    >
                      Continue to Target Role
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div>
                  <JobDescriptionInput
                    jobDescription={jobDescription}
                    onChangeJd={setJobDescription}
                    onShowToast={addToast}
                  />
                  <div className="wizard-nav-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => goToStep(1)}
                    >
                      <ChevronLeft size={16} />
                      Back to Profile
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => goToStep(3)}
                    >
                      Continue to Recipients
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div>
                  <RecipientManager
                    recipients={recipients}
                    onUpdateRecipients={setRecipients}
                    onShowToast={addToast}
                    generatedEmails={generatedEmails}
                  />
                  <div className="wizard-nav-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => goToStep(2)}
                    >
                      <ChevronLeft size={16} />
                      Back to Target Role
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => goToStep(4)}
                      disabled={recipientsCount === 0}
                    >
                      Continue to AI Drafts
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div>
                  <EmailPreview
                    config={config}
                    resumeData={resumeData}
                    jobDescription={jobDescription}
                    recipients={recipients}
                    onUpdateRecipients={setRecipients}
                    generatedEmails={generatedEmails}
                    onUpdateGeneratedEmails={setGeneratedEmails}
                    onOpenSettings={handleOpenSettings}
                    onShowToast={addToast}
                    onTriggerSend={handleTriggerSend}
                    onRefreshConfig={setConfig}
                    user={user}
                  />
                  <div className="wizard-nav-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => goToStep(3)}
                    >
                      <ChevronLeft size={16} />
                      Back to Recipients
                    </button>
                    <div />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {config && (
        <SettingsModal
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          initialTab={settingsTab}
          config={config}
          onRefreshConfig={setConfig}
          onShowToast={addToast}
          user={user}
        />
      )}

      {/* Send Progress Modal */}
      <SendProgressModal
        isOpen={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        isSending={isSending}
        progressData={progressData}
        throttlingData={throttlingData}
        sendLogs={campaignSendLogs}
        summaryData={campaignSummary}
      />

      {/* Toast System */}
      <Toast toasts={toasts} onDismiss={removeToast} />
    </>
  );
}
