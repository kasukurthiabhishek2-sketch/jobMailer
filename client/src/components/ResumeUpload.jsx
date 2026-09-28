import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  User,
  Mail,
  Phone,
  Sparkles,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { uploadResume, deleteEphemeralResume } from '../services/api';

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
  onShowToast
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [showPreviewText, setShowPreviewText] = useState(false);

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

  const handleRemoveResume = async () => {
    const fileId = resumeData?.fileId;
    if (fileId) {
      try {
        await deleteEphemeralResume(fileId);
      } catch {
        // best-effort cleanup
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onResumeUploaded(null);
    onShowToast?.({
      type: 'info',
      title: 'Resume Removed',
      message: 'Candidate profile and uploaded resume cleared.'
    });
  };



  return (
    <div className="glass-card">
      <div className="step-hero-header">
        <h2 className="step-hero-title">Candidate Profile</h2>
        <p className="step-hero-subtitle">
          Upload your resume. JDMail automatically extracts your contact info and experience.
        </p>
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
                <RefreshCw size={26} className="spin-icon" />
              ) : (
                <UploadCloud size={30} />
              )}
            </div>
            <div className="dropzone-title">
              {isUploading ? 'Extracting Resume Data...' : 'Drop your resume here or click to browse'}
            </div>
            <div className="dropzone-desc">
              PDF (.pdf) or Word (.docx) • Up to 5MB
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
              Try with Sample Resume
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
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleRemoveResume}
                style={{ gap: 6 }}
                aria-label="Remove Resume"
              >
                <Trash2 size={14} />
                Remove Resume
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
                Contact & Sender Details
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Verified from resume
              </span>
            </div>

            <div className="responsive-grid-3">
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
    </div>
  );
}
