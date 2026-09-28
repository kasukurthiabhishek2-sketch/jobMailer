import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Lock,
  Check,
  ChevronDown,
  CheckCircle2,
  RefreshCw,
  Copy,
  ExternalLink,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Edit2
} from 'lucide-react';
import {
  saveAiProviderConfig,
  setActiveAiProvider,
  testAiConnection,
  listAiModels,
  startCopilotAuth,
  getCurrentCopilotFlow,
  checkCopilotStatus
} from '../../services/api';
import { saveSettings, stripUndefined } from '../../lib/settings';

/* ── Constants ───────────────────────────────────────────────────────────── */

const PROVIDER_CONFIG = {
  gemini:  { name: 'Google Gemini',   monogram: 'G', keyPrefix: 'AIza', keyPage: 'https://aistudio.google.com/apikey' },
  openai:  { name: 'OpenAI',          monogram: 'O', keyPrefix: 'sk-', keyPage: 'https://platform.openai.com/api-keys' },
  groq:    { name: 'Groq',            monogram: 'Q', keyPrefix: 'gsk_', keyPage: 'https://console.groq.com/keys' },
  grok:    { name: 'Grok (xAI)',      monogram: 'X', keyPrefix: 'xai-', keyPage: 'https://console.x.ai/' },
  copilot: { name: 'GitHub Copilot',  monogram: 'C', keyPrefix: 'ghu_', keyPage: null },
  nvidia:  { name: 'NVIDIA NIM',      monogram: 'N', keyPrefix: 'nvapi-', keyPage: 'https://build.nvidia.com/nim' },
  custom:  { name: 'Custom Endpoint', monogram: '⌘', keyPrefix: '', keyPage: null },
};

const FRIENDLY_MODEL_NAMES = {
  'gemini-1.5-flash': 'Gemini 1.5 Flash',
  'gemini-1.5-pro': 'Gemini 1.5 Pro',
  'gemini-2.0-flash-exp': 'Gemini 2.0 Flash',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-3.5-turbo': 'GPT-3.5 Turbo',
  'grok-2-1212': 'Grok 2',
  'grok-2-vision-1212': 'Grok 2 Vision',
  'grok-beta': 'Grok Beta',
  'meta/llama-3.1-70b-instruct': 'Llama 3.1 70B',
  'meta/llama-3.1-8b-instruct': 'Llama 3.1 8B',
  'mistralai/mixtral-8x22b-instruct-v0.1': 'Mixtral 8x22B',
  'qwen/qwen3.8-27b': 'Qwen 3.8 27B',
  'openai/gpt-oss-20b': 'GPT-OSS 20B',
  'openai/gpt-oss-120b': 'GPT-OSS 120B',
};

function friendlyModelName(id) {
  if (!id) return '';
  return FRIENDLY_MODEL_NAMES[id] || id;
}

function getProviderSavedKeys(provider) {
  if (Array.isArray(provider?.savedKeys) && provider.savedKeys.length > 0) {
    return provider.savedKeys;
  }
  const hasKey = Boolean(
    provider?.isConfigured ||
    (provider?.apiKey && provider.apiKey.trim().length > 0) ||
    (provider?.maskedKey && provider.maskedKey.trim().length > 0)
  );
  if (hasKey) {
    const masked = provider.maskedKey || (provider.apiKey ? (provider.apiKey.length > 8 ? `${provider.apiKey.slice(0, 4)}...${provider.apiKey.slice(-4)}` : '••••••••') : '••••••••');
    return [
      {
        id: provider.selectedKeyId || 'default',
        name: 'Primary Key',
        apiKey: provider.apiKey || '',
        maskedKey: masked,
        createdAt: Date.now()
      }
    ];
  }
  return [];
}

/* ── Inline UI primitives (only used in this file) ───────────────────── */

function StatusBadge({ status, lastVerifiedAt }) {
  if (status === 'connected') {
    const ago = lastVerifiedAt ? formatTimeAgo(lastVerifiedAt) : '';
    return (
      <span className="status-badge status-badge-ready" title={ago ? `Verified ${ago}` : undefined}>
        <CheckCircle2 size={12} aria-hidden="true" /> Connected
      </span>
    );
  }
  if (status === 'verifying') {
    return (
      <span className="status-badge status-badge-attention">
        <RefreshCw size={12} className="spin-icon" aria-hidden="true" /> Verifying…
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="status-badge status-badge-attention">
        <AlertCircle size={12} aria-hidden="true" /> Error
      </span>
    );
  }
  if (status === 'key-saved') {
    return (
      <span className="status-badge status-badge-neutral">
        <Lock size={12} aria-hidden="true" /> Key saved
      </span>
    );
  }
  return <span className="status-badge status-badge-neutral">Not configured</span>;
}

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function ProviderLogo({ monogram }) {
  return (
    <span className="provider-logo-tile" aria-hidden="true">
      {monogram}
    </span>
  );
}

function ModelSelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);
  const listRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);

  const filtered = searchTerm
    ? options.filter(opt => {
        const q = searchTerm.toLowerCase();
        return opt.toLowerCase().includes(q) || friendlyModelName(opt).toLowerCase().includes(q);
      })
    : options;

  const selectedIndex = filtered.indexOf(value);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  useEffect(() => {
    if (open && focusIndex >= 0 && listRef.current?.children[focusIndex]) {
      listRef.current.children[focusIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [focusIndex, open]);

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    const nextFiltered = term
      ? options.filter(opt => {
          const q = term.toLowerCase();
          return opt.toLowerCase().includes(q) || friendlyModelName(opt).toLowerCase().includes(q);
        })
      : options;
    setFocusIndex(nextFiltered.length > 0 ? 0 : -1);
  };

  const select = (opt) => {
    onChange(opt);
    setOpen(false);
    setSearchTerm('');
    triggerRef.current?.focus();
  };

  const handleListKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusIndex(i => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusIndex >= 0 && focusIndex < filtered.length) select(filtered[focusIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setSearchTerm('');
        triggerRef.current?.focus();
        break;
      default:
        break;
    }
  };

  const handleTriggerKeyDown = (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
      setFocusIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  };

  return (
    <div className="model-select" ref={wrapperRef}>
      <button
        type="button"
        ref={triggerRef}
        className="model-select-trigger"
        onClick={() => { setOpen(!open); if (!open) setFocusIndex(selectedIndex >= 0 ? selectedIndex : 0); }}
        onKeyDown={handleTriggerKeyDown}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="model-select-value">{friendlyModelName(value)}</span>
        <ChevronDown
          size={14}
          className={`model-select-icon ${open ? 'provider-chevron-open' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="model-select-dropdown">
          {options.length > 8 && (
            <div className="model-select-search-wrap">
              <input
                ref={searchRef}
                type="text"
                className="model-select-search"
                placeholder="Search models…"
                value={searchTerm}
                onChange={handleSearchChange}
                onKeyDown={handleListKeyDown}
                aria-label="Search models"
              />
            </div>
          )}
          <ul
            ref={listRef}
            role="listbox"
            className="model-select-listbox"
            onKeyDown={handleListKeyDown}
            tabIndex={-1}
            aria-label="Select model"
          >
            {filtered.length === 0 ? (
              <li className="model-select-empty">No models match “{searchTerm}”</li>
            ) : (
              filtered.map((opt, i) => (
                <li
                  key={opt}
                  role="option"
                  aria-selected={opt === value}
                  className={`model-select-option ${opt === value ? 'selected' : ''} ${i === focusIndex ? 'focused' : ''}`}
                  onClick={() => select(opt)}
                  onMouseEnter={() => setFocusIndex(i)}
                >
                  <span className="model-select-option-label">{friendlyModelName(opt)}</span>
                  {friendlyModelName(opt) !== opt && (
                    <span className="model-select-option-id">{opt}</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────── */

export default function AiProvidersTab({ config, onRefreshConfig, onShowToast, user }) {
  const [expandedKey, setExpandedKey] = useState(null);
  const [editingKeys, setEditingKeys] = useState({});
  const [editingModels, setEditingModels] = useState({});
  const [editingBaseUrls, setEditingBaseUrls] = useState({});
  const [addingKey, setAddingKey] = useState({});
  const [newKeyName, setNewKeyName] = useState({});
  const [editingKeyId, setEditingKeyId] = useState({});
  const [editingKeyName, setEditingKeyName] = useState({});
  const [providerStates, setProviderStates] = useState({});
  const [modelLists, setModelLists] = useState({});
  const [_replacingKey, setReplacingKey] = useState({});

  const [showManualCopilotInput, setShowManualCopilotInput] = useState(false);
  const [showCopilotToken, setShowCopilotToken] = useState(false);
  const [showToken, setShowToken] = useState({});

  const [copilotFlow, setCopilotFlow] = useState(() => {
    try {
      const saved = sessionStorage.getItem('jdmail_copilot_flow');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.deviceCode && parsed.expiresAt > Date.now()) {
          return {
            ...parsed,
            polling: true,
            copied: false,
            error: null,
            checking: false,
            statusMessage: 'Resumed pending GitHub verification session...'
          };
        }
      }
    } catch {
      // sessionStorage unavailable or invalid
    }
    return {
      active: false,
      deviceCode: '',
      userCode: '',
      verificationUri: '',
      expiresIn: 0,
      expiresAt: 0,
      polling: false,
      copied: false,
      error: null,
      checking: false,
      statusMessage: ''
    };
  });

  const configRef = useRef(config);
  const userRef = useRef(user);

  useEffect(() => {
    configRef.current = config;
    userRef.current = user;
  }, [config, user]);

  const pollTimeoutRef = useRef(null);
  const isPollingRef = useRef(false);
  const currentIntervalRef = useRef(5000);

  const stopPolling = () => {
    isPollingRef.current = false;
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  };

  const startPollingFlow = useCallback((deviceCode, intervalMs = 5000) => {
    stopPolling();
    isPollingRef.current = true;
    currentIntervalRef.current = Math.max(5000, intervalMs);

    const pollStep = async () => {
      if (!isPollingRef.current) return;
      try {
        const res = await checkCopilotStatus(deviceCode, true);
        if (res.status === 'authorized') {
          stopPolling();
          try { sessionStorage.removeItem('jdmail_copilot_flow'); } catch {}
          setCopilotFlow({
            active: false, deviceCode: '', userCode: '', verificationUri: '',
            expiresIn: 0, expiresAt: 0, polling: false, copied: false,
            error: null, checking: false, statusMessage: ''
          });
          if (res.config) {
            const currentConfig = configRef.current;
            const currentUser = userRef.current;
            const updatedConfig = stripUndefined({
              ...currentConfig,
              ...res.config,
              activeProvider: 'copilot',
              aiProviders: {
                ...currentConfig?.aiProviders,
                copilot: {
                  ...currentConfig?.aiProviders?.copilot,
                  ...res.config?.aiProviders?.copilot,
                  isConfigured: true,
                  active: true
                }
              }
            });
            if (currentUser?.uid) {
              try {
                await saveSettings(currentUser.uid, updatedConfig);
              } catch (e) {
                console.warn('Firestore settings save notice:', e.message);
              }
            }
            onRefreshConfig(updatedConfig);
          }
          onShowToast?.({
            type: 'success',
            title: 'GitHub Copilot connected',
            message: 'Successfully authenticated with your GitHub Copilot subscription!'
          });
          return;
        }

        if (res.status === 'slow_down') {
          currentIntervalRef.current = Math.max(currentIntervalRef.current + 5000, (res.interval || 10) * 1000);
          setCopilotFlow(prev => ({
            ...prev,
            statusMessage: `GitHub rate limit: adjusting check rate to ${currentIntervalRef.current / 1000}s...`
          }));
        } else if (res.status === 'pending') {
          setCopilotFlow(prev => ({
            ...prev,
            statusMessage: 'Waiting for you to authorize on GitHub...'
          }));
        } else if (res.status === 'expired' || res.status === 'denied' || res.status === 'error') {
          stopPolling();
          try { sessionStorage.removeItem('jdmail_copilot_flow'); } catch {}
          setCopilotFlow(prev => ({
            ...prev,
            polling: false,
            error: res.error || 'Authorization failed'
          }));
          return;
        }
      } catch (pollErr) {
        console.warn('Copilot polling transient error:', pollErr.message);
      }

      if (isPollingRef.current) {
        pollTimeoutRef.current = setTimeout(pollStep, currentIntervalRef.current);
      }
    };

    pollTimeoutRef.current = setTimeout(pollStep, currentIntervalRef.current);
  }, [onRefreshConfig, onShowToast]);

  const handleStartCopilotAuth = async () => {
    try {
      stopPolling();
      setCopilotFlow({
        active: true, deviceCode: '', userCode: '', verificationUri: '',
        expiresIn: 0, expiresAt: 0, polling: true, copied: false,
        error: null, checking: false,
        statusMessage: 'Requesting verification code from GitHub...'
      });

      const data = await startCopilotAuth();
      const expiresAt = Date.now() + ((data.expiresIn || 899) * 1000);
      const newFlow = {
        active: true,
        deviceCode: data.deviceCode,
        userCode: data.userCode,
        verificationUri: data.verificationUri,
        expiresIn: data.expiresIn,
        expiresAt,
        polling: true,
        copied: false,
        error: null,
        checking: false,
        statusMessage: 'Waiting for you to authorize on GitHub...'
      };
      setCopilotFlow(newFlow);
      try {
        sessionStorage.setItem('jdmail_copilot_flow', JSON.stringify({
          deviceCode: data.deviceCode,
          userCode: data.userCode,
          verificationUri: data.verificationUri,
          expiresIn: data.expiresIn,
          expiresAt
        }));
      } catch {}

      const initialInterval = ((data.interval || 5) * 1000) + 1000;
      startPollingFlow(data.deviceCode, initialInterval);
    } catch (err) {
      stopPolling();
      setCopilotFlow(prev => ({ ...prev, polling: false, error: err.message }));
      onShowToast?.({ type: 'error', title: 'GitHub error', message: err.message });
    }
  };

  const handleCheckCopilotStatus = useCallback(async (showToastOnPending = true) => {
    if (copilotFlow.checking) return;
    setCopilotFlow(prev => ({ ...prev, checking: true }));

    try {
      const res = await checkCopilotStatus(copilotFlow.deviceCode, true);
      if (res.status === 'authorized') {
        stopPolling();
        try { sessionStorage.removeItem('jdmail_copilot_flow'); } catch {}
        setCopilotFlow({
          active: false, deviceCode: '', userCode: '', verificationUri: '',
          expiresIn: 0, expiresAt: 0, polling: false, copied: false,
          error: null, checking: false, statusMessage: ''
        });
        if (res.config) {
          const currentConfig = configRef.current;
          const currentUser = userRef.current;
          const updatedConfig = stripUndefined({
            ...currentConfig,
            ...res.config,
            activeProvider: 'copilot',
            aiProviders: {
              ...currentConfig?.aiProviders,
              copilot: {
                ...currentConfig?.aiProviders?.copilot,
                ...res.config?.aiProviders?.copilot,
                isConfigured: true,
                active: true
              }
            }
          });
          if (currentUser?.uid) {
            try {
              await saveSettings(currentUser.uid, updatedConfig);
            } catch (e) {
              console.warn('Firestore settings save notice:', e.message);
            }
          }
          onRefreshConfig(updatedConfig);
        }
        onShowToast?.({
          type: 'success',
          title: 'GitHub Copilot connected',
          message: 'Successfully authenticated with your GitHub Copilot subscription!'
        });
        return;
      }

      if (res.status === 'pending') {
        setCopilotFlow(prev => ({
          ...prev, checking: false, error: null,
          statusMessage: 'Waiting for you to authorize on GitHub...'
        }));
        if (showToastOnPending) {
          onShowToast?.({
            type: 'info',
            title: 'Authorization pending',
            message: 'Still waiting for approval on GitHub. Make sure you entered the code and clicked "Authorize GitHub Copilot".'
          });
        }
      } else if (res.status === 'slow_down') {
        currentIntervalRef.current = Math.max(currentIntervalRef.current + 5000, (res.interval || 10) * 1000);
        setCopilotFlow(prev => ({
          ...prev, checking: false,
          statusMessage: `GitHub rate limit: please wait ${currentIntervalRef.current / 1000}s...`
        }));
        if (showToastOnPending) {
          onShowToast?.({
            type: 'warning',
            title: 'Rate limit',
            message: 'GitHub asked to slow down requests. Please wait a few seconds and click Verify again.'
          });
        }
      } else if (res.status === 'expired' || res.status === 'denied' || res.status === 'error') {
        stopPolling();
        try { sessionStorage.removeItem('jdmail_copilot_flow'); } catch {}
        setCopilotFlow(prev => ({
          ...prev, checking: false, polling: false,
          error: res.error || 'Authorization failed'
        }));
        if (showToastOnPending) {
          onShowToast?.({
            type: 'error',
            title: 'Authorization failed',
            message: res.error || 'Device code expired or was rejected by GitHub.'
          });
        }
      }
    } catch (err) {
      setCopilotFlow(prev => ({ ...prev, checking: false }));
      if (showToastOnPending) {
        onShowToast?.({ type: 'error', title: 'Check error', message: err.message });
      }
    }
  }, [copilotFlow.checking, copilotFlow.deviceCode, onRefreshConfig, onShowToast]);

  const handleCancelCopilotAuth = () => {
    stopPolling();
    try { sessionStorage.removeItem('jdmail_copilot_flow'); } catch {}
    setCopilotFlow({
      active: false, deviceCode: '', userCode: '', verificationUri: '',
      expiresIn: 0, expiresAt: 0, polling: false, copied: false,
      error: null, checking: false, statusMessage: ''
    });
  };

  useEffect(() => {
    if (!config?.aiProviders?.copilot?.isConfigured && !copilotFlow.active) {
      getCurrentCopilotFlow().then(res => {
        if (res?.active && res.flow?.userCode) {
          const flowExpiresAt = Date.now() + ((res.flow.expiresIn || 899) * 1000);
          setCopilotFlow({
            active: true,
            deviceCode: res.flow.deviceCode || '',
            userCode: res.flow.userCode,
            verificationUri: res.flow.verificationUri || 'https://github.com/login/device',
            expiresIn: res.flow.expiresIn || 899,
            expiresAt: flowExpiresAt,
            polling: true,
            copied: false,
            error: null,
            checking: false,
            statusMessage: 'Waiting for you to authorize on GitHub...'
          });
          startPollingFlow(res.flow.deviceCode, (res.flow.interval || 5) * 1000);
        }
      }).catch(() => {});
    }
  }, [config?.aiProviders?.copilot?.isConfigured, copilotFlow.active, startPollingFlow]);

  useEffect(() => {
    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible' && copilotFlow.active && (copilotFlow.deviceCode || copilotFlow.userCode)) {
        handleCheckCopilotStatus(false);
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [copilotFlow.active, copilotFlow.deviceCode, copilotFlow.userCode, handleCheckCopilotStatus]);

  const handleCopyAndOpenGithub = (code, uri) => {
    navigator.clipboard.writeText(code);
    setCopilotFlow(prev => ({ ...prev, copied: true }));
    window.open(uri || 'https://github.com/login/device', '_blank', 'noopener,noreferrer');
    onShowToast?.({
      type: 'success',
      title: 'Code copied',
      message: `Verification code ${code} copied to clipboard! Opening GitHub to authenticate.`
    });
    setTimeout(() => {
      setCopilotFlow(prev => ({ ...prev, copied: false }));
    }, 3000);
  };

  const isProviderConfigured = useCallback((key, provider) => {
    if (!provider) return false;
    if (provider.isConfigured) return true;
    if (provider.apiKey && provider.apiKey.trim().length > 0) return true;
    if (provider.maskedKey && provider.maskedKey.trim().length > 0) return true;
    if (Array.isArray(provider.savedKeys) && provider.savedKeys.length > 0) return true;
    const status = providerStates[key]?.status;
    if (status === 'connected' || status === 'key-saved') return true;
    if (config?.activeProvider === key) return true;
    if (key === 'copilot' && (provider.isConfigured || provider.connected)) return true;
    return false;
  }, [providerStates, config?.activeProvider]);

  const getEffectiveStatus = useCallback((providerKey) => {
    const ps = providerStates[providerKey];
    if (ps?.status) return ps.status;
    const provider = config?.aiProviders?.[providerKey];
    if (isProviderConfigured(providerKey, provider)) return 'key-saved';
    return 'not-configured';
  }, [providerStates, config?.aiProviders, isProviderConfigured]);

  const handleSaveAndVerify = async (providerKey, rawKey, customKeyName) => {
    if (!rawKey?.trim()) return;
    const trimmed = rawKey.trim();

    setProviderStates(prev => ({ ...prev, [providerKey]: { ...prev[providerKey], saving: true } }));

    try {
      const currentProvider = config?.aiProviders?.[providerKey] || {};
      const existingKeys = getProviderSavedKeys(currentProvider);
      const masked = trimmed.length > 8 ? `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}` : '••••••••';
      const keyId = `key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const keyName = customKeyName?.trim() || (existingKeys.length === 0 ? 'Primary Key' : `Key ${existingKeys.length + 1}`);

      const newKeyObj = {
        id: keyId,
        name: keyName,
        apiKey: trimmed,
        maskedKey: masked,
        createdAt: new Date().toISOString()
      };

      const updatedSavedKeys = [...existingKeys, newKeyObj];

      const updatedAiProvider = {
        ...currentProvider,
        apiKey: trimmed,
        maskedKey: masked,
        selectedKeyId: keyId,
        savedKeys: updatedSavedKeys,
        isConfigured: true,
        model: editingModels[providerKey] || currentProvider.model || '',
        baseURL: providerKey === 'custom' ? (editingBaseUrls[providerKey] || currentProvider.baseURL || '') : currentProvider.baseURL,
        enabled: true
      };

      const updatedConfig = stripUndefined({
        ...config,
        aiProviders: {
          ...config?.aiProviders,
          [providerKey]: updatedAiProvider
        }
      });

      if (user?.uid) {
        try {
          await saveSettings(user.uid, updatedConfig);
        } catch (e) {
          console.warn('Firestore save notice:', e.message);
        }
      }

      try {
        await saveAiProviderConfig({
          providerKey,
          apiKey: trimmed,
          keyName,
          selectedKeyId: keyId,
          model: updatedAiProvider.model,
          baseURL: updatedAiProvider.baseURL,
          enabled: true
        });
      } catch {
        // Non-fatal if offline/local
      }

      onRefreshConfig(updatedConfig);
      setEditingKeys(prev => ({ ...prev, [providerKey]: '' }));
      setReplacingKey(prev => ({ ...prev, [providerKey]: false }));
      setAddingKey(prev => ({ ...prev, [providerKey]: false }));
      setNewKeyName(prev => ({ ...prev, [providerKey]: '' }));

      onShowToast?.({
        type: 'success',
        title: 'API key saved',
        message: `Saved "${keyName}" for ${PROVIDER_CONFIG[providerKey]?.name || providerKey}`
      });

      handleTestConnection(providerKey, trimmed);
    } catch (err) {
      onShowToast?.({ type: 'error', title: 'Save failed', message: err.message });
      setProviderStates(prev => ({ ...prev, [providerKey]: { ...prev[providerKey], saving: false, status: 'error', error: err.message } }));
    }
  };

  const handleSelectKey = async (providerKey, keyId) => {
    const currentProvider = config?.aiProviders?.[providerKey] || {};
    const keys = getProviderSavedKeys(currentProvider);
    const targetKey = keys.find(k => k.id === keyId);
    if (!targetKey) return;

    const updatedAiProvider = {
      ...currentProvider,
      apiKey: targetKey.apiKey || '',
      maskedKey: targetKey.maskedKey || '',
      selectedKeyId: keyId,
      isConfigured: true
    };

    const updatedConfig = stripUndefined({
      ...config,
      aiProviders: {
        ...config?.aiProviders,
        [providerKey]: updatedAiProvider
      }
    });

    if (user?.uid) {
      try {
        await saveSettings(user.uid, updatedConfig);
      } catch (e) {
        console.warn('Firestore save notice:', e.message);
      }
    }

    try {
      await saveAiProviderConfig({
        providerKey,
        selectedKeyId: keyId,
        model: currentProvider.model || '',
        enabled: true
      });
    } catch {}

    onRefreshConfig(updatedConfig);
    onShowToast?.({
      type: 'success',
      title: 'Active key updated',
      message: `Switched to "${targetKey.name}" for ${PROVIDER_CONFIG[providerKey]?.name || providerKey}`
    });

    handleTestConnection(providerKey, targetKey.apiKey);
  };

  const handleRenameKey = async (providerKey, keyId, newName) => {
    if (!newName?.trim()) return;
    const trimmedName = newName.trim();
    const currentProvider = config?.aiProviders?.[providerKey] || {};
    const keys = getProviderSavedKeys(currentProvider);
    const updatedKeys = keys.map(k => k.id === keyId ? { ...k, name: trimmedName } : k);

    const updatedAiProvider = {
      ...currentProvider,
      savedKeys: updatedKeys
    };

    const updatedConfig = stripUndefined({
      ...config,
      aiProviders: {
        ...config?.aiProviders,
        [providerKey]: updatedAiProvider
      }
    });

    if (user?.uid) {
      try {
        await saveSettings(user.uid, updatedConfig);
      } catch (e) {
        console.warn('Firestore save notice:', e.message);
      }
    }

    try {
      await saveAiProviderConfig({
        providerKey,
        renameKeyId: keyId,
        newName: trimmedName,
        model: currentProvider.model || '',
        enabled: true
      });
    } catch {}

    onRefreshConfig(updatedConfig);
    setEditingKeyId(prev => ({ ...prev, [providerKey]: null }));
    onShowToast?.({
      type: 'info',
      title: 'Key renamed',
      message: `Renamed to "${trimmedName}"`
    });
  };

  const handleDeleteSavedKey = async (providerKey, keyId) => {
    const currentProvider = config?.aiProviders?.[providerKey] || {};
    const keys = getProviderSavedKeys(currentProvider);
    const targetKey = keys.find(k => k.id === keyId);
    const keyName = targetKey?.name || 'API key';

    if (!window.confirm(`Delete "${keyName}"? This cannot be undone.`)) {
      return;
    }

    const remainingKeys = keys.filter(k => k.id !== keyId);
    let newSelectedId = currentProvider.selectedKeyId;
    let newApiKey = currentProvider.apiKey;
    let newMaskedKey = currentProvider.maskedKey;
    let isConfigured = currentProvider.isConfigured;

    if (currentProvider.selectedKeyId === keyId || keys.length === 1) {
      if (remainingKeys.length > 0) {
        newSelectedId = remainingKeys[0].id;
        newApiKey = remainingKeys[0].apiKey || '';
        newMaskedKey = remainingKeys[0].maskedKey || '';
        isConfigured = true;
      } else {
        newSelectedId = '';
        newApiKey = '';
        newMaskedKey = '';
        isConfigured = false;
      }
    }

    const updatedAiProvider = {
      ...currentProvider,
      apiKey: newApiKey,
      maskedKey: newMaskedKey,
      selectedKeyId: newSelectedId,
      savedKeys: remainingKeys,
      isConfigured
    };

    const updatedConfig = stripUndefined({
      ...config,
      aiProviders: {
        ...config?.aiProviders,
        [providerKey]: updatedAiProvider
      }
    });

    if (user?.uid) {
      try {
        await saveSettings(user.uid, updatedConfig);
      } catch (e) {
        console.warn('Firestore save notice:', e.message);
      }
    }

    try {
      await saveAiProviderConfig({
        providerKey,
        deleteKeyId: keyId,
        apiKey: newApiKey,
        model: currentProvider.model || '',
        enabled: true
      });
    } catch {}

    if (!isConfigured && config?.activeProvider === providerKey) {
      try { await setActiveAiProvider('gemini'); } catch {}
    }

    onRefreshConfig(updatedConfig);
    if (!isConfigured) {
      setProviderStates(prev => ({ ...prev, [providerKey]: { status: 'not-configured', error: null, message: null } }));
      setModelLists(prev => ({ ...prev, [providerKey]: undefined }));
    }
    onShowToast?.({
      type: 'info',
      title: 'Key removed',
      message: `Deleted "${keyName}" for ${PROVIDER_CONFIG[providerKey]?.name || providerKey}`
    });
  };

  const handleTestConnection = async (providerKey, overrideKey) => {
    setProviderStates(prev => ({ ...prev, [providerKey]: { ...prev[providerKey], status: 'verifying', error: null } }));
    try {
      const currentProvider = config?.aiProviders?.[providerKey] || {};
      const model = editingModels[providerKey] || currentProvider.model;
      const baseURL = editingBaseUrls[providerKey] || currentProvider.baseURL || '';
      // If a raw key is provided (e.g. just pasted), send it directly; otherwise let the server resolve from encrypted storage
      const res = await testAiConnection({
        providerKey,
        apiKey: overrideKey || '',
        model,
        baseURL,
        selectedKeyId: overrideKey ? undefined : (currentProvider.selectedKeyId || undefined)
      });
      if (res?.success) {
        setProviderStates(prev => ({ ...prev, [providerKey]: { ...prev[providerKey], status: 'connected', error: null, message: res.message, lastVerifiedAt: Date.now(), saving: false } }));
      } else {
        setProviderStates(prev => ({ ...prev, [providerKey]: { ...prev[providerKey], status: 'error', error: res?.error || 'Connection test failed', saving: false } }));
      }
    } catch (err) {
      setProviderStates(prev => ({ ...prev, [providerKey]: { ...prev[providerKey], status: 'error', error: err.message, saving: false } }));
    }
  };

  const handleFetchModels = async (providerKey) => {
    setModelLists(prev => ({ ...prev, [providerKey]: { ...prev[providerKey], loading: true, error: null } }));
    try {
      const currentProvider = config?.aiProviders?.[providerKey] || {};
      // Let the server resolve the key from encrypted storage; only send raw key if user is typing one in right now
      const res = await listAiModels({
        providerKey,
        apiKey: editingKeys[providerKey] || '',
        selectedKeyId: currentProvider.selectedKeyId || undefined
      });
      if (res?.success && Array.isArray(res.models)) {
        setModelLists(prev => ({ ...prev, [providerKey]: { models: res.models, loading: false, error: null, fetchedAt: Date.now() } }));
      } else {
        setModelLists(prev => ({ ...prev, [providerKey]: { ...prev[providerKey], loading: false, error: res?.error || 'Failed to load models' } }));
      }
    } catch (err) {
      setModelLists(prev => ({ ...prev, [providerKey]: { ...prev[providerKey], loading: false, error: err.message } }));
    }
  };

  const handleRemoveKey = async (providerKey) => {
    if (!window.confirm(`Remove the API key for ${PROVIDER_CONFIG[providerKey]?.name || providerKey}? This cannot be undone.`)) {
      return;
    }
    try {
      const currentProvider = config?.aiProviders?.[providerKey] || {};
      const updatedAiProvider = {
        ...currentProvider,
        apiKey: '',
        isConfigured: false,
        maskedKey: ''
      };
      const updatedConfig = stripUndefined({
        ...config,
        aiProviders: {
          ...config?.aiProviders,
          [providerKey]: updatedAiProvider
        }
      });
      if (user?.uid) {
        try {
          await saveSettings(user.uid, updatedConfig);
        } catch (e) {
          console.warn('Firestore save notice:', e.message);
        }
      }
      try {
        await saveAiProviderConfig({
          providerKey,
          apiKey: '',
          model: currentProvider.model || '',
          enabled: true
        });
      } catch {}
      if (config?.activeProvider === providerKey) {
        try { await setActiveAiProvider('gemini'); } catch {}
      }
      onRefreshConfig(updatedConfig);
      setProviderStates(prev => ({ ...prev, [providerKey]: { status: 'not-configured', error: null, message: null } }));
      setModelLists(prev => ({ ...prev, [providerKey]: undefined }));
      setReplacingKey(prev => ({ ...prev, [providerKey]: false }));
      onShowToast?.({ type: 'info', title: 'Key removed', message: `API key removed for ${PROVIDER_CONFIG[providerKey]?.name || providerKey}` });
    } catch (err) {
      onShowToast?.({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleSetActiveAi = async (providerKey) => {
    try {
      const updatedAiProviders = { ...config?.aiProviders };
      for (const k of Object.keys(updatedAiProviders)) {
        updatedAiProviders[k] = {
          ...updatedAiProviders[k],
          active: k === providerKey
        };
      }
      const updatedConfig = stripUndefined({
        ...config,
        activeProvider: providerKey,
        aiProviders: updatedAiProviders
      });

      try {
        await setActiveAiProvider(providerKey);
      } catch (backendErr) {
        console.warn('Local backend active provider notice:', backendErr.message);
      }

      if (user?.uid) {
        await saveSettings(user.uid, updatedConfig);
      }
      onRefreshConfig(updatedConfig);
      onShowToast?.({
        type: 'success',
        title: 'Default provider updated',
        message: `Default AI provider set to ${PROVIDER_CONFIG[providerKey]?.name || providerKey}`
      });
    } catch (err) {
      onShowToast?.({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleModelChange = async (providerKey, newModel) => {
    setEditingModels(prev => ({ ...prev, [providerKey]: newModel }));
    const currentProvider = config?.aiProviders?.[providerKey] || {};
    const hasKey = isProviderConfigured(providerKey, currentProvider);
    const updatedProvider = {
      ...currentProvider,
      model: newModel,
      isConfigured: hasKey || Boolean(newModel)
    };
    const updatedConfig = stripUndefined({
      ...config,
      aiProviders: {
        ...config?.aiProviders,
        [providerKey]: updatedProvider
      }
    });

    try {
      await saveAiProviderConfig({
        providerKey,
        model: newModel,
        apiKey: currentProvider.apiKey || '',
        baseURL: providerKey === 'custom' ? (editingBaseUrls[providerKey] || currentProvider.baseURL) : undefined,
        enabled: true
      });
    } catch (backendErr) {
      console.warn('Local backend save notice:', backendErr.message);
    }

    if (user?.uid) {
      try {
        await saveSettings(user.uid, updatedConfig);
      } catch (e) {
        console.warn('Firestore save notice:', e.message);
      }
    }

    onRefreshConfig(updatedConfig);
    onShowToast?.({
      type: 'info',
      title: 'Model saved',
      message: `${PROVIDER_CONFIG[providerKey]?.name || providerKey} model set to ${friendlyModelName(newModel)}`
    });
  };

  const toggleExpand = (key) => {
    setExpandedKey(expandedKey === key ? null : key);
  };

  // Auto-fetch models when expanding a configured provider's card
  React.useEffect(() => {
    if (!expandedKey) return;
    const provider = config?.aiProviders?.[expandedKey];
    if (provider?.isConfigured) {
      const cached = modelLists[expandedKey];
      if (!cached || !cached.models || (Date.now() - (cached.fetchedAt || 0) > 600000)) {
        handleFetchModels(expandedKey);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedKey]);

  const renderModelPicker = (key, provider) => {
    const status = getEffectiveStatus(key);
    const isConfigured = isProviderConfigured(key, provider);
    
    if (status !== 'connected' && status !== 'key-saved' && !isConfigured) {
      return (
        <div>
          <input type="text" className="form-input" disabled value="Verify your API key first" />
        </div>
      );
    }

    const ml = modelLists[key];
    const hasFetched = ml?.models?.length > 0;
    const fallbackModels = provider.supportedModels || [];
    // Normalize: live models are {id, name} objects, fallback are strings
    const modelIds = hasFetched ? ml.models.map(m => m.id) : fallbackModels;
    const current = editingModels[key] || provider.model;

    // If the saved model isn't in the list, add it at the top to avoid silent failure
    if (current && !modelIds.includes(current)) {
      modelIds.unshift(current);
    }

    return (
      <div className="model-picker-container">
        {ml?.loading ? (
          <div className="skeleton-loader" style={{ height: '36px', borderRadius: '4px' }}></div>
        ) : (
          modelIds.length > 0 ? (
            <ModelSelect value={current} options={modelIds} onChange={val => handleModelChange(key, val)} />
          ) : (
            <input
              type="text"
              value={editingModels[key] !== undefined ? editingModels[key] : (provider.model || '')}
              onChange={e => setEditingModels(prev => ({ ...prev, [key]: e.target.value }))}
              onBlur={e => handleModelChange(key, e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleModelChange(key, e.target.value); }}
              className="form-input"
              placeholder="Model name"
            />
          )
        )}
        <div className="model-refresh-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {hasFetched ? `${modelIds.length} models from ${PROVIDER_CONFIG[key]?.name || key}` : (fallbackModels.length > 0 ? '(cached list)' : '')}
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleFetchModels(key)} disabled={ml?.loading}>
            <RefreshCw size={12} className={ml?.loading ? 'spin-icon' : ''} /> Refresh models
          </button>
        </div>
        {ml?.error && <div style={{ color: 'var(--color-error)', fontSize: '0.8rem', marginTop: '4px' }}>{ml.error}</div>}
      </div>
    );
  };

  const renderApiKeyPanel = (key, provider) => {
    const meta = PROVIDER_CONFIG[key] || { name: key, keyPrefix: '' };
    const status = getEffectiveStatus(key);
    const savedKeys = getProviderSavedKeys(provider);
    const hasSavedKeys = savedKeys.length > 0;
    const isAdding = Boolean(addingKey[key]) || !hasSavedKeys;
    const activeKeyId = provider?.selectedKeyId || savedKeys[0]?.id;
    const isSaving = providerStates[key]?.saving;
    const hasKey = isProviderConfigured(key, provider);

    return (
      <>
        {hasSavedKeys && (
          <div className="provider-section">
            <div className="provider-section-title">Saved API Keys ({savedKeys.length})</div>
            <div className="saved-keys-list">
              {savedKeys.map((k) => {
                const isSelected = k.id === activeKeyId;
                const isRenaming = editingKeyId[key] === k.id;
                return (
                  <div
                    key={k.id}
                    className={`saved-key-card ${isSelected ? 'saved-key-card-active' : ''}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <button
                        type="button"
                        className="saved-key-radio"
                        onClick={() => handleSelectKey(key, k.id)}
                        title={isSelected ? 'Active key' : 'Select this key'}
                        aria-label={`Select key ${k.name}`}
                      >
                        {isSelected ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          <div className="saved-key-radio-unselected" />
                        )}
                      </button>

                      {isRenaming ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                          <input
                            type="text"
                            className="form-input form-input-sm"
                            style={{ height: '28px', fontSize: '0.85rem' }}
                            value={editingKeyName[key] !== undefined ? editingKeyName[key] : k.name}
                            onChange={e => setEditingKeyName(prev => ({ ...prev, [key]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRenameKey(key, k.id, editingKeyName[key] || k.name);
                              if (e.key === 'Escape') setEditingKeyId(prev => ({ ...prev, [key]: null }));
                            }}
                            autoFocus
                            aria-label="Edit key name"
                          />
                          <button
                            type="button"
                            className="btn btn-primary btn-xs"
                            onClick={() => handleRenameKey(key, k.id, editingKeyName[key] || k.name)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => setEditingKeyId(prev => ({ ...prev, [key]: null }))}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="saved-key-name">{k.name}</span>
                            {isSelected && (
                              <span className="status-badge status-badge-ready" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                Active
                              </span>
                            )}
                          </div>
                          <code className="saved-key-code">{k.maskedKey}</code>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
                      {!isSelected && !isRenaming && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs"
                          onClick={() => handleSelectKey(key, k.id)}
                        >
                          Use key
                        </button>
                      )}
                      {!isRenaming && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          title="Rename key"
                          onClick={() => {
                            setEditingKeyId(prev => ({ ...prev, [key]: k.id }));
                            setEditingKeyName(prev => ({ ...prev, [key]: k.name }));
                          }}
                        >
                          <Edit2 size={12} /> Rename
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        style={{ color: 'var(--color-error)' }}
                        title="Delete key"
                        onClick={() => handleDeleteSavedKey(key, k.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {!isAdding && (
              <div style={{ marginTop: 'var(--sp-2)' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setAddingKey(prev => ({ ...prev, [key]: true }));
                    setNewKeyName(prev => ({ ...prev, [key]: `Key ${savedKeys.length + 1}` }));
                  }}
                  style={{ gap: '6px' }}
                >
                  <Plus size={13} /> Add another key
                </button>
              </div>
            )}
          </div>
        )}

        {isAdding && (
          <div className="provider-section" style={{ marginTop: hasSavedKeys ? 'var(--sp-3)' : 0 }}>
            <div className="provider-section-title">
              {hasSavedKeys ? 'Add New Key' : 'Connection'}
            </div>
            <div className="apikey-input-area">
              <label className="form-label" htmlFor={`keyname-${key}`}>
                Key Name / Label
              </label>
              <input
                id={`keyname-${key}`}
                type="text"
                placeholder="e.g. Work Account, Personal, Production"
                value={newKeyName[key] !== undefined ? newKeyName[key] : (hasSavedKeys ? `Key ${savedKeys.length + 1}` : 'Primary Key')}
                onChange={e => setNewKeyName(prev => ({ ...prev, [key]: e.target.value }))}
                className="form-input"
                style={{ marginBottom: 'var(--sp-2)' }}
              />

              <label className="form-label" htmlFor={`apikey-${key}`}>
                API key
              </label>
              <div className="password-input-wrapper">
                <input
                  id={`apikey-${key}`}
                  type={showToken[key] ? "text" : "password"}
                  placeholder={meta.keyPrefix ? `Paste ${meta.keyPrefix}...` : 'Paste your API key'}
                  value={editingKeys[key] || ''}
                  onChange={e => setEditingKeys(prev => ({ ...prev, [key]: e.target.value }))}
                  className="form-input"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowToken(prev => ({ ...prev, [key]: !prev[key] }))}
                  aria-label={showToken[key] ? 'Hide token' : 'Show token'}
                >
                  {showToken[key] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {key === 'custom' && (
                <>
                  <label className="form-label" htmlFor={`baseurl-${key}`} style={{ marginTop: 'var(--sp-3)' }}>
                    Base URL
                  </label>
                  <input
                    id={`baseurl-${key}`}
                    type="text"
                    value={editingBaseUrls[key] !== undefined ? editingBaseUrls[key] : (provider.baseURL || 'https://api.openai.com/v1')}
                    onChange={e => setEditingBaseUrls(prev => ({ ...prev, [key]: e.target.value }))}
                    className="form-input"
                    placeholder="https://api.openai.com/v1"
                  />
                </>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleSaveAndVerify(key, editingKeys[key], newKeyName[key])}
                  disabled={!editingKeys[key] || isSaving}
                >
                  {isSaving ? <><RefreshCw size={13} className="spin-icon" /> Saving...</> : (hasSavedKeys ? 'Save & add key' : 'Save & verify')}
                </button>
                {hasSavedKeys && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setAddingKey(prev => ({ ...prev, [key]: false }));
                      setEditingKeys(prev => ({ ...prev, [key]: '' }));
                    }}
                  >
                    Cancel
                  </button>
                )}
                {meta.keyPage && (
                  <a href={meta.keyPage} target="_blank" rel="noopener noreferrer" className="provider-setup-link" style={{ marginLeft: 'auto', fontSize: '0.85rem' }}>
                    Get a key <ExternalLink size={12} style={{ display: 'inline' }} />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="provider-section">
          <div className="provider-section-title">Model</div>
          {renderModelPicker(key, provider)}
        </div>

        {(() => {
          const savedKeys = getProviderSavedKeys(provider);
          if (savedKeys.length < 2) return null;
          const activeId = provider?.selectedKeyId || savedKeys[0]?.id;
          return (
            <div className="provider-section">
              <div className="provider-section-title">Active Key for Testing</div>
              <select
                className="form-input"
                value={activeId}
                onChange={e => handleSelectKey(key, e.target.value)}
                style={{ maxWidth: '300px' }}
              >
                {savedKeys.map(k => (
                  <option key={k.id} value={k.id}>
                    {k.name} ({k.maskedKey})
                  </option>
                ))}
              </select>
            </div>
          );
        })()}

        <div className="provider-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleTestConnection(key)}
            disabled={!hasKey || status === 'verifying'}
          >
            {status === 'verifying' ? (
              <><RefreshCw size={13} className="spin-icon" aria-hidden="true" /> Verifying…</>
            ) : (
              'Test connection'
            )}
          </button>
          
          <div className="provider-actions-right">
             <div className="status-region" aria-live="polite">
              {providerStates[key]?.status === 'error' && (
                <div style={{ color: 'var(--color-error)', fontSize: '0.8rem', maxWidth: '200px', textAlign: 'right' }}>
                  {providerStates[key].error}
                </div>
              )}
             </div>

            {config?.activeProvider !== key && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleSetActiveAi(key)}
                disabled={!hasKey}
                title={!hasKey ? 'Configure this provider first' : undefined}
              >
                Set as default
              </button>
            )}
            {config?.activeProvider === key && (
              <span className="provider-default-label">
                <Check size={14} aria-hidden="true" /> Default
              </span>
            )}
          </div>
        </div>
      </>
    );
  };

  const renderCopilotPanel = (key, provider) => (
    <>
      <div className="provider-section">
        <div className="provider-section-title">Connection</div>
        <p className="provider-section-desc">
          GitHub Copilot authenticates through GitHub's Device Flow.
        </p>

        {/* Connected state */}
        {provider.isConfigured && !copilotFlow.active && (
          <div className="copilot-connected">
            <span className="copilot-status-line">
              <CheckCircle2 size={14} aria-hidden="true" />
              Signed in with GitHub · Copilot subscription active
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleStartCopilotAuth}
              style={{ gap: 6 }}
            >
              <RefreshCw size={14} aria-hidden="true" /> Reconnect GitHub
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleRemoveKey(key)}
              style={{ gap: 6, marginLeft: '8px', color: 'var(--color-error)' }}
            >
              <Trash2 size={14} aria-hidden="true" /> Remove
            </button>
          </div>
        )}

        {/* Disconnected state */}
        {!provider.isConfigured && !copilotFlow.active && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleStartCopilotAuth}
            style={{ gap: 8 }}
          >
            Connect GitHub Copilot
          </button>
        )}

        {/* Active device flow */}
        {copilotFlow.active && copilotFlow.userCode && (
          <div className="copilot-flow-card">
            <div className="copilot-flow-top">
              <div>
                <div className="form-label">One-time verification code</div>
                <div className="copilot-user-code">{copilotFlow.userCode}</div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleCopyAndOpenGithub(copilotFlow.userCode, copilotFlow.verificationUri)}
                style={{ gap: 8 }}
              >
                {copilotFlow.copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                {copilotFlow.copied ? 'Copied! Opening GitHub…' : 'Copy and open GitHub'}
                <ExternalLink size={14} aria-hidden="true" />
              </button>
            </div>

            <div className="copilot-flow-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm copilot-verify-btn"
                onClick={() => handleCheckCopilotStatus(true)}
                disabled={copilotFlow.checking}
                aria-busy={copilotFlow.checking || undefined}
              >
                {copilotFlow.checking ? (
                  <><RefreshCw size={13} className="spin-icon" aria-hidden="true" /> Verifying…</>
                ) : (
                  <><CheckCircle2 size={14} aria-hidden="true" /> Complete connection</>
                )}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCancelCopilotAuth}
                style={{ marginLeft: 'auto' }}
              >
                Cancel
              </button>
            </div>

            <div
              className={`copilot-status ${copilotFlow.error ? 'copilot-status-error' : ''}`}
              role="status"
              aria-live="polite"
            >
              {(copilotFlow.checking || copilotFlow.polling) && !copilotFlow.error && (
                <RefreshCw size={13} className="spin-icon" aria-hidden="true" />
              )}
              <span>
                {copilotFlow.checking
                  ? 'Verifying authorization…'
                  : (copilotFlow.error || copilotFlow.statusMessage || 'Waiting for GitHub authorization…')}
              </span>
            </div>

            {copilotFlow.error && (
              <div className="copilot-error-box">
                <div className="copilot-error-msg">
                  <AlertCircle size={15} aria-hidden="true" />
                  <span>{copilotFlow.error}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleStartCopilotAuth}
                >
                  Get new code
                </button>
              </div>
            )}
          </div>
        )}

        {/* PAT fallback disclosure */}
        <div className="divider-or"><span>or</span></div>
        <button
          type="button"
          className="pat-disclosure-toggle"
          onClick={() => setShowManualCopilotInput(!showManualCopilotInput)}
          aria-expanded={showManualCopilotInput}
        >
          Use a personal access token instead
          <ChevronDown
            size={14}
            className={showManualCopilotInput ? 'provider-chevron-open' : ''}
            aria-hidden="true"
          />
        </button>

        {showManualCopilotInput && (
          <div style={{ marginTop: 'var(--sp-2)' }}>
            <label className="form-label" htmlFor="copilot-pat">
              GitHub token {provider.isConfigured && (
                <span className="form-label-hint">(Saved: {provider.maskedKey})</span>
              )}
            </label>
            <div className="password-input-wrapper">
              <input
                id="copilot-pat"
                type={showCopilotToken ? 'text' : 'password'}
                placeholder={provider.isConfigured ? 'Enter new token to update' : 'Paste ghu_… or personal access token'}
                value={editingKeys.copilot || ''}
                onChange={e => setEditingKeys(prev => ({ ...prev, copilot: e.target.value }))}
                className="form-input"
                autoComplete="off"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowCopilotToken(!showCopilotToken)}
                aria-label={showCopilotToken ? 'Hide token' : 'Show token'}
              >
                {showCopilotToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div style={{ marginTop: '8px' }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => handleSaveAndVerify('copilot', editingKeys.copilot)} disabled={!editingKeys.copilot || providerStates.copilot?.saving}>
                {providerStates.copilot?.saving ? <><RefreshCw size={13} className="spin-icon" /> Saving...</> : 'Save & verify'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="provider-section">
        <div className="provider-section-title">Model</div>
        {renderModelPicker(key, provider)}
      </div>

      <div className="provider-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => handleTestConnection(key)}
          disabled={!provider.isConfigured || getEffectiveStatus(key) === 'verifying'}
        >
          {getEffectiveStatus(key) === 'verifying' ? (
            <><RefreshCw size={13} className="spin-icon" aria-hidden="true" /> Verifying…</>
          ) : (
            'Test connection'
          )}
        </button>
        
        <div className="provider-actions-right">
            <div className="status-region" aria-live="polite">
            {providerStates[key]?.status === 'error' && (
              <div style={{ color: 'var(--color-error)', fontSize: '0.8rem', maxWidth: '200px', textAlign: 'right' }}>
                {providerStates[key].error}
              </div>
            )}
            </div>
            {config?.activeProvider !== key && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleSetActiveAi(key)}
                disabled={!provider.isConfigured}
              >
                Set as default
              </button>
            )}
            {config?.activeProvider === key && (
              <span className="provider-default-label">
                <Check size={14} aria-hidden="true" /> Default
              </span>
            )}
        </div>
      </div>
    </>
  );

  const renderProvider = ([key, provider]) => {
    const meta = PROVIDER_CONFIG[key] || {
      name: provider.name || key,
      monogram: (provider.name || key).charAt(0)
    };
    const isDefault = config?.activeProvider === key;
    const isExpanded = expandedKey === key;
    const status = getEffectiveStatus(key);
    const model = editingModels[key] || provider.model;

    return (
      <div key={key} className={`provider-row ${isExpanded ? 'provider-row-open' : ''}`}>
        <button
          type="button"
          className="provider-row-header"
          onClick={() => toggleExpand(key)}
          aria-expanded={isExpanded}
          aria-controls={`provider-panel-${key}`}
        >
          <div className="provider-row-left">
            <ProviderLogo monogram={meta.monogram} />
            <div className="provider-row-info">
              <span className="provider-row-name">{meta.name}</span>
              <span className="provider-row-model" title={model}>
                {isProviderConfigured(key, provider) ? (model ? friendlyModelName(model) : '') : 'Add an API key'}
              </span>
            </div>
          </div>
          <div className="provider-row-right">
            <StatusBadge status={status} lastVerifiedAt={providerStates[key]?.lastVerifiedAt} />
            {isDefault && <span className="status-badge status-badge-default">Default</span>}
            <ChevronDown
              size={16}
              className={`provider-chevron ${isExpanded ? 'provider-chevron-open' : ''}`}
              aria-hidden="true"
            />
          </div>
        </button>

        {isExpanded && (
          <div
            className="provider-row-panel"
            id={`provider-panel-${key}`}
            role="region"
            aria-label={`${meta.name} settings`}
          >
            {key === 'copilot'
              ? renderCopilotPanel(key, provider)
              : renderApiKeyPanel(key, provider)}
          </div>
        )}
      </div>
    );
  };

  const aiProvidersList = config?.aiProviders ? Object.entries(config.aiProviders) : [];

  const sorted = [...aiProvidersList].sort(([kA, pA], [kB, pB]) => {
    const dA = config?.activeProvider === kA;
    const dB = config?.activeProvider === kB;
    if (dA !== dB) return dA ? -1 : 1;
    const confA = isProviderConfigured(kA, pA) ? 1 : 0;
    const confB = isProviderConfigured(kB, pB) ? 1 : 0;
    if (confA !== confB) return confA ? -1 : 1;
    return 0;
  });

  const inUse = sorted.filter(([k, p]) => isProviderConfigured(k, p));
  const available = sorted.filter(([k, p]) => !isProviderConfigured(k, p));

  return (
    <div>
      <p className="pane-description">
        Configure AI providers for email generation. The default provider is used for all AI features.
      </p>
      <div className="encryption-notice">
        <Lock size={14} aria-hidden="true" />
        <span>API keys are encrypted at rest and never sent back to the browser.</span>
      </div>

      {inUse.length > 0 && (
        <div className="provider-group">
          <div className="provider-group-label">
            In use <span className="provider-group-count">{inUse.length}</span>
          </div>
          {inUse.map(renderProvider)}
        </div>
      )}

      {available.length > 0 && (
        <div className="provider-group">
          <div className="provider-group-label">
            Available <span className="provider-group-count">{available.length}</span>
          </div>
          {available.map(renderProvider)}
        </div>
      )}
    </div>
  );
}
