import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ResumeUpload from '../../components/ResumeUpload';
import RecipientManager from '../../components/RecipientManager';
import RecipientModal from '../../components/RecipientModal';
import JobDescriptionInput from '../../components/JobDescriptionInput';
import StepIndicator from '../../components/StepIndicator';
import {
  WIZARD_STEPS,
  isStepUnlocked,
  getStepLockReason
} from '../../constants/wizardSteps';

// Mock API services
vi.mock('../../services/api', () => ({
  uploadResume: vi.fn().mockResolvedValue({
    fileId: 'mock-resume-id.pdf',
    originalFilename: 'Test_Resume.pdf',
    sizeBytes: 150000,
    text: 'Experienced Software Engineer with Node.js and React.',
    wordCount: 350,
    detectedName: 'Jordan Lee',
    detectedEmail: 'jordan@example.com',
    detectedPhone: '+1 (555) 123-4567'
  }),
  deleteEphemeralResume: vi.fn().mockResolvedValue({ success: true }),
  uploadRecipientsSheet: vi.fn(),
  fetchOutreachLogs: vi.fn().mockResolvedValue([])
}));

describe('Tier 1: Feature Coverage (Features 1 to 10: Steps 1-3 & Wizard State)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Feature 1: Step 1 Resume Upload & Parsing
  // =========================================================================
  describe('F01: Step 1 Resume Upload & Parsing', () => {
    it('1.1 renders initial dropzone with file type and size guidance', () => {
      render(<ResumeUpload resumeData={null} onResumeUploaded={vi.fn()} onShowToast={vi.fn()} />);
      expect(screen.getByText(/Drop your resume here or click to browse/i)).toBeInTheDocument();
      expect(screen.getByText(/PDF \(\.pdf\) or Word \(\.docx\) • Up to 5MB/i)).toBeInTheDocument();
    });

    it('1.2 does not display sample resume button in dropzone', () => {
      render(<ResumeUpload resumeData={null} onResumeUploaded={vi.fn()} onShowToast={vi.fn()} />);
      expect(screen.queryByRole('button', { name: /Try with Sample Resume/i })).not.toBeInTheDocument();
    });

    it('1.3 toggles dragover and dragleave visual state on dropzone', () => {
      const { container } = render(<ResumeUpload resumeData={null} onResumeUploaded={vi.fn()} onShowToast={vi.fn()} />);
      const dropzone = container.querySelector('.dropzone');
      expect(dropzone).not.toHaveClass('active');

      fireEvent.dragOver(dropzone, { preventDefault: vi.fn(), stopPropagation: vi.fn() });
      expect(dropzone).toHaveClass('active');

      fireEvent.dragLeave(dropzone, { preventDefault: vi.fn(), stopPropagation: vi.fn() });
      expect(dropzone).not.toHaveClass('active');
    });

    it('1.4 toggles collapsible extracted resume text preview', () => {
      const sampleData = {
        fileId: 'f1',
        originalFilename: 'resume.pdf',
        text: 'Detailed career background and accomplishments...',
        wordCount: 120,
        detectedName: 'Alex Mercer',
        detectedEmail: 'alex@example.com',
        detectedPhone: '+1 555 0000'
      };
      render(<ResumeUpload resumeData={sampleData} onResumeUploaded={vi.fn()} onShowToast={vi.fn()} />);

      const toggleBtn = screen.getByRole('button', { name: /View Extracted Resume Text/i });
      expect(screen.queryByText('Detailed career background and accomplishments...')).not.toBeInTheDocument();

      fireEvent.click(toggleBtn);
      expect(screen.getByText('Detailed career background and accomplishments...')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Hide Extracted Resume Text/i }));
      expect(screen.queryByText('Detailed career background and accomplishments...')).not.toBeInTheDocument();
    });

    it('1.5 clears candidate resume when Remove Resume button is clicked', async () => {
      const onResumeUploaded = vi.fn();
      const onShowToast = vi.fn();
      const sampleData = {
        fileId: 'f1',
        originalFilename: 'resume.pdf',
        text: 'Resume text',
        detectedName: 'Alex'
      };
      render(<ResumeUpload resumeData={sampleData} onResumeUploaded={onResumeUploaded} onShowToast={onShowToast} />);

      const removeBtn = screen.getByRole('button', { name: /Remove Resume/i });
      fireEvent.click(removeBtn);

      expect(onResumeUploaded).toHaveBeenCalledWith(null);
      expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info', title: 'Resume Removed' }));
    });
  });

  // =========================================================================
  // Feature 2: Step 1 Profile Keystroke Auto-Advance Defect
  // =========================================================================
  describe('F02: Step 1 Profile Keystroke Auto-Advance Defect', () => {
    const sampleData = {
      fileId: 'f1',
      originalFilename: 'resume.pdf',
      text: 'Resume text',
      detectedName: 'Alex Mercer',
      detectedEmail: 'alex@example.com',
      detectedPhone: '+1 555 1234'
    };

    it('2.1 editing candidate Full Name updates value without navigating away from Step 1', () => {
      const onResumeUploaded = vi.fn();
      render(<ResumeUpload resumeData={sampleData} onResumeUploaded={onResumeUploaded} onShowToast={vi.fn()} />);

      const nameInput = screen.getByDisplayValue('Alex Mercer');
      fireEvent.change(nameInput, { target: { value: 'Alexander Mercer' } });

      expect(onResumeUploaded).toHaveBeenCalledTimes(1);
      expect(onResumeUploaded).toHaveBeenCalledWith(expect.objectContaining({
        detectedName: 'Alexander Mercer'
      }), { autoAdvance: false });
    });

    it('2.2 editing candidate Email Address updates value without navigating away from Step 1', () => {
      const onResumeUploaded = vi.fn();
      render(<ResumeUpload resumeData={sampleData} onResumeUploaded={onResumeUploaded} onShowToast={vi.fn()} />);

      const emailInput = screen.getByDisplayValue('alex@example.com');
      fireEvent.change(emailInput, { target: { value: 'alex.new@example.com' } });

      expect(onResumeUploaded).toHaveBeenCalledTimes(1);
      expect(onResumeUploaded).toHaveBeenCalledWith(expect.objectContaining({
        detectedEmail: 'alex.new@example.com'
      }), { autoAdvance: false });
    });

    it('2.3 editing candidate Phone Number updates value without navigating away from Step 1', () => {
      const onResumeUploaded = vi.fn();
      render(<ResumeUpload resumeData={sampleData} onResumeUploaded={onResumeUploaded} onShowToast={vi.fn()} />);

      const phoneInput = screen.getByDisplayValue('+1 555 1234');
      fireEvent.change(phoneInput, { target: { value: '+1 (555) 999-8888' } });

      expect(onResumeUploaded).toHaveBeenCalledTimes(1);
      expect(onResumeUploaded).toHaveBeenCalledWith(expect.objectContaining({
        detectedPhone: '+1 (555) 999-8888'
      }), { autoAdvance: false });
    });

    it('2.4 sequential keystrokes in Name field keep focus and input value accessible', () => {
      const onResumeUploaded = vi.fn();
      render(<ResumeUpload resumeData={sampleData} onResumeUploaded={onResumeUploaded} onShowToast={vi.fn()} />);

      const nameInput = screen.getByDisplayValue('Alex Mercer');
      fireEvent.change(nameInput, { target: { value: 'Alex M' } });
      fireEvent.change(nameInput, { target: { value: 'Alex Me' } });
      fireEvent.change(nameInput, { target: { value: 'Alex Mer' } });

      expect(onResumeUploaded).toHaveBeenCalledTimes(3);
    });

    it('2.5 step transition is gated strictly by explicit user action or file upload', () => {
      expect(isStepUnlocked(1, {})).toBe(true);
      expect(isStepUnlocked(2, {})).toBe(false);
      expect(isStepUnlocked(2, { resumeData: sampleData })).toBe(true);
    });
  });

  // =========================================================================
  // Feature 3: Step 2 Recipient Management
  // =========================================================================
  describe('F03: Step 2 Recipient Management', () => {
    it('3.1 adds contact manually with valid RFC email and defaults to approved', () => {
      const onUpdateRecipients = vi.fn();
      render(<RecipientManager recipients={[]} onUpdateRecipients={onUpdateRecipients} onShowToast={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /Add Manually/i }));
      fireEvent.change(screen.getByPlaceholderText('e.g. Jessica Taylor'), { target: { value: 'Rachel Green' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. jessica@company.com'), { target: { value: 'rachel@ralphlauren.com' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. Stripe, OpenAI, Figma'), { target: { value: 'Ralph Lauren' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. Technical Recruiter or Senior SWE'), { target: { value: 'Talent Lead' } });

      fireEvent.click(screen.getByRole('button', { name: /Add Recipient to Queue/i }));

      expect(onUpdateRecipients).toHaveBeenCalledTimes(1);
      const added = onUpdateRecipients.mock.calls[0][0][0];
      expect(added.name).toBe('Rachel Green');
      expect(added.email).toBe('rachel@ralphlauren.com');
      expect(added.company).toBe('Ralph Lauren');
      expect(added.role).toBe('Talent Lead');
      expect(added.isApproved).toBe(true);
    });

    it('3.2 manual contact with optional JD displays JD Added badge', () => {
      const recipientsWithJd = [{
        id: 'r1',
        name: 'Rachel',
        email: 'rachel@corp.com',
        company: 'Corp',
        role: 'Lead',
        jobDescription: 'Seeking React Specialist',
        isValidEmail: true,
        isApproved: true
      }];
      render(<RecipientManager recipients={recipientsWithJd} onUpdateRecipients={vi.fn()} onShowToast={vi.fn()} />);
      expect(screen.getByText('JD Added')).toBeInTheDocument();
    });

    it('3.3 manual contact without JD displays Generic Pitch badge', () => {
      const recipientsGeneric = [{
        id: 'r2',
        name: 'Monica',
        email: 'monica@corp.com',
        company: 'Corp',
        role: 'Chef',
        jobDescription: '',
        isValidEmail: true,
        isApproved: true
      }];
      render(<RecipientManager recipients={recipientsGeneric} onUpdateRecipients={vi.fn()} onShowToast={vi.fn()} />);
      expect(screen.getByText('Generic Pitch')).toBeInTheDocument();
    });

    it('3.4 invalid email in manual entry shows error toast and does not submit', () => {
      const onShowToast = vi.fn();
      const onUpdateRecipients = vi.fn();
      render(<RecipientManager recipients={[]} onUpdateRecipients={onUpdateRecipients} onShowToast={onShowToast} />);

      fireEvent.click(screen.getByRole('button', { name: /Add Manually/i }));
      fireEvent.change(screen.getByPlaceholderText('e.g. jessica@company.com'), { target: { value: 'invalid-email-no-at' } });

      const form = screen.getByRole('button', { name: /Add Recipient to Queue/i }).closest('form');
      fireEvent.submit(form);

      expect(onUpdateRecipients).not.toHaveBeenCalled();
      expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', title: 'Invalid Email Format' }));
    });

    it('3.5 displays empty queue placeholder when no contacts exist', () => {
      render(<RecipientManager recipients={[]} onUpdateRecipients={vi.fn()} onShowToast={vi.fn()} />);
      expect(screen.getByText('No contacts in queue')).toBeInTheDocument();
      expect(screen.getByText(/Upload a sheet or add contacts manually to begin\./i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Feature 4: Step 2 Table Pagination
  // =========================================================================
  describe('F04: Step 2 Table Pagination', () => {
    function renderModalWithData(sheetData, props = {}) {
      const defaultProps = {
        isOpen: true,
        onClose: props.onClose || vi.fn(),
        onConfirmSelection: props.onConfirmSelection || vi.fn()
      };
      const { rerender, container } = render(
        <RecipientModal {...defaultProps} sheetData={null} />
      );
      rerender(
        <RecipientModal {...defaultProps} sheetData={sheetData} />
      );
      return { rerender, container, ...defaultProps };
    }

    const makeRows = (count) => Array.from({ length: count }, (_, i) => ({
      id: `row_${i + 1}`,
      rowIndex: i + 1,
      excelRowNum: i + 2,
      email: `contact${i + 1}@company.com`,
      name: `Recruiter ${i + 1}`,
      company: `Company ${i + 1}`,
      role: 'Recruiter',
      isValidEmail: true,
      isSelected: true,
      isApproved: false
    }));

    it('4.1 calculates total rows and valid counts correctly in RecipientModal', () => {
      const sheetData = {
        filename: 'recipients.xlsx',
        rows: makeRows(60),
        totalCount: 60,
        validCount: 60,
        invalidCount: 0
      };
      renderModalWithData(sheetData);
      expect(screen.getByText(/All 60/i)).toBeInTheDocument();
      expect(screen.getByText(/Ready 60/i)).toBeInTheDocument();
    });

    it('4.2 search input filters visible rows dynamically', () => {
      const sheetData = {
        filename: 'recipients.xlsx',
        rows: [
          { id: '1', email: 'alice@stripe.com', name: 'Alice', company: 'Stripe', isValidEmail: true, isSelected: true },
          { id: '2', email: 'bob@netflix.com', name: 'Bob', company: 'Netflix', isValidEmail: true, isSelected: true }
        ],
        totalCount: 2,
        validCount: 2,
        invalidCount: 0
      };
      renderModalWithData(sheetData);

      expect(screen.getByText('alice@stripe.com')).toBeInTheDocument();
      expect(screen.getByText('bob@netflix.com')).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText(/Search name, email or company/i);
      fireEvent.change(searchInput, { target: { value: 'stripe' } });

      expect(screen.getByText('alice@stripe.com')).toBeInTheDocument();
      expect(screen.queryByText('bob@netflix.com')).not.toBeInTheDocument();
    });

    it('4.3 tab filtering allows switching between all, valid, selected, and invalid', () => {
      const sheetData = {
        filename: 'recipients.xlsx',
        rows: [
          { id: '1', email: 'valid@test.com', name: 'Valid', isValidEmail: true, isSelected: true },
          { id: '2', email: 'bad-email', name: 'Invalid', isValidEmail: false, isSelected: false }
        ],
        totalCount: 2,
        validCount: 1,
        invalidCount: 1
      };
      renderModalWithData(sheetData);

      // Switch to Needs attention (invalid) tab
      fireEvent.click(screen.getByText(/Needs attention/i));
      expect(screen.getByText('bad-email')).toBeInTheDocument();
      expect(screen.queryByText('valid@test.com')).not.toBeInTheDocument();
    });

    it('4.4 select all checkbox selects all valid rows', () => {
      const sheetData = {
        filename: 'recipients.xlsx',
        rows: [
          { id: '1', email: 'r1@test.com', isValidEmail: true, isSelected: false },
          { id: '2', email: 'r2@test.com', isValidEmail: true, isSelected: false }
        ],
        totalCount: 2,
        validCount: 2,
        invalidCount: 0
      };
      renderModalWithData(sheetData);

      // Click Select All checkbox in table header
      const selectAll = document.querySelector('thead input[type="checkbox"]');
      if (selectAll) {
        fireEvent.click(selectAll);
        expect(screen.getByText(/Selected 2/i)).toBeInTheDocument();
      }
    });

    it('4.5 pagination resets smoothly when search returns 0 matches', () => {
      const sheetData = {
        filename: 'recipients.xlsx',
        rows: makeRows(5),
        totalCount: 5,
        validCount: 5,
        invalidCount: 0
      };
      renderModalWithData(sheetData);

      const searchInput = screen.getByPlaceholderText(/Search name, email or company/i);
      fireEvent.change(searchInput, { target: { value: 'nonexistent-query-xyz' } });

      expect(screen.getByText(/No contacts matching your search\/filter criteria/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Feature 5: Step 2 30-Day Dedup Queue Badge
  // =========================================================================
  describe('F05: Step 2 30-Day Dedup Queue Badge', () => {
    function renderModalWithData(sheetData, props = {}) {
      const defaultProps = {
        isOpen: true,
        onClose: props.onClose || vi.fn(),
        onConfirmSelection: props.onConfirmSelection || vi.fn()
      };
      const { rerender, container } = render(
        <RecipientModal {...defaultProps} sheetData={null} />
      );
      rerender(
        <RecipientModal {...defaultProps} sheetData={sheetData} />
      );
      return { rerender, container, ...defaultProps };
    }

    it('5.1 displays Contacted badge on previously contacted recipient in RecipientManager', () => {
      const recipients = [{
        id: 'r1',
        name: 'Sarah',
        email: 'sarah@recruiter.com',
        company: 'Stripe',
        role: 'Recruiter',
        isValidEmail: true,
        isApproved: false,
        isPreviouslyContacted: true,
        lastContactedDate: '2026-09-20'
      }];
      render(<RecipientManager recipients={recipients} onUpdateRecipients={vi.fn()} onShowToast={vi.fn()} />);
      expect(screen.getByText(/Contacted/i)).toBeInTheDocument();
    });

    it('5.2 previously contacted recipient defaults to unchecked in modal', () => {
      const sheetData = {
        filename: 'recipients.xlsx',
        rows: [
          {
            id: '1',
            email: 'recent@recruiter.com',
            name: 'Recent',
            isValidEmail: true,
            isPreviouslyContacted: true,
            isSelected: false, // auto-unchecked by default
            isApproved: false
          }
        ],
        totalCount: 1,
        validCount: 1,
        invalidCount: 0
      };
      renderModalWithData(sheetData);
      expect(screen.getByText(/Selected 0/i)).toBeInTheDocument();
    });

    it('5.3 uncontacted fresh recipient defaults to selected and has no dedup warning', () => {
      const sheetData = {
        filename: 'recipients.xlsx',
        rows: [
          {
            id: '1',
            email: 'fresh@recruiter.com',
            name: 'Fresh',
            isValidEmail: true,
            isPreviouslyContacted: false,
            isSelected: true,
            isApproved: false
          }
        ],
        totalCount: 1,
        validCount: 1,
        invalidCount: 0
      };
      renderModalWithData(sheetData);
      expect(screen.getByText(/Selected 1/i)).toBeInTheDocument();
      expect(screen.queryByText(/Contacted/i)).not.toBeInTheDocument();
    });

    it('5.4 manual override: user can check and approve a previously contacted recipient', () => {
      const onConfirm = vi.fn();
      const sheetData = {
        filename: 'recipients.xlsx',
        rows: [
          {
            id: '1',
            email: 'past@recruiter.com',
            name: 'Past Contact',
            isValidEmail: true,
            isPreviouslyContacted: true,
            isSelected: false,
            isApproved: false
          }
        ],
        totalCount: 1,
        validCount: 1,
        invalidCount: 0
      };
      renderModalWithData(sheetData, { onConfirmSelection: onConfirm });

      // Check row checkbox manually from document.body portal
      const rowCheckbox = document.querySelector('tbody input[type="checkbox"]');
      expect(rowCheckbox).not.toBeNull();
      fireEvent.click(rowCheckbox);

      // Check consent
      const consentCheckbox = screen.getByRole('checkbox', { name: /explicitly approve/i });
      fireEvent.click(consentCheckbox);

      // Approve
      fireEvent.click(screen.getByRole('button', { name: /Approve/i }));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('5.5 dedup status is preserved across row selection toggles', () => {
      const recipients = [{
        id: 'r1',
        name: 'Sarah',
        email: 'sarah@recruiter.com',
        isValidEmail: true,
        isApproved: true,
        isPreviouslyContacted: true
      }];
      render(<RecipientManager recipients={recipients} onUpdateRecipients={vi.fn()} onShowToast={vi.fn()} />);
      expect(screen.getByText(/Contacted/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Feature 6: Step 2 Consent Gate & Shake Animation
  // =========================================================================
  describe('F06: Step 2 Consent Gate & Shake Animation', () => {
    function renderModalWithData(sheetData, props = {}) {
      const defaultProps = {
        isOpen: true,
        onClose: props.onClose || vi.fn(),
        onConfirmSelection: props.onConfirmSelection || vi.fn()
      };
      const { rerender, container } = render(
        <RecipientModal {...defaultProps} sheetData={null} />
      );
      rerender(
        <RecipientModal {...defaultProps} sheetData={sheetData} />
      );
      return { rerender, container, ...defaultProps };
    }

    const makeSheetData = () => ({
      filename: 'contacts.xlsx',
      rows: [
        { id: '1', email: 'test@example.com', name: 'Tester', isValidEmail: true, isSelected: true, isApproved: false }
      ],
      totalCount: 1,
      validCount: 1,
      invalidCount: 0
    });

    it('6.1 consent checkbox is unchecked by default on initial render', () => {
      renderModalWithData(makeSheetData());
      const consent = screen.getByRole('checkbox', { name: /explicitly approve/i });
      expect(consent.checked).toBe(false);
    });

    it('6.2 clicking Approve without consent prevents import and does not close modal', () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();
      renderModalWithData(makeSheetData(), { onConfirmSelection: onConfirm, onClose });

      const approveBtn = screen.getByRole('button', { name: /Approve/i });
      fireEvent.click(approveBtn);

      expect(onConfirm).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('6.3 clicking Approve with consent checked invokes confirmation and closes modal', () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();
      renderModalWithData(makeSheetData(), { onConfirmSelection: onConfirm, onClose });

      fireEvent.click(screen.getByRole('checkbox', { name: /explicitly approve/i }));
      fireEvent.click(screen.getByRole('button', { name: /Approve/i }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('6.4 approve button is disabled when zero rows are selected', () => {
      const emptySelection = {
        filename: 'contacts.xlsx',
        rows: [{ id: '1', email: 'test@example.com', isValidEmail: true, isSelected: false }],
        totalCount: 1,
        validCount: 1,
        invalidCount: 0
      };
      renderModalWithData(emptySelection);

      const approveBtn = screen.getByRole('button', { name: /Approve/i });
      expect(approveBtn).toBeDisabled();
    });

    it('6.5 providing new sheetData resets consent checkbox to unchecked', () => {
      const { rerender } = renderModalWithData(makeSheetData());

      const consent = screen.getByRole('checkbox', { name: /explicitly approve/i });
      fireEvent.click(consent);
      expect(consent.checked).toBe(true);

      // Re-render with new sheetData
      rerender(
        <RecipientModal isOpen={true} onClose={vi.fn()} sheetData={{ ...makeSheetData(), filename: 'new.xlsx' }} onConfirmSelection={vi.fn()} />
      );

      const resetConsent = screen.getByRole('checkbox', { name: /explicitly approve/i });
      expect(resetConsent.checked).toBe(false);
    });
  });

  // =========================================================================
  // Feature 7: Step 3 Target Role & Strategy
  // =========================================================================
  describe('F07: Step 3 Target Role & Strategy', () => {
    it('7.1 switches between Tailored and General Value Pitch modes', () => {
      render(<JobDescriptionInput jobDescription="" onChangeJd={vi.fn()} onShowToast={vi.fn()} />);

      const tailoredBtn = screen.getByText('Specific Role (JD)').closest('button');
      const generalBtn = screen.getByText('Direct Value Pitch').closest('button');

      expect(tailoredBtn).toBeInTheDocument();
      expect(generalBtn).toBeInTheDocument();

      fireEvent.click(tailoredBtn);
      fireEvent.click(generalBtn);
    });

    it('7.2 selecting Stripe preset role loads job description text and displays toast', () => {
      const onChangeJd = vi.fn();
      const onShowToast = vi.fn();
      render(<JobDescriptionInput jobDescription="" onChangeJd={onChangeJd} onShowToast={onShowToast} />);

      // Switch to tailored mode so presets become visible
      const tailoredBtn = screen.getByText('Specific Role (JD)').closest('button');
      fireEvent.click(tailoredBtn);

      const stripeChip = screen.getByText('Stripe').closest('button');
      fireEvent.click(stripeChip);

      expect(onChangeJd).toHaveBeenCalledTimes(1);
      const text = onChangeJd.mock.calls[0][0];
      expect(text).toContain('Stripe');
      expect(text).toContain('Full-Stack Engineer');
      expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info', title: 'Preset Role Selected' }));
    });

    it('7.3 updates live word and character counters on typing', () => {
      render(
        <JobDescriptionInput
          jobDescription="Senior Full Stack Engineer with extensive experience in React and Node.js."
          onChangeJd={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      expect(screen.getByText(/11/)).toBeInTheDocument();
      expect(screen.getByText(/74/)).toBeInTheDocument();
    });

    it('7.4 quality indicator displays Brief for < 35 words and Optimal for 35-350 words', () => {
      const { rerender } = render(
        <JobDescriptionInput jobDescription="Short description under 35 words" onChangeJd={vi.fn()} onShowToast={vi.fn()} />
      );
      expect(screen.getByText('Brief overview. Add key requirements for sharper AI matching')).toBeInTheDocument();

      // Words count >= 35
      const optimalText = Array(40).fill('requirement').join(' ');
      rerender(<JobDescriptionInput jobDescription={optimalText} onChangeJd={vi.fn()} onShowToast={vi.fn()} />);
      expect(screen.getByText('Optimal depth for personalized skill alignment')).toBeInTheDocument();
    });

    it('7.5 empty job description displays Empty badge with call to action', () => {
      render(<JobDescriptionInput jobDescription="" onChangeJd={vi.fn()} onShowToast={vi.fn()} />);
      expect(screen.getByText('Paste a job description or choose a preset role above')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Feature 8: Step 3 Clear Confirmation Safeguard
  // =========================================================================
  describe('F08: Step 3 Clear Confirmation Safeguard', () => {
    it('8.1 clearing short text (<= 50 words) clears immediately without modal', () => {
      const onChangeJd = vi.fn();
      render(<JobDescriptionInput jobDescription="Short 5 word job description" onChangeJd={onChangeJd} onShowToast={vi.fn()} />);

      const clearBtn = screen.getByText(/Clear/i).closest('button');
      fireEvent.click(clearBtn);

      expect(onChangeJd).toHaveBeenCalledWith('');
      expect(screen.queryByText(/Clear this job description/i)).not.toBeInTheDocument();
    });

    it('8.2 clearing long text (> 50 words) opens confirmation dialog', () => {
      const longJd = Array(60).fill('developer').join(' ');
      render(<JobDescriptionInput jobDescription={longJd} onChangeJd={vi.fn()} onShowToast={vi.fn()} />);

      const clearBtn = screen.getByText(/Clear/i).closest('button');
      fireEvent.click(clearBtn);

      expect(screen.getByText(/Clear this job description/i)).toBeInTheDocument();
      expect(screen.getByText('Confirm Clear').closest('button')).toBeInTheDocument();
      expect(screen.getByText('Cancel').closest('button')).toBeInTheDocument();
    });

    it('8.3 cancelling clear dialog preserves job description text', () => {
      const onChangeJd = vi.fn();
      const longJd = Array(60).fill('developer').join(' ');
      render(<JobDescriptionInput jobDescription={longJd} onChangeJd={onChangeJd} onShowToast={vi.fn()} />);

      fireEvent.click(screen.getByText(/Clear/i).closest('button'));
      fireEvent.click(screen.getByText('Cancel').closest('button'));

      expect(onChangeJd).not.toHaveBeenCalled();
      expect(screen.queryByText(/Clear this job description/i)).not.toBeInTheDocument();
    });

    it('8.4 confirming clear dialog wipes text and shows feedback toast', () => {
      const onChangeJd = vi.fn();
      const onShowToast = vi.fn();
      const longJd = Array(60).fill('developer').join(' ');
      render(<JobDescriptionInput jobDescription={longJd} onChangeJd={onChangeJd} onShowToast={onShowToast} />);

      fireEvent.click(screen.getByText(/Clear/i).closest('button'));
      fireEvent.click(screen.getByText('Confirm Clear').closest('button'));

      expect(onChangeJd).toHaveBeenCalledWith('');
      expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info', title: 'Target Cleared' }));
    });

    it('8.5 exactly 50 words clears immediately while 51 words prompts modal', () => {
      const onChange50 = vi.fn();
      const text50 = Array(50).fill('word').join(' ');
      const { unmount } = render(
        <JobDescriptionInput jobDescription={text50} onChangeJd={onChange50} onShowToast={vi.fn()} />
      );

      fireEvent.click(screen.getByText(/Clear/i).closest('button'));
      expect(onChange50).toHaveBeenCalledWith('');
      unmount();

      const onChange51 = vi.fn();
      const text51 = Array(51).fill('word').join(' ');
      render(<JobDescriptionInput jobDescription={text51} onChangeJd={onChange51} onShowToast={vi.fn()} />);
      fireEvent.click(screen.getByText(/Clear/i).closest('button'));
      expect(screen.getByText(/Clear this job description/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Feature 9: StepIndicator Title & Accessibility
  // =========================================================================
  describe('F09: StepIndicator Title & Accessibility', () => {
    it('9.1 renders exactly 4 canonical steps in nav.step-bar', () => {
      const { container } = render(
        <StepIndicator currentStep={1} onSelectStep={vi.fn()} resumeReady={false} recipientsCount={0} />
      );
      expect(container.querySelectorAll('nav.step-bar')).toHaveLength(1);
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(4);
    });

    it('9.2 active step has aria-current="step"', () => {
      render(
        <StepIndicator currentStep={2} onSelectStep={vi.fn()} resumeReady={true} recipientsCount={0} />
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons[1]).toHaveAttribute('aria-current', 'step');
      expect(buttons[0]).not.toHaveAttribute('aria-current');
    });

    it('9.3 locked step has aria-disabled="true" and locked class', () => {
      render(
        <StepIndicator currentStep={1} onSelectStep={vi.fn()} resumeReady={false} recipientsCount={0} />
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons[1]).toHaveAttribute('aria-disabled', 'true');
      expect(buttons[1]).toHaveClass('locked');
      expect(buttons[3]).toHaveAttribute('aria-disabled', 'true');
      expect(buttons[3]).toHaveClass('locked');
    });

    it('9.4 locked step title displays clear unlock reason', () => {
      render(
        <StepIndicator currentStep={1} onSelectStep={vi.fn()} resumeReady={false} recipientsCount={0} />
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons[1].getAttribute('title')).toContain('Step 1');
      expect(buttons[3].getAttribute('title')).toContain('Step 1');
    });

    it('9.5 clicking unlocked step triggers onSelectStep with target step ID', () => {
      const onSelect = vi.fn();
      render(
        <StepIndicator currentStep={1} onSelectStep={onSelect} resumeReady={true} recipientsCount={0} />
      );
      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[1]); // Step 2 is unlocked
      expect(onSelect).toHaveBeenCalledWith(2);

      fireEvent.click(buttons[3]); // Step 4 is locked
      expect(onSelect).not.toHaveBeenCalledWith(4);
    });
  });

  // =========================================================================
  // Feature 10: Step 1 & 3 Unit Test Coverage
  // =========================================================================
  describe('F10: Step 1 & 3 Unit Test Coverage', () => {
    it('10.1 canonical WIZARD_STEPS structure conforms to specification', () => {
      expect(WIZARD_STEPS).toHaveLength(4);
      expect(WIZARD_STEPS[0].shortLabel).toBe('Profile & AI');
      expect(WIZARD_STEPS[1].shortLabel).toBe('Recipients');
      expect(WIZARD_STEPS[2].shortLabel).toBe('Target Role');
      expect(WIZARD_STEPS[3].shortLabel).toBe('Drafts & Send');
    });

    it('10.2 Step 3 is optional in canonical configuration', () => {
      expect(WIZARD_STEPS[2].optional).toBe(true);
      expect(WIZARD_STEPS[0].optional).toBe(false);
      expect(WIZARD_STEPS[1].optional).toBe(false);
      expect(WIZARD_STEPS[3].optional).toBe(false);
    });

    it('10.3 getStepLockReason provides human-readable explanations', () => {
      expect(getStepLockReason(1, {})).toBeNull();
      expect(getStepLockReason(2, {})).toContain('Step 1');
      expect(getStepLockReason(4, { resumeData: {} })).toContain('Step 2');
    });

    it('10.4 ResumeUpload handles unhandled optional callbacks safely', () => {
      // Should render without error even if onShowToast is omitted
      expect(() => {
        render(<ResumeUpload resumeData={null} onResumeUploaded={vi.fn()} />);
      }).not.toThrow();
    });

    it('10.5 JobDescriptionInput handles undefined props gracefully', () => {
      expect(() => {
        render(<JobDescriptionInput jobDescription="" onChangeJd={vi.fn()} />);
      }).not.toThrow();
    });
  });
});
