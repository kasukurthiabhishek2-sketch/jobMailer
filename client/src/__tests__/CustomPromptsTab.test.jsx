import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CustomPromptsTab from '../components/settings/CustomPromptsTab';
import SettingsModal from '../components/SettingsModal';
import * as api from '../services/api';

vi.mock('../services/api', async () => {
  const actual = await vi.importActual('../services/api');
  return {
    ...actual,
    saveCustomPrompts: vi.fn().mockResolvedValue({ success: true })
  };
});

describe('CustomPromptsTab & Prompt Customization Settings', () => {
  const mockConfig = {
    customPrompts: {
      coldEmail: { enabled: false, content: '' },
      jdParser: { enabled: false, content: '' }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders overview, prompt sections and load recommended buttons', () => {
    render(
      <CustomPromptsTab
        config={mockConfig}
        onRefreshConfig={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    expect(screen.getByText('Custom AI System Prompts')).toBeInTheDocument();
    expect(screen.getByText('Cold Email Generation Prompt')).toBeInTheDocument();
    expect(screen.getByText('Job Description Parser Prompt')).toBeInTheDocument();
    expect(screen.getAllByText('Load Recommended Template').length).toBe(2);
    expect(screen.getByRole('button', { name: /Save AI Prompts/i })).toBeInTheDocument();
  });

  it('populates recommended prompt template when clicking Load Recommended Template', () => {
    render(
      <CustomPromptsTab
        config={mockConfig}
        onRefreshConfig={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    const loadButtons = screen.getAllByText('Load Recommended Template');
    fireEvent.click(loadButtons[0]);

    const textareas = screen.getAllByRole('textbox');
    expect(textareas[0].value).toContain('elite career strategist');
    expect(screen.getAllByText('Custom Prompt Active').length).toBeGreaterThanOrEqual(1);
  });

  it('saves custom prompts through saveCustomPrompts and triggers toast', async () => {
    const onRefreshConfig = vi.fn();
    const onShowToast = vi.fn();

    render(
      <CustomPromptsTab
        config={mockConfig}
        onRefreshConfig={onRefreshConfig}
        onShowToast={onShowToast}
      />
    );

    const textareas = screen.getAllByRole('textbox');
    fireEvent.change(textareas[0], { target: { value: 'My custom cold email prompt override' } });

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    const saveButton = screen.getByRole('button', { name: /Save AI Prompts/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.saveCustomPrompts).toHaveBeenCalledWith(
        expect.objectContaining({
          coldEmail: {
            enabled: true,
            content: 'My custom cold email prompt override'
          }
        })
      );
    });

    expect(onShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Prompts Saved'
      })
    );
  });

  it('renders AI Prompts tab in SettingsModal navigation and opens it on click', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        config={mockConfig}
        onRefreshConfig={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    const promptsNavButton = screen.getByRole('button', { name: /AI Prompts/i });
    expect(promptsNavButton).toBeInTheDocument();

    fireEvent.click(promptsNavButton);
    expect(screen.getByText('Custom AI System Prompts')).toBeInTheDocument();
    expect(screen.getByText('Cold Email Generation Prompt')).toBeInTheDocument();
  });
});
