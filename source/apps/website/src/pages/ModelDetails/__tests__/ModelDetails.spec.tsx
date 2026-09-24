// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DeleteModelCommand, RetryTrainingCommand } from '@deepracer-indy/typescript-client';
import { composeStories } from '@storybook/react';
import { userEvent, within } from '@storybook/test';

import i18n from '#i18n';
import { POLLING_INTERVAL_TIME } from '#pages/ModelDetails/constants';
import * as ModelDetailsStories from '#pages/ModelDetails/ModelDetails.stories';
import { mockDeepRacerClient, screen, waitFor } from '#utils/testUtils';

let mockDispatch = vi.fn();
vi.mock('#hooks/useAppDispatch', () => ({
  useAppDispatch: () => mockDispatch,
}));

const {
  ModelNotFound,
  ModelWithImportError,
  ModelQueued,
  ModelImporting,
  DeleteModalOpens,
  DeleteModelFails,
  WithSubmissionSuccess,
  PhysicalModelReady,
  PhysicalModelImporting,
  PhysicalModelError,
  ModelWaitingForCapacity,
  RetryTrainingModalOpens,
  RetryTrainingSucceeds,
  RetryTrainingStillWaiting,
  RetryTrainingFails,
  ...stories
} = composeStories(ModelDetailsStories);

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

describe('TrainingConfiguration', () => {
  it('should display minimum evaluation trials with default value when not set', async () => {
    await stories.TrainingCompleted.run();

    const label = await screen.findByText(i18n.t('modelDetails:trainingConfiguration.keyValueLabels.minEvalTrials'));
    expect(label).toBeInTheDocument();
    // The value "5" (DEFAULT_MIN_EVAL_TRIALS) should be rendered as a sibling of the label
    expect(label.closest('[class*="key-value"]')?.textContent).toContain('5');
  });

  it('should display explicit minimum evaluation trials value when set', async () => {
    await stories.TrainingCompletedWithMinEvalTrials.run();

    const label = await screen.findByText(i18n.t('modelDetails:trainingConfiguration.keyValueLabels.minEvalTrials'));
    expect(label.closest('[class*="key-value"]')?.textContent).toContain('3');
  });
});

describe('ButtonDropdown actions', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockDispatch = vi.fn();
    vi.clearAllMocks();
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

describe('Submission success banner', () => {
  it('should show success flashbar when navigated with successMessage state', async () => {
    await WithSubmissionSuccess.run();

    expect(await screen.findByText('Model submitted successfully!')).toBeInTheDocument();
  });

  it('should not show flashbar without successMessage state', async () => {
    await stories.TrainingCompleted.run();

    expect(screen.queryByText('Model submitted successfully!')).not.toBeInTheDocument();
  });
});

describe('Delete modal', () => {
  beforeEach(() => {
    mockDeepRacerClient.reset();
    mockDispatch = vi.fn();
  });

  const getDeleteModal = () => screen.getByRole('dialog', { name: i18n.t('modelDetails:deleteModal.header') });

  it('should show the delete confirmation modal when Delete is clicked from Actions dropdown', async () => {
    await DeleteModalOpens.run();

    const modal = getDeleteModal();
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText(/permanently delete your model/)).toBeInTheDocument();
  });

  it('should close the modal without deleting when Cancel is clicked', async () => {
    await DeleteModalOpens.run();

    const modal = getDeleteModal();
    await userEvent.click(within(modal).getByText(i18n.t('modelDetails:deleteModal.cancelButton')));

    expect(modal.className).toContain('hidden');
    expect(mockDeepRacerClient.commandCalls(DeleteModelCommand)).toHaveLength(0);
  });

  it('should close the modal and delete the model when Delete is clicked', async () => {
    await DeleteModalOpens.run();

    const modal = getDeleteModal();
    await userEvent.click(within(modal).getByText(i18n.t('modelDetails:deleteModal.deleteButton')));

    await waitFor(() => expect(mockDeepRacerClient.commandCalls(DeleteModelCommand)).toHaveLength(1));
  });

  it('should close the modal and dispatch an error notification when delete fails', async () => {
    await DeleteModelFails.run();

    const modal = getDeleteModal();
    await userEvent.click(within(modal).getByText(i18n.t('modelDetails:deleteModal.deleteButton')));

    expect(modal.className).toContain('hidden');
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          content: expect.stringContaining('Failed to delete model'),
        }),
      }),
    );
  });
});

describe('Physical model conditionals', () => {
  it('should show Physical badge for physical model', async () => {
    await PhysicalModelReady.run();
    expect(await screen.findByText('Physical')).toBeInTheDocument();
  });

  it('should hide Evaluation tab for physical model', async () => {
    await PhysicalModelReady.run();
    expect(await screen.findByRole('tab', { name: i18n.t('modelDetails:tabs.training') })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: i18n.t('modelDetails:tabs.evaluation') })).not.toBeInTheDocument();
  });

  it('should render importing state for physical model', async () => {
    await PhysicalModelImporting.run();
    expect(await screen.findByText(i18n.t('common:modelStatus.IMPORTING'))).toBeInTheDocument();
  });

  it('should render error state for physical model', async () => {
    await PhysicalModelError.run();
    expect(await screen.findByText(i18n.t('common:modelStatus.ERROR'))).toBeInTheDocument();
  });
});

describe('WAITING_FOR_CAPACITY and Retry training', () => {
  beforeEach(() => {
    mockDeepRacerClient.reset();
    mockDispatch = vi.fn();
  });

  it('should display warning status and the capacity-waiting alert with the status message', async () => {
    await ModelWaitingForCapacity.run();

    expect((await screen.findAllByText(i18n.t('common:modelStatus.WAITING_FOR_CAPACITY'))).length).toBeGreaterThan(0);
    expect(await screen.findByText(i18n.t('modelDetails:capacityWaiting.header'))).toBeInTheDocument();
    expect(screen.getByText('Training capacity is not available. Please try again later.')).toBeInTheDocument();
  });

  it('should show the Retry training button only for a waiting model', async () => {
    await ModelWaitingForCapacity.run();

    // Two matches: the header action button (gated by isWaitingForCapacity) plus the modal's
    // always-mounted confirm button. A ready model (below) has only the latter.
    const buttons = await screen.findAllByRole('button', { name: i18n.t('modelDetails:buttons.retryTraining') });
    expect(buttons.length).toBe(2);
  });

  it('should not show the Retry training button for a ready model', async () => {
    await stories.TrainingCompleted.run();

    // Only the retry-training Modal's always-mounted (hidden) confirm button remains; the header
    // action button is gated by isWaitingForCapacity and must not render for a ready model.
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: i18n.t('modelDetails:buttons.retryTraining') })).toHaveLength(1);
    });
  });

  it('should open the retry-training confirmation modal when Retry training is clicked', async () => {
    await RetryTrainingModalOpens.run();

    const modal = screen.getByRole('dialog', { name: i18n.t('modelDetails:retryTrainingModal.header') });
    expect(modal).toBeInTheDocument();
  });

  it('should close the modal without retrying when Cancel is clicked', async () => {
    await RetryTrainingModalOpens.run();

    const modal = screen.getByRole('dialog', { name: i18n.t('modelDetails:retryTrainingModal.header') });
    await userEvent.click(within(modal).getByText(i18n.t('modelDetails:retryTrainingModal.cancelButton')));

    expect(modal.className).toContain('hidden');
    expect(mockDeepRacerClient.commandCalls(RetryTrainingCommand)).toHaveLength(0);
  });

  it('should dispatch a success notification and close the modal when retry queues the job', async () => {
    await RetryTrainingSucceeds.run();

    const modal = screen.getByRole('dialog', { name: i18n.t('modelDetails:retryTrainingModal.header') });
    await userEvent.click(
      within(modal).getByRole('button', { name: i18n.t('modelDetails:retryTrainingModal.confirmButton') }),
    );

    await waitFor(() => expect(mockDeepRacerClient.commandCalls(RetryTrainingCommand)).toHaveLength(1));
    expect(modal.className).toContain('hidden');
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'notifications/displaySuccessNotification',
        payload: expect.objectContaining({ content: 'Training job dispatched successfully.' }),
      }),
    );
  });

  it('should dispatch an info notification when retry reports capacity is still unavailable', async () => {
    await RetryTrainingStillWaiting.run();

    const modal = screen.getByRole('dialog', { name: i18n.t('modelDetails:retryTrainingModal.header') });
    await userEvent.click(
      within(modal).getByRole('button', { name: i18n.t('modelDetails:retryTrainingModal.confirmButton') }),
    );

    await waitFor(() => expect(mockDeepRacerClient.commandCalls(RetryTrainingCommand)).toHaveLength(1));
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'notifications/displayInfoNotification',
        payload: expect.objectContaining({ content: 'Training capacity is still not available.' }),
      }),
    );
  });

  it('should dispatch an error notification when the retry request fails', async () => {
    await RetryTrainingFails.run();

    const modal = screen.getByRole('dialog', { name: i18n.t('modelDetails:retryTrainingModal.header') });
    await userEvent.click(
      within(modal).getByRole('button', { name: i18n.t('modelDetails:retryTrainingModal.confirmButton') }),
    );

    await waitFor(() => expect(mockDeepRacerClient.commandCalls(RetryTrainingCommand)).toHaveLength(1));
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'notifications/displayErrorNotification',
        payload: expect.objectContaining({ content: i18n.t('modelDetails:notifications.retryTrainingError') }),
      }),
    );
  });
});
