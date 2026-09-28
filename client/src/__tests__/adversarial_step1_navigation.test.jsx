import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ResumeUpload from '../components/ResumeUpload';
import StepIndicator from '../components/StepIndicator';
import { useWizardState } from '../hooks/useWizardState';
import { uploadResume } from '../services/api';

vi.mock('../services/api', () => ({
  uploadResume: vi.fn(),
  deleteEphemeralResume: vi.fn()
}));

const mockResumeData = {
  fileId: 'adv-resume-101.pdf',
  originalFilename: 'Alex_Mercer_CV.pdf',
  sizeBytes: 154200,
  text: 'Alex Mercer\nSenior Staff Systems Engineer\nContact: alex@example.com | +1 555-0199',
  summarySnippet: 'Alex Mercer - Senior Staff Systems Engineer...',
  wordCount: 320,
  detectedName: 'Alex Mercer',
  detectedEmail: 'alex@example.com',
  detectedPhone: '+1 555-0199'
};

/**
 * Interactive test harness coupling useWizardState, StepIndicator, and ResumeUpload
 * identically to App.jsx.
 */
function WizardHarness({ initialResume = null, onLockedClick = undefined }) {
  const wizard = useWizardState(1);
  const handleUploaded = wizard.handleResumeUploaded;

  // If initialResume provided, initialize state once
  React.useEffect(() => {
    if (initialResume) {
      handleUploaded(initialResume, { autoAdvance: false });
    }
  }, [initialResume, handleUploaded]);

  return (
    <div>
      <StepIndicator
        currentStep={wizard.currentStep}
        onSelectStep={wizard.goToStep}
        onLockedClick={onLockedClick}
        resumeReady={wizard.resumeReady}
        recipientsCount={wizard.recipientsCount}
        jdReady={wizard.jdReady}
        emailReady={wizard.emailReady}
      />
      <div data-testid="current-step-display">{wizard.currentStep}</div>
      <div data-testid="candidate-name-display">{wizard.resumeData?.detectedName || ''}</div>
      <div data-testid="candidate-email-display">{wizard.resumeData?.detectedEmail || ''}</div>
      <div data-testid="candidate-phone-display">{wizard.resumeData?.detectedPhone || ''}</div>

      {wizard.currentStep === 1 && (
        <ResumeUpload
          resumeData={wizard.resumeData}
          onResumeUploaded={wizard.handleResumeUploaded}
          onResumeChange={wizard.handleResumeChange}
          onShowToast={vi.fn()}
        />
      )}
      {wizard.currentStep === 2 && (
        <div data-testid="step-2-container">Step 2: Recipient Management Active</div>
      )}
    </div>
  );
}

describe('Adversarial Stress Test: Step 1 Keystroke Isolation & Auto-Advance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Rapid Typing Stress & Isolation
  // ---------------------------------------------------------------------------
  it('resists 100 rapid successive keystrokes in Name without advancing to Step 2', async () => {
    render(<WizardHarness initialResume={mockResumeData} />);

    expect(screen.getByTestId('current-step-display')).toHaveTextContent('1');
    const nameInput = screen.getByPlaceholderText('Candidate Name');

    // Simulate 100 rapid keystrokes
    let currentVal = 'Alex';
    for (let i = 0; i < 100; i++) {
      currentVal += String.fromCharCode(65 + (i % 26));
      fireEvent.change(nameInput, { target: { value: currentVal } });
    }

    expect(screen.getByTestId('current-step-display')).toHaveTextContent('1');
    expect(screen.getByTestId('candidate-name-display')).toHaveTextContent(currentVal);
    expect(screen.queryByTestId('step-2-container')).not.toBeInTheDocument();
  });

  it('resists rapid round-robin keystrokes across Name, Email, and Phone', async () => {
    render(<WizardHarness initialResume={mockResumeData} />);

    const nameInput = screen.getByPlaceholderText('Candidate Name');
    const emailInput = screen.getByPlaceholderText('name@example.com');
    const phoneInput = screen.getByPlaceholderText('+1 (555) 000-0000');

    // Rapid round-robin across all 3 inputs
    for (let cycle = 0; cycle < 30; cycle++) {
      fireEvent.change(nameInput, { target: { value: `User_${cycle}` } });
      expect(screen.getByTestId('current-step-display')).toHaveTextContent('1');

      fireEvent.change(emailInput, { target: { value: `user_${cycle}@domain.io` } });
      expect(screen.getByTestId('current-step-display')).toHaveTextContent('1');

      fireEvent.change(phoneInput, { target: { value: `+1-555-${1000 + cycle}` } });
      expect(screen.getByTestId('current-step-display')).toHaveTextContent('1');
    }

    expect(screen.getByTestId('candidate-name-display')).toHaveTextContent('User_29');
    expect(screen.getByTestId('candidate-email-display')).toHaveTextContent('user_29@domain.io');
    expect(screen.getByTestId('candidate-phone-display')).toHaveTextContent('+1-555-1029');
    expect(screen.getByTestId('current-step-display')).toHaveTextContent('1');
  });

  // ---------------------------------------------------------------------------
  // 2. Extreme Payloads, Pasting, and Clearing
  // ---------------------------------------------------------------------------
  it('resists massive text pasting (50,000 characters) without unexpected navigation', () => {
    render(<WizardHarness initialResume={mockResumeData} />);

    const nameInput = screen.getByPlaceholderText('Candidate Name');
    const hugePayload = 'Alex ' + 'A'.repeat(50000);

    fireEvent.change(nameInput, { target: { value: hugePayload } });

    expect(screen.getByTestId('current-step-display')).toHaveTextContent('1');
    expect(screen.getByTestId('candidate-name-display').textContent.length).toBeGreaterThan(50000);
  });

  it('resists clearing all profile fields to empty strings without advancing or crashing', () => {
    render(<WizardHarness initialResume={mockResumeData} />);

    const nameInput = screen.getByPlaceholderText('Candidate Name');
    const emailInput = screen.getByPlaceholderText('name@example.com');
    const phoneInput = screen.getByPlaceholderText('+1 (555) 000-0000');

    // Wipe out all fields
    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.change(emailInput, { target: { value: '' } });
    fireEvent.change(phoneInput, { target: { value: '' } });

    expect(screen.getByTestId('current-step-display')).toHaveTextContent('1');
    expect(screen.getByTestId('candidate-name-display')).toHaveTextContent('');
    expect(screen.getByTestId('candidate-email-display')).toHaveTextContent('');
    expect(screen.getByTestId('candidate-phone-display')).toHaveTextContent('');
  });

  // ---------------------------------------------------------------------------
  // 3. Hostile Characters & Code Injection Payloads
  // ---------------------------------------------------------------------------
  it('handles XSS, SQLi, and unicode emojis in profile fields safely on Step 1', () => {
    render(<WizardHarness initialResume={mockResumeData} />);

    const nameInput = screen.getByPlaceholderText('Candidate Name');
    const emailInput = screen.getByPlaceholderText('name@example.com');
    const phoneInput = screen.getByPlaceholderText('+1 (555) 000-0000');

    const sqli = "Robert'); DROP TABLE Students;--";
    const xss = '<script>alert(document.cookie)</script>';
    const unicode = '👩‍💻 Dr. Sören Kierkegaard 🚀 (ñ, å, ø)';

    fireEvent.change(nameInput, { target: { value: sqli } });
    fireEvent.change(emailInput, { target: { value: xss } });
    fireEvent.change(phoneInput, { target: { value: unicode } });

    expect(screen.getByTestId('current-step-display')).toHaveTextContent('1');
    expect(screen.getByTestId('candidate-name-display')).toHaveTextContent(sqli);
    expect(screen.getByTestId('candidate-email-display')).toHaveTextContent(xss);
    expect(screen.getByTestId('candidate-phone-display')).toHaveTextContent(unicode);
  });

  // ---------------------------------------------------------------------------
  // 4. Positive Auto-Advance Triggers (Sample Resume & File Upload)
  // ---------------------------------------------------------------------------
  it('clicking "Try with Sample Resume" DOES advance to Step 2', async () => {
    render(<WizardHarness initialResume={null} />);

    expect(screen.getByTestId('current-step-display')).toHaveTextContent('1');

    const sampleBtn = screen.getByRole('button', { name: /Try with Sample Resume/i });
    fireEvent.click(sampleBtn);

    expect(screen.getByTestId('current-step-display')).toHaveTextContent('2');
    expect(screen.getByTestId('step-2-container')).toBeInTheDocument();
    expect(screen.getByTestId('candidate-name-display')).toHaveTextContent('Alex Mercer');
  });

  it('uploading a valid PDF file DOES advance to Step 2', async () => {
    uploadResume.mockResolvedValueOnce(mockResumeData);

    const { container } = render(<WizardHarness initialResume={null} />);
    expect(screen.getByTestId('current-step-display')).toHaveTextContent('1');

    const fileInput = container.querySelector('input[type="file"]');
    const validFile = new File(['%PDF-1.4...'], 'resume.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(screen.getByTestId('current-step-display')).toHaveTextContent('2');
    });
    expect(screen.getByTestId('step-2-container')).toBeInTheDocument();
  });

  it('dropping a valid PDF file onto dropzone DOES advance to Step 2', async () => {
    uploadResume.mockResolvedValueOnce(mockResumeData);

    const { container } = render(<WizardHarness initialResume={null} />);
    const dropzone = container.querySelector('.dropzone');
    const validFile = new File(['%PDF-1.4...'], 'dropped.pdf', { type: 'application/pdf' });

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [validFile] }
    });

    await waitFor(() => {
      expect(screen.getByTestId('current-step-display')).toHaveTextContent('2');
    });
    expect(screen.getByTestId('step-2-container')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // 5. Negative Upload Triggers (Must NOT advance)
  // ---------------------------------------------------------------------------
  it('failed file upload or oversized file does NOT advance from Step 1', async () => {
    const { container } = render(<WizardHarness initialResume={null} />);

    const fileInput = container.querySelector('input[type="file"]');
    const hugeFile = new File(['huge'], 'huge.pdf', { type: 'application/pdf' });
    Object.defineProperty(hugeFile, 'size', { value: 10 * 1024 * 1024 }); // 10MB

    fireEvent.change(fileInput, { target: { files: [hugeFile] } });

    expect(screen.getByTestId('current-step-display')).toHaveTextContent('1');
    expect(screen.queryByTestId('step-2-container')).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // 6. Architectural Edge Case: Omission of onResumeChange Fallback Defense
  // ---------------------------------------------------------------------------
  it('verifies that omitting onResumeChange safely defends with autoAdvance: false preventing step 2 jump', () => {
    let step = 1;
    let resume = mockResumeData;

    const handleResumeUploaded = (data, options = {}) => {
      const autoAdvance = typeof options === 'boolean' ? options : (options.autoAdvance ?? true);
      resume = data;
      if (autoAdvance && data && step === 1) {
        step = 2;
      }
    };

    // Render ResumeUpload with onResumeChange missing:
    render(
      <ResumeUpload
        resumeData={resume}
        onResumeUploaded={handleResumeUploaded}
        onResumeChange={undefined}
      />
    );

    const nameInput = screen.getByPlaceholderText('Candidate Name');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });

    // Verifies that without onResumeChange, the fallback calls onResumeUploaded with { autoAdvance: false },
    // preserving step 1 and preventing premature auto-advance!
    expect(step).toBe(1);
  });
});

describe('Adversarial Stress Test: StepIndicator ARIA, Keyboard & Dynamic Titles', () => {
  // ---------------------------------------------------------------------------
  // 1. Dynamic Titles
  // ---------------------------------------------------------------------------
  it('correctly formats dynamic title Recipients (N) on Step 2 and leaves Step 3 as Target Role', () => {
    const testCases = [
      { recipientsCount: 0, expectedStep2: 'Recipients', expectedStep3: 'Target Role' },
      { recipientsCount: 1, expectedStep2: 'Recipients (1)', expectedStep3: 'Target Role' },
      { recipientsCount: 17, expectedStep2: 'Recipients (17)', expectedStep3: 'Target Role' },
      { recipientsCount: 999, expectedStep2: 'Recipients (999)', expectedStep3: 'Target Role' }
    ];

    for (const tc of testCases) {
      const { unmount } = render(
        <StepIndicator
          currentStep={1}
          onSelectStep={vi.fn()}
          resumeReady={true}
          recipientsCount={tc.recipientsCount}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toHaveTextContent('Profile & AI');
      expect(buttons[1]).toHaveTextContent(tc.expectedStep2);
      expect(buttons[2]).toHaveTextContent(tc.expectedStep3);
      expect(buttons[3]).toHaveTextContent('Drafts & Send');

      unmount();
    }
  });

  it('formats Recipients (N) when recipients array is provided directly', () => {
    const recipientsArray = [
      { id: 'r1', name: 'Alice' },
      { id: 'r2', name: 'Bob' },
      { id: 'r3', name: 'Charlie' }
    ];

    render(
      <StepIndicator
        currentStep={2}
        onSelectStep={vi.fn()}
        resumeReady={true}
        recipients={recipientsArray}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons[1]).toHaveTextContent('Recipients (3)');
    expect(buttons[2]).toHaveTextContent('Target Role');
  });

  // ---------------------------------------------------------------------------
  // 2. Tab Navigation & Keyboard Focusability
  // ---------------------------------------------------------------------------
  it('ensures all 4 step buttons remain focusable via Tab even when steps are locked', () => {
    render(
      <StepIndicator
        currentStep={1}
        onSelectStep={vi.fn()}
        resumeReady={false}
        recipientsCount={0}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);

    // Verify none of the buttons have the HTML disabled attribute (which would trap/kill Tab focus)
    buttons.forEach((btn) => {
      expect(btn).not.toBeDisabled();
      btn.focus();
      expect(document.activeElement).toBe(btn);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. ARIA States (aria-current and aria-disabled)
  // ---------------------------------------------------------------------------
  it('correctly sets aria-current and aria-disabled across locked and unlocked states', () => {
    const { rerender } = render(
      <StepIndicator
        currentStep={1}
        onSelectStep={vi.fn()}
        resumeReady={false}
      />
    );

    let buttons = screen.getAllByRole('button');
    // Step 1: active, unlocked
    expect(buttons[0]).toHaveAttribute('aria-current', 'step');
    expect(buttons[0]).not.toHaveAttribute('aria-disabled');

    // Steps 2, 3, 4: locked
    expect(buttons[1]).not.toHaveAttribute('aria-current');
    expect(buttons[1]).toHaveAttribute('aria-disabled', 'true');
    expect(buttons[2]).toHaveAttribute('aria-disabled', 'true');
    expect(buttons[3]).toHaveAttribute('aria-disabled', 'true');

    // Rerender on Step 2 with resume uploaded
    rerender(
      <StepIndicator
        currentStep={2}
        onSelectStep={vi.fn()}
        resumeReady={true}
        recipientsCount={2}
      />
    );

    buttons = screen.getAllByRole('button');
    expect(buttons[0]).not.toHaveAttribute('aria-current');
    expect(buttons[1]).toHaveAttribute('aria-current', 'step');
    expect(buttons[1]).not.toHaveAttribute('aria-disabled');
    expect(buttons[2]).not.toHaveAttribute('aria-disabled'); // Step 3 unlocked when resumeReady
    expect(buttons[3]).not.toHaveAttribute('aria-disabled'); // Step 4 unlocked when recipients > 0
  });

  // ---------------------------------------------------------------------------
  // 4. Enter and Space on Locked Steps (MUST NOT ADVANCE)
  // ---------------------------------------------------------------------------
  it('pressing Enter or Space or clicking on a locked step does NOT call onSelectStep', () => {
    const onSelectStep = vi.fn();
    const onLockedClick = vi.fn();

    render(
      <StepIndicator
        currentStep={1}
        onSelectStep={onSelectStep}
        onLockedClick={onLockedClick}
        resumeReady={false}
      />
    );

    const buttons = screen.getAllByRole('button');
    const lockedStep2 = buttons[1];
    const lockedStep4 = buttons[3];

    // 1. Click locked Step 2
    fireEvent.click(lockedStep2);
    expect(onSelectStep).not.toHaveBeenCalled();
    expect(onLockedClick).toHaveBeenCalledWith('Upload candidate resume in Step 1 to unlock');

    // 2. Press Enter on locked Step 4 (button click synthesized)
    lockedStep4.focus();
    fireEvent.keyDown(lockedStep4, { key: 'Enter', code: 'Enter' });
    fireEvent.click(lockedStep4);
    expect(onSelectStep).not.toHaveBeenCalled();
    expect(onLockedClick).toHaveBeenCalledWith('Upload candidate resume in Step 1 to unlock');

    // 3. Press Space on locked Step 2
    lockedStep2.focus();
    fireEvent.keyDown(lockedStep2, { key: ' ', code: 'Space' });
    fireEvent.click(lockedStep2);
    expect(onSelectStep).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 5. Enter and Space on Unlocked Steps (MUST ADVANCE)
  // ---------------------------------------------------------------------------
  it('clicking or keyboard-activating an unlocked step successfully calls onSelectStep', () => {
    const onSelectStep = vi.fn();

    render(
      <StepIndicator
        currentStep={1}
        onSelectStep={onSelectStep}
        resumeReady={true}
        recipientsCount={5}
      />
    );

    const buttons = screen.getAllByRole('button');

    // Click Step 2
    fireEvent.click(buttons[1]);
    expect(onSelectStep).toHaveBeenCalledWith(2);

    // Keyboard-activate Step 3 (simulate browser click on Enter)
    buttons[2].focus();
    fireEvent.click(buttons[2]);
    expect(onSelectStep).toHaveBeenCalledWith(3);

    // Keyboard-activate Step 4
    buttons[3].focus();
    fireEvent.click(buttons[3]);
    expect(onSelectStep).toHaveBeenCalledWith(4);
  });
});
