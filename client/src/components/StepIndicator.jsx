import React from 'react';
import { Check } from 'lucide-react';

export default function StepIndicator({ currentStep, onSelectStep, resumeReady, recipientsCount, jdReady, emailReady }) {
  const steps = [
    { id: 1, title: 'Upload Resume', isReady: resumeReady },
    { id: 2, title: `Recipients (${recipientsCount})`, isReady: recipientsCount > 0 },
    { id: 3, title: 'Job Description', isReady: jdReady, optional: true },
    { id: 4, title: 'AI Personalize & Review', isReady: emailReady },
    { id: 5, title: 'Send & Logs', isReady: false }
  ];

  return (
    <div className="step-bar">
      {steps.map((step, idx) => {
        const isActive = currentStep === step.id;
        const isDone = step.isReady && currentStep > step.id;

        return (
          <React.Fragment key={step.id}>
            <div
              className={`step-item ${isActive ? 'active' : ''} ${isDone ? 'completed' : ''}`}
              onClick={() => onSelectStep(step.id)}
            >
              <div className="step-number">
                {isDone ? <Check size={14} /> : step.id}
              </div>
              <div className="step-title">
                {step.title}
                {step.optional && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>(Optional)</span>}
              </div>
            </div>
            {idx < steps.length - 1 && <div className="step-separator" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
