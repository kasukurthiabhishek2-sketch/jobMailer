import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { getVisibleWizardSteps } from '../constants/wizardSteps';
import StepIndicator from '../components/StepIndicator';
import JobDescriptionModal from '../components/JobDescriptionModal';
import JobDescriptionInput from '../components/JobDescriptionInput';
import RecipientManager from '../components/RecipientManager';

describe('Excel Upload and Target Role Workflow', () => {
  describe('getVisibleWizardSteps helper', () => {
    it('returns only 3 steps (excluding Step 3 Target Role) when hasSpreadsheetRecipients is false', () => {
      const steps = getVisibleWizardSteps(false);
      expect(steps).toHaveLength(3);
      expect(steps.map(s => s.id)).toEqual([1, 2, 4]);
      expect(steps.map(s => s.stepNumber)).toEqual([1, 2, 3]);
      expect(steps.find(s => s.id === 3)).toBeUndefined();
    });

    it('returns all 4 steps (including Step 3 Target Role) when hasSpreadsheetRecipients is true', () => {
      const steps = getVisibleWizardSteps(true);
      expect(steps).toHaveLength(4);
      expect(steps.map(s => s.id)).toEqual([1, 2, 3, 4]);
      expect(steps.map(s => s.stepNumber)).toEqual([1, 2, 3, 4]);
      expect(steps.find(s => s.id === 3)).toBeDefined();
    });
  });

  describe('StepIndicator navigation bar', () => {
    it('does NOT render Target Role in top nav when showTargetRole is false (even with spreadsheet recipients)', () => {
      render(
        <StepIndicator
          currentStep={2}
          resumeReady={true}
          recipients={[{ id: 'r1', source: 'spreadsheet' }]}
          hasSpreadsheetRecipients={true}
          showTargetRole={false}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);
      expect(screen.queryByText('Target Role')).not.toBeInTheDocument();
      expect(buttons[0]).toHaveTextContent('Profile & AI');
      expect(buttons[1]).toHaveTextContent('Recipients (1)');
      expect(buttons[2]).toHaveTextContent('Drafts & Send');
    });

    it('can optionally render Target Role in top nav when showTargetRole is true', () => {
      render(
        <StepIndicator
          currentStep={2}
          resumeReady={true}
          recipients={[{ id: 'r1', source: 'spreadsheet' }]}
          showTargetRole={true}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(4);
      expect(screen.getByText('Target Role')).toBeInTheDocument();
      expect(buttons[0]).toHaveTextContent('Profile & AI');
      expect(buttons[1]).toHaveTextContent('Recipients (1)');
      expect(buttons[2]).toHaveTextContent('Target Role');
      expect(buttons[3]).toHaveTextContent('Drafts & Send');
    });
  });

  describe('JobDescriptionModal dialog component', () => {
    it('renders the dialog when open and updates local JD text field', () => {
      const onSaveJd = vi.fn();
      const onClose = vi.fn();
      const onShowToast = vi.fn();

      render(
        <JobDescriptionModal
          isOpen={true}
          onClose={onClose}
          jobDescription="Initial requirements"
          onSaveJd={onSaveJd}
          onShowToast={onShowToast}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText('Target Job Description')).toBeInTheDocument();

      const textarea = screen.getByPlaceholderText(/Paste target job description/i);
      expect(textarea).toHaveValue('Initial requirements');

      fireEvent.change(textarea, { target: { value: 'Senior Backend Engineer with Node and AWS experience' } });
      expect(textarea).toHaveValue('Senior Backend Engineer with Node and AWS experience');

      // Click save
      const saveBtn = screen.getByRole('button', { name: /Save Job Description/i });
      fireEvent.click(saveBtn);

      expect(onSaveJd).toHaveBeenCalledWith('Senior Backend Engineer with Node and AWS experience');
      expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
      expect(onClose).toHaveBeenCalled();
    });

    it('closes without saving when Skip for Now is clicked', () => {
      const onSaveJd = vi.fn();
      const onClose = vi.fn();

      render(
        <JobDescriptionModal
          isOpen={true}
          onClose={onClose}
          jobDescription=""
          onSaveJd={onSaveJd}
        />
      );

      const skipBtn = screen.getByRole('button', { name: /Skip for Now/i });
      fireEvent.click(skipBtn);

      expect(onSaveJd).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('JobDescriptionInput two-section elimination when excel uploaded', () => {
    it('removes mode toggle pills (two sections) when hasSpreadsheetRecipients is true', () => {
      render(
        <JobDescriptionInput
          jobDescription="Seeking Staff Engineer"
          onChangeJd={vi.fn()}
          hasSpreadsheetRecipients={true}
        />
      );

      // Mode toggle buttons for "Specific Role (JD)" and "Direct Value Pitch" must NOT be in the document
      expect(screen.queryByRole('button', { name: /Specific Role \(JD\)/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Direct Value Pitch/i })).not.toBeInTheDocument();

      // Textarea text field is directly present
      const textarea = screen.getByPlaceholderText(/Paste target job description/i);
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue('Seeking Staff Engineer');
    });

    it('displays mode toggle pills when hasSpreadsheetRecipients is false', () => {
      render(
        <JobDescriptionInput
          jobDescription=""
          onChangeJd={vi.fn()}
          hasSpreadsheetRecipients={false}
        />
      );

      expect(screen.getByRole('button', { name: /Specific Role \(JD\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Direct Value Pitch/i })).toBeInTheDocument();
    });
  });

  describe('RecipientManager spreadsheet JD integration', () => {
    it('renders JD configuration banner in spreadsheet tab when spreadsheet recipients exist', () => {
      const recipients = [
        { id: 's1', name: 'John Doe', email: 'john@example.com', source: 'spreadsheet', isApproved: true }
      ];

      render(
        <RecipientManager
          recipients={recipients}
          onUpdateRecipients={vi.fn()}
          onShowToast={vi.fn()}
          jobDescription="Must have 5 years distributed systems experience"
          onChangeJd={vi.fn()}
        />
      );

      expect(screen.getByText('Target Job Description Active')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edit JD' })).toBeInTheDocument();

      // Click Edit JD to open modal
      fireEvent.click(screen.getByRole('button', { name: 'Edit JD' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Target Job Description')).toBeInTheDocument();
    });
  });
});
