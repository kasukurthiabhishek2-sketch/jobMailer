import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import StepIndicator from './components/StepIndicator';
import ResumeUpload from './components/ResumeUpload';
import RecipientManager from './components/RecipientManager';
import JobDescriptionInput from './components/JobDescriptionInput';
import EmailPreview from './components/EmailPreview';
import SendProgressModal from './components/SendProgressModal';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast';
import { fetchConfig, streamEmailSending } from './services/api';

export default function App() {
  const [config, setConfig] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [resumeData, setResumeData] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [jobDescription, setJobDescription] = useState('');
  const [generatedEmails, setGeneratedEmails] = useState({});

  // Modals state
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('ai');
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [progressData, setProgressData] = useState(null);
  const [throttlingData, setThrottlingData] = useState(null);
  const [campaignSendLogs, setCampaignSendLogs] = useState([]);
  const [campaignSummary, setCampaignSummary] = useState(null);

  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('jdmail-theme') || 'dark';
  });

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

  // Initial config load
  useEffect(() => {
    fetchConfig()
      .then(data => {
        setConfig(data);
      })
      .catch(err => {
        console.error('Failed to load initial config:', err);
        addToast({
          type: 'error',
          title: 'Connection Issue',
          message: 'Could not connect to JDMail backend. Please check server.'
        });
      });
  }, []);

  const handleSelectStep = (stepId) => {
    if (stepId === 6) {
      handleOpenSettings('logs');
      return;
    }
    setCurrentStep(stepId);
  };

  const handleResumeUploaded = (data) => {
    setResumeData(data);
    if (currentStep === 1) {
      setCurrentStep(2);
    }
  };

  const handleOpenSettings = (tab = 'ai') => {
    setSettingsTab(tab);
    setSettingsModalOpen(true);
  };

  const handleOpenLogs = () => {
    setSettingsTab('logs');
    setSettingsModalOpen(true);
  };

  // Trigger outbound email campaign
  const handleTriggerSend = () => {
    const activeSmtp = (config?.smtpProfiles || []).find(p => p.isDefault) || config?.smtpProfiles?.[0];
    if (!activeSmtp || !activeSmtp.isConfigured) {
      addToast({
        type: 'error',
        title: 'SMTP Profile Required',
        message: 'Please add and configure your SMTP credentials in Settings before sending.'
      });
      handleOpenSettings('smtp');
      return;
    }

    if (!resumeData) {
      addToast({
        type: 'error',
        title: 'Resume Required',
        message: 'Please upload candidate resume in Step 1.'
      });
      return;
    }

    // Build recipient payload with generated or edited subject/body
    const readyRecipients = recipients
      .filter(r => generatedEmails[r.id]?.body)
      .map(r => ({
        id: r.id,
        email: r.email,
        name: r.name,
        company: r.company,
        role: r.role,
        subject: generatedEmails[r.id].subject,
        body: generatedEmails[r.id].body
      }));

    if (readyRecipients.length === 0) {
      addToast({
        type: 'error',
        title: 'No Drafts Ready',
        message: 'Please click "Generate Tailored Cold Emails" in Step 4 before sending.'
      });
      return;
    }

    // Reset and open send progress modal
    setProgressData({ current: 0, total: readyRecipients.length, recipientEmail: '', status: 'starting' });
    setThrottlingData(null);
    setCampaignSendLogs([]);
    setCampaignSummary(null);
    setIsSending(true);
    setSendModalOpen(true);

    const delay = config?.sendingPreferences?.delaySeconds || 3;
    const attachResume = config?.sendingPreferences?.attachResume !== false;

    streamEmailSending({
      recipients: readyRecipients,
      resumeFileId: attachResume ? resumeData.fileId : null,
      smtpProfileId: activeSmtp.id,
      delaySeconds: delay,
      onEvent: (eventType, eventData) => {
        if (eventType === 'start') {
          setProgressData({ current: 0, total: eventData.total, status: 'started' });
        } else if (eventType === 'progress') {
          setThrottlingData(null);
          setProgressData({
            current: eventData.current,
            total: eventData.total,
            recipientEmail: eventData.recipientEmail,
            recipientName: eventData.recipientName,
            status: 'sending'
          });
        } else if (eventType === 'item_complete') {
          setCampaignSendLogs(prev => [eventData.logItem, ...prev]);
        } else if (eventType === 'throttling') {
          setThrottlingData({
            waitingSeconds: eventData.waitingSeconds,
            nextIndex: eventData.nextIndex
          });
        } else if (eventType === 'finished') {
          setIsSending(false);
          setThrottlingData(null);
          setCampaignSummary({
            total: eventData.total,
            sentCount: eventData.sentCount,
            failedCount: eventData.failedCount
          });
          addToast({
            type: 'success',
            title: 'Campaign Complete',
            message: `Finished sending ${eventData.sentCount} of ${eventData.total} emails.`
          });
        }
      },
      onError: (err) => {
        setIsSending(false);
        addToast({
          type: 'error',
          title: 'Sending Error',
          message: err.message
        });
      }
    });
  };

  return (
    <>
      <Header
        config={config}
        onOpenSettings={handleOpenSettings}
        onOpenLogs={handleOpenLogs}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="app-container">
        {/* Step Progression Bar */}
        <StepIndicator
          currentStep={currentStep}
          onSelectStep={handleSelectStep}
          resumeReady={Boolean(resumeData)}
          aiReady={Boolean(config?.aiProviders?.[config?.activeProvider || 'gemini']?.isConfigured)}
          recipientsCount={recipients.length}
          jdReady={Boolean(jobDescription && jobDescription.trim())}
          emailReady={Boolean(Object.keys(generatedEmails).length > 0)}
        />

        {/* Main 2-Column Dashboard Grid */}
        <div className="dashboard-grid">
          {/* Left Column: Setup Inputs (Resume, Recipients, JD) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Step 1: Resume Upload */}
            <ResumeUpload
              resumeData={resumeData}
              onResumeUploaded={handleResumeUploaded}
              onShowToast={addToast}
              config={config}
              onOpenSettings={handleOpenSettings}
            />

            {/* Step 2: Recipients Manager */}
            <RecipientManager
              recipients={recipients}
              onUpdateRecipients={setRecipients}
              onShowToast={addToast}
            />

            {/* Step 3: Optional Job Description */}
            <JobDescriptionInput
              jobDescription={jobDescription}
              onChangeJd={setJobDescription}
              onShowToast={addToast}
            />
          </div>

          {/* Right Column: AI Generation, Review & Send */}
          <div>
            <EmailPreview
              config={config}
              resumeData={resumeData}
              jobDescription={jobDescription}
              recipients={recipients}
              generatedEmails={generatedEmails}
              onUpdateGeneratedEmails={setGeneratedEmails}
              onOpenSettings={handleOpenSettings}
              onShowToast={addToast}
              onTriggerSend={handleTriggerSend}
            />
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
