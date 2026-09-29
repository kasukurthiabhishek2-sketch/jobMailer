import React, { useState } from 'react';
import { Terminal, RotateCcw, Save, Sparkles, FileText, Info } from 'lucide-react';
import { saveCustomPrompts } from '../../services/api';
import { saveSettings } from '../../lib/settings';

const DEFAULT_COLD_EMAIL_PROMPT = `You are an elite career strategist and executive cold-email copywriter.
Your goal is to craft high-converting, personalized cold outreach emails for job seekers reaching out to recruiters, hiring managers, or founders.

Guidelines for cold emails:
1. Subject line: Catchy, professional, and personalized (e.g., "[Role] at [Company] - [Candidate Name] / [Key Achievement]" or "Quick note regarding [Role] / [Candidate Name]"). Never spammy or generic.
2. Opening Hook: Address the recipient respectfully. Mention something specific about the company if known.
3. Value Proposition: Draw 2-3 compelling, quantifiable achievements, skills, or projects from the Candidate Resume that directly match the Job Description (if provided) or demonstrate strong impact in the domain.
4. If a Job Description is provided, explicitly align the candidate's core strengths to the JD's requirements.
5. If NO Job Description is provided, highlight the candidate's strongest career pillars and how they can create immediate value.
6. Strict Fact Grounding: Never fabricate numbers, metrics, percentages, revenue figures, or credentials not explicitly present in the resume.
7. Call to Action (CTA): Low friction, polite, asking for a brief 10-15 minute introductory conversation.
8. Brevity: Keep the email body between 110 and 175 words. Busy executives don't read long essays.`;

const DEFAULT_JD_PARSER_PROMPT = `You are a precise job description parser. Extract structured data from job posting text.

Rules:
1. Extract ALL email addresses found in the text — look for patterns like name@domain.com, mailto: links, or "apply to:" / "contact:" sections.
2. For each email found, extract the associated person's name and title if mentioned nearby.
3. Extract the company name, job title/role, and location.
4. Extract the top responsibilities and requirements as concise bullet points (max 6 each).
5. Preserve the full job description text in jobDescriptionClean — cleaned and formatted but complete.
6. Set confidence flags to indicate what was successfully found.
7. If a field cannot be determined, use an empty string or empty array — never fabricate data.`;

export default function CustomPromptsTab({ config = {}, onRefreshConfig, user, onShowToast }) {
  const currentConfig = config || {};
  const currentPrompts = currentConfig.customPrompts || {};

  const [coldEmailEnabled, setColdEmailEnabled] = useState(() => Boolean(currentPrompts.coldEmail?.enabled));
  const [coldEmailContent, setColdEmailContent] = useState(() => currentPrompts.coldEmail?.content || '');
  const [jdParserEnabled, setJdParserEnabled] = useState(() => Boolean(currentPrompts.jdParser?.enabled));
  const [jdParserContent, setJdParserContent] = useState(() => currentPrompts.jdParser?.content || '');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if config reference changes
  const [prevPrompts, setPrevPrompts] = useState(currentPrompts);
  if (currentPrompts !== prevPrompts) {
    setPrevPrompts(currentPrompts);
    setColdEmailEnabled(Boolean(currentPrompts.coldEmail?.enabled));
    setColdEmailContent(currentPrompts.coldEmail?.content || '');
    setJdParserEnabled(Boolean(currentPrompts.jdParser?.enabled));
    setJdParserContent(currentPrompts.jdParser?.content || '');
  }

  const handleSave = async () => {
    setIsSaving(true);
    const updatedPrompts = {
      coldEmail: {
        enabled: coldEmailEnabled,
        content: coldEmailContent
      },
      jdParser: {
        enabled: jdParserEnabled,
        content: jdParserContent
      }
    };

    const updatedConfig = {
      ...currentConfig,
      customPrompts: updatedPrompts
    };

    try {
      await saveCustomPrompts(updatedPrompts);
      if (user?.uid) {
        await saveSettings(user.uid, updatedConfig);
      }
      onRefreshConfig?.(updatedConfig);
      onShowToast?.({
        type: 'success',
        title: 'Prompts Saved',
        message: 'Your custom AI prompt templates have been saved successfully.'
      });
    } catch (err) {
      console.error('Failed saving custom prompts:', err);
      onShowToast?.({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Could not save custom prompts.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Overview Card */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          padding: 16,
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start'
        }}
      >
        <Terminal size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            Custom AI System Prompts
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Instruct the AI models how to execute tasks across the application. When enabled, your prompt will replace the default system instructions while preserving required JSON schema and grounding invariants.
          </div>
        </div>
      </div>

      {/* Task 1: Cold Outreach Email */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
            Cold Email Generation Prompt
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: coldEmailEnabled ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={coldEmailEnabled}
              onChange={(e) => setColdEmailEnabled(e.target.checked)}
              style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
            />
            {coldEmailEnabled ? 'Custom Prompt Active' : 'Default Prompt Active'}
          </label>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Controls the instructions given to the AI when generating personalized cold emails in Step 3.
        </div>

        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {coldEmailContent.length} / 8000 characters
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: '4px 10px', height: 'auto', gap: 6 }}
              onClick={() => {
                setColdEmailContent(DEFAULT_COLD_EMAIL_PROMPT);
                setColdEmailEnabled(true);
              }}
            >
              <RotateCcw size={12} />
              Load Recommended Template
            </button>
          </div>

          <textarea
            className="form-input"
            rows={8}
            placeholder={DEFAULT_COLD_EMAIL_PROMPT}
            value={coldEmailContent}
            onChange={(e) => setColdEmailContent(e.target.value)}
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: 1.5,
              resize: 'vertical'
            }}
          />

          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={13} style={{ flexShrink: 0 }} />
            <span>The AI automatically receives candidate resume text, target recipient details, and job description. Required JSON formatting is enforced automatically.</span>
          </div>
        </div>
      </div>

      {/* Task 2: Job Description Parser */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} style={{ color: 'var(--accent-primary)' }} />
            Job Description Parser Prompt
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: jdParserEnabled ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={jdParserEnabled}
              onChange={(e) => setJdParserEnabled(e.target.checked)}
              style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
            />
            {jdParserEnabled ? 'Custom Prompt Active' : 'Default Prompt Active'}
          </label>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Controls how structured contact info, company name, and requirements are parsed from job postings.
        </div>

        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {jdParserContent.length} / 8000 characters
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: '4px 10px', height: 'auto', gap: 6 }}
              onClick={() => {
                setJdParserContent(DEFAULT_JD_PARSER_PROMPT);
                setJdParserEnabled(true);
              }}
            >
              <RotateCcw size={12} />
              Load Recommended Template
            </button>
          </div>

          <textarea
            className="form-input"
            rows={8}
            placeholder={DEFAULT_JD_PARSER_PROMPT}
            value={jdParserContent}
            onChange={(e) => setJdParserContent(e.target.value)}
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: 1.5,
              resize: 'vertical'
            }}
          />

          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={13} style={{ flexShrink: 0 }} />
            <span>The parser extracts email addresses, company, title, and key requirements. Schema verification is handled automatically by the recovery pipeline.</span>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={isSaving}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px' }}
        >
          {isSaving ? (
            'Saving Prompts...'
          ) : (
            <>
              <Save size={16} />
              Save AI Prompts
            </>
          )}
        </button>
      </div>
    </div>
  );
}
