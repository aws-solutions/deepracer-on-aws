// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarLogAssetType } from '@deepracer-indy/typescript-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen, waitFor } from '#utils/testUtils';

import DeleteCarLogAssetsModal from '../DeleteCarLogAssetsModal';

const mockDeleteCarLogAsset = vi.fn();
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
  useDeleteCarLogAssetMutation: () => [mockDeleteCarLogAsset, { isLoading: false }],
}));

describe('<DeleteCarLogAssetsModal />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteCarLogAsset.mockReturnValueOnce({ unwrap: () => Promise.resolve({}) });
    mockDeleteCarLogAsset.mockReturnValueOnce({ unwrap: () => Promise.reject({ error: 'Denied' }) });
  });

  it('reports partial delete results', async () => {
    render(
      <DeleteCarLogAssetsModal
        assets={[
          {
            assetId: 'asset-001',
            profileId: 'profile-001',
            type: CarLogAssetType.VIDEO,
            filename: 'run-001.mp4',
            uploadedAt: new Date('2026-01-01T10:00:00Z'),
          },
          {
            assetId: 'asset-002',
            profileId: 'profile-001',
            type: CarLogAssetType.BAG_SQLITE,
            filename: 'run-001.db3.tar.gz',
            uploadedAt: new Date('2026-01-01T10:00:00Z'),
          },
        ]}
        isVisible
        onDismiss={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockDeleteCarLogAsset).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText('Some assets were deleted successfully, but others failed.')).toBeInTheDocument();
    expect(screen.getByText(/Denied/)).toBeInTheDocument();
  });
});
