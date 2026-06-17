// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AdminModel, AdminProfile, ModelStatus } from '@deepracer-indy/typescript-client';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Mock, vi } from 'vitest';

import {
  useLazyGetAdminAssetUrlQuery,
  useListAdminProfilesQuery,
  useListModelsForProfileQuery,
} from '#services/deepRacer/adminApi';
import { render } from '#utils/testUtils';

import AdminModelDownload from '../AdminModelDownload';

vi.mock('#services/deepRacer/adminApi', () => ({
  useListAdminProfilesQuery: vi.fn(),
  useListModelsForProfileQuery: vi.fn(),
  useLazyGetAdminAssetUrlQuery: vi.fn(),
}));

const MOCK_PROFILES: AdminProfile[] = [
  { profileId: 'p1', alias: 'Alice', emailAddress: 'alice@example.com', totalModelCount: 2 },
  { profileId: 'p2', alias: 'Bob', emailAddress: 'bob@example.com', totalModelCount: 1 },
  { profileId: 'p3', alias: 'Charlie', emailAddress: 'charlie@example.com', totalModelCount: 0 },
];

const MOCK_MODELS: AdminModel[] = [
  { modelId: 'm1', name: 'MyModel', status: ModelStatus.READY, createdAt: new Date('2024-01-01') },
  { modelId: 'm2', name: 'TrainingModel', status: ModelStatus.TRAINING, createdAt: new Date('2024-01-02') },
];

const mockTriggerGetUrl = vi.fn();

const defaultSetup = () => {
  (useListAdminProfilesQuery as Mock).mockReturnValue({
    data: MOCK_PROFILES,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  (useListModelsForProfileQuery as Mock).mockReturnValue({ data: MOCK_MODELS, isLoading: false, isError: false });
  (useLazyGetAdminAssetUrlQuery as Mock).mockReturnValue([mockTriggerGetUrl]);
};

describe('AdminModelDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultSetup();
  });

  it('renders profile table with profiles on load', () => {
    render(<AdminModelDownload />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('shows loading state while fetching profiles', () => {
    (useListAdminProfilesQuery as Mock).mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: true,
      isError: false,
      refetch: vi.fn(),
    });

    render(<AdminModelDownload />);

    expect(screen.getByText('Loading profiles...')).toBeInTheDocument();
  });

  it('shows error state with retry button when profile fetch fails', () => {
    const mockRefetch = vi.fn();
    (useListAdminProfilesQuery as Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });

    render(<AdminModelDownload />);

    expect(screen.getByText(/Unable to load profiles/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('filters profiles by alias (case-insensitive substring)', async () => {
    render(<AdminModelDownload />);

    const filter = screen.getByPlaceholderText('Search by racer name or email...');
    await userEvent.type(filter, 'ali');

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('filters profiles by email', async () => {
    render(<AdminModelDownload />);

    const filter = screen.getByPlaceholderText('Search by racer name or email...');
    await userEvent.type(filter, 'bob@');

    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('shows no match message when filter has no results', async () => {
    render(<AdminModelDownload />);

    const filter = screen.getByPlaceholderText('Search by racer name or email...');
    await userEvent.type(filter, 'zzznomatch');

    expect(screen.getByText('No users match the search criteria.')).toBeInTheDocument();
  });

  it('expands row and triggers model fetch on expand', async () => {
    render(<AdminModelDownload />);

    fireEvent.click(screen.getAllByText('Alice')[0]);

    await waitFor(() => {
      expect(useListModelsForProfileQuery).toHaveBeenCalledWith(expect.objectContaining({ profileId: 'p1' }));
    });
  });

  it('shows READY model with Download link and non-READY with disabled indicator', async () => {
    render(<AdminModelDownload />);

    fireEvent.click(screen.getAllByText('Alice')[0]);

    await waitFor(() => {
      expect(screen.getAllByText('MyModel').length).toBeGreaterThan(0);
    });

    // Download column header + one Download link for READY model
    expect(screen.getAllByText('Download').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Not ready')).toBeInTheDocument();
  });

  it('calls GetAdminAssetUrl and triggers download on Download link click', async () => {
    mockTriggerGetUrl.mockResolvedValue({
      data: { url: 'https://s3.example.com/model.tar.gz', filename: 'Alice_MyModel.tar.gz' },
    });

    render(<AdminModelDownload />);
    fireEvent.click(screen.getAllByText('Alice')[0]);

    // Click the first "Download" link (not the column header)
    const downloadLinks = await screen.findAllByText('Download');
    const downloadLink = downloadLinks.find((el) => el.tagName !== 'DIV') ?? downloadLinks[0];
    fireEvent.click(downloadLink);

    await waitFor(() => {
      expect(mockTriggerGetUrl).toHaveBeenCalledWith({ modelId: 'm1', profileId: 'p1' });
    });
  });

  it('shows Flashbar error when download fails', async () => {
    mockTriggerGetUrl.mockResolvedValue({ error: 'Not found' });

    render(<AdminModelDownload />);
    fireEvent.click(screen.getAllByText('Alice')[0]);

    const downloadLinks = await screen.findAllByText('Download');
    const downloadLink = downloadLinks.find((el) => el.tagName !== 'DIV') ?? downloadLinks[0];
    fireEvent.click(downloadLink);

    await waitFor(() => {
      expect(screen.getByText('Download failed. Please try again.')).toBeInTheDocument();
    });
  });

  it('shows inline error when model fetch fails', async () => {
    (useListModelsForProfileQuery as Mock).mockReturnValue({ data: undefined, isLoading: false, isError: true });

    render(<AdminModelDownload />);
    fireEvent.click(screen.getAllByText('Alice')[0]);

    await waitFor(() => {
      expect(screen.getAllByText(/Unable to load models for this user/).length).toBeGreaterThan(0);
    });
  });

  it('shows 25 items per page by default', async () => {
    // Use zero-padded aliases so alphabetical sort matches insertion order
    const manyProfiles = Array.from({ length: 30 }, (_, i) => ({
      profileId: `p${i}`,
      alias: `User${String(i).padStart(2, '0')}`,
      emailAddress: `user${i}@example.com`,
      totalModelCount: 0,
    }));
    (useListAdminProfilesQuery as Mock).mockReturnValue({
      data: manyProfiles,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<AdminModelDownload />);

    // Page 1 shows 25 items by default (User00–User24 alphabetically)
    expect(screen.getByText('User00')).toBeInTheDocument();
    expect(screen.queryByText('User25')).not.toBeInTheDocument();
  });
});
