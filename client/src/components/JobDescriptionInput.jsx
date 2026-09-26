import React, { useState } from 'react';
import { Briefcase, Sparkles, XCircle, FileText, Info, ChevronDown } from 'lucide-react';

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
  onShowToast
}) {
  const [showSampleMenu, setShowSampleMenu] = useState(false);
  const [activeMode, setActiveMode] = useState(jobDescription ? 'tailored' : 'general');

  // Word and character count
  const charCount = jobDescription ? jobDescription.length : 0;
  const wordCount = jobDescription ? jobDescription.trim().split(/\s+/).filter(Boolean).length : 0;

  // Visual guidance based on word count
  let qualityIndicator = {
    color: 'var(--text-muted)',
    badge: 'Empty',
    message: 'Leave blank for a general high-impact intro, or paste a JD to match skills against role requirements.'
  };

  if (wordCount > 0 && wordCount < 35) {
    qualityIndicator = {
      color: 'var(--accent-warning)',
      badge: 'Brief',
      message: 'Brief overview. Consider adding specific technical requirements or responsibilities for sharper AI skill alignment.'
    };
  } else if (wordCount >= 35 && wordCount <= 350) {
    qualityIndicator = {
      color: 'var(--accent-success)',
      badge: 'Optimal',
      message: 'Optimal detail. Great depth for AI to align candidate achievements directly to role requirements.'
    };
  } else if (wordCount > 350) {
    qualityIndicator = {
      color: 'var(--accent-primary)',
      badge: 'Comprehensive',
      message: 'Comprehensive job description. AI will prioritize the top technical requirements and leadership qualifications.'
    };
  }

  const handleSelectSample = (sample) => {
    onChangeJd(sample.text);
    setActiveMode('tailored');
    setShowSampleMenu(false);
    onShowToast({
      type: 'info',
      title: 'Sample JD Loaded',
      message: `Loaded "${sample.title}".`
    });
  };

  const handleClear = () => {
    onChangeJd('');
    setActiveMode('general');
    onShowToast({
      type: 'info',
      title: 'Job Description Cleared',
      message: 'Switched to General Value Pitch mode.'
    });
  };

  const handleSwitchMode = (mode) => {
    setActiveMode(mode);
    if (mode === 'general' && jobDescription) {
      // Keep or clear? Stash confirmation or note
      onShowToast({
        type: 'info',
        title: 'General Mode Active',
        message: 'AI will craft a direct value pitch. Existing JD text is saved below.'
      });
    }
  };

  return (
    <div className="glass-card">
      {/* Header */}
      <div className="card-header">
        <div className="card-title">
          <Briefcase className="card-title-icon" size={20} />
          <span>Step 3: Target Role / Job Description</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          {jobDescription && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClear}
              title="Clear job description"
            >
              <XCircle size={14} /> Clear
            </button>
          )}

          {/* Sample JD Selector Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowSampleMenu(prev => !prev)}
              style={{ gap: 6 }}
            >
              <Sparkles size={14} style={{ color: 'var(--primary-light)' }} />
              Sample JDs
              <ChevronDown size={13} style={{ transform: showSampleMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {showSampleMenu && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 20,
                  minWidth: 260,
                  overflow: 'hidden',
                  animation: 'fadeIn 0.15s ease-out'
                }}
              >
                <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                  SELECT A PRE-POPULATED JD
                </div>
                {SAMPLE_JDS.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSample(s)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontWeight: 600 }}>{s.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mode Toggle Pills */}
      <div
        style={{
          display: 'flex',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: 4,
          gap: 6,
          marginBottom: 14
        }}
      >
        <button
          type="button"
          onClick={() => handleSwitchMode('tailored')}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: activeMode === 'tailored' ? 'var(--accent-primary)' : 'transparent',
            color: activeMode === 'tailored' ? '#fff' : 'var(--text-secondary)',
            boxShadow: activeMode === 'tailored' ? 'var(--shadow-sm)' : 'none',
            transition: 'all var(--transition-fast)'
          }}
        >
          <FileText size={14} />
          Shared Job Description (Tailored Match)
        </button>

        <button
          type="button"
          onClick={() => handleSwitchMode('general')}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: activeMode === 'general' ? 'var(--accent-primary)' : 'transparent',
            color: activeMode === 'general' ? '#fff' : 'var(--text-secondary)',
            boxShadow: activeMode === 'general' ? 'var(--shadow-sm)' : 'none',
            transition: 'all var(--transition-fast)'
          }}
        >
          <Sparkles size={14} />
          Direct Value Pitch (No JD Required)
        </button>
      </div>

      {/* Mode Context Banner */}
      {activeMode === 'general' ? (
        <div
          style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--text-secondary)'
          }}
        >
          <Info size={16} style={{ color: 'var(--primary-light)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong style={{ color: '#fff' }}>Direct Value Pitch Mode Active:</strong> AI will generate punchy outreach focused on candidate engineering achievements and core strengths, automatically addressing each recipient's company and role without forcing alignment to a single job description.
          </div>
        </div>
      ) : null}

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
