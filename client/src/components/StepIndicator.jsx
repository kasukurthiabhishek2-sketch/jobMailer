import React from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import { WIZARD_STEPS } from '../constants/wizardSteps';

export default function StepIndicator({
  currentStep = 1,
  onSelectStep,
  onLockedClick,
  state,
  resumeReady = false,
  recipientsCount = 0,
  recipients = [],
  jdReady = false,
  jobDescription = '',
  emailReady = false,
  generatedEmails = {},
  stepStates
}) {
  // Normalize state for gating predicates
  const activeRecipients = Array.isArray(recipients) && recipients.length > 0
    ? recipients
    : Array.from({ length: recipientsCount || 0 }, (_, i) => ({ id: `rec_${i}` }));

  const currentState = state || {
    resumeData: resumeReady ? { text: 'loaded' } : null,
    recipients: activeRecipients,
    jobDescription: jdReady ? (jobDescription || 'provided') : jobDescription,
    generatedEmails: emailReady && Object.keys(generatedEmails).length === 0
      ? { default: { body: 'draft' } }
      : generatedEmails
  };

  return (
    <nav className="step-bar" aria-label="Workflow Steps">
      {WIZARD_STEPS.map((step, idx) => {
        const isActive = currentStep === step.id;
        const isUnlocked = step.isUnlocked(currentState);
        const isDone = stepStates?.[step.id]?.completed ?? step.isCompleted(currentState);
        const hasError = stepStates?.[step.id]?.hasError ?? false;
        const lockReason = step.getLockReason(currentState);

        // Dynamic title for recipients step
        let displayTitle = step.shortLabel || step.label;
        if (step.id === 2 && activeRecipients.length > 0) {
          displayTitle = `Recipients (${activeRecipients.length})`;
        }

        const tooltip = !isUnlocked
          ? (lockReason || `Complete previous steps to unlock ${step.label}`)
          : hasError
          ? `${displayTitle} needs attention`
          : step.label;

        return (
          <React.Fragment key={step.id}>
            <button
              type="button"
              className={`step-item ${isActive ? 'active' : ''} ${isDone ? 'completed' : ''} ${hasError ? 'has-error' : ''} ${!isUnlocked ? 'locked' : ''}`}
              onClick={() => {
                if (isUnlocked) {
                  onSelectStep?.(step.id);
                } else if (onLockedClick && lockReason) {
                  onLockedClick(lockReason);
                }
              }}
              title={tooltip}
              aria-current={isActive ? 'step' : undefined}
              aria-disabled={!isUnlocked ? 'true' : undefined}
            >
              <div className="step-number">
                {isDone ? (
                  <Check size={14} />
                ) : hasError ? (
                  <AlertTriangle size={14} />
                ) : (
                  step.stepNumber
                )}
              </div>
              <div className="step-title-group">
                <span className="step-title">{displayTitle}</span>
                {step.optional && <span className="step-optional-badge">Optional</span>}
              </div>
            </button>
            {idx < WIZARD_STEPS.length - 1 && (
              <div className={`step-separator ${isDone ? 'completed' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
