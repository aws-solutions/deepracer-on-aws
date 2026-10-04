// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarLogAssetType, CarLogFetchStatus, UserGroups } from '@deepracer-indy/typescript-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, waitFor } from '#utils/testUtils';

import CarLogs from '../CarLogs';

const mockGetUserGroups = vi.fn();
const mockUseListCarLogAssetsQuery = vi.fn();
const mockUseListCarLogFetchesQuery = vi.fn();

vi.mock('#utils/authUtils.js', () => ({
  getUserGroups: (...args: unknown[]) => mockGetUserGroups(...args),
}));

vi.mock('#hooks/useCarLogsMqtt.js', () => ({
  useCarLogsMqtt: vi.fn(),
}));

vi.mock('#services/deepRacer/carLogsApi.js', () => ({
  useListCarLogAssetsQuery: (...args: unknown[]) => mockUseListCarLogAssetsQuery(...args),
  useListCarLogFetchesQuery: (...args: unknown[]) => mockUseListCarLogFetchesQuery(...args),
}));

const mockAssets = [
  {
    assetId: 'asset-001',
    profileId: 'profile-001',
    type: CarLogAssetType.VIDEO,
    filename: 'run-001.mp4',
    uploadedAt: new Date('2026-01-01T10:00:00Z'),
  },
];

const mockJobs = [
  {
    jobId: 'job-001',
    profileId: 'profile-001',
    status: CarLogFetchStatus.PROCESSING,
    createdAt: new Date('2026-01-01T10:00:00Z'),
  },
];

describe('<CarLogs />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseListCarLogAssetsQuery.mockReturnValue({
      data: mockAssets,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mockUseListCarLogFetchesQuery.mockReturnValue({
      data: mockJobs,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  it('shows assets and processing tabs for managers', async () => {
    mockGetUserGroups.mockResolvedValue([UserGroups.ADMIN]);

    render(<CarLogs />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Assets' })).toBeInTheDocument();
    });

    expect(screen.getByRole('tab', { name: 'Processing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload archive' })).toBeInTheDocument();
  });

  it('shows only the assets tab for commentators', async () => {
    mockGetUserGroups.mockResolvedValue([UserGroups.COMMENTATORS]);

    render(<CarLogs />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Assets' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('tab', { name: 'Processing' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});
