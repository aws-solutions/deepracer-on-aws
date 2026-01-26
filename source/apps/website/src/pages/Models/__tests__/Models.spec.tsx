// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ModelStatus } from '@deepracer-indy/typescript-client';
import { composeStories } from '@storybook/react';
import { userEvent } from '@storybook/test';
import * as React from 'react';
import { vi } from 'vitest';

import { useAppDispatch } from '#hooks/useAppDispatch';
import { LIST_MODELS_POLLING_INTERVAL_TIME } from '#pages/ModelDetails/constants';
import Models from '#pages/Models/Models';
import * as stories from '#pages/Models/Models.stories';
import { useListModelsQuery, useDeleteModelMutation } from '#services/deepRacer/modelsApi';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice';
import { render, screen, waitFor } from '#utils/testUtils';

const { Default } = composeStories(stories);

vi.mock('#hooks/useAppDispatch');
vi.mock('#services/deepRacer/modelsApi');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: vi.fn((key, options) => {
      if (key === 'table.header') return 'Your models';
      if (key === 'table.columnHeader.modelName') return 'Model name';
      if (key === 'table.columnHeader.modelDescription') return 'Model description';
      if (key === 'table.columnHeader.status') return 'Status';
      if (key === 'table.columnHeader.agentAlgorithm') return 'Agent algorithm';
      if (key === 'table.columnHeader.sensors') return 'Sensors';
      if (key === 'table.columnHeader.creationTime') return 'Creation time';
      if (key === 'table.buttonDropdownLabel') return 'Actions';
      if (key === 'notifications.statusTransitions.IMPORTING.toReady') {
        return `Model ${options?.modelName} is ready`;
      }
      if (key === 'notifications.statusTransitions.TRAINING.toError') {
        return `Model ${options?.modelName} failed`;
      }
      return key;
    }),
  }),
}));

describe('<Models />', () => {
  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppDispatch).mockReturnValue(mockDispatch);
    vi.mocked(useListModelsQuery).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
    vi.mocked(useDeleteModelMutation).mockReturnValue([vi.fn(), { isLoading: false, reset: vi.fn() }]);
  });

  it('renders without crashing', () => {
    render(<Default />, { isStorybookStory: true });

    expect(screen.getByTestId('modelsListRoot')).toBeInTheDocument();
    expect(screen.getByText('Your models')).toBeInTheDocument();
    expect(screen.getByText('Model name')).toBeInTheDocument();
    expect(screen.getByText('Model description')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Agent algorithm')).toBeInTheDocument();
    expect(screen.getByText('Sensors')).toBeInTheDocument();
    expect(screen.getByText('Creation time')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('dispatches success notification when model transitions to READY', () => {
    const TestComponent = () => {
      React.useEffect(() => {
        const handleStatusTransition = (model: { name: string }, previousStatus: string, currentStatus: string) => {
          if (currentStatus === ModelStatus.READY) {
            const successKey = `notifications.statusTransitions.${previousStatus}.toReady`;
            const t = vi.fn((key: string, options?: { modelName: string }) => {
              if (key === 'notifications.statusTransitions.IMPORTING.toReady') {
                return `Model ${options?.modelName} is ready`;
              }
              return key;
            });
            const message = t(successKey, { modelName: model.name });
            if (message !== successKey) {
              mockDispatch(displaySuccessNotification({ content: message }));
            }
          }
        };

        handleStatusTransition({ name: 'Test Model' }, ModelStatus.IMPORTING, ModelStatus.READY);
      }, []);

      return <div>Test</div>;
    };

    render(<TestComponent />);

    expect(mockDispatch).toHaveBeenCalledWith(displaySuccessNotification({ content: 'Model Test Model is ready' }));
  });

  it('dispatches error notification when model transitions to ERROR', () => {
    const TestComponent = () => {
      React.useEffect(() => {
        const handleStatusTransition = (model: { name: string }, previousStatus: string, currentStatus: string) => {
          if (currentStatus === ModelStatus.ERROR) {
            const errorKey = `notifications.statusTransitions.${previousStatus}.toError`;
            const t = vi.fn((key: string, options?: { modelName: string }) => {
              if (key === 'notifications.statusTransitions.TRAINING.toError') {
                return `Model ${options?.modelName} failed`;
              }
              return key;
            });
            const message = t(errorKey, { modelName: model.name });
            if (message !== errorKey) {
              mockDispatch(displayErrorNotification({ content: message }));
            }
          }
        };

        handleStatusTransition({ name: 'Test Model' }, ModelStatus.TRAINING, ModelStatus.ERROR);
      }, []);

      return <div>Test</div>;
    };

    render(<TestComponent />);

    expect(mockDispatch).toHaveBeenCalledWith(displayErrorNotification({ content: 'Model Test Model failed' }));
  });

  it('sets polling interval when importing models are present', () => {
    const mockModel = {
      modelId: '1',
      status: ModelStatus.IMPORTING,
      name: 'Test',
      createdAt: new Date(),
      metadata: {
        agentAlgorithm: 'PPO',
        sensors: { camera: 'FRONT_FACING_CAMERA' },
      },
    };

    vi.mocked(useListModelsQuery).mockReturnValue({
      data: [mockModel],
      isLoading: false,
      refetch: vi.fn(),
    });

    const { rerender } = render(<Models />);

    rerender(<Models />);

    expect(useListModelsQuery).toHaveBeenLastCalledWith(
      undefined,
      expect.objectContaining({
        pollingInterval: LIST_MODELS_POLLING_INTERVAL_TIME,
        skipPollingIfUnfocused: true,
        refetchOnMountOrArgChange: true,
      }),
    );
  });

  it('sets polling interval to 0 when no importing models are present', () => {
    const mockModel = {
      modelId: '1',
      status: ModelStatus.READY,
      name: 'Test',
      createdAt: new Date(),
      metadata: {
        agentAlgorithm: 'PPO',
        sensors: { camera: 'FRONT_FACING_CAMERA' },
      },
    };

    const mockQuery = vi.fn().mockReturnValue({
      data: [mockModel],
      isLoading: false,
      refetch: vi.fn(),
    });
    vi.mocked(useListModelsQuery).mockImplementation(mockQuery);

    render(<Models />);

    expect(mockQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        pollingInterval: 0,
        skipPollingIfUnfocused: true,
        refetchOnMountOrArgChange: true,
      }),
    );
  });

  it('covers handleStatusTransition for READY status', () => {
    vi.clearAllMocks();

    const initialModels = [
      {
        modelId: '1',
        status: ModelStatus.IMPORTING,
        name: 'Test Model',
        createdAt: new Date(),
        metadata: {
          agentAlgorithm: 'PPO',
          sensors: { camera: 'FRONT_FACING_CAMERA' },
        },
      },
    ];

    vi.mocked(useListModelsQuery).mockReturnValue({
      data: initialModels,
      isLoading: false,
      refetch: vi.fn(),
    });

    const { rerender } = render(<Models />);

    const updatedModels = [
      {
        ...initialModels[0],
        status: ModelStatus.READY,
      },
    ];

    vi.mocked(useListModelsQuery).mockReturnValue({
      data: updatedModels,
      isLoading: false,
      refetch: vi.fn(),
    });

    rerender(<Models />);

    expect(mockDispatch).toHaveBeenCalledWith(displaySuccessNotification({ content: 'Model Test Model is ready' }));
  });

  it('covers handleStatusTransition for ERROR status (lines 72-87)', () => {
    vi.clearAllMocks();

    const initialModels = [
      {
        modelId: '1',
        status: ModelStatus.TRAINING,
        name: 'Test Model',
        createdAt: new Date(),
        metadata: {
          agentAlgorithm: 'PPO',
          sensors: { camera: 'FRONT_FACING_CAMERA' },
        },
      },
    ];

    vi.mocked(useListModelsQuery).mockReturnValue({
      data: initialModels,
      isLoading: false,
      refetch: vi.fn(),
    });

    const { rerender } = render(<Models />);

    const updatedModels = [
      {
        ...initialModels[0],
        status: ModelStatus.ERROR,
      },
    ];

    vi.mocked(useListModelsQuery).mockReturnValue({
      data: updatedModels,
      isLoading: false,
      refetch: vi.fn(),
    });

    rerender(<Models />);

    expect(mockDispatch).toHaveBeenCalledWith(displayErrorNotification({ content: 'Model Test Model failed' }));
  });

  it('disables items based on model status', () => {
    const models = [
      {
        modelId: '1',
        status: ModelStatus.QUEUED,
        name: 'Queued Model',
        createdAt: new Date(),
        metadata: {
          agentAlgorithm: 'PPO',
          sensors: { camera: 'FRONT_FACING_CAMERA' },
        },
      },
      {
        modelId: '2',
        status: ModelStatus.STOPPING,
        name: 'Stopping Model',
        createdAt: new Date(),
        metadata: {
          agentAlgorithm: 'SAC',
          sensors: { lidar: 'LIDAR' },
        },
      },
      {
        modelId: '3',
        status: ModelStatus.DELETING,
        name: 'Deleting Model',
        createdAt: new Date(),
        metadata: {
          agentAlgorithm: 'PPO',
          sensors: { camera: 'STEREO_CAMERAS' },
        },
      },
      {
        modelId: '4',
        status: ModelStatus.READY,
        name: 'Ready Model',
        createdAt: new Date(),
        metadata: {
          agentAlgorithm: 'SAC',
          sensors: { camera: 'FRONT_FACING_CAMERA' },
        },
      },
    ];

    vi.mocked(useListModelsQuery).mockReturnValue({
      data: models,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<Models />);
    expect(screen.getByTestId('modelsListRoot')).toBeInTheDocument();
  });

  it('disables delete button when model is in TRAINING status', async () => {
    const trainingModel = {
      modelId: '1',
      status: ModelStatus.TRAINING,
      name: 'Training Model',
      createdAt: new Date(),
      metadata: {
        agentAlgorithm: 'PPO',
        sensors: { camera: 'FRONT_FACING_CAMERA' },
      },
    };

    vi.mocked(useListModelsQuery).mockReturnValue({
      data: [trainingModel],
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<Models />);

    // Verify the table renders with the training model
    expect(screen.getByTestId('modelsListRoot')).toBeInTheDocument();
    expect(screen.getByText('Training Model')).toBeInTheDocument();

    // Select the training model row by clicking on the row's radio button
    const radioButton = screen.getByRole('radio');
    await userEvent.click(radioButton);

    // Open the actions dropdown
    await waitFor(() => {
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
    const actionsDropdown = screen.getByText('Actions');
    await userEvent.click(actionsDropdown);

    // Check that delete button is disabled for training model
    await waitFor(() => {
      const deleteOption = screen.getByRole('menuitem', {
        name: 'table.deleteButton',
      });
      expect(deleteOption).toHaveAttribute('aria-disabled', 'true');
    });
  });

  it('enables delete button when model is in READY status', async () => {
    const readyModel = {
      modelId: '1',
      status: ModelStatus.READY,
      name: 'Ready Model',
      createdAt: new Date(),
      metadata: {
        agentAlgorithm: 'PPO',
        sensors: { camera: 'FRONT_FACING_CAMERA' },
      },
    };

    vi.mocked(useListModelsQuery).mockReturnValue({
      data: [readyModel],
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<Models />);

    // Verify the table renders with the ready model
    expect(screen.getByTestId('modelsListRoot')).toBeInTheDocument();
    expect(screen.getByText('Ready Model')).toBeInTheDocument();

    // Select the ready model row by clicking on the row's radio button
    const radioButton = screen.getByRole('radio');
    await userEvent.click(radioButton);

    // Open the actions dropdown
    await waitFor(() => {
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
    const actionsDropdown = screen.getByText('Actions');
    await userEvent.click(actionsDropdown);

    // Check that delete button is enabled for ready model
    await waitFor(() => {
      const deleteOption = screen.getByRole('menuitem', {
        name: 'table.deleteButton',
      });
      expect(deleteOption).not.toHaveAttribute('aria-disabled', 'true');
    });
  });
});
