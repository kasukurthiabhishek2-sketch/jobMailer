import React, { useState } from 'react';
import { Sparkles, XCircle, FileText, Info, AlertCircle } from 'lucide-react';

const SAMPLE_JDS = [
  {
    id: 'stripe',
    title: 'Stripe — Senior Full-Stack Engineer',
    text: `Job Title: Senior Full-Stack Engineer (Core Infrastructure & AI Applications)
Company: Stripe
Location: Remote / San Francisco, CA

About the Role:
We are looking for a Senior Full-Stack Engineer to build next-generation platform services and developer experiences. You will design, build, and scale reliable, high-throughput microservices handling millions of transactions, while integrating intelligent agentic capabilities into our merchant portal.

Requirements:
- 5+ years of experience building modern web applications with React, TypeScript, and Node.js.
- Strong track record architecting distributed systems and optimizing database performance (PostgreSQL, Redis).
- Experience working with LLM APIs (OpenAI, Gemini, Anthropic) or AI-augmented workflows is a plus.
- Passion for low-latency APIs, clean UI architecture, and robust automated testing.
- Strong product sense and communication skills for collaborating across engineering, design, and talent teams.`
  },
  {
    id: 'founding',
    title: 'Series-A Startup — Founding Full-Stack Engineer',
    text: `Job Title: Founding Full-Stack Engineer
Company: Stealth AI Agent Startup
Location: New York, NY / Remote

About the Role:
We are an early-stage team backed by top Silicon Valley VCs building autonomous workflow automation for high-growth enterprises. As our Founding Full-Stack Engineer, you will own the end-to-end architecture from data ingestion pipelines to real-time interactive user interfaces.

Requirements:
- 4+ years of software engineering experience in fast-paced startup environments.
- Deep expertise in React, modern state management, Node.js/Python backend services, and cloud infra (AWS/GCP).
- Comfortable owning ambiguous problems, making pragmatic architectural trade-offs, and shipping quickly.
- Strong interest in LLM integration, agentic memory, and developer velocity.`
  },
  {
    id: 'techlead',
    title: 'Tech Lead / Staff Software Engineer',
    text: `Job Title: Staff Software Engineer / Team Lead
Company: CloudScale Technologies
Location: Hybrid / Remote

About the Role:
Lead the technical vision and engineering roadmap for our core distributed platform. You will mentor senior engineers, establish architectural standards, and drive key modernization initiatives across distributed services.

Requirements:
- 7+ years of software development experience with extensive system design expertise.
- Demonstrated technical leadership, mentoring, and cross-functional alignment.
- Expertise with event-driven architecture (Kafka/SQS), Docker/Kubernetes, and cloud scalability.
- Commitment to operational excellence, automated CI/CD pipelines, and high availability.`
  }
];

export default function JobDescriptionInput({
  jobDescription,
  onChangeJd,
  onShowToast,
  allRecipientsTailored = false,
  hasSpreadsheetRecipients = false
}) {
  const [activeMode, setActiveMode] = useState(
    hasSpreadsheetRecipients ? 'tailored' : (jobDescription ? 'tailored' : 'general')
  );

  const effectiveMode = hasSpreadsheetRecipients ? 'tailored' : activeMode;

  // Word and character count
  const charCount = jobDescription ? jobDescription.length : 0;
  const wordCount = jobDescription ? jobDescription.trim().split(/\s+/).filter(Boolean).length : 0;

  // Visual guidance based on word count
  let qualityIndicator = {
    color: 'var(--text-muted)',
    badge: 'Empty',
    message: 'Paste a job description or choose a preset role above'
  };

  if (wordCount > 0 && wordCount < 35) {
    qualityIndicator = {
      color: 'var(--accent-warning)',
      badge: 'Brief',
      message: 'Brief overview. Add key requirements for sharper AI matching'
    };
  } else if (wordCount >= 35 && wordCount <= 350) {
    qualityIndicator = {
      color: 'var(--accent-success)',
      badge: 'Optimal',
      message: 'Optimal depth for personalized skill alignment'
    };
  } else if (wordCount > 350) {
    qualityIndicator = {
      color: 'var(--accent-primary)',
      badge: 'Detailed',
      message: 'Comprehensive description. Top requirements prioritized'
    };
  }

  const handleSelectSample = (sample) => {
    onChangeJd(sample.text);
    setActiveMode('tailored');
    onShowToast({
      type: 'info',
      title: 'Preset Role Selected',
      message: `Loaded "${sample.title.split('—')[0].trim()}".`
    });
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const executeClear = () => {
    onChangeJd('');
    setActiveMode('general');
    onShowToast?.({
      type: 'info',
      title: 'Target Cleared',
      message: 'Switched to Direct Value Pitch mode.'
    });
  };

  const handleClear = () => {
    if (wordCount > 50) {
      setShowClearConfirm(true);
    } else {
      executeClear();
    }
  };

  const handleSwitchMode = (mode) => {
    setActiveMode(mode);
  };

  return (
    <div className="glass-card">
      <div className="step-hero-header">
        <h2 className="step-hero-title">Target Role</h2>
        <p className="step-hero-subtitle">
          {hasSpreadsheetRecipients
            ? 'Paste the job description or role requirements to tailor outreach for your imported contacts.'
            : 'Target a specific job opening or choose a direct executive value pitch.'}
        </p>
      </div>

      {allRecipientsTailored && !hasSpreadsheetRecipients && (
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 13,
            color: 'var(--text-secondary)'
          }}
        >
          <Sparkles size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Tailored Roles Active:</strong>{' '}
            Your recipients were added with individual role requirements from AI Parse JD / manual entry.
            Cold emails will be tailored using each contact's specific role. Anything entered here will only act as an optional shared fallback.
          </div>
        </div>
      )}

      {/* Mode Toggle Pills (Hidden when excel is uploaded - no need for two sections) */}
      {!hasSpreadsheetRecipients && (
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 4,
            gap: 6,
            marginBottom: 16
          }}
        >
          <button
            type="button"
            onClick={() => handleSwitchMode('tailored')}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: effectiveMode === 'tailored' ? 'var(--accent-primary)' : 'transparent',
              color: effectiveMode === 'tailored' ? '#fff' : 'var(--text-secondary)',
              transition: 'all var(--transition-fast)'
            }}
          >
            <FileText size={15} />
            Specific Role (JD)
          </button>

          <button
            type="button"
            onClick={() => handleSwitchMode('general')}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: effectiveMode === 'general' ? 'var(--accent-primary)' : 'transparent',
              color: effectiveMode === 'general' ? '#fff' : 'var(--text-secondary)',
              transition: 'all var(--transition-fast)'
            }}
          >
            <Sparkles size={15} />
            Direct Value Pitch
          </button>
        </div>
      )}

      {/* Sample JDs Quick Chips (Tailored Mode) */}
      {effectiveMode === 'tailored' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Presets:</span>
            {SAMPLE_JDS.map(s => (
              <button
                key={s.id}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleSelectSample(s)}
                style={{ fontSize: 11, padding: '3px 9px', height: 26 }}
              >
                {s.title.split('—')[0].trim()}
              </button>
            ))}
          </div>

          {jobDescription && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleClear}
              style={{ fontSize: 11, height: 26, color: 'var(--text-muted)' }}
            >
              <XCircle size={13} /> Clear
            </button>
          )}
        </div>
      )}

      {/* Mode Context Banner for General Mode */}
      {!hasSpreadsheetRecipients && effectiveMode === 'general' && (
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            color: 'var(--text-secondary)'
          }}
        >
          <Info size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
          <span>
            AI will synthesize a direct executive value pitch focused on your standout achievements.
          </span>
        </div>
      )}

      {/* Confirm Before Clear Banner (TICK-CYC3-15 / C6) */}
      {showClearConfirm && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--warning-bg)',
            border: '1px solid var(--accent-warning)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)' }}>
            <AlertCircle size={16} style={{ color: 'var(--accent-warning)', flexShrink: 0 }} />
            <span>
              Clear this job description (<strong>{wordCount} words</strong>)?
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowClearConfirm(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => {
                setShowClearConfirm(false);
                executeClear();
              }}
            >
              Confirm Clear
            </button>
          </div>
        </div>
      )}

      {/* Textarea */}
      <div style={{ position: 'relative' }}>
        <textarea
          className="form-textarea"
          style={{
            minHeight: 140,
            paddingBottom: 32,
            opacity: activeMode === 'general' ? 0.75 : 1
          }}
          placeholder={
            activeMode === 'general'
              ? 'Optional: Add custom focus areas or talking points (e.g., "Highlight experience with distributed systems and LLMs")...'
              : 'Paste target job description, responsibilities, or role requirements here...'
          }
          value={jobDescription}
          onChange={e => {
            onChangeJd(e.target.value);
            if (activeMode !== 'tailored') {
              setActiveMode('tailored');
            }
          }}
        />

        {/* Counter & Indicator Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            marginTop: 4,
            fontSize: 11,
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            gap: 8
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: qualityIndicator.color
              }}
            />
            <span style={{ color: qualityIndicator.color, fontWeight: 600 }}>
              {qualityIndicator.badge}:
            </span>
            <span>{qualityIndicator.message}</span>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
            <strong>{wordCount}</strong> words • <strong>{charCount}</strong> chars
          </div>
        </div>
      </div>
    </div>
  );
}
