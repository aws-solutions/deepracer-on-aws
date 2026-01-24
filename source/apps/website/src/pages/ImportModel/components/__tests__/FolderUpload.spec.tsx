// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { FolderUpload } from '../FolderUpload';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('FolderUpload', () => {
  const mockRegister = vi.fn();
  const mockOnFileChange = vi.fn();

  const defaultProps = {
    register: mockRegister,
    onFileChange: mockOnFileChange,
    selectedFolder: '',
    uploadProgress: 0,
    fileStatuses: {},
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render upload button when no upload in progress', () => {
    render(<FolderUpload {...defaultProps} />);
    expect(screen.getByText('Upload folder')).toBeInTheDocument();
  });

  it('should show selected folder when provided', () => {
    render(<FolderUpload {...defaultProps} selectedFolder="test-folder" />);
    expect(screen.getByText('Selected folder: test-folder')).toBeInTheDocument();
  });

  it('should show progress bar during upload', () => {
    render(<FolderUpload {...defaultProps} uploadProgress={50} />);
    expect(screen.getByTestId('upload-progress')).toBeInTheDocument();
    expect(screen.getByText('Uploading model files: 50%')).toBeInTheDocument();
  });

  it('should show file statuses during upload', () => {
    const fileStatuses = {
      'file1.txt': true,
      'file2.txt': false,
    };
    render(<FolderUpload {...defaultProps} uploadProgress={50} fileStatuses={fileStatuses} />);
    expect(screen.getByTestId('status-file1.txt')).toBeInTheDocument();
    expect(screen.getByTestId('status-file2.txt')).toBeInTheDocument();
  });

  it('should display error message when provided', () => {
    render(<FolderUpload {...defaultProps} errorText="Test error" />);
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('should disable the upload button when disabled prop is true', () => {
    render(<FolderUpload {...defaultProps} disabled={true} />);
    const button = screen.getByRole('button', { name: 'Upload folder' });
    expect(button).toBeDisabled();
  });

  it('should enable the upload button when disabled prop is false', () => {
    render(<FolderUpload {...defaultProps} disabled={false} />);
    const button = screen.getByRole('button', { name: 'Upload folder' });
    expect(button).not.toBeDisabled();
  });
});
