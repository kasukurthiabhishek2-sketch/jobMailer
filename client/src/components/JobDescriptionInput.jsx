import React from 'react';
import { Briefcase, Sparkles, XCircle } from 'lucide-react';

const SAMPLE_JOB_DESCRIPTION = `Job Title: Senior Full-Stack Engineer (Core Infrastructure & AI Applications)
Company: Stripe
Location: Remote / San Francisco, CA

About the Role:
We are looking for a Senior Full-Stack Engineer to build next-generation platform services and developer experiences. You will design, build, and scale reliable, high-throughput microservices handling millions of transactions, while integrating intelligent agentic capabilities into our merchant portal.

Requirements:
- 5+ years of experience building modern web applications with React, TypeScript, and Node.js.
- Strong track record architecting distributed systems and optimizing database performance (PostgreSQL, Redis).
- Experience working with LLM APIs (OpenAI, Gemini, Anthropic) or AI-augmented workflows is a plus.
- Passion for low-latency APIs, clean UI architecture, and robust automated testing.
- Strong product sense and communication skills for collaborating across engineering, design, and talent teams.`;

export default function JobDescriptionInput({
  jobDescription,
  onChangeJd,
  onShowToast
}) {
  const handleLoadSample = () => {
    onChangeJd(SAMPLE_JOB_DESCRIPTION);
    onShowToast({
      type: 'info',
      title: 'Sample JD Loaded',
      message: 'Loaded sample Stripe Senior Engineer job description.'
    });
  };

  const handleClear = () => {
    onChangeJd('');
  };

  return (
    <div className="glass-card">
      <div className="card-header">
        <div className="card-title">
          <Briefcase className="card-title-icon" size={20} />
          <span>Step 3: Job Description (Optional)</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
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
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleLoadSample}
            style={{ gap: 6 }}
          >
            <Sparkles size={14} style={{ color: 'var(--primary-light)' }} />
            Load Sample JD
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--text-muted)' }}>
        {jobDescription ? (
          <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            ✓ Tailored Mode Active: AI will align candidate skills directly against requirements below.
          </span>
        ) : (
          <span>
            💡 <strong>Optional:</strong> Leave blank for a high-impact intro highlighting core accomplishments, or paste a JD to match skills against role requirements.
          </span>
        )}
      </div>

      <textarea
        className="form-textarea"
        style={{ minHeight: 125 }}
        placeholder="Paste target job description, responsibilities, or role requirements here..."
        value={jobDescription}
        onChange={e => onChangeJd(e.target.value)}
      />
    </div>
  );
}
