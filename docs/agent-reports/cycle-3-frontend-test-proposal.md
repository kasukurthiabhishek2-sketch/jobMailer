# Frontend Test Harness Proposal: Vitest + React Testing Library (Cycle 3)

- **Date:** 2026-09-28
- **Ticket:** `TICK-CYC3-23`
- **Role:** QA / Test Automation Lead & Principal Frontend Architect
- **Status:** Proposal — Awaiting Human Approval Before Installing Dependencies

---

## 1. Justification

The backend has 14 regression test suites running via `server/test_runner_all.js`. In contrast, the frontend relies solely on Oxlint static analysis with zero unit or component interaction tests.

Workstreams B and C introduce foundational React state architecture refactors:
- `client/src/constants/wizardSteps.js` (`WIZARD_STEPS` config and `isUnlocked` predicates)
- `useWizardState` custom hook extraction from `App.jsx`
- `StepIndicator.jsx` clickable navigation, keyboard/aria accessibility, and duplicate-render prevention
- `EmailPreview.jsx` batch generation and claim grounding display

Without an automated test harness, verifying that `StepIndicator` renders exactly one DOM node, that locked steps refuse navigation, or that wizard state transitions correctly requires tedious manual clicking in the browser and will easily regress silently.

---

## 2. Proposed Minimal Test Stack

Because the client is built on **Vite 6** and **React 19**, Vitest integrates natively without extra build tools, Babel, or Webpack wrappers.

### Required Dev Dependencies (Client Workspace Only)
- `vitest` (Fast, native Vite test runner matching Vite configuration)
- `@testing-library/react` (DOM testing utilities focused on user behavior)
- `@testing-library/jest-dom` (Custom matchers like `toBeInTheDocument()`, `toBeDisabled()`)
- `jsdom` (Lightweight headless DOM environment for Node.js)

```bash
cd client && npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

---

## 3. Targeted Test Coverage (Minimal, High-Value Scope)

We propose starting with 3 focused test suites targeting the exact surfaces being refactored in Workstreams B & C:

1. **`client/src/__tests__/wizardSteps.test.js`**:
   - Asserts `WIZARD_STEPS` array has exactly 5 steps in the correct canonical order (1: Profile, 2: Target Role, 3: Recipients, 4: Drafts, 5: Send).
   - Validates `isUnlocked(state)` predicates:
     - Step 1: Always unlocked.
     - Step 2: Unlocked when resume is uploaded.
     - Step 3: Unlocked when resume is uploaded.
     - Step 4: Locked until resume is uploaded AND at least 1 recipient is added.
     - Step 5: Locked until at least 1 email draft is generated.

2. **`client/src/__tests__/StepIndicator.test.jsx`**:
   - Asserts exactly one `<nav class="step-bar">` is rendered.
   - Asserts locked steps have `disabled` attribute and `aria-disabled="true"`.
   - Asserts active step has `aria-current="step"`.
   - Asserts clicking an unlocked step triggers `onSelectStep(stepId)`.
   - Asserts clicking a locked step does not trigger `onSelectStep`.

3. **`client/src/__tests__/useWizardState.test.js`**:
   - Asserts initial step defaults to 1.
   - Asserts `goToStep(targetId)` respects unlock predicates.
   - Asserts step progression updates directional slide state (`forward` vs `backward`).

---

## 4. Execution Script Integration

Update `client/package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Integration into top-level check:
```bash
npm run test:all # or cd client && npm test
```

---

## 5. Decision Request for User / Human Lead

Do you approve installing `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, and `jsdom` into `client/package.json` to enable automated frontend testing for Cycle 3?
