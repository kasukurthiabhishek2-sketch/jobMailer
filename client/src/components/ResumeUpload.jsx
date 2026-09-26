import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  User,
  Mail,
  Phone,
  Sparkles,
  AlertCircle,
  Server,
  Settings
} from 'lucide-react';
import { uploadResume, testAiConnection, testSmtpConnection } from '../services/api';

const SAMPLE_RESUME_TEXT = `Alex Mercer
Senior Full-Stack & AI Systems Engineer
San Francisco, CA | alex.mercer.dev@example.com | +1 (555) 382-9912 | github.com/alexmercer | linkedin.com/in/alexmercer

PROFESSIONAL SUMMARY
Results-driven Senior Full-Stack Engineer with 6+ years of experience architecting distributed cloud systems, modern React frontends, and AI agent workflows. Proven track record of reducing latency by 42% and scaling SaaS platforms to 2.5M+ active users. Passionate about LLM integration, automated workflows, and high-performance web applications.

CORE SKILLS
- Frontend: React 18, Next.js, TypeScript, TailwindCSS, State Management (Zustand/Redux), WebSockets.
- Backend: Node.js, Express, Python (FastAPI), Go, REST & GraphQL APIs, Microservices.
- AI & LLMs: OpenAI API, Google Gemini, Anthropic Claude, LangChain, RAG architectures, Vector DBs (Pinecone, pgvector).
- Cloud & DevOps: AWS (ECS, Lambda, S3), Docker, Kubernetes, CI/CD (GitHub Actions), PostgreSQL, Redis.

WORK EXPERIENCE
Senior Full-Stack Engineer | CloudScale Technologies | 2022 – Present
- Spearheaded the redesign of the core enterprise dashboard using React and Node.js, increasing daily user engagement by 35%.
- Implemented an intelligent AI copilot using streaming LLM completions, saving customer support teams 20+ hours weekly.
- Reduced server p99 latency from 450ms to 95ms through Redis caching and PostgreSQL query optimization.

Software Engineer | Apex Systems | 2019 – 2022
- Developed high-throughput microservices handling 40,000+ requests per second with 99.98% uptime.
- Built reusable component library adopted across 4 internal engineering teams, cutting UI feature turnaround by 50%.

EDUCATION & CERTIFICATIONS
B.S. in Computer Science | University of California, Berkeley (2019)
AWS Certified Solutions Architect (Associate)`;

export default function ResumeUpload({
  resumeData,
  onResumeUploaded,
  onShowToast,
  config,
  onOpenSettings
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [showPreviewText, setShowPreviewText] = useState(false);

  // Quick Connect testing states
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState(null);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState(null);

  const activeAiKey = config?.activeProvider || 'gemini';
  const activeAi = config?.aiProviders?.[activeAiKey];
  const isAiConfigured = Boolean(activeAi?.isConfigured);

  const defaultSmtp = (config?.smtpProfiles || []).find(p => p.isDefault) || config?.smtpProfiles?.[0];
  const isSmtpConfigured = Boolean(defaultSmtp && defaultSmtp.isConfigured);

  const handleFile = async (file) => {
    if (!file) return;
    setValidationError(null);

    // Client-side file size validation (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      const err = `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum allowed 5MB limit. Please upload a smaller file.`;
      setValidationError(err);
      onShowToast({ type: 'error', title: 'File Too Large', message: err });
      return;
    }

    // Client-side extension validation (.pdf, .docx, .txt)
    const validExts = ['.pdf', '.docx', '.txt'];
    const hasValidExt = validExts.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      const err = 'Unsupported file format. Please upload a PDF (.pdf) or Word document (.docx).';
      setValidationError(err);
      onShowToast({ type: 'error', title: 'Invalid Format', message: err });
      return;
    }

    setIsUploading(true);
    try {
      const data = await uploadResume(file);
      onResumeUploaded(data);
      onShowToast({
        type: 'success',
        title: 'Resume Processed',
        message: `Extracted ${data.wordCount} words from ${file.name}`
      });
    } catch (err) {
      setValidationError(err.message || 'Failed to upload and parse resume file.');
      onShowToast({
        type: 'error',
        title: 'Upload Failed',
        message: err.message
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSampleResume = () => {
    setValidationError(null);
    onResumeUploaded({
      fileId: 'sample-resume-alex-mercer.pdf',
      originalFilename: 'Alex_Mercer_Resume.pdf',
      sizeBytes: 142850,
      text: SAMPLE_RESUME_TEXT,
      summarySnippet: SAMPLE_RESUME_TEXT.slice(0, 280) + '...',
      wordCount: SAMPLE_RESUME_TEXT.split(/\s+/).length,
      detectedName: 'Alex Mercer',
      detectedEmail: 'alex.mercer.dev@example.com',
      detectedPhone: '+1 (555) 382-9912'
    });
    onShowToast({
      type: 'info',
      title: 'Sample Resume Loaded',
      message: 'Loaded sample Senior Engineer resume for instant testing.'
    });
  };

  const handleFieldChange = (field, value) => {
    if (!resumeData) return;
    onResumeUploaded({
      ...resumeData,
      [field]: value
    });
  };

  const handleQuickTestAi = async () => {
    if (!activeAi) return;
    setTestingAi(true);
    setAiTestResult(null);
    try {
      const res = await testAiConnection({
        providerKey: activeAiKey,
        model: activeAi.model,
        baseURL: activeAi.baseURL
      });
      setAiTestResult(res);
      if (res.success) {
        onShowToast({ type: 'success', title: 'AI Connected', message: `${activeAi.name} is ready!` });
      } else {
        onShowToast({ type: 'error', title: 'AI Test Failed', message: res.error });
      }
    } catch (err) {
      setAiTestResult({ success: false, error: err.message });
      onShowToast({ type: 'error', title: 'Connection Error', message: err.message });
    } finally {
      setTestingAi(false);
    }
  };

  const handleQuickTestSmtp = async () => {
    if (!defaultSmtp) return;
    setTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await testSmtpConnection(defaultSmtp);
      setSmtpTestResult(res);
      if (res.success) {
        onShowToast({ type: 'success', title: 'SMTP Verified', message: 'SMTP connection verified!' });
      } else {
        onShowToast({ type: 'error', title: 'SMTP Verification Failed', message: res.error });
      }
    } catch (err) {
      setSmtpTestResult({ success: false, error: err.message });
      onShowToast({ type: 'error', title: 'Connection Error', message: err.message });
    } finally {
      setTestingSmtp(false);
    }
  };

  return (
    <div className="glass-card">
      <div className="card-header">
        <div className="card-title">
          <FileText className="card-title-icon" size={20} />
          <span>Step 1: Setup & Candidate Profile</span>
        </div>
        {resumeData && (
          <span className="badge-counter" style={{ color: 'var(--accent-success)', borderColor: 'rgba(52, 211, 153, 0.3)' }}>
            ✓ Resume Parsed
          </span>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFile(e.target.files?.[0])}
        accept=".pdf,.docx,.txt"
        style={{ display: 'none' }}
      />

      {/* Inline Validation Error Banner */}
      {validationError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-2)',
            padding: 'var(--sp-3)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--danger-bg)',
            border: '1px solid var(--accent-danger)',
            color: 'var(--accent-danger)',
            fontSize: 13,
            marginBottom: 'var(--sp-4)'
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{validationError}</span>
        </div>
      )}

      {!resumeData ? (
        <>
          <div
            className={`dropzone ${isDragging ? 'active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="dropzone-icon">
              {isUploading ? (
                <RefreshCw size={24} className="spin-icon" />
              ) : (
                <UploadCloud size={28} />
              )}
            </div>
            <div className="dropzone-title">
              {isUploading ? 'Extracting & Parsing Resume...' : 'Click to Upload or Drag & Drop Resume'}
            </div>
            <div className="dropzone-desc">
              Supports PDF (.pdf) or Word (.docx) • Max 5MB • Auto-extracts contact info
            </div>
          </div>

          <div style={{ marginTop: 'var(--sp-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleSampleResume}
              style={{ gap: 'var(--sp-2)' }}
            >
              <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
              Use Demo Sample Resume
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {/* File summary bar */}
          <div className="file-info-box">
            <div className="file-info-left">
              <div className="file-type-icon">
                {resumeData.originalFilename?.endsWith('.docx') ? 'DOCX' : 'PDF'}
              </div>
              <div>
                <div className="file-meta-name">{resumeData.originalFilename}</div>
                <div className="file-meta-sub">
                  <span>{(resumeData.sizeBytes ? (resumeData.sizeBytes / 1024).toFixed(1) : '140')} KB</span>
                  <span>•</span>
                  <span>{resumeData.wordCount || 350} words parsed</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Change File
              </button>
            </div>
          </div>

          {/* Editable extracted fields */}
          <div
            style={{
              padding: 'var(--sp-4)',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-3)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Extracted Candidate Information
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Edit to correct heuristic detection
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--sp-3)' }}>
              <div>
                <label className="form-label" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <User size={12} style={{ color: 'var(--accent-primary)' }} />
                  Full Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={resumeData.detectedName || ''}
                  onChange={(e) => handleFieldChange('detectedName', e.target.value)}
                  placeholder="Candidate Name"
                  style={{ fontSize: 13 }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Mail size={12} style={{ color: 'var(--accent-info)' }} />
                  Email Address
                </label>
                <input
                  type="email"
                  className="form-input"
                  value={resumeData.detectedEmail || ''}
                  onChange={(e) => handleFieldChange('detectedEmail', e.target.value)}
                  placeholder="name@example.com"
                  style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Phone size={12} style={{ color: 'var(--accent-success)' }} />
                  Phone Number
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={resumeData.detectedPhone || ''}
                  onChange={(e) => handleFieldChange('detectedPhone', e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>
          </div>

          {/* Collapsible raw text preview */}
          <div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowPreviewText(!showPreviewText)}
              style={{ width: '100%', justifyContent: 'space-between' }}
            >
              <span>{showPreviewText ? 'Hide Extracted Resume Text' : 'View Extracted Resume Text'}</span>
              {showPreviewText ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showPreviewText && (
              <div
                style={{
                  marginTop: 'var(--sp-2)',
                  padding: 'var(--sp-3)',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  maxHeight: 180,
                  overflowY: 'auto',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {resumeData.text}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 1 Quick Connect Cards (AI & SMTP) */}
      <div style={{ marginTop: 'var(--sp-4)', paddingTop: 'var(--sp-4)', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-3)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <Server size={15} style={{ color: 'var(--accent-primary)' }} />
          <span>Quick Connect Status</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
          {/* Card 1: AI Provider Quick Connect */}
          <div
            style={{
              padding: 'var(--sp-3)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)',
              border: `1px solid ${isAiConfigured ? 'var(--border-subtle)' : 'var(--accent-warning)'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <span
                  className={`status-dot ${isAiConfigured ? 'active' : 'warning'}`}
                  title={isAiConfigured ? 'API Key Configured' : 'Key Needed'}
                />
                <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  {activeAi?.name || 'AI Provider'}
                </strong>
              </div>
              <span style={{ fontSize: 11, color: isAiConfigured ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                {isAiConfigured ? 'Configured' : 'Key Needed'}
              </span>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              Model: {activeAi?.model || 'default'}
            </div>

            {aiTestResult && (
              <div
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: aiTestResult.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                  color: aiTestResult.success ? 'var(--accent-success)' : 'var(--accent-danger)'
                }}
              >
                {aiTestResult.success ? '✓ Connection verified' : `✕ ${aiTestResult.error || 'Failed'}`}
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'auto', paddingTop: 'var(--sp-1)' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleQuickTestAi}
                disabled={testingAi || !isAiConfigured}
                style={{ flex: 1 }}
              >
                {testingAi ? <RefreshCw size={12} className="spin-icon" /> : 'Test AI'}
              </button>
              {onOpenSettings && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onOpenSettings('ai')}
                  title="Configure AI in Settings"
                >
                  <Settings size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Card 2: SMTP Sender Quick Connect */}
          <div
            style={{
              padding: 'var(--sp-3)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)',
              border: `1px solid ${isSmtpConfigured ? 'var(--border-subtle)' : 'var(--border-subtle)'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <span
                  className={`status-dot ${isSmtpConfigured ? 'active' : 'warning'}`}
                  title={isSmtpConfigured ? 'SMTP Ready' : 'Credentials Needed'}
                />
                <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  {defaultSmtp?.name || 'SMTP Account'}
                </strong>
              </div>
              <span style={{ fontSize: 11, color: isSmtpConfigured ? 'var(--accent-success)' : 'var(--text-muted)' }}>
                {isSmtpConfigured ? 'Connected' : 'Deferred (Optional)'}
              </span>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {defaultSmtp ? defaultSmtp.username : 'Not configured yet'}
            </div>

            {!isSmtpConfigured && (
              <div style={{ fontSize: 11, color: 'var(--accent-warning)', lineHeight: 1.3 }}>
                Can be configured before sending in Step 5.
              </div>
            )}

            {smtpTestResult && (
              <div
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: smtpTestResult.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                  color: smtpTestResult.success ? 'var(--accent-success)' : 'var(--accent-danger)'
                }}
              >
                {smtpTestResult.success ? '✓ SMTP verified' : `✕ ${smtpTestResult.error || 'Failed'}`}
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'auto', paddingTop: 'var(--sp-1)' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleQuickTestSmtp}
                disabled={testingSmtp || !isSmtpConfigured}
                style={{ flex: 1 }}
              >
                {testingSmtp ? <RefreshCw size={12} className="spin-icon" /> : 'Test SMTP'}
              </button>
              {onOpenSettings && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onOpenSettings('smtp')}
                  title="Configure SMTP in Settings"
                >
                  <Settings size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
