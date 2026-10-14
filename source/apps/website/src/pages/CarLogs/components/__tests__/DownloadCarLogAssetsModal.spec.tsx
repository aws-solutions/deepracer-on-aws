// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarLogAssetType } from '@deepracer-indy/typescript-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen, waitFor } from '#utils/testUtils';

import DownloadCarLogAssetsModal from '../DownloadCarLogAssetsModal';

const mockGetCarLogAssetUrls = vi.fn();
const mockDispatch = vi.fn();

vi.mock('#hooks/useAppDispatch.js', () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock('#store/notifications/notificationsSlice.js', () => ({
  displayErrorNotification: vi.fn((args) => args),
  displaySuccessNotification: vi.fn((args) => args),
  displayWarningNotification: vi.fn((args) => args),
}));

vi.mock('#services/deepRacer/carLogsApi.js', () => ({
  useGetCarLogAssetUrlsMutation: () => [mockGetCarLogAssetUrls, { isLoading: false }],
}));

describe('<DownloadCarLogAssetsModal />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['video'])) }) as typeof fetch;
    global.URL.createObjectURL = vi.fn(() => 'blob:download');
    global.URL.revokeObjectURL = vi.fn();
    mockGetCarLogAssetUrls.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          urls: [{ assetId: 'asset-001', url: 'https://example.com/download', filename: 'run-001.mp4' }],
          errors: [],
        }),
    });
  });

  it('downloads the selected assets sequentially', async () => {
    render(
      <DownloadCarLogAssetsModal
        assets={[
          {
            assetId: 'asset-001',
            profileId: 'profile-001',
            type: CarLogAssetType.VIDEO,
            filename: 'run-001.mp4',
            uploadedAt: new Date('2026-01-01T10:00:00Z'),
          },
        ]}
        isVisible
        onDismiss={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => {
      expect(mockGetCarLogAssetUrls).toHaveBeenCalled();
    });
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/download');
    expect(screen.getByText('All selected assets were downloaded.')).toBeInTheDocument();
  });
});
