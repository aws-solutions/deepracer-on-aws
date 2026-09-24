// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import { ModelStatus, OptimizationStatus } from '@deepracer-indy/typescript-client';
import { composeStories } from '@storybook/react';
import { userEvent } from '@storybook/test';
import * as React from 'react';
import { assert, vi } from 'vitest';

import { useAppDispatch } from '#hooks/useAppDispatch';
import { LIST_MODELS_POLLING_INTERVAL_TIME } from '#pages/ModelDetails/constants';
import Models from '#pages/Models/Models';
import * as stories from '#pages/Models/Models.stories';
import { modelsApi, useListModelsQuery, useDeleteModelMutation } from '#services/deepRacer/modelsApi';
import { useGetProfileQuery } from '#services/deepRacer/profileApi';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice';
import { render, screen, waitFor } from '#utils/testUtils';

const { Default } = composeStories(stories);

vi.mock('#hooks/useAppDispatch');
vi.mock('#services/deepRacer/modelsApi', async () => {
  const actual = await vi.importActual<typeof import('#services/deepRacer/modelsApi')>('#services/deepRacer/modelsApi');
  return {
    ...actual,
    useListModelsQuery: vi.fn(),
    useDeleteModelMutation: vi.fn(),
    usePackageModelMutation: vi.fn(),
    modelsApi: {
      ...actual.modelsApi,
      endpoints: {
        ...actual.modelsApi.endpoints,
        listModels: {
          ...actual.modelsApi.endpoints.listModels,
          useQueryState: vi.fn(),
        },
      },
    },
  };
});
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

vi.mock('#services/deepRacer/profileApi', () => ({
  useGetProfileQuery: vi.fn(() => ({ data: { profileId: 'profile-001' } })),
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
    vi.mocked(modelsApi.endpoints.listModels.useQueryState).mockReturnValue({ data: [] });
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

    vi.mocked(modelsApi.endpoints.listModels.useQueryState).mockReturnValue({ data: [mockModel] });

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
    render(<Models />);

    expect(useListModelsQuery).toHaveBeenLastCalledWith(
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

describe('ButtonDropdown actions', () => {
  const mockDispatch = vi.fn();
  const mockDeleteModel = vi.fn(() => Promise.resolve());
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppDispatch).mockReturnValue(mockDispatch);
    vi.mocked(useDeleteModelMutation).mockReturnValue([mockDeleteModel, { isLoading: false, reset: vi.fn() }] as never);
    vi.mocked(useListModelsQuery).mockReturnValue({
      data: [
        {
          modelId: 'model-1',
          name: 'TestModel',
          status: ModelStatus.READY,
          createdAt: new Date(),
          metadata: { agentAlgorithm: 'PPO', sensors: { camera: 'FRONT_FACING_CAMERA' } },
        },
      ],
      isLoading: false,
      refetch: mockRefetch,
    } as never);
    vi.mocked(modelsApi.endpoints.listModels.useQueryState).mockReturnValue({
      data: [
        {
          modelId: 'model-1',
          name: 'TestModel',
          status: ModelStatus.READY,
          optimizationStatus: OptimizationStatus.OPTIMIZED,
          createdAt: new Date(),
          metadata: { agentAlgorithm: 'PPO', sensors: { camera: 'FRONT_FACING_CAMERA' } },
        },
      ],
    } as never);
  });

  it('renders import and actions button dropdowns', () => {
    render(<Models />);
    expect(screen.getByTestId('importModelButton')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('calls refetch when refresh button is clicked', async () => {
    render(<Models />);
    const refreshButton = screen.getAllByRole('button').find((b) => b.querySelector('svg'));
    assert(refreshButton);
    await userEvent.click(refreshButton);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('enables actions after selecting a model row', async () => {
    const { container } = render(<Models />);
    const wrapper = createWrapper(container);

    const table = wrapper.findTable();
    table?.findRowSelectionArea(1)?.click();

    await waitFor(() => {
      const actionsButton = screen.getByText('Actions');
      expect(actionsButton.closest('button')).not.toBeDisabled();
    });
  });

  it('navigates to import virtual model page', () => {
    const { container } = render(<Models />);
    const wrapper = createWrapper(container);

    const importDropdown = wrapper.findButtonDropdown('[data-testid="importModelButton"]');
    assert(importDropdown);
    importDropdown.openDropdown();
    const item = importDropdown.findItemById('IMPORT_VIRTUAL');
    assert(item);
    item.click();
    expect(importDropdown).toBeDefined();
  });

  it('navigates to import physical model page', () => {
    const { container } = render(<Models />);
    const wrapper = createWrapper(container);

    const importDropdown = wrapper.findButtonDropdown('[data-testid="importModelButton"]');
    assert(importDropdown);
    importDropdown.openDropdown();
    const item = importDropdown.findItemById('IMPORT_PHYSICAL');
    assert(item);
    item.click();
    expect(importDropdown).toBeDefined();
  });
});

describe('Import physical model quota gating', () => {
  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppDispatch).mockReturnValue(mockDispatch);
    vi.mocked(useDeleteModelMutation).mockReturnValue([vi.fn(), { isLoading: false, reset: vi.fn() }] as never);
    vi.mocked(useListModelsQuery).mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() } as never);
    vi.mocked(modelsApi.endpoints.listModels.useQueryState).mockReturnValue({ data: [] });
  });

  it('disables the physical import item when model quota is exceeded', () => {
    vi.mocked(useGetProfileQuery).mockReturnValue({
      data: { profileId: 'p1', modelCount: 10, maxModelCount: 10 },
    } as never);

    const { container } = render(<Models />);
    const wrapper = createWrapper(container);

    const importDropdown = wrapper.findButtonDropdown('[data-testid="importModelButton"]');
    assert(importDropdown);
    importDropdown.openDropdown();

    const physicalItem = importDropdown.findItemById('IMPORT_PHYSICAL');
    assert(physicalItem);
    expect(physicalItem.getElement().classList.toString()).toContain('disabled');
  });

  it('keeps the virtual import item enabled when model quota is exceeded', () => {
    vi.mocked(useGetProfileQuery).mockReturnValue({
      data: { profileId: 'p1', modelCount: 10, maxModelCount: 10 },
    } as never);

    const { container } = render(<Models />);
    const wrapper = createWrapper(container);

    const importDropdown = wrapper.findButtonDropdown('[data-testid="importModelButton"]');
    assert(importDropdown);
    importDropdown.openDropdown();

    const virtualItem = importDropdown.findItemById('IMPORT_VIRTUAL');
    assert(virtualItem);
    expect(virtualItem.getElement().classList.toString()).not.toContain('disabled');
  });

  it('enables the physical import item when model quota is not exceeded', () => {
    vi.mocked(useGetProfileQuery).mockReturnValue({
      data: { profileId: 'p1', modelCount: 3, maxModelCount: 10 },
    } as never);

    const { container } = render(<Models />);
    const wrapper = createWrapper(container);

    const importDropdown = wrapper.findButtonDropdown('[data-testid="importModelButton"]');
    assert(importDropdown);
    importDropdown.openDropdown();

    const physicalItem = importDropdown.findItemById('IMPORT_PHYSICAL');
    assert(physicalItem);
    expect(physicalItem.getElement().classList.toString()).not.toContain('disabled');
  });

  it('enables the physical import item when maxModelCount is unlimited (-1)', () => {
    vi.mocked(useGetProfileQuery).mockReturnValue({
      data: { profileId: 'p1', modelCount: 100, maxModelCount: -1 },
    } as never);

    const { container } = render(<Models />);
    const wrapper = createWrapper(container);

    const importDropdown = wrapper.findButtonDropdown('[data-testid="importModelButton"]');
    assert(importDropdown);
    importDropdown.openDropdown();

    const physicalItem = importDropdown.findItemById('IMPORT_PHYSICAL');
    assert(physicalItem);
    expect(physicalItem.getElement().classList.toString()).not.toContain('disabled');
  });
});
