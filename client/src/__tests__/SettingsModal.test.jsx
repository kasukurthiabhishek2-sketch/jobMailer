import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsModal from '../components/SettingsModal';

describe('SettingsModal Component (TICK-CYC3-09 / B3)', () => {
  const dummyConfig = {
    activeProvider: 'gemini',
    aiProviders: {
      gemini: { name: 'Google Gemini', isConfigured: true, model: 'gemini-2.5' }
    },
    smtpProfiles: [
      { id: 'smtp1', name: 'Work Gmail', isDefault: true, host: 'smtp.gmail.com', port: 465, encryption: 'SSL' }
    ],
    preferences: {
      outreachTone: 'direct',
      delaySeconds: 3,
      attachResume: true
    }
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SettingsModal
        isOpen={false}
        onClose={vi.fn()}
        config={dummyConfig}
        onRefreshConfig={vi.fn()}
        onShowToast={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders vertical sidebar navigation and default AI tab when isOpen is true', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        initialTab="ai"
        config={dummyConfig}
        onRefreshConfig={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    expect(screen.getByText('Settings & Preferences')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /AI Providers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SMTP/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Preferences/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Logs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Danger Zone/i })).toBeInTheDocument();

    // AI Tab content
    expect(screen.getByText('Google Gemini')).toBeInTheDocument();
  });

  it('switches between tabs on click', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        initialTab="ai"
        config={dummyConfig}
        onRefreshConfig={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    // Switch to SMTP tab
    fireEvent.click(screen.getByRole('button', { name: /SMTP/i }));
    expect(screen.getByText('Saved SMTP Accounts')).toBeInTheDocument();
    expect(screen.getByText('Work Gmail')).toBeInTheDocument();

    // Switch to Preferences tab
    fireEvent.click(screen.getByRole('button', { name: /Preferences/i }));
    expect(screen.getByText(/Candidate Profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Default Outreach Tone & Style/i)).toBeInTheDocument();

    // Switch to Danger Zone tab
    fireEvent.click(screen.getByRole('button', { name: /Danger Zone/i }));
    expect(screen.getByText('Destructive Action Notice')).toBeInTheDocument();
  });

  it('calls onClose when Close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={onClose}
        initialTab="ai"
        config={dummyConfig}
        onRefreshConfig={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders dialog with proper a11y attributes', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        initialTab="ai"
        config={dummyConfig}
        onRefreshConfig={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'settings-dialog-title');
  });

  it('renders nav with aria-label and aria-current on active item', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        initialTab="ai"
        config={dummyConfig}
        onRefreshConfig={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(nav).toBeInTheDocument();

    const aiButton = screen.getByRole('button', { name: /AI Providers/i });
    expect(aiButton).toHaveAttribute('aria-current', 'page');

    const smtpButton = screen.getByRole('button', { name: /SMTP/i });
    expect(smtpButton).not.toHaveAttribute('aria-current');
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={onClose}
        initialTab="ai"
        config={dummyConfig}
        onRefreshConfig={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders StatusBadge with correct status for configured provider', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        initialTab="ai"
        config={dummyConfig}
        onRefreshConfig={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    expect(screen.getByText('Key saved')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('renders provider rows with proper aria-expanded buttons', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        initialTab="ai"
        config={dummyConfig}
        onRefreshConfig={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    const geminiButton = screen.getByRole('button', { name: /Google Gemini/i });
    expect(geminiButton).toHaveAttribute('aria-expanded');
  });

  it('shows configured provider with selected model in In use section and renders saved keys list with names', () => {
    const configWithGroq = {
      activeProvider: 'groq',
      aiProviders: {
        groq: {
          name: 'Groq',
          maskedKey: 'gsk_...Uc79',
          model: 'openai/gpt-oss-20b',
          savedKeys: [
            { id: 'k1', name: 'Work Account', maskedKey: 'gsk_...Uc79' },
            { id: 'k2', name: 'Backup Groq', maskedKey: 'gsk_...8888' }
          ],
          selectedKeyId: 'k1'
        },
        openai: {
          name: 'OpenAI',
          maskedKey: '',
          isConfigured: false
        }
      },
      smtpProfiles: [],
      preferences: {}
    };

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        initialTab="ai"
        config={configWithGroq}
        onRefreshConfig={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    // In use section should contain Groq with selected model friendly name
    expect(screen.getByText('In use')).toBeInTheDocument();
    expect(screen.getByText('GPT-OSS 20B')).toBeInTheDocument();

    // Expand Groq accordion
    const groqButton = screen.getByRole('button', { name: /Groq/i });
    fireEvent.click(groqButton);

    // Should display the saved keys list with custom names
    expect(screen.getByText(/Saved API Keys \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText('Work Account')).toBeInTheDocument();
    expect(screen.getByText('Backup Groq')).toBeInTheDocument();
    expect(screen.getByText('Use key')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add another key/i })).toBeInTheDocument();

    // Redundant active key dropdown must NOT be present
    expect(screen.queryByRole('combobox', { name: /Select active API key from previously added keys/i })).toBeNull();

    // Replace button should be present on saved key cards
    const replaceButtons = screen.getAllByRole('button', { name: /Replace/i });
    expect(replaceButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders standard default models in model dropdown when expanded', () => {
    const configWithGemini = {
      activeProvider: 'gemini',
      aiProviders: {
        gemini: {
          name: 'Google Gemini',
          maskedKey: 'AIza...4kQQ',
          model: 'gemini-2.5-flash',
          isConfigured: true,
          savedKeys: [
            { id: 'gem_1', name: 'Primary Key', maskedKey: 'AIza...4kQQ' }
          ],
          selectedKeyId: 'gem_1'
        }
      },
      smtpProfiles: [],
      preferences: {}
    };

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        initialTab="ai"
        config={configWithGemini}
        onRefreshConfig={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    // Expand Gemini accordion
    const geminiButton = screen.getByRole('button', { name: /Google Gemini/i });
    fireEvent.click(geminiButton);

    // Model combobox trigger should display friendly name
    const modelTrigger = screen.getByRole('combobox', { name: '' });
    expect(modelTrigger).toBeInTheDocument();
    expect(modelTrigger).toHaveTextContent(/Gemini 2.5 Flash/i);

    // Clicking trigger opens dropdown
    fireEvent.click(modelTrigger);

    // Standard default models should be present and selectable
    expect(screen.getByText('Gemini 1.5 Flash')).toBeInTheDocument();
    expect(screen.getByText('Gemini 1.5 Pro')).toBeInTheDocument();
    expect(screen.getByText('Gemini 2.0 Flash')).toBeInTheDocument();
  });
});
