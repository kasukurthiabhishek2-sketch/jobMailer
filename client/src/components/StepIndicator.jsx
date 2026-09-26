import React from 'react';
import { Check, AlertTriangle } from 'lucide-react';

export default function StepIndicator({
  currentStep,
  onSelectStep,
  resumeReady = false,
  aiReady = true,
  recipientsCount = 0,
  jdReady = false,
  emailReady = false,
  stepStates
}) {
  const steps = [
    {
      id: 1,
      title: 'Setup',
      isUnlocked: true,
      isCompleted: stepStates?.[1]?.completed ?? (resumeReady && aiReady),
      hasError: stepStates?.[1]?.hasError ?? (!resumeReady && currentStep > 1)
    },
    {
      id: 2,
      title: recipientsCount > 0 ? `Recipients (${recipientsCount})` : 'Recipients',
      isUnlocked: stepStates?.[2]?.unlocked ?? resumeReady,
      isCompleted: stepStates?.[2]?.completed ?? (recipientsCount > 0),
      hasError: stepStates?.[2]?.hasError ?? (currentStep > 2 && recipientsCount === 0)
    },
    {
      id: 3,
      title: 'Job Description',
      optional: true,
      isUnlocked: stepStates?.[3]?.unlocked ?? (resumeReady && recipientsCount > 0),
      isCompleted: stepStates?.[3]?.completed ?? Boolean(jdReady),
      hasError: false
    },
    {
      id: 4,
      title: 'Generate & Review',
      isUnlocked: stepStates?.[4]?.unlocked ?? (resumeReady && recipientsCount > 0),
      isCompleted: stepStates?.[4]?.completed ?? Boolean(emailReady),
      hasError: stepStates?.[4]?.hasError ?? (currentStep > 4 && !emailReady)
    },
    {
      id: 5,
      title: 'Send',
      isUnlocked: stepStates?.[5]?.unlocked ?? Boolean(emailReady),
      isCompleted: stepStates?.[5]?.completed ?? false,
      hasError: false
    },
    {
      id: 6,
      title: 'Logs',
      alwaysUnlocked: true,
      isUnlocked: true,
      isCompleted: false,
      hasError: false
    }
  ];

  return (
    <nav className="step-bar" aria-label="Workflow Steps">
      {steps.map((step, idx) => {
        const isActive = currentStep === step.id;
        const isDone = step.isCompleted;
        const isUnlocked = step.isUnlocked || step.alwaysUnlocked;
        const hasError = step.hasError;

        return (
          <React.Fragment key={step.id}>
            <button
              type="button"
              className={`step-item ${isActive ? 'active' : ''} ${isDone ? 'completed' : ''} ${hasError ? 'has-error' : ''} ${!isUnlocked ? 'locked' : ''}`}
              onClick={() => {
                if (isUnlocked) onSelectStep(step.id);
              }}
              disabled={!isUnlocked}
              title={
                !isUnlocked
                  ? `Complete previous steps to unlock ${step.title}`
                  : hasError
                  ? `${step.title} needs attention`
                  : step.title
              }
              aria-current={isActive ? 'step' : undefined}
            >
              <div className="step-number">
                {isDone ? (
                  <Check size={14} />
                ) : hasError ? (
                  <AlertTriangle size={14} />
                ) : (
                  step.id
                )}
              </div>
              <div className="step-title-group">
                <span className="step-title">{step.title}</span>
                {step.optional && <span className="step-optional-badge">Optional</span>}
              </div>
            </button>
            {idx < steps.length - 1 && (
              <div className={`step-separator ${isDone ? 'completed' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
