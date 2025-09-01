import React, { useState } from 'react';

interface FileUploaderProps {
  setFiles: (files: File[]) => void;
  files: File[]; // Added to satisfy parent component's props
}

type Mode = 'image' | 'pdf';

export const FileUploader: React.FC<FileUploaderProps> = ({ setFiles }) => {
  const [mode, setMode] = useState<Mode>('image');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setFiles([]); // Reset files when mode changes
  }

  return (
    <div className="mb-3">
      <div className="btn-group w-100 mb-2">
        <input type="radio" className="btn-check" name="options" id="option-image" autoComplete="off" checked={mode === 'image'} onChange={() => handleModeChange('image')} />
        <label className="btn btn-outline-primary" htmlFor="option-image">Image</label>

        <input type="radio" className="btn-check" name="options" id="option-pdf" autoComplete="off" checked={mode === 'pdf'} onChange={() => handleModeChange('pdf')} />
        <label className="btn btn-outline-primary" htmlFor="option-pdf">PDF</label>
      </div>

      <label htmlFor="formFile" className="form-label">
        {mode === 'image' ? 'Upload Images (multiple allowed)' : 'Upload PDF (single file)'}
      </label>
      <input
        className="form-control"
        type="file"
        id="formFile"
        accept={mode === 'image' ? 'image/*' : '.pdf'}
        multiple={mode === 'image'}
        onChange={handleFileChange}
        key={mode} // Add key to reset input when mode changes
      />
    </div>
  );
};