import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, User, Mail, Phone, Sparkles } from 'lucide-react';
import { uploadResume } from '../services/api';

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

export default function ResumeUpload({ resumeData, onResumeUploaded, onShowToast }) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showPreviewText, setShowPreviewText] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;

    const validExts = ['.pdf', '.docx', '.txt'];
    const hasValidExt = validExts.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      onShowToast({
        type: 'error',
        title: 'Unsupported File Format',
        message: 'Please upload a PDF (.pdf) or Word document (.docx).'
      });
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
      onShowToast({
        type: 'error',
        title: 'Upload Failed',
        message: err.message
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSampleResume = () => {
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

  return (
    <div className="glass-card">
      <div className="card-header">
        <div className="card-title">
          <FileText className="card-title-icon" size={20} />
          <span>Step 1: Candidate Resume</span>
        </div>
        {resumeData && (
          <span className="badge-counter" style={{ color: 'var(--success)', borderColor: 'var(--success-border)' }}>
            ✓ Parsed & Ready
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

      {!resumeData ? (
        <>
          <div
            className={`dropzone ${isDragging ? 'active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
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
              Supports PDF (.pdf) or Word (.docx) • Auto-extracts skills & contact info
            </div>
          </div>

          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleSampleResume}
              style={{ gap: 6 }}
            >
              <Sparkles size={14} style={{ color: 'var(--primary-light)' }} />
              Use Demo Sample Resume
            </button>
          </div>
        </>
      ) : (
        <div>
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

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Change File
              </button>
            </div>
          </div>

          {/* Extracted metadata chips */}
          <div className="info-pill-row">
            {resumeData.detectedName && (
              <div className="info-pill">
                <User size={13} style={{ color: 'var(--primary-light)' }} />
                <span>Name: <strong>{resumeData.detectedName}</strong></span>
              </div>
            )}
            {resumeData.detectedEmail && (
              <div className="info-pill">
                <Mail size={13} style={{ color: 'var(--accent-cyan)' }} />
                <span>Email: <strong>{resumeData.detectedEmail}</strong></span>
              </div>
            )}
            {resumeData.detectedPhone && (
              <div className="info-pill">
                <Phone size={13} style={{ color: 'var(--success)' }} />
                <span>Phone: <strong>{resumeData.detectedPhone}</strong></span>
              </div>
            )}
          </div>

          {/* Collapsible raw text preview */}
          <div style={{ marginTop: 14 }}>
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
                  marginTop: 10,
                  padding: 14,
                  background: 'var(--bg-secondary)',
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
