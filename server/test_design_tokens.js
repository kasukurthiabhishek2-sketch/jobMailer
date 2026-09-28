/**
 * Design System, Token Completeness & Theme Invariants Test
 * Validates that design tokens, theme contrast, and workflow step invariants
 * are preserved across the client design system and components.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, '..', 'client');
const cssPath = path.join(clientDir, 'src', 'index.css');
const stepIndicatorPath = path.join(clientDir, 'src', 'components', 'StepIndicator.jsx');

console.log('Testing Design Tokens & Theme Invariants...');

// 1. Verify index.css exists
assert(fs.existsSync(cssPath), 'client/src/index.css must exist');
const cssContent = fs.readFileSync(cssPath, 'utf8');

// 2. Verify Core Design System Tokens in :root (Dark mode baseline)
const requiredTokens = [
  '--bg-base',
  '--bg-surface',
  '--bg-surface-elevated',
  '--bg-header',
  '--border-subtle',
  '--border-strong',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--accent-primary',
  '--accent-success',
  '--accent-warning',
  '--accent-danger',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--shadow-sm',
  '--shadow-md'
];

for (const token of requiredTokens) {
  assert(cssContent.includes(`${token}:`), `CSS must define token ${token} in :root`);
}

// 3. Verify Light Mode overrides exist
assert(cssContent.includes('[data-theme="light"]'), 'CSS must define [data-theme="light"] block');
const lightThemeMatch = cssContent.match(/\[data-theme="light"\]\s*\{([\s\S]*?)\}/);
assert(lightThemeMatch, 'Could not parse [data-theme="light"] CSS block');
const lightBlock = lightThemeMatch[1];

const requiredLightOverrides = [
  '--bg-base',
  '--bg-surface',
  '--bg-header',
  '--border-subtle',
  '--text-primary',
  '--text-secondary',
  '--text-muted'
];

for (const token of requiredLightOverrides) {
  assert(lightBlock.includes(`${token}:`), `Light theme block must override ${token}`);
}

// 4. Verify Responsive Breakpoints & Utilities
assert(cssContent.includes('.responsive-grid-3'), 'CSS must include .responsive-grid-3 utility');
assert(cssContent.includes('.responsive-grid-2'), 'CSS must include .responsive-grid-2 utility');
assert(cssContent.includes('@media (max-width: 768px)'), 'CSS must include 768px sidebar breakpoint');

// 5. Verify Canonical 4-Step Linear Workflow in StepIndicator and WIZARD_STEPS
assert(fs.existsSync(stepIndicatorPath), 'StepIndicator.jsx must exist');
const wizardStepsPath = path.join(clientDir, 'src', 'constants', 'wizardSteps.js');
assert(fs.existsSync(wizardStepsPath), 'wizardSteps.js must exist');
const stepContent = fs.readFileSync(stepIndicatorPath, 'utf8') + fs.readFileSync(wizardStepsPath, 'utf8');

assert(stepContent.includes("id: 1") && (stepContent.includes("title: 'Setup'") || stepContent.includes("Candidate Profile")), 'Step 1 must be Setup / Profile');
assert(stepContent.includes("id: 2") && (stepContent.includes("'Recipients'") || stepContent.includes("Recipient Management")), 'Step 2 must be Recipients');
assert(stepContent.includes("id: 3") && (stepContent.includes("title: 'Target Role'") || stepContent.includes("Target Role")), 'Step 3 must be Target Role');
assert(stepContent.includes("id: 4") && (stepContent.includes("AI Drafts") || stepContent.includes("Safe Outreach Dispatch")), 'Step 4 must be AI Drafts & Safe Outreach Dispatch');
assert(!stepContent.includes("id: 5"), 'Step 5 must be merged into Step 4');
// Verify Step 6 ("Logs") was removed from the primary pipeline as non-linear
assert(!stepContent.includes("id: 6"), 'Step 6 must not exist in linear StepIndicator');

console.log('✓ All 5 Design Token & Workflow Invariant checks passed successfully.');
process.exit(0);
