import { describe, it, expect } from 'vitest';
import {
  WIZARD_STEPS,
  getStepById,
  getStepNumber,
  isStepUnlocked,
  getStepLockReason
} from '../constants/wizardSteps';

describe('WIZARD_STEPS Canonical Configuration', () => {
  it('has exactly 4 steps in canonical order', () => {
    expect(WIZARD_STEPS).toHaveLength(4);
    expect(WIZARD_STEPS.map(s => s.id)).toEqual([1, 2, 3, 4]);
    expect(WIZARD_STEPS.map(s => s.stepNumber)).toEqual([1, 2, 3, 4]);
    expect(WIZARD_STEPS[3].shortLabel).toBe('Drafts & Send');
  });

  it('verifies Step 1 is always unlocked', () => {
    expect(isStepUnlocked(1, {})).toBe(true);
    expect(getStepLockReason(1, {})).toBeNull();
  });

  it('verifies Step 2 and Step 3 require resume', () => {
    const emptyState = {};
    expect(isStepUnlocked(2, emptyState)).toBe(false);
    expect(isStepUnlocked(3, emptyState)).toBe(false);
    expect(getStepLockReason(2, emptyState)).toContain('Step 1');
    expect(getStepLockReason(3, emptyState)).toContain('Step 1');

    const stateWithResume = { resumeData: { text: 'Candidate text' } };
    expect(isStepUnlocked(2, stateWithResume)).toBe(true);
    expect(isStepUnlocked(3, stateWithResume)).toBe(true);
  });

  it('verifies Step 4 requires both resume and at least 1 recipient', () => {
    const onlyResume = { resumeData: { text: 'Resume' }, recipients: [] };
    expect(isStepUnlocked(4, onlyResume)).toBe(false);
    expect(getStepLockReason(4, onlyResume)).toContain('Step 3');

    const readyForStep4 = {
      resumeData: { text: 'Resume' },
      recipients: [{ id: 'r1', email: 'test@example.com' }]
    };
    expect(isStepUnlocked(4, readyForStep4)).toBe(true);
  });

  it('verifies Step 4 isCompleted predicate for drafts or campaign completion', () => {
    const step4 = getStepById(4);

    const emptyDrafts = {
      recipients: [{ id: 'r1', email: 'test@example.com' }],
      generatedEmails: {}
    };
    expect(step4.isCompleted(emptyDrafts)).toBe(false);

    const withDraft = {
      recipients: [{ id: 'r1', email: 'test@example.com' }],
      generatedEmails: { r1: { body: 'Personalized intro' } }
    };
    expect(step4.isCompleted(withDraft)).toBe(true);

    const campaignDone = {
      campaignCompleted: true,
      recipients: [],
      generatedEmails: {}
    };
    expect(step4.isCompleted(campaignDone)).toBe(true);
  });

  it('getStepById returns fallback for unknown step', () => {
    expect(getStepById(99).id).toBe(1);
    expect(getStepNumber(3)).toBe(3);
  });
});
