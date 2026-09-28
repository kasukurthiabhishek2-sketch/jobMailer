import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StepIndicator from '../components/StepIndicator';

describe('StepIndicator Component (TICK-CYC3-10)', () => {
  it('renders exactly one step-bar navigation element', () => {
    const { container } = render(
      <StepIndicator currentStep={1} onSelectStep={() => {}} resumeReady={false} />
    );
    const navs = container.querySelectorAll('nav.step-bar');
    expect(navs).toHaveLength(1);
  });

  it('renders all 4 steps with accessible ARIA attributes', () => {
    render(
      <StepIndicator currentStep={2} onSelectStep={() => {}} resumeReady={true} />
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);

    // Active step has aria-current="step"
    expect(buttons[1]).toHaveAttribute('aria-current', 'step');
    expect(buttons[0]).not.toHaveAttribute('aria-current');

    // Locked step (Step 4 without recipients) has aria-disabled="true"
    expect(buttons[3]).toHaveAttribute('aria-disabled', 'true');
    expect(buttons[3]).toBeDisabled();
  });

  it('allows clicking unlocked step and ignores locked step', () => {
    const onSelectStep = vi.fn();
    render(
      <StepIndicator currentStep={1} onSelectStep={onSelectStep} resumeReady={true} />
    );
    const buttons = screen.getAllByRole('button');

    // Click Step 2 (unlocked because resumeReady is true)
    fireEvent.click(buttons[1]);
    expect(onSelectStep).toHaveBeenCalledWith(2);

    // Click Step 4 (locked because no recipients)
    fireEvent.click(buttons[3]);
    expect(onSelectStep).not.toHaveBeenCalledWith(4);
  });

  it('displays descriptive lock reason in title attribute', () => {
    render(
      <StepIndicator currentStep={1} onSelectStep={() => {}} resumeReady={false} />
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons[1].getAttribute('title')).toContain('Step 1');
  });
});
