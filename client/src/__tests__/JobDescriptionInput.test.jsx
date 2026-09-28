import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import JobDescriptionInput from '../components/JobDescriptionInput';

describe('JobDescriptionInput Component (M1)', () => {
  // 1. Mode Switching
  describe('Mode Switching (Specific Role vs Direct Value Pitch)', () => {
    it('initializes in Direct Value Pitch (general) mode when jobDescription is empty', () => {
      render(
        <JobDescriptionInput
          jobDescription=""
          onChangeJd={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      expect(screen.getByText(/Direct Value Pitch/i)).toBeInTheDocument();
      expect(screen.getByText(/AI will synthesize a direct executive value pitch/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Optional: Add custom focus areas/i)).toBeInTheDocument();
      // Preset chips and clear button are hidden in general mode
      expect(screen.queryByText('Presets:')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Clear/i })).not.toBeInTheDocument();
    });

    it('initializes in Specific Role (tailored) mode when jobDescription is provided', () => {
      render(
        <JobDescriptionInput
          jobDescription="Seeking experienced React developer"
          onChangeJd={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      expect(screen.queryByText(/AI will synthesize a direct executive value pitch/i)).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Paste target job description/i)).toBeInTheDocument();
      expect(screen.getByText('Presets:')).toBeInTheDocument();
    });

    it('switches between Specific Role and Direct Value Pitch on button click', () => {
      render(
        <JobDescriptionInput
          jobDescription=""
          onChangeJd={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      const specificRoleBtn = screen.getByRole('button', { name: /Specific Role \(JD\)/i });
      fireEvent.click(specificRoleBtn);
      expect(screen.getByText('Presets:')).toBeInTheDocument();
      expect(screen.queryByText(/AI will synthesize a direct executive value pitch/i)).not.toBeInTheDocument();

      const directValueBtn = screen.getByRole('button', { name: /Direct Value Pitch/i });
      fireEvent.click(directValueBtn);
      expect(screen.getByText(/AI will synthesize a direct executive value pitch/i)).toBeInTheDocument();
      expect(screen.queryByText('Presets:')).not.toBeInTheDocument();
    });

    it('automatically transitions from general to tailored mode when user types into textarea', () => {
      const onChangeJd = vi.fn();

      render(
        <JobDescriptionInput
          jobDescription=""
          onChangeJd={onChangeJd}
          onShowToast={vi.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText(/Optional: Add custom focus areas/i);
      fireEvent.change(textarea, { target: { value: 'Senior Frontend Engineer requirements' } });

      expect(onChangeJd).toHaveBeenCalledWith('Senior Frontend Engineer requirements');
      // Presets bar should now be visible as mode flips to tailored
      expect(screen.getByText('Presets:')).toBeInTheDocument();
    });
  });

  // 2. Preset Chips Selection
  describe('Preset Chips Selection', () => {
    it('renders Stripe, Series-A Startup, and Tech Lead preset chips in tailored mode', () => {
      render(
        <JobDescriptionInput
          jobDescription="sample"
          onChangeJd={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: 'Stripe' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Series-A Startup' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tech Lead / Staff Software Engineer' })).toBeInTheDocument();
    });

    it('clicking Stripe preset populates full Stripe JD and fires info toast', () => {
      const onChangeJd = vi.fn();
      const onShowToast = vi.fn();

      render(
        <JobDescriptionInput
          jobDescription="sample"
          onChangeJd={onChangeJd}
          onShowToast={onShowToast}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Stripe' }));

      expect(onChangeJd).toHaveBeenCalledTimes(1);
      const loadedText = onChangeJd.mock.calls[0][0];
      expect(loadedText).toContain('Job Title: Senior Full-Stack Engineer (Core Infrastructure & AI Applications)');
      expect(loadedText).toContain('Company: Stripe');

      expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({
        type: 'info',
        title: 'Preset Role Selected',
        message: 'Loaded "Stripe".'
      }));
    });

    it('clicking Series-A Startup and Tech Lead presets loads their respective JD texts', () => {
      const onChangeJd = vi.fn();

      render(
        <JobDescriptionInput
          jobDescription="sample"
          onChangeJd={onChangeJd}
          onShowToast={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Series-A Startup' }));
      expect(onChangeJd.mock.calls[0][0]).toContain('Founding Full-Stack Engineer');

      fireEvent.click(screen.getByRole('button', { name: 'Tech Lead / Staff Software Engineer' }));
      expect(onChangeJd.mock.calls[1][0]).toContain('Staff Software Engineer / Team Lead');
    });
  });

  // 3. Live Word/Char Counter & Quality Badges
  describe('Live Counter & Quality Badges', () => {
    it('renders Empty badge for 0 words', () => {
      render(
        <JobDescriptionInput
          jobDescription=""
          onChangeJd={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      expect(screen.getByText('Empty:')).toBeInTheDocument();
      expect(screen.getByText('Paste a job description or choose a preset role above')).toBeInTheDocument();
      expect(screen.getAllByText('0', { selector: 'strong' }).length).toBeGreaterThanOrEqual(1);
    });

    it('renders Brief badge for 1 to 34 words with accurate counts', () => {
      const briefText = 'Looking for a Senior Python Developer with Django experience.'; // 9 words
      render(
        <JobDescriptionInput
          jobDescription={briefText}
          onChangeJd={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      expect(screen.getByText('Brief:')).toBeInTheDocument();
      expect(screen.getByText(/Brief overview\. Add key requirements/i)).toBeInTheDocument();
      expect(screen.getByText('9', { selector: 'strong' })).toBeInTheDocument();
      expect(screen.getByText(String(briefText.length), { selector: 'strong' })).toBeInTheDocument();
    });

    it('renders Optimal badge at lower boundary (35 words) and upper boundary (350 words)', () => {
      const optimalText = Array(35).fill('engineer').join(' ');
      const { rerender } = render(
        <JobDescriptionInput
          jobDescription={optimalText}
          onChangeJd={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      expect(screen.getByText('Optimal:')).toBeInTheDocument();
      expect(screen.getByText(/Optimal depth for personalized skill alignment/i)).toBeInTheDocument();
      expect(screen.getByText('35', { selector: 'strong' })).toBeInTheDocument();

      const upperOptimalText = Array(350).fill('skill').join(' ');
      rerender(
        <JobDescriptionInput
          jobDescription={upperOptimalText}
          onChangeJd={vi.fn()}
          onShowToast={vi.fn()}
        />
      );
      expect(screen.getByText('Optimal:')).toBeInTheDocument();
      expect(screen.getByText('350', { selector: 'strong' })).toBeInTheDocument();
    });

    it('renders Detailed badge for >350 words', () => {
      const detailedText = Array(351).fill('requirement').join(' ');
      render(
        <JobDescriptionInput
          jobDescription={detailedText}
          onChangeJd={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      expect(screen.getByText('Detailed:')).toBeInTheDocument();
      expect(screen.getByText(/Comprehensive description\. Top requirements prioritized/i)).toBeInTheDocument();
      expect(screen.getByText('351', { selector: 'strong' })).toBeInTheDocument();
    });
  });

  // 4. Clear Button Safeguard
  describe('Clear Button Safeguard Logic', () => {
    it('directly clears without modal when wordCount <= 50 words', () => {
      const onChangeJd = vi.fn();
      const onShowToast = vi.fn();
      const shortText = 'Short job description with only six words.'; // 6 words

      render(
        <JobDescriptionInput
          jobDescription={shortText}
          onChangeJd={onChangeJd}
          onShowToast={onShowToast}
        />
      );

      const clearBtn = screen.getByRole('button', { name: /Clear/i });
      fireEvent.click(clearBtn);

      // Directly calls onChangeJd with empty string
      expect(onChangeJd).toHaveBeenCalledWith('');
      expect(screen.queryByText(/Clear this job description/i)).not.toBeInTheDocument();
      expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({
        type: 'info',
        title: 'Target Cleared'
      }));
    });

    it('displays safeguard confirmation banner when wordCount > 50 words', () => {
      const onChangeJd = vi.fn();
      const longText = Array(55).fill('requirement').join(' '); // 55 words

      render(
        <JobDescriptionInput
          jobDescription={longText}
          onChangeJd={onChangeJd}
          onShowToast={vi.fn()}
        />
      );

      const clearBtn = screen.getByRole('button', { name: /Clear/i });
      fireEvent.click(clearBtn);

      // Must NOT immediately clear
      expect(onChangeJd).not.toHaveBeenCalled();
      expect(screen.getByText('55 words', { selector: 'strong' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm Clear' })).toBeInTheDocument();
    });

    it('canceling safeguard banner retains existing job description', () => {
      const onChangeJd = vi.fn();
      const longText = Array(55).fill('requirement').join(' ');

      render(
        <JobDescriptionInput
          jobDescription={longText}
          onChangeJd={onChangeJd}
          onShowToast={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Clear/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onChangeJd).not.toHaveBeenCalled();
      expect(screen.queryByText(/Clear this job description/i)).not.toBeInTheDocument();
    });

    it('confirming safeguard banner clears text, switches to general mode, and fires toast', () => {
      const onChangeJd = vi.fn();
      const onShowToast = vi.fn();
      const longText = Array(55).fill('requirement').join(' ');

      render(
        <JobDescriptionInput
          jobDescription={longText}
          onChangeJd={onChangeJd}
          onShowToast={onShowToast}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Clear/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Clear' }));

      expect(onChangeJd).toHaveBeenCalledWith('');
      expect(screen.queryByText(/Clear this job description/i)).not.toBeInTheDocument();
      expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({
        type: 'info',
        title: 'Target Cleared',
        message: 'Switched to Direct Value Pitch mode.'
      }));
    });
  });
});
