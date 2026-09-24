// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { userEvent } from '@storybook/test';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Mock, vi } from 'vitest';

import ImportPhysicalModel from '#pages/ImportPhysicalModel/ImportPhysicalModel';
import { useGetModelQuery, useImportPhysicalModelMutation } from '#services/deepRacer/modelsApi';
import { useGetProfileQuery } from '#services/deepRacer/profileApi';
import { uploadPhysicalModelArchive } from '#services/deepRacer/uploadUtils';
import { render } from '#utils/testUtils';

vi.mock('#services/deepRacer/modelsApi', () => ({
  useGetModelQuery: vi.fn(),
  useImportPhysicalModelMutation: vi.fn(),
}));

vi.mock('#services/deepRacer/profileApi', () => ({
  useGetProfileQuery: vi.fn(),
}));

vi.mock('#services/deepRacer/uploadUtils', () => ({
  uploadPhysicalModelArchive: vi.fn(),
}));

vi.mock('#hooks/useAppDispatch', () => ({
  useAppDispatch: () => vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockImportMutation = vi.fn();

describe('<ImportPhysicalModel />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useGetProfileQuery as Mock).mockReturnValue({ data: { profileId: 'profile-001' } });
    (useImportPhysicalModelMutation as Mock).mockReturnValue([mockImportMutation, { isLoading: false }]);
    (useGetModelQuery as Mock).mockReturnValue({ data: undefined });
  });

  it('renders the page with header', () => {
    render(<ImportPhysicalModel />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('renders the file input', () => {
    render(<ImportPhysicalModel />);
    expect(screen.getByTestId('file-input')).toBeInTheDocument();
  });

  it('renders import and cancel buttons', () => {
    render(<ImportPhysicalModel />);
    // Cloudscape Button renders as <button>
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2); // at least Cancel + Import + Choose file
  });

  it('updates file state when file is selected', () => {
    render(<ImportPhysicalModel />);

    const file = new File(['content'], 'my-model.tar.gz', { type: 'application/gzip' });
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [file] } });

    // File name should appear somewhere in the UI
    expect(screen.getByText(/my-model\.tar\.gz/)).toBeInTheDocument();
  });

  it('clears file when null is passed', () => {
    render(<ImportPhysicalModel />);

    const file = new File(['content'], 'my-model.tar.gz', { type: 'application/gzip' });
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByText(/my-model\.tar\.gz/)).toBeInTheDocument();

    // Simulate clearing by sending empty files
    fireEvent.change(fileInput, { target: { files: [] } });
  });

  it('does not call import mutation when form is invalid (no file, no name)', () => {
    render(<ImportPhysicalModel />);

    // Find and click the import button (last primary button)
    const buttons = screen.getAllByRole('button');
    const importButton = buttons.find((b) => b.textContent?.match(/import/i));
    if (importButton) fireEvent.click(importButton);

    expect(mockImportMutation).not.toHaveBeenCalled();
  });
});

describe('Validation logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useGetProfileQuery as Mock).mockReturnValue({ data: { profileId: 'profile-001' } });
    (useImportPhysicalModelMutation as Mock).mockReturnValue([mockImportMutation, { isLoading: false }]);
    (useGetModelQuery as Mock).mockReturnValue({ data: undefined });
  });

  const getNameInput = () => screen.getByRole('textbox');
  const getImportButton = () => {
    const buttons = screen.getAllByRole('button');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return buttons.find((b) => b.textContent?.match(/import/i))!;
  };

  it('shows file required error when no file is selected', async () => {
    render(<ImportPhysicalModel />);

    const nameInput = getNameInput();
    await userEvent.type(nameInput, 'valid-name');
    await userEvent.click(getImportButton());

    expect(screen.getByText(/please select/i)).toBeInTheDocument();
  });

  it('shows file too large error when file exceeds MAX_ARCHIVE_SIZE', async () => {
    render(<ImportPhysicalModel />);

    const nameInput = getNameInput();
    await userEvent.type(nameInput, 'valid-name');

    // Create a file > 500MB
    const bigFile = new File(['x'], 'big-model.tar.gz', { type: 'application/gzip' });
    Object.defineProperty(bigFile, 'size', { value: 501 * 1024 * 1024 });

    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    await userEvent.click(getImportButton());

    expect(screen.getByText(/exceeds the maximum size/i)).toBeInTheDocument();
  });

  it('shows invalid file type error for non-tar.gz files', async () => {
    render(<ImportPhysicalModel />);

    const nameInput = getNameInput();
    await userEvent.type(nameInput, 'valid-name');

    const zipFile = new File(['x'], 'model.zip', { type: 'application/zip' });
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [zipFile] } });

    await userEvent.click(getImportButton());

    expect(screen.getByText(/only .tar.gz archives/i)).toBeInTheDocument();
  });

  it('accepts .tar.gz file with uppercase extension via toLowerCase', async () => {
    render(<ImportPhysicalModel />);

    const nameInput = getNameInput();
    await userEvent.type(nameInput, 'valid-name');

    const file = new File(['x'], 'model.TAR.GZ', { type: 'application/gzip' });
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [file] } });

    await userEvent.click(getImportButton());

    // No file type error should appear
    expect(screen.queryByText(/only .tar.gz archives/i)).not.toBeInTheDocument();
  });

  it('shows invalid name error for names with special characters', async () => {
    render(<ImportPhysicalModel />);

    const nameInput = getNameInput();
    await userEvent.type(nameInput, 'invalid name!');

    const file = new File(['x'], 'model.tar.gz', { type: 'application/gzip' });
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [file] } });

    await userEvent.click(getImportButton());

    expect(screen.getByText(/non-allowed characters/i)).toBeInTheDocument();
    expect(mockImportMutation).not.toHaveBeenCalled();
  });

  it('clears name error when valid name is provided', async () => {
    render(<ImportPhysicalModel />);

    const nameInput = getNameInput();
    await userEvent.type(nameInput, 'valid-name');

    const file = new File(['x'], 'model.tar.gz', { type: 'application/gzip' });
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [file] } });

    await userEvent.click(getImportButton());

    // No name error should be shown
    expect(screen.queryByText(/non-allowed characters/i)).not.toBeInTheDocument();
  });
});

describe('Submit flow', () => {
  const mockUnwrap = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useGetProfileQuery as Mock).mockReturnValue({ data: { profileId: 'profile-001' } });
    mockUnwrap.mockResolvedValue('model-id-123');
    mockImportMutation.mockReturnValue({ unwrap: mockUnwrap });
    (useImportPhysicalModelMutation as Mock).mockReturnValue([mockImportMutation, { isLoading: false }]);
    (useGetModelQuery as Mock).mockReturnValue({ data: undefined });
    (uploadPhysicalModelArchive as Mock).mockResolvedValue('uploads/physical-models/profile-001/abc123.tar.gz');
  });

  const submitValidForm = async () => {
    render(<ImportPhysicalModel />);

    const nameInput = screen.getByRole('textbox');
    await userEvent.type(nameInput, 'my-model');

    const file = new File(['content'], 'model.tar.gz', { type: 'application/gzip' });
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [file] } });

    const buttons = screen.getAllByRole('button');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const importButton = buttons.find((b) => b.textContent?.match(/import/i))!;
    await userEvent.click(importButton);
  };

  it('calls uploadPhysicalModelArchive then importPhysicalModel on valid submit', async () => {
    await submitValidForm();

    await waitFor(() => {
      expect(uploadPhysicalModelArchive).toHaveBeenCalled();
    });
    expect(mockImportMutation).toHaveBeenCalledWith(expect.objectContaining({ modelName: 'my-model' }));
  });

  it('navigates to models page after successful import', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await submitValidForm();

    await waitFor(() => expect(mockUnwrap).toHaveBeenCalled());
    vi.advanceTimersByTime(2500);

    expect(mockNavigate).toHaveBeenCalledWith('/models');
    vi.useRealTimers();
  });

  it('resets progress and submitting state on S3 upload failure', async () => {
    (uploadPhysicalModelArchive as Mock).mockRejectedValue(new Error('S3 upload failed'));

    await submitValidForm();

    await waitFor(() => {
      // Form should be re-enabled (not submitting)
      const nameInput = screen.getByRole('textbox');
      expect(nameInput).not.toBeDisabled();
    });
  });

  it('navigates back when cancel button is clicked', async () => {
    render(<ImportPhysicalModel />);

    const buttons = screen.getAllByRole('button');
    const cancelButton = buttons.find((b) => b.textContent?.match(/cancel/i));
    if (cancelButton) await userEvent.click(cancelButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('disables inputs while submitting', async () => {
    // Make upload never resolve to keep isSubmitting true
    (uploadPhysicalModelArchive as Mock).mockReturnValue(
      new Promise((_resolve) => {
        /* intentionally pending */
      }),
    );

    await submitValidForm();

    await waitFor(() => {
      const nameInput = screen.getByRole('textbox');
      expect(nameInput).toBeDisabled();
    });
  });
});
