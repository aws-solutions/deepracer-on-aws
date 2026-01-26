// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { renderHook } from '@testing-library/react';

import { mockModel, mockModel3, mockModel4 } from '../../../constants/testConstants.js';
import { useModelDetailsNotifications } from '../useModelDetailsNotifications.js';

const mockDispatch = vi.fn();

vi.mock('#hooks/useAppDispatch', () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock('react-i18next', () => ({
  useTranslation: (namespace: string) => ({
    t: (key: string, options?: { modelName?: string }) => {
      if (namespace === 'models' && key === 'notifications.statusTransitions.IMPORTING.toReady') {
        return `Model "${options?.modelName}" imported successfully.`;
      }
      return key;
    },
  }),
}));

describe('useModelDetailsNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display import error notification when model has error status and import error message', () => {
    renderHook(() => useModelDetailsNotifications(mockModel3));

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          id: 'import-error',
          header: 'Import Error',
          content: 'Model Validation Failed: No checkpoint files',
          dismissible: true,
        }),
        type: 'notifications/displayErrorNotification',
      }),
    );
  });

  it('should display import success notification when model status changes from IMPORTING to READY', () => {
    const { rerender } = renderHook(({ model }) => useModelDetailsNotifications(model), {
      initialProps: { model: mockModel4 },
    });

    mockDispatch.mockClear();

    rerender({ model: mockModel });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          id: 'import-success',
          content: 'Model "testModel" imported successfully.',
          dismissible: true,
        }),
        type: 'notifications/displaySuccessNotification',
      }),
    );
  });

  it('should not display import success notification if previous status was not IMPORTING', () => {
    renderHook(() => useModelDetailsNotifications(mockModel));

    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'notifications/displaySuccessNotification',
      }),
    );
  });
});
