// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { FileUploadZone } from '#pages/ImportPhysicalModel/components/FileUploadZone';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'modelInfo.chooseFile': 'Choose file',
        'modelInfo.constraint': '.tar.gz files up to 500 MB',
        description: 'Drag and drop or click to upload',
        'progress.uploading': 'Uploading',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('<FileUploadZone />', () => {
  const mockOnFileChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the drop zone with choose file button when no file selected', () => {
    render(<FileUploadZone selectedFile={null} onFileChange={mockOnFileChange} uploadProgress={0} disabled={false} />);
    expect(screen.getByText('Choose file')).toBeInTheDocument();
    expect(screen.getByText('.tar.gz files up to 500 MB')).toBeInTheDocument();
  });

  it('renders file name and size when file is selected', () => {
    const file = new File(['a'.repeat(1024 * 1024 * 5)], 'my-model.tar.gz', { type: 'application/gzip' });
    render(<FileUploadZone selectedFile={file} onFileChange={mockOnFileChange} uploadProgress={0} disabled={false} />);
    expect(screen.getByText(/my-model\.tar\.gz/)).toBeInTheDocument();
  });

  it('renders progress bar when uploadProgress > 0', () => {
    const file = new File(['content'], 'model.tar.gz', { type: 'application/gzip' });
    render(<FileUploadZone selectedFile={file} onFileChange={mockOnFileChange} uploadProgress={50} disabled={false} />);
    expect(screen.getByTestId('upload-progress')).toBeInTheDocument();
  });

  it('calls onFileChange when a file is selected via input', () => {
    render(<FileUploadZone selectedFile={null} onFileChange={mockOnFileChange} uploadProgress={0} disabled={false} />);

    const file = new File(['content'], 'new-model.tar.gz', { type: 'application/gzip' });
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(mockOnFileChange).toHaveBeenCalledWith(file);
  });

  it('calls onFileChange with null when no file is selected (cancel)', () => {
    render(<FileUploadZone selectedFile={null} onFileChange={mockOnFileChange} uploadProgress={0} disabled={false} />);

    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [] } });

    expect(mockOnFileChange).toHaveBeenCalledWith(null);
  });

  it('shows error text when errorText is provided', () => {
    render(
      <FileUploadZone
        selectedFile={null}
        onFileChange={mockOnFileChange}
        uploadProgress={0}
        disabled={false}
        errorText="Invalid file type"
      />,
    );
    expect(screen.getByText('Invalid file type')).toBeInTheDocument();
  });

  describe('keyboard accessibility', () => {
    it('drop zone has role=button and is focusable', () => {
      render(
        <FileUploadZone selectedFile={null} onFileChange={mockOnFileChange} uploadProgress={0} disabled={false} />,
      );
      const dropZone = screen.getByRole('button', { name: /drag and drop/i });
      expect(dropZone.tagName).toBe('DIV');
      expect(dropZone).toHaveAttribute('tabindex', '0');
    });

    it('opens file picker on click', () => {
      render(
        <FileUploadZone selectedFile={null} onFileChange={mockOnFileChange} uploadProgress={0} disabled={false} />,
      );
      const dropZone = screen.getByRole('button', { name: /drag and drop/i });
      const fileInput = screen.getByTestId('file-input');
      const clickSpy = vi.spyOn(fileInput, 'click');

      fireEvent.click(dropZone);
      expect(clickSpy).toHaveBeenCalled();
    });

    it('opens file picker on Enter key', () => {
      render(
        <FileUploadZone selectedFile={null} onFileChange={mockOnFileChange} uploadProgress={0} disabled={false} />,
      );
      const dropZone = screen.getByRole('button', { name: /drag and drop/i });
      const fileInput = screen.getByTestId('file-input');
      const clickSpy = vi.spyOn(fileInput, 'click');

      fireEvent.keyDown(dropZone, { key: 'Enter' });
      expect(clickSpy).toHaveBeenCalled();
    });

    it('opens file picker on Space key', () => {
      render(
        <FileUploadZone selectedFile={null} onFileChange={mockOnFileChange} uploadProgress={0} disabled={false} />,
      );
      const dropZone = screen.getByRole('button', { name: /drag and drop/i });
      const fileInput = screen.getByTestId('file-input');
      const clickSpy = vi.spyOn(fileInput, 'click');

      fireEvent.keyDown(dropZone, { key: ' ' });
      expect(clickSpy).toHaveBeenCalled();
    });

    it('does not open file picker when disabled', () => {
      render(<FileUploadZone selectedFile={null} onFileChange={mockOnFileChange} uploadProgress={0} disabled={true} />);
      const dropZone = screen.getByRole('button', { name: /drag and drop/i });
      const fileInput = screen.getByTestId('file-input');
      const clickSpy = vi.spyOn(fileInput, 'click');

      fireEvent.click(dropZone);
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('does not open file picker on Enter when disabled', () => {
      render(<FileUploadZone selectedFile={null} onFileChange={mockOnFileChange} uploadProgress={0} disabled={true} />);
      const dropZone = screen.getByRole('button', { name: /drag and drop/i });
      const fileInput = screen.getByTestId('file-input');
      const clickSpy = vi.spyOn(fileInput, 'click');

      fireEvent.keyDown(dropZone, { key: 'Enter' });
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('sets tabindex=-1 when disabled', () => {
      render(<FileUploadZone selectedFile={null} onFileChange={mockOnFileChange} uploadProgress={0} disabled={true} />);
      const dropZone = screen.getByRole('button', { name: /drag and drop/i });
      expect(dropZone).toHaveAttribute('tabindex', '-1');
    });
  });
});
