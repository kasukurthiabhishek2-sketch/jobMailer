/**
 * Canonical Single-Source-of-Truth Wizard Step Configuration (TICK-CYC3-07 / B1)
 *
 * Defines step identity, ordering, labels, descriptions, and gating predicates.
 * Consumed by:
 * - StepIndicator.jsx (navigation tabs, accessible ARIA, unlock/lock states)
 * - Header.jsx (Quick-Start Guide modal cards)
 * - App.jsx / useWizardState (step navigation and transition gating)
 * - All validation and toast messages across the application
 */

export const WIZARD_STEPS = [
  {
    id: 1,
    stepNumber: 1,
    label: 'Candidate Profile & AI Setup',
    shortLabel: 'Profile & AI',
    description: 'Upload your resume (.pdf or .docx). Configure and test at least one AI provider (Gemini, Groq, OpenAI, or Copilot) to generate personalized outreach.',
    optional: false,
    isUnlocked: () => true,
    getLockReason: () => null,
    isCompleted: (state) => Boolean(state?.resumeData)
  },
  {
    id: 2,
    stepNumber: 2,
    label: 'Recipient Management',
    shortLabel: 'Recipients',
    description: 'Import recruiters and hiring managers from Excel/CSV or add them manually. RFC-standard validation highlights formatting errors automatically.',
    optional: false,
    isUnlocked: (state) => Boolean(state?.resumeData),
    getLockReason: (state) => (!state?.resumeData ? 'Upload candidate resume in Step 1 to unlock' : null),
    isCompleted: (state) => Boolean(state?.recipients && state.recipients.length > 0)
  },
  {
    id: 3,
    stepNumber: 3,
    label: 'Target Role & Strategy',
    shortLabel: 'Target Role',
    description: 'Paste a specific job description to spotlight relevant skills and metrics, or skip to generate a direct value intro pitch.',
    optional: true,
    isUnlocked: (state) => Boolean(state?.resumeData),
    getLockReason: (state) => (!state?.resumeData ? 'Upload candidate resume in Step 1 to unlock' : null),
    isCompleted: (state) => Boolean(state?.jobDescription && state.jobDescription.trim())
  },
  {
    id: 4,
    stepNumber: 4,
    label: 'AI Drafts & Safe Outreach Dispatch',
    shortLabel: 'Drafts & Send',
    description: 'Generate personalized drafts concurrently, inspect claim grounding scores against your resume, and dispatch verified outreach.',
    optional: false,
    isUnlocked: (state) => Boolean(state?.resumeData && state?.recipients && state.recipients.length > 0),
    getLockReason: (state) => {
      if (!state?.resumeData) return 'Upload candidate resume in Step 1 to unlock';
      if (!state?.recipients || state.recipients.length === 0) return 'Add at least one recipient in Step 2 to unlock';
      return null;
    },
    isCompleted: (state) => Boolean(
      state?.campaignCompleted ||
      (state?.recipients &&
       state.recipients.length > 0 &&
       state?.generatedEmails &&
       state.recipients.some(r => state.generatedEmails[r.id]?.body))
    )
  }
];

export function getStepById(stepId) {
  return WIZARD_STEPS.find(s => s.id === stepId) || WIZARD_STEPS[0];
}

export function getStepNumber(stepId) {
  const step = getStepById(stepId);
  return step.stepNumber;
}

export function isStepUnlocked(stepId, state) {
  const step = WIZARD_STEPS.find(s => s.id === stepId);
  return step ? step.isUnlocked(state) : false;
}

export function getStepLockReason(stepId, state) {
  const step = WIZARD_STEPS.find(s => s.id === stepId);
  return step ? step.getLockReason(state) : null;
}
