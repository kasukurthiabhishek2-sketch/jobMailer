import { useState, useCallback } from 'react';
import { isStepUnlocked, getStepLockReason } from '../constants/wizardSteps';

/**
 * useWizardState — Central hook managing the multi-step cold outreach wizard.
 *
 * Responsibilities:
 * - Active step and directional physical slide transitions
 * - Candidate profile, target role JD, recipients, and generated drafts state
 * - Step unlock gating and validation via centralized WIZARD_STEPS
 * - Reset and auto-advancement transitions
 */
export function useWizardState(initialStep = 1) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [direction, setDirection] = useState('forward');
  const [resumeData, setResumeData] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [jobDescription, setJobDescription] = useState('');
  const [generatedEmails, setGeneratedEmails] = useState({});

  const wizardSnapshot = {
    resumeData,
    recipients,
    jobDescription,
    generatedEmails
  };

  const canGoToStep = useCallback((stepId) => {
    return isStepUnlocked(stepId, {
      resumeData,
      recipients,
      jobDescription,
      generatedEmails
    });
  }, [resumeData, recipients, jobDescription, generatedEmails]);

  const getLockReason = useCallback((stepId) => {
    return getStepLockReason(stepId, {
      resumeData,
      recipients,
      jobDescription,
      generatedEmails
    });
  }, [resumeData, recipients, jobDescription, generatedEmails]);

  const goToStep = useCallback((stepId) => {
    if (stepId === currentStep) return false;
    // Allow going backwards freely; gate forward transitions on unlock status
    if (stepId > currentStep && !canGoToStep(stepId)) {
      return false;
    }
    setDirection(stepId > currentStep ? 'forward' : 'backward');
    setCurrentStep(stepId);
    return true;
  }, [currentStep, canGoToStep]);

  const handleResumeUploaded = useCallback((data, options = {}) => {
    const autoAdvance = typeof options === 'boolean' ? options : (options.autoAdvance ?? true);
    setResumeData(data);
    if (autoAdvance && data && currentStep === 1) {
      setDirection('forward');
      setCurrentStep(2);
    }
  }, [currentStep]);

  const handleResumeChange = useCallback((data) => {
    setResumeData(data);
  }, []);

  const resetWizard = useCallback(() => {
    setCurrentStep(1);
    setDirection('forward');
    setResumeData(null);
    setRecipients([]);
    setJobDescription('');
    setGeneratedEmails({});
  }, []);

  return {
    currentStep,
    setCurrentStep,
    direction,
    setDirection,
    resumeData,
    setResumeData,
    recipients,
    setRecipients,
    jobDescription,
    setJobDescription,
    generatedEmails,
    setGeneratedEmails,
    // Navigation & validation
    goToStep,
    canGoToStep,
    getLockReason,
    handleResumeUploaded,
    handleResumeChange,
    resetWizard,
    // Computed / derived properties
    resumeReady: Boolean(resumeData),
    hasSpreadsheetRecipients: Boolean(
      recipients &&
      recipients.length > 0 &&
      recipients.some(r => r.source === 'spreadsheet')
    ),
    allRecipientsTailored: Boolean(
      recipients &&
      recipients.length > 0 &&
      recipients.every(r => (
        r.source === 'manual' ||
        r.source === 'ai_parse' ||
        (r.jobDescription && r.jobDescription.trim()) ||
        (r.role && r.role.trim()) ||
        r.id?.startsWith('rec_ai_')
      ))
    ),
    jdReady: Boolean(
      (jobDescription && jobDescription.trim()) ||
      (recipients &&
       recipients.length > 0 &&
       recipients.every(r => (
         r.source === 'manual' ||
         r.source === 'ai_parse' ||
         (r.jobDescription && r.jobDescription.trim()) ||
         (r.role && r.role.trim()) ||
         r.id?.startsWith('rec_ai_')
       )))
    ),
    recipientsCount: recipients.length,
    emailReady: Object.keys(generatedEmails).length > 0,
    readyRecipients: recipients.filter(r => generatedEmails[r.id]?.body),
    readyRecipientsCount: recipients.filter(r => generatedEmails[r.id]?.body).length,
    approvedRecipientsCount: recipients.filter(r => r.isApproved).length,
    wizardSnapshot
  };
}
