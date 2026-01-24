// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';
import { userEvent } from '@storybook/test';

import i18n from '#i18n';
import { POLLING_INTERVAL_TIME } from '#pages/ModelDetails/constants';
import * as ModelDetailsStories from '#pages/ModelDetails/ModelDetails.stories';
import { screen } from '#utils/testUtils';

const { ModelNotFound, ModelWithImportError, ModelQueued, ModelImporting, ...stories } =
  composeStories(ModelDetailsStories);

let mockDispatch = vi.fn();
describe('<ModelDetails />', () => {
  it('should render a model not found message for missing model', async () => {
    await ModelNotFound.run();

    expect(await screen.findByText(i18n.t('modelDetails:modelDoesNotExist'))).toBeInTheDocument();
  });

  it.each(Object.entries(stories))('should render %s story without crashing', async (_, Story) => {
    await Story.run();

    expect(await screen.findByRole('tab', { name: i18n.t('modelDetails:tabs.training') })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: i18n.t('modelDetails:tabs.evaluation') })).toBeInTheDocument();
  });

  it('should display import error message in popover when model has error status', async () => {
    await ModelWithImportError.run();

    const errorStatus = await screen.findByText(i18n.t('common:modelStatus.ERROR'));
    expect(errorStatus).toBeInTheDocument();

    await userEvent.click(errorStatus);

    expect(await screen.findByText('Import Error')).toBeInTheDocument();
    expect(await screen.findByText('Model Validation Failed: No checkpoint files')).toBeInTheDocument();
  });

  it('should display pending status indicator for QUEUED models', async () => {
    await ModelQueued.run();
    expect(await screen.findByText(i18n.t('common:modelStatus.QUEUED'))).toBeInTheDocument();
  });

  it('should display info status indicator for IMPORTING models', async () => {
    await ModelImporting.run();
    expect(await screen.findByText(i18n.t('common:modelStatus.IMPORTING'))).toBeInTheDocument();
  });
});

describe('ButtonDropdown actions', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockDispatch = vi.fn();
    vi.clearAllMocks();
    vi.mock('#hooks/useAppDispatch', () => ({
      useAppDispatch: () => mockDispatch,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should disable download physical model based on model status', async () => {
    await stories.TrainingInProgress.run();

    const actionsDropdown = await screen.findByText(i18n.t('modelDetails:buttons.actions'));
    await userEvent.click(actionsDropdown);

    const downloadOption = screen.getByRole('menuitem', {
      name: i18n.t('modelDetails:buttons.downloadModel'),
    });
    expect(downloadOption).toHaveAttribute('aria-disabled', 'true');
  });

  it('should enable download physical model based on model status', async () => {
    await stories.TrainingCompleted.run();

    const actionsDropdown = await screen.findByText(i18n.t('modelDetails:buttons.actions'));
    await userEvent.click(actionsDropdown);

    const downloadOption = screen.getByRole('menuitem', {
      name: i18n.t('modelDetails:buttons.downloadModel'),
    });
    expect(downloadOption).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('should download physical model when model is completed', async () => {
    const mockHref = 'https://example.com/model.zip';
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: mockHref },
    });

    await stories.TrainingCompletedAndReadyForDownload.run();

    const actionsDropdown = await screen.findByText(i18n.t('modelDetails:buttons.actions'));
    await userEvent.click(actionsDropdown);

    const downloadOption = screen.getByRole('menuitem', {
      name: i18n.t('modelDetails:buttons.downloadModel'),
    });
    await userEvent.click(downloadOption);

    expect(downloadOption).not.toHaveAttribute('aria-disabled', 'true');
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          content: expect.stringContaining(
            i18n.t('modelDetails:notifications.physicalDownloadModelSuccess', { modelName: 'testModel' }),
          ),
        }),
      }),
    );
    expect(window.location.href).toBe(mockHref);
  });

  it('should disable download virtual model based on model status', async () => {
    await stories.TrainingInProgress.run();

    const actionsDropdown = await screen.findByText(i18n.t('modelDetails:buttons.actions'));
    await userEvent.click(actionsDropdown);

    const downloadOption = screen.getByRole('menuitem', {
      name: i18n.t('modelDetails:buttons.downloadVirtualModel'),
    });
    expect(downloadOption).toHaveAttribute('aria-disabled', 'true');
  });

  it('should handle virtual model download url click', async () => {
    const mockHref = 'https://example.com/model.zip';
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: mockHref },
    });

    await stories.TrainingCompletedAndReadyForDownload.run();

    const actionsDropdown = await screen.findByText(i18n.t('modelDetails:buttons.actions'));
    await userEvent.click(actionsDropdown);

    const downloadOption = screen.getByRole('menuitem', {
      name: i18n.t('modelDetails:buttons.downloadVirtualModel'),
    });
    await userEvent.click(downloadOption);
    expect(downloadOption).not.toHaveAttribute('aria-disabled', 'true');
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          content: expect.stringContaining(
            i18n.t('modelDetails:notifications.virtualDownloadModelSuccess', { modelName: 'testModel' }),
          ),
        }),
      }),
    );
    expect(window.location.href).toBe(mockHref);
  });

  it('should handle virtual model queued status', async () => {
    await stories.TrainingCompletedAndModelQueued.run();
    const actionsDropdown = await screen.findByText(i18n.t('modelDetails:buttons.actions'));
    await userEvent.click(actionsDropdown);

    const downloadOption = screen.getByRole('menuitem', {
      name: i18n.t('modelDetails:buttons.downloadVirtualModel'),
    });
    await userEvent.click(downloadOption);
    expect(downloadOption).not.toHaveAttribute('aria-disabled', 'true');
    const lastCall = mockDispatch.mock.calls[mockDispatch.mock.calls.length - 1];
    expect(lastCall[0]).toEqual({
      payload: {
        content: i18n.t('modelDetails:notifications.virtualDownloadModelPackaging', { modelName: 'testModel' }),
      },
      type: 'notifications/displayInfoNotification',
    });
  });

  it('should handle polling', async () => {
    await stories.TrainingCompletedAndModelQueued.run();

    const actionsDropdown = await screen.findByText(i18n.t('modelDetails:buttons.actions'));
    await userEvent.click(actionsDropdown);

    const downloadOption = screen.getByRole('menuitem', {
      name: i18n.t('modelDetails:buttons.downloadVirtualModel'),
    });
    await userEvent.click(downloadOption);
    vi.advanceTimersByTime(POLLING_INTERVAL_TIME * 2);

    const lastCall = mockDispatch.mock.calls[mockDispatch.mock.calls.length - 1];
    expect(lastCall[0]).toEqual({
      payload: {
        content: i18n.t('modelDetails:notifications.virtualDownloadModelPackaging', { modelName: 'testModel' }),
      },
      type: 'notifications/displayInfoNotification',
    });
  });
});

describe('Submit Model button', () => {
  it('should be disabled for non-ready models', async () => {
    await stories.TrainingInProgress.run();

    const buttonText = await screen.findByText(i18n.t('modelDetails:buttons.submitModel'));
    const submitButton = buttonText.closest('button');

    expect(submitButton).toBeDisabled();
  });

  it('should be enabled for ready models', async () => {
    await stories.TrainingCompleted.run();

    const buttonText = await screen.findByText(i18n.t('modelDetails:buttons.submitModel'));
    const submitButton = buttonText.closest('button');

    expect(submitButton).not.toBeDisabled();
  });
});
