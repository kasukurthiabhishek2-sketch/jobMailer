import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ResumeUpload from '../components/ResumeUpload';
import { uploadResume, deleteEphemeralResume } from '../services/api';

vi.mock('../services/api', () => ({
  uploadResume: vi.fn(),
  deleteEphemeralResume: vi.fn()
}));

describe('ResumeUpload Component (M1)', () => {
  const defaultResumeData = {
    fileId: 'mock-resume-1.pdf',
    originalFilename: 'Jane_Doe_Resume.pdf',
    sizeBytes: 142850,
    text: 'Jane Doe\nFull-Stack Engineer\nSan Francisco, CA | jane@example.com | +1 (555) 123-4567\nSummary:\nExperienced engineer with 5 years in React and Node.js.',
    summarySnippet: 'Jane Doe - Full-Stack Engineer...',
    wordCount: 150,
    detectedName: 'Jane Doe',
    detectedEmail: 'jane@example.com',
    detectedPhone: '+1 (555) 123-4567'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. File Upload Validation & Handling
  describe('File Upload Validation & Handling', () => {
    it('accepts valid PDF file, triggers uploadResume API, and calls onResumeUploaded on success', async () => {
      const onResumeUploaded = vi.fn();
      const onShowToast = vi.fn();
      uploadResume.mockResolvedValueOnce(defaultResumeData);

      const { container } = render(
        <ResumeUpload
          resumeData={null}
          onResumeUploaded={onResumeUploaded}
          onShowToast={onShowToast}
        />
      );

      const fileInput = container.querySelector('input[type="file"]');
      const file = new File(['dummy-content'], 'my_resume.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(uploadResume).toHaveBeenCalledWith(file);
      await waitFor(() => {
        expect(onResumeUploaded).toHaveBeenCalledWith(defaultResumeData);
      });
      expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({
        type: 'success',
        title: 'Resume Processed'
      }));
    });

    it('accepts valid DOCX and TXT files', async () => {
      const onResumeUploaded = vi.fn();
      uploadResume.mockResolvedValue(defaultResumeData);

      const { container } = render(
        <ResumeUpload
          resumeData={null}
          onResumeUploaded={onResumeUploaded}
          onShowToast={vi.fn()}
        />
      );

      const fileInput = container.querySelector('input[type="file"]');
      const docxFile = new File(['dummy-docx'], 'resume.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      fireEvent.change(fileInput, { target: { files: [docxFile] } });
      expect(uploadResume).toHaveBeenCalledWith(docxFile);

      const txtFile = new File(['dummy-txt'], 'resume.txt', { type: 'text/plain' });
      fireEvent.change(fileInput, { target: { files: [txtFile] } });
      expect(uploadResume).toHaveBeenCalledWith(txtFile);
    });

    it('rejects files exceeding 5MB ceiling and renders error banner without network call', async () => {
      const onResumeUploaded = vi.fn();
      const onShowToast = vi.fn();

      const { container } = render(
        <ResumeUpload
          resumeData={null}
          onResumeUploaded={onResumeUploaded}
          onShowToast={onShowToast}
        />
      );

      const fileInput = container.querySelector('input[type="file"]');
      const largeFile = new File(['x'.repeat(100)], 'huge_resume.pdf', { type: 'application/pdf' });
      Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 }); // 6MB

      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      expect(uploadResume).not.toHaveBeenCalled();
      expect(onResumeUploaded).not.toHaveBeenCalled();
      expect(screen.getByText(/exceeds the maximum allowed 5MB limit/i)).toBeInTheDocument();
      expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({
        type: 'error',
        title: 'File Too Large'
      }));
    });

    it('rejects unsupported extensions (.png, .zip) with validation error banner and error toast', async () => {
      const onResumeUploaded = vi.fn();
      const onShowToast = vi.fn();

      const { container } = render(
        <ResumeUpload
          resumeData={null}
          onResumeUploaded={onResumeUploaded}
          onShowToast={onShowToast}
        />
      );

      const fileInput = container.querySelector('input[type="file"]');
      const invalidFile = new File(['image-bytes'], 'photo.png', { type: 'image/png' });

      fireEvent.change(fileInput, { target: { files: [invalidFile] } });

      expect(uploadResume).not.toHaveBeenCalled();
      expect(onResumeUploaded).not.toHaveBeenCalled();
      expect(screen.getByText(/Unsupported file format/i)).toBeInTheDocument();
      expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({
        type: 'error',
        title: 'Invalid Format'
      }));
    });

    it('handles API upload rejection by displaying error banner and error toast', async () => {
      const onResumeUploaded = vi.fn();
      const onShowToast = vi.fn();
      uploadResume.mockRejectedValueOnce(new Error('Corrupt PDF structure'));

      const { container } = render(
        <ResumeUpload
          resumeData={null}
          onResumeUploaded={onResumeUploaded}
          onShowToast={onShowToast}
        />
      );

      const fileInput = container.querySelector('input[type="file"]');
      const file = new File(['corrupt'], 'broken.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Corrupt PDF structure')).toBeInTheDocument();
      });
      expect(onResumeUploaded).not.toHaveBeenCalled();
      expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({
        type: 'error',
        title: 'Upload Failed',
        message: 'Corrupt PDF structure'
      }));
    });

    it('renders extraction spinner in dropzone during pending upload', async () => {
      let resolveUpload;
      uploadResume.mockImplementationOnce(() => new Promise((res) => { resolveUpload = res; }));

      const { container } = render(
        <ResumeUpload
          resumeData={null}
          onResumeUploaded={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      const fileInput = container.querySelector('input[type="file"]');
      const file = new File(['valid'], 'sample.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(screen.getByText('Extracting Resume Data...')).toBeInTheDocument();

      // Resolve upload to clean up
      resolveUpload(defaultResumeData);
      await waitFor(() => {
        expect(screen.queryByText('Extracting Resume Data...')).not.toBeInTheDocument();
      });
    });
  });

  // 2. Drag-and-Drop Interactions
  describe('Drag and Drop Interactions', () => {
    it('sets active class on dragover and removes on dragleave', () => {
      const { container } = render(
        <ResumeUpload
          resumeData={null}
          onResumeUploaded={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      const dropzone = container.querySelector('.dropzone');
      expect(dropzone).not.toHaveClass('active');

      fireEvent.dragOver(dropzone);
      expect(dropzone).toHaveClass('active');

      fireEvent.dragLeave(dropzone);
      expect(dropzone).not.toHaveClass('active');
    });

    it('processes dropped file on drop event', async () => {
      const onResumeUploaded = vi.fn();
      uploadResume.mockResolvedValueOnce(defaultResumeData);

      const { container } = render(
        <ResumeUpload
          resumeData={null}
          onResumeUploaded={onResumeUploaded}
          onShowToast={vi.fn()}
        />
      );

      const dropzone = container.querySelector('.dropzone');
      const file = new File(['pdf-data'], 'dropped_resume.pdf', { type: 'application/pdf' });

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] }
      });

      expect(dropzone).not.toHaveClass('active');
      expect(uploadResume).toHaveBeenCalledWith(file);
      await waitFor(() => {
        expect(onResumeUploaded).toHaveBeenCalledWith(defaultResumeData);
      });
    });
  });

  // 3. Sample Resume Action Removed
  describe('Try with Sample Resume Action', () => {
    it('does not render "Try with Sample Resume" button in the dropzone', () => {
      render(
        <ResumeUpload
          resumeData={null}
          onResumeUploaded={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /Try with Sample Resume/i })).not.toBeInTheDocument();
    });
  });

  // 4. Extracted Field Editing & Keystroke Isolation
  describe('Extracted Profile Field Editing', () => {
    it('renders Candidate Name, Email, and Phone inputs prefilled with resumeData', () => {
      render(
        <ResumeUpload
          resumeData={defaultResumeData}
          onResumeUploaded={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('jane@example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('+1 (555) 123-4567')).toBeInTheDocument();
    });

    it('updating Name input calls onResumeUploaded with autoAdvance: false when onResumeChange is omitted', () => {
      const onResumeUploaded = vi.fn();

      render(
        <ResumeUpload
          resumeData={defaultResumeData}
          onResumeUploaded={onResumeUploaded}
          onShowToast={vi.fn()}
        />
      );

      const nameInput = screen.getByDisplayValue('Jane Doe');
      fireEvent.change(nameInput, { target: { value: 'Jane Elizabeth Doe' } });

      expect(onResumeUploaded).toHaveBeenCalledWith({
        ...defaultResumeData,
        detectedName: 'Jane Elizabeth Doe'
      }, { autoAdvance: false });
    });

    it('updating Email and Phone inputs calls onResumeUploaded with autoAdvance: false when onResumeChange is omitted', () => {
      const onResumeUploaded = vi.fn();

      render(
        <ResumeUpload
          resumeData={defaultResumeData}
          onResumeUploaded={onResumeUploaded}
          onShowToast={vi.fn()}
        />
      );

      const emailInput = screen.getByDisplayValue('jane@example.com');
      fireEvent.change(emailInput, { target: { value: 'jane.doe@work.io' } });
      expect(onResumeUploaded).toHaveBeenCalledWith({
        ...defaultResumeData,
        detectedEmail: 'jane.doe@work.io'
      }, { autoAdvance: false });

      const phoneInput = screen.getByDisplayValue('+1 (555) 123-4567');
      fireEvent.change(phoneInput, { target: { value: '+1 (555) 999-8888' } });
      expect(onResumeUploaded).toHaveBeenCalledWith({
        ...defaultResumeData,
        detectedPhone: '+1 (555) 999-8888'
      }, { autoAdvance: false });
    });

    it('calls onResumeChange and does not call onResumeUploaded when onResumeChange is provided', () => {
      const onResumeUploaded = vi.fn();
      const onResumeChange = vi.fn();

      render(
        <ResumeUpload
          resumeData={defaultResumeData}
          onResumeUploaded={onResumeUploaded}
          onResumeChange={onResumeChange}
          onShowToast={vi.fn()}
        />
      );

      const nameInput = screen.getByDisplayValue('Jane Doe');
      fireEvent.change(nameInput, { target: { value: 'Jane Elizabeth Doe' } });

      expect(onResumeChange).toHaveBeenCalledWith({
        ...defaultResumeData,
        detectedName: 'Jane Elizabeth Doe'
      });
      expect(onResumeUploaded).not.toHaveBeenCalled();
    });
  });

  // 5. Collapsible Raw Text Preview
  describe('Collapsible Raw Text Preview', () => {
    it('toggles preview visibility between hidden and expanded states', () => {
      render(
        <ResumeUpload
          resumeData={defaultResumeData}
          onResumeUploaded={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      // Initially collapsed
      const toggleBtn = screen.getByRole('button', { name: /View Extracted Resume Text/i });
      expect(screen.queryByText(/Experienced engineer with 5 years/i)).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(toggleBtn);
      expect(screen.getByRole('button', { name: /Hide Extracted Resume Text/i })).toBeInTheDocument();
      expect(screen.getByText(/Experienced engineer with 5 years/i)).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(screen.getByRole('button', { name: /Hide Extracted Resume Text/i }));
      expect(screen.getByRole('button', { name: /View Extracted Resume Text/i })).toBeInTheDocument();
      expect(screen.queryByText(/Experienced engineer with 5 years/i)).not.toBeInTheDocument();
    });
  });

  // 6. Summary Bar & Ephemeral Deletion
  describe('File Summary Bar & Ephemeral Deletion', () => {
    it('displays file type badge, name, size in KB, and parsed word count', () => {
      render(
        <ResumeUpload
          resumeData={defaultResumeData}
          onResumeUploaded={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      expect(screen.getByText('PDF')).toBeInTheDocument();
      expect(screen.getByText('Jane_Doe_Resume.pdf')).toBeInTheDocument();
      expect(screen.getByText(/139\.5 KB/i)).toBeInTheDocument();
      expect(screen.getByText(/150 words parsed/i)).toBeInTheDocument();
    });

    it('invokes hidden file input when clicking Change File', () => {
      const { container } = render(
        <ResumeUpload
          resumeData={defaultResumeData}
          onResumeUploaded={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      const fileInput = container.querySelector('input[type="file"]');
      const clickSpy = vi.spyOn(fileInput, 'click');

      const changeFileBtn = screen.getByRole('button', { name: /Change File/i });
      fireEvent.click(changeFileBtn);

      expect(clickSpy).toHaveBeenCalled();
    });

    it('clicking Remove Resume calls deleteEphemeralResume and clears resumeData', async () => {
      const onResumeUploaded = vi.fn();
      const onShowToast = vi.fn();
      deleteEphemeralResume.mockResolvedValueOnce({ success: true });

      render(
        <ResumeUpload
          resumeData={defaultResumeData}
          onResumeUploaded={onResumeUploaded}
          onShowToast={onShowToast}
        />
      );

      const removeBtn = screen.getByRole('button', { name: /Remove Resume/i });
      fireEvent.click(removeBtn);

      expect(deleteEphemeralResume).toHaveBeenCalledWith('mock-resume-1.pdf');
      expect(onResumeUploaded).toHaveBeenCalledWith(null);
      expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({
        type: 'info',
        title: 'Resume Removed'
      }));
    });

    it('handles deleteEphemeralResume API failure gracefully without breaking cleanup', async () => {
      const onResumeUploaded = vi.fn();
      const onShowToast = vi.fn();
      deleteEphemeralResume.mockRejectedValueOnce(new Error('Network error on delete'));

      render(
        <ResumeUpload
          resumeData={defaultResumeData}
          onResumeUploaded={onResumeUploaded}
          onShowToast={onShowToast}
        />
      );

      const removeBtn = screen.getByRole('button', { name: /Remove Resume/i });
      fireEvent.click(removeBtn);

      // Best effort cleanup still clears local state and alerts user
      expect(onResumeUploaded).toHaveBeenCalledWith(null);
      expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Resume Removed'
      }));
    });
  });
});
