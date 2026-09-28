import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Shield,
  Check,
  ChevronDown,
  ChevronUp,
  Server,
  CheckCircle2,
  Key,
  RefreshCw,
  Copy,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import {
  saveAiProviderConfig,
  setActiveAiProvider,
  testAiConnection,
  startCopilotAuth,
  getCurrentCopilotFlow,
  checkCopilotStatus
} from '../../services/api';
import { saveSettings, stripUndefined } from '../../lib/settings';

const PROVIDER_META = {
  gemini: { name: 'Google Gemini', brandClass: 'brand-gemini', dotColor: '#4285f4' },
  openai: { name: 'OpenAI', brandClass: 'brand-openai', dotColor: '#10a37f' },
  groq: { name: 'Groq', brandClass: 'brand-groq', dotColor: '#f55036' },
  grok: { name: 'Grok (xAI)', brandClass: 'brand-grok', dotColor: '#1d9bf0' },
  copilot: { name: 'GitHub Copilot', brandClass: 'brand-copilot', dotColor: '#2da44e' },
  nvidia: { name: 'NVIDIA NIM', brandClass: 'brand-nvidia', dotColor: '#76b900' },
  custom: { name: 'Custom Endpoint', brandClass: 'brand-custom', dotColor: '#64748b' }
};

/**
 * AiProvidersTab — Configuration, testing, and authentication for AI providers and GitHub Copilot.
 */
export default function AiProvidersTab({ config, onRefreshConfig, onShowToast, user }) {
  // Accordion state
  const [expandedMap, setExpandedMap] = useState({});

  const toggleExpand = (key) => {
    setExpandedMap(prev => {
      const isCurrentlyOpen = prev[key] !== undefined ? prev[key] : (config?.activeProvider === key);
      return { ...prev, [key]: !isCurrentlyOpen };
    });
  };

  // AI settings edit states
  const [editingKeys, setEditingKeys] = useState({});
  const [editingModels, setEditingModels] = useState({});
  const [editingBaseUrls, setEditingBaseUrls] = useState({});
  const [aiTestStatus, setAiTestStatus] = useState({});

  // Copilot Device Code Auth State
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

  const [showManualCopilotInput, setShowManualCopilotInput] = useState(false);
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
            title: 'GitHub Copilot Connected',
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
        active: true,
        deviceCode: '',
        userCode: '',
        verificationUri: '',
        expiresIn: 0,
        expiresAt: 0,
        polling: true,
        copied: false,
        error: null,
        checking: false,
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
      onShowToast?.({ type: 'error', title: 'GitHub Error', message: err.message });
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
          title: 'GitHub Copilot Connected',
          message: 'Successfully authenticated with your GitHub Copilot subscription!'
        });
        return;
      }

      if (res.status === 'pending') {
        setCopilotFlow(prev => ({
          ...prev,
          checking: false,
          error: null,
          statusMessage: 'Waiting for you to authorize on GitHub...'
        }));
        if (showToastOnPending) {
          onShowToast?.({
            type: 'info',
            title: 'Authorization Pending',
            message: 'Still waiting for approval on GitHub. Make sure you entered the code and clicked "Authorize GitHub Copilot".'
          });
        }
      } else if (res.status === 'slow_down') {
        currentIntervalRef.current = Math.max(currentIntervalRef.current + 5000, (res.interval || 10) * 1000);
        setCopilotFlow(prev => ({
          ...prev,
          checking: false,
          statusMessage: `GitHub rate limit: please wait ${currentIntervalRef.current / 1000}s...`
        }));
        if (showToastOnPending) {
          onShowToast?.({
            type: 'warning',
            title: 'Rate Limit',
            message: 'GitHub asked to slow down requests. Please wait a few seconds and click Verify again.'
          });
        }
      } else if (res.status === 'expired' || res.status === 'denied' || res.status === 'error') {
        stopPolling();
        try { sessionStorage.removeItem('jdmail_copilot_flow'); } catch {}
        setCopilotFlow(prev => ({
          ...prev,
          checking: false,
          polling: false,
          error: res.error || 'Authorization failed'
        }));
        if (showToastOnPending) {
          onShowToast?.({
            type: 'error',
            title: 'Authorization Failed',
            message: res.error || 'Device code expired or was rejected by GitHub.'
          });
        }
      }
    } catch (err) {
      setCopilotFlow(prev => ({ ...prev, checking: false }));
      if (showToastOnPending) {
        onShowToast?.({ type: 'error', title: 'Check Error', message: err.message });
      }
    }
  }, [copilotFlow.checking, copilotFlow.deviceCode, onRefreshConfig, onShowToast]);

  const handleCancelCopilotAuth = () => {
    stopPolling();
    try { sessionStorage.removeItem('jdmail_copilot_flow'); } catch {}
    setCopilotFlow({
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
      title: 'Code Copied',
      message: `Verification code ${code} copied to clipboard! Opening GitHub to authenticate.`
    });
    setTimeout(() => {
      setCopilotFlow(prev => ({ ...prev, copied: false }));
    }, 3000);
  };

  const handleModelChange = async (providerKey, newModel) => {
    setEditingModels(prev => ({ ...prev, [providerKey]: newModel }));
    const currentProvider = config?.aiProviders?.[providerKey] || {};
    const updatedProvider = {
      ...currentProvider,
      model: newModel
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
        baseURL: updatedProvider.baseURL,
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
      title: 'Model Preference Saved',
      message: `${PROVIDER_META[providerKey]?.name || providerKey} model set to ${newModel}`
    });
  };

  const handleSaveApiKey = async (providerKey, rawKey) => {
    if (rawKey === undefined || rawKey === null) return;
    const trimmed = rawKey.trim();
    if (!trimmed) return;

    const currentProvider = config?.aiProviders?.[providerKey] || {};
    const updatedProvider = {
      ...currentProvider,
      apiKey: trimmed,
      model: editingModels[providerKey] || currentProvider.model || '',
      enabled: true,
      isConfigured: true
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
        apiKey: trimmed,
        model: updatedProvider.model,
        baseURL: updatedProvider.baseURL,
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
    setEditingKeys(prev => ({ ...prev, [providerKey]: '' }));
    onShowToast?.({
      type: 'success',
      title: 'API Key Saved',
      message: `API key saved for ${PROVIDER_META[providerKey]?.name || providerKey}`
    });
  };

  const handleSaveBaseUrl = async (providerKey, rawUrl) => {
    if (rawUrl === undefined || rawUrl === null) return;
    const trimmed = rawUrl.trim();
    const currentProvider = config?.aiProviders?.[providerKey] || {};
    const updatedProvider = {
      ...currentProvider,
      baseURL: trimmed || 'https://api.openai.com/v1'
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
        model: editingModels[providerKey] || currentProvider.model || '',
        apiKey: currentProvider.apiKey || '',
        baseURL: updatedProvider.baseURL,
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
        title: 'Active Provider Updated',
        message: `Active AI provider set to ${config?.aiProviders?.[providerKey]?.name || providerKey}`
      });
    } catch (err) {
      onShowToast?.({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleTestAi = async (providerKey) => {
    setAiTestStatus(prev => ({
      ...prev,
      [providerKey]: { loading: true }
    }));

    try {
      const apiKey = editingKeys[providerKey];
      const model = editingModels[providerKey] || config?.aiProviders?.[providerKey]?.model;
      const baseURL = editingBaseUrls[providerKey] || config?.aiProviders?.[providerKey]?.baseURL || '';

      const res = await testAiConnection({ providerKey, apiKey, model, baseURL });
      if (res && res.success) {
        setAiTestStatus(prev => ({
          ...prev,
          [providerKey]: { loading: false, success: true, message: res.message }
        }));
      } else {
        setAiTestStatus(prev => ({
          ...prev,
          [providerKey]: { loading: false, success: false, error: res?.error || 'Connection test failed' }
        }));
      }
    } catch (err) {
      setAiTestStatus(prev => ({
        ...prev,
        [providerKey]: { loading: false, success: false, error: err.message || 'Connection test failed' }
      }));
    }
  };

  const aiProvidersList = config?.aiProviders ? Object.entries(config.aiProviders) : [];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: 12,
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          marginBottom: 20,
          fontSize: 13
        }}
      >
        <Shield size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
        <span>
          <strong>Encrypted at Rest:</strong> All API keys are securely encrypted using AES-256-GCM. Keys are never logged or exposed in client responses.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {aiProvidersList.map(([key, provider]) => {
          const isActive = config?.activeProvider === key;
          const testRes = aiTestStatus[key];
          const meta = PROVIDER_META[key] || { name: provider.name || key, brandClass: 'brand-custom', dotColor: '#64748b' };
          const isExpanded = expandedMap[key] !== undefined ? expandedMap[key] : isActive;

          if (!isExpanded) {
            return (
              <div
                key={key}
                className="provider-row-collapsed"
                onClick={() => toggleExpand(key)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && toggleExpand(key)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: meta.dotColor,
                      display: 'inline-block',
                      flexShrink: 0
                    }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                    {meta.name}
                  </span>
                  {isActive && (
                    <span className={`badge-counter ${meta.brandClass}`} style={{ fontSize: 11, padding: '2px 8px' }}>
                      Active Model
                    </span>
                  )}
                  {provider.isConfigured ? (
                    <span style={{ color: 'var(--success)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Check size={12} /> Configured
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      No Key Set
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {editingModels[key] || provider.model}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: 4, color: 'var(--text-secondary)' }}
                    aria-label={`Expand ${meta.name}`}
                  >
                    <ChevronDown size={15} />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={key}
              className="provider-row-expanded"
              style={{
                padding: 16,
                borderRadius: 'var(--radius-md)',
                background: isActive ? 'rgba(37, 99, 235, 0.04)' : 'var(--bg-secondary)',
                border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                borderLeft: `3px solid ${meta.dotColor}`
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                  cursor: 'pointer'
                }}
                onClick={() => toggleExpand(key)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: meta.dotColor,
                      display: 'inline-block',
                      flexShrink: 0
                    }}
                  />
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {meta.name}
                  </span>
                  {isActive && (
                    <span className={`badge-counter ${meta.brandClass}`} style={{ fontSize: 11, padding: '2px 8px' }}>
                      Active Model
                    </span>
                  )}
                  {provider.isConfigured ? (
                    <span style={{ color: 'var(--success)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Check size={13} /> Key Configured
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      No Key Set
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => handleSetActiveAi(key)}
                    disabled={isActive}
                  >
                    {isActive ? 'Current Default' : 'Set as Active'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: 4, color: 'var(--text-secondary)' }}
                    onClick={() => toggleExpand(key)}
                    aria-label={`Collapse ${meta.name}`}
                  >
                    <ChevronUp size={15} />
                  </button>
                </div>
              </div>

              {/* Inputs */}
              {key === 'copilot' ? (
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    GitHub Copilot authenticates securely through GitHub's Device Flow. No API key required.
                  </div>

                  {copilotFlow.active && copilotFlow.userCode ? (
                    <div
                      style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--primary-light)',
                        borderRadius: 'var(--radius-md)',
                        padding: 18,
                        marginBottom: 14
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                            One-Time Verification Code:
                          </div>
                          <div
                            style={{
                              display: 'inline-block',
                              padding: '8px 18px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-glow)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 24,
                              fontWeight: 800,
                              letterSpacing: 4,
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-primary)'
                            }}
                          >
                            {copilotFlow.userCode}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => handleCopyAndOpenGithub(copilotFlow.userCode, copilotFlow.verificationUri)}
                          style={{ gap: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700 }}
                        >
                          {copilotFlow.copied ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
                          {copilotFlow.copied ? 'Code Copied! Opening GitHub...' : 'Copy and Open GitHub to Authenticate'}
                          <ExternalLink size={14} />
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleCheckCopilotStatus(true)}
                          disabled={copilotFlow.checking}
                          style={{ gap: 6, background: '#10b981', borderColor: '#059669', color: '#fff' }}
                        >
                          {copilotFlow.checking ? (
                            <>
                              <RefreshCw size={13} className="spin-icon" /> Verifying...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={14} /> I've Authorized — Complete Connection
                            </>
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

                      {/* Real-time Status Indicator */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: copilotFlow.error ? 'var(--danger)' : 'var(--primary-light)', marginTop: 12 }}>
                        {(copilotFlow.checking || copilotFlow.polling) && !copilotFlow.error && (
                          <RefreshCw size={13} className="spin-icon" />
                        )}
                        <span>
                          {copilotFlow.checking
                            ? 'Verifying authorization status with GitHub...'
                            : (copilotFlow.error || copilotFlow.statusMessage || 'Waiting for you to authorize on GitHub...')}
                        </span>
                      </div>

                      {/* Error Box with Retry Option */}
                      {copilotFlow.error && (
                        <div
                          style={{
                            marginTop: 10,
                            padding: '10px 14px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            background: 'var(--danger-bg)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.25)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <AlertCircle size={15} style={{ flexShrink: 0 }} />
                            <span>{copilotFlow.error}</span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={handleStartCopilotAuth}
                            style={{ fontSize: 12, padding: '3px 8px' }}
                          >
                            Get New Code
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleStartCopilotAuth}
                        style={{ gap: 8 }}
                      >
                        <Server size={15} />
                        {provider.isConfigured ? 'Re-Authenticate GitHub Copilot' : 'Authenticate GitHub Copilot'}
                      </button>

                      {provider.isConfigured && (
                        <span style={{ fontSize: 13, color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle2 size={16} /> Subscription Connected
                        </span>
                      )}
                    </div>
                  )}

                  {/* Fallback Manual Token Input Toggle */}
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowManualCopilotInput(!showManualCopilotInput)}
                      style={{ fontSize: 12, color: 'var(--text-secondary)', gap: 6 }}
                    >
                      <Key size={13} />
                      {showManualCopilotInput ? 'Hide manual token input' : 'Or enter GitHub token / PAT manually'}
                    </button>

                    {showManualCopilotInput && (
                      <div style={{ marginTop: 10 }}>
                        <label className="form-label" style={{ fontSize: 12 }}>
                          GitHub Token (ghu_... or PAT) {provider.isConfigured && <span style={{ color: 'var(--text-muted)' }}>(Saved: {provider.maskedKey})</span>}
                        </label>
                        <input
                          type="password"
                          placeholder={provider.isConfigured ? 'Enter new token to update...' : 'Paste ghu_... or GitHub Personal Access Token'}
                          value={editingKeys['copilot'] !== undefined ? editingKeys['copilot'] : ''}
                          onChange={e => setEditingKeys({ ...editingKeys, copilot: e.target.value })}
                          onBlur={e => handleSaveApiKey('copilot', e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveApiKey('copilot', e.target.value); }}
                          className="form-input"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Model Selection for Copilot — Auto-saved on change without separate button */}
                  <div style={{ marginTop: 12, maxWidth: 320 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Copilot Model</label>
                    <select
                      className="form-select"
                      value={editingModels[key] || provider.model || 'gpt-4o'}
                      onChange={e => handleModelChange('copilot', e.target.value)}
                    >
                      {(provider.supportedModels || ['gpt-4o', 'gpt-4o-mini']).map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: key === 'custom' ? '1.5fr 1fr 1fr' : '1.5fr 1fr', gap: 12 }}>
                  {/* API Key Input — Auto-saves on blur or enter */}
                  <div>
                    <label className="form-label" style={{ fontSize: 12 }}>
                      API Key {provider.isConfigured && <span style={{ color: 'var(--text-muted)' }}>(Saved: {provider.maskedKey})</span>}
                    </label>
                    <input
                      type="password"
                      placeholder={provider.isConfigured ? 'Enter new key to update...' : 'Paste your API key here (sk-...)'}
                      value={editingKeys[key] || ''}
                      onChange={e => setEditingKeys({ ...editingKeys, [key]: e.target.value })}
                      onBlur={e => handleSaveApiKey(key, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveApiKey(key, e.target.value); }}
                      className="form-input"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                    />
                  </div>

                  {/* Model Dropdown — Auto-saves on select without separate button */}
                  <div>
                    <label className="form-label" style={{ fontSize: 12 }}>Model</label>
                    {provider.supportedModels && provider.supportedModels.length > 0 ? (
                      <select
                        className="form-select"
                        value={editingModels[key] || provider.model}
                        onChange={e => handleModelChange(key, e.target.value)}
                      >
                        {provider.supportedModels.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={editingModels[key] !== undefined ? editingModels[key] : provider.model}
                        onChange={e => setEditingModels({ ...editingModels, [key]: e.target.value })}
                        onBlur={e => handleModelChange(key, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleModelChange(key, e.target.value); }}
                        className="form-input"
                        placeholder="model name"
                      />
                    )}
                  </div>

                  {/* Custom Base URL if custom provider */}
                  {key === 'custom' && (
                    <div>
                      <label className="form-label" style={{ fontSize: 12 }}>Base URL</label>
                      <input
                        type="text"
                        value={editingBaseUrls[key] !== undefined ? editingBaseUrls[key] : (provider.baseURL || 'https://api.openai.com/v1')}
                        onChange={e => setEditingBaseUrls({ ...editingBaseUrls, [key]: e.target.value })}
                        onBlur={e => handleSaveBaseUrl(key, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveBaseUrl(key, e.target.value); }}
                        className="form-input"
                        placeholder="https://api.openai.com/v1"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Test Connection Banner if present */}
              {testRes && (
                <div
                  style={{
                    marginTop: 10,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: testRes.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                    color: testRes.success ? 'var(--success)' : '#f87171'
                  }}
                >
                  {testRes.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  <span>{testRes.message || testRes.error}</span>
                </div>
              )}

              {/* Actions: Test Connection only (no redundant save button) */}
              <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleTestAi(key)}
                  disabled={testRes?.loading}
                >
                  {testRes?.loading ? (
                    <>
                      <RefreshCw size={13} className="spin-icon" /> Testing...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
