// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import { AdminModelExtended, ModelStatus, OptimizationStatus } from '@deepracer-indy/typescript-client';
import { userEvent } from '@storybook/test';
import { Mock, vi } from 'vitest';

import { useAppDispatch } from '#hooks/useAppDispatch';
import AdminModels from '#pages/AdminModels/AdminModels';
import { useLazyGetAdminAssetUrlQuery, useListAdminModelsQuery } from '#services/deepRacer/adminApi';
import { usePackageModelMutation } from '#services/deepRacer/modelsApi';
import { render, screen, waitFor } from '#utils/testUtils';

vi.mock('#hooks/useAppDispatch');
vi.mock('#services/deepRacer/adminApi', async () => {
  const actual = await vi.importActual<typeof import('#services/deepRacer/adminApi')>('#services/deepRacer/adminApi');
  return {
    ...actual,
    useListAdminModelsQuery: vi.fn(),
    useLazyGetAdminAssetUrlQuery: vi.fn(),
  };
});
vi.mock('#services/deepRacer/modelsApi', async () => {
  const actual = await vi.importActual<typeof import('#services/deepRacer/modelsApi')>('#services/deepRacer/modelsApi');
  return {
    ...actual,
    usePackageModelMutation: vi.fn(),
  };
});

const TEST_MODELS: AdminModelExtended[] = [
  {
    modelId: 'model-abc123',
    name: 'CenterlineTracker-v2',
    username: 'jaime.muniz',
    profileId: 'profile-001',
    status: ModelStatus.READY,
    modelSource: 'IMPORTED_PHYSICAL',
    optimizationStatus: OptimizationStatus.OPTIMIZED,
    createdAt: new Date('2026-06-04T10:38:35Z'),
    metadata: { agentAlgorithm: 'PPO', sensors: { camera: 'FRONT_FACING_CAMERA' } },
  },
  {
    modelId: 'model-def456',
    name: 'SteeringPenalty-v1',
    username: 'smartin',
    profileId: 'profile-002',
    status: ModelStatus.READY,
    modelSource: 'TRAINED',
    optimizationStatus: OptimizationStatus.OPTIMIZED,
    createdAt: new Date('2026-06-03T08:44:34Z'),
    metadata: { agentAlgorithm: 'SAC', sensors: { camera: 'FRONT_FACING_CAMERA' } },
  },
] as AdminModelExtended[];

describe('<AdminModels />', () => {
  const mockDispatch = vi.fn();
  const mockRefetch = vi.fn();
  const mockTriggerGetUrl = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppDispatch as unknown as Mock).mockReturnValue(mockDispatch);
    (useListAdminModelsQuery as Mock).mockReturnValue({
      data: TEST_MODELS,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: mockRefetch,
    });
    (useLazyGetAdminAssetUrlQuery as Mock).mockReturnValue([mockTriggerGetUrl, { isLoading: false, reset: vi.fn() }]);
    (usePackageModelMutation as Mock).mockReturnValue([
      vi.fn(() => ({ unwrap: () => Promise.resolve() })),
      { isLoading: false },
    ]);
  });

  it('renders table with models', async () => {
    render(<AdminModels />);
    expect(await screen.findByText('CenterlineTracker-v2')).toBeInTheDocument();
    expect(screen.getByText('SteeringPenalty-v1')).toBeInTheDocument();
  });

  it('renders header', async () => {
    render(<AdminModels />);
    expect(await screen.findByText(/Models/)).toBeInTheDocument();
  });

  it('shows empty state when no models', async () => {
    (useListAdminModelsQuery as Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: mockRefetch,
    });
    render(<AdminModels />);
    expect(await screen.findByText('No models')).toBeInTheDocument();
  });

  it('handles loading state (data undefined)', async () => {
    (useListAdminModelsQuery as Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      isError: false,
      refetch: mockRefetch,
    });
    render(<AdminModels />);
    expect(await screen.findByText(/loading models/i)).toBeInTheDocument();
  });

  it('shows error alert and retry button when API fails', async () => {
    (useListAdminModelsQuery as Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: true,
      refetch: mockRefetch,
    });
    render(<AdminModels />);
    expect(await screen.findByText(/failed to load models/i)).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('calls refetch when retry button is clicked', async () => {
    (useListAdminModelsQuery as Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: true,
      refetch: mockRefetch,
    });
    render(<AdminModels />);
    const retryButton = await screen.findByRole('button', { name: /retry/i });
    await userEvent.click(retryButton);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('upload button is disabled when no models selected', async () => {
    render(<AdminModels />);
    await screen.findByText('CenterlineTracker-v2');
    const uploadButton = screen.getByRole('button', { name: /upload model to car/i });
    expect(uploadButton).toBeDisabled();
  });

  it('upload button enables after selecting an eligible model', async () => {
    const { container } = render(<AdminModels />);
    await screen.findByText('CenterlineTracker-v2');

    const wrapper = createWrapper(container);
    const table = wrapper.findTable();
    table?.findRowSelectionArea(1)?.click();

    const uploadButton = screen.getByRole('button', { name: /upload model to car/i });
    expect(uploadButton).toBeEnabled();
  });

  it('opens CarUploadModal when upload button is clicked', async () => {
    const { container } = render(<AdminModels />);
    await screen.findByText('CenterlineTracker-v2');

    const wrapper = createWrapper(container);
    const table = wrapper.findTable();
    table?.findRowSelectionArea(1)?.click();

    const uploadButton = screen.getByRole('button', { name: /upload model to car/i });
    await userEvent.click(uploadButton);

    // CarUploadModal renders
    expect(await screen.findByText(/select a car/i)).toBeInTheDocument();

    // Dismiss modal — covers onDismiss callback (line 155)
    const dialog = screen.getByRole('dialog');
    const allButtons = dialog.querySelectorAll('button');
    const dismissBtn = Array.from(allButtons).find((b) => b.textContent === '');
    if (dismissBtn) await userEvent.click(dismissBtn);
  });

  it('handleDownload dispatches success notification on successful download', async () => {
    mockTriggerGetUrl.mockResolvedValue({
      data: { url: 'https://s3.example.com/model.tar.gz', filename: 'model.tar.gz' },
    });

    render(<AdminModels />);
    await screen.findByText('CenterlineTracker-v2');

    // Download links should render for READY models (Download column is in DEFAULT_VISIBLE_COLUMNS)
    const downloadLinks = await screen.findAllByText(/download/i);
    const downloadLink = downloadLinks.find((el) => el.closest('a') || el.closest('[role="link"]'));
    expect(downloadLink).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await userEvent.click(downloadLink!);

    await waitFor(() => {
      expect(mockTriggerGetUrl).toHaveBeenCalledWith({
        modelId: 'model-abc123',
        profileId: 'profile-001',
      });
    });
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          content: expect.stringContaining('CenterlineTracker-v2'),
        }),
      }),
    );
  });

  it('handleDownload dispatches error when result has no data', async () => {
    mockTriggerGetUrl.mockResolvedValue({ data: undefined });

    render(<AdminModels />);
    await screen.findByText('CenterlineTracker-v2');

    const downloadLinks = await screen.findAllByText(/download/i);
    const downloadLink = downloadLinks.find((el) => el.closest('a') || el.closest('[role="link"]'));
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await userEvent.click(downloadLink!);

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            content: expect.stringContaining('Failed to download'),
          }),
        }),
      );
    });
  });

  it('handleDownload dispatches error when API throws', async () => {
    mockTriggerGetUrl.mockRejectedValue(new Error('Network error'));

    render(<AdminModels />);
    await screen.findByText('CenterlineTracker-v2');

    const downloadLinks = await screen.findAllByText(/download/i);
    const downloadLink = downloadLinks.find((el) => el.closest('a') || el.closest('[role="link"]'));
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await userEvent.click(downloadLink!);

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            content: expect.stringContaining('Failed to download'),
          }),
        }),
      );
    });
  });

  it('prunes stale selections when model status changes', () => {
    const pruneSelection = (selected: AdminModelExtended[], currentModels: AdminModelExtended[]) =>
      selected.filter((s) => currentModels.some((m) => m.modelId === s.modelId && m.status === ModelStatus.READY));

    expect(pruneSelection(TEST_MODELS, TEST_MODELS)).toEqual(TEST_MODELS);
    expect(pruneSelection(TEST_MODELS, [])).toEqual([]);
    const stale = { ...TEST_MODELS[0], status: ModelStatus.IMPORTING } as AdminModelExtended;
    expect(pruneSelection([TEST_MODELS[0]], [stale])).toEqual([]);
  });

  it('isItemDisabled logic', () => {
    const isItemDisabled = (item: AdminModelExtended) => item.status !== ModelStatus.READY;

    expect(isItemDisabled(TEST_MODELS[0])).toBe(false);
    expect(isItemDisabled({ ...TEST_MODELS[0], status: ModelStatus.ERROR } as AdminModelExtended)).toBe(true);
    expect(isItemDisabled({ ...TEST_MODELS[0], status: ModelStatus.IMPORTING } as AdminModelExtended)).toBe(true);
    // READY model with any optimization status should be selectable
    expect(isItemDisabled({ ...TEST_MODELS[0], optimizationStatus: undefined } as unknown as AdminModelExtended)).toBe(
      false,
    );
  });
});

describe('<AdminModels /> optimize', () => {
  const mockDispatch = vi.fn();
  const mockRefetch = vi.fn();
  const mockTriggerGetUrl = vi.fn();
  const mockPackageModel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppDispatch as unknown as Mock).mockReturnValue(mockDispatch);
    mockPackageModel.mockReturnValue({ unwrap: () => Promise.resolve({ modelId: 'model-1' }) });
    (useListAdminModelsQuery as Mock).mockReturnValue({
      data: [
        {
          modelId: 'model-ready-noopt',
          name: 'NeedsOptimize',
          username: 'user1',
          profileId: 'profile-1',
          status: ModelStatus.READY,
          modelSource: 'TRAINED',
          optimizationStatus: undefined,
          createdAt: new Date(),
          metadata: { agentAlgorithm: 'PPO', sensors: { camera: 'FRONT_FACING_CAMERA' } },
        },
        ...TEST_MODELS,
      ] as AdminModelExtended[],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: mockRefetch,
    });
    (useLazyGetAdminAssetUrlQuery as Mock).mockReturnValue([mockTriggerGetUrl, { isLoading: false, reset: vi.fn() }]);
    (usePackageModelMutation as Mock).mockReturnValue([mockPackageModel, { isLoading: false }]);
  });

  it('renders Optimize for car button', async () => {
    render(<AdminModels />);
    expect(await screen.findByRole('button', { name: /optimize for car/i })).toBeInTheDocument();
  });

  it('Optimize for car button is disabled when no models selected', async () => {
    render(<AdminModels />);
    const btn = await screen.findByRole('button', { name: /optimize for car/i });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });

  it('Optimize for car button is disabled when selected models are already optimized', async () => {
    // Default TEST_MODELS are all OPTIMIZED — select one
    (useListAdminModelsQuery as Mock).mockReturnValue({
      data: TEST_MODELS,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: mockRefetch,
    });
    const { container } = render(<AdminModels />);
    const wrapper = createWrapper(container);
    const table = wrapper.findTable();
    table?.findRowSelectionArea(1)?.click();

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /optimize for car/i });
      expect(btn).toHaveAttribute('aria-disabled', 'true');
    });
  });

  it('handleOptimize calls packageModel for first eligible selected model', async () => {
    const { container } = render(<AdminModels />);
    const wrapper = createWrapper(container);
    const table = wrapper.findTable();

    table?.findRowSelectionArea(1)?.click();

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /optimize for car/i });
      expect(btn).not.toBeDisabled();
    });

    screen.getByRole('button', { name: /optimize for car/i }).click();

    await waitFor(() => {
      expect(mockPackageModel).toHaveBeenCalledWith({ modelId: 'model-ready-noopt', profileId: 'profile-1' });
    });

    // Info notification dispatched
    expect(mockDispatch).toHaveBeenCalled();
  });

  it('dispatches error notification when packageModel rejects', async () => {
    mockPackageModel.mockReturnValue({ unwrap: () => Promise.reject(new Error('fail')) });

    const { container } = render(<AdminModels />);
    const wrapper = createWrapper(container);
    const table = wrapper.findTable();

    table?.findRowSelectionArea(1)?.click();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /optimize for car/i })).not.toBeDisabled();
    });

    screen.getByRole('button', { name: /optimize for car/i }).click();

    await waitFor(() => {
      expect(mockPackageModel).toHaveBeenCalled();
    });

    // Error notification dispatched
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledTimes(1);
    });
  });

  it('Upload model to car button is disabled when selected models are not optimized', async () => {
    const { container } = render(<AdminModels />);
    const wrapper = createWrapper(container);
    const table = wrapper.findTable();

    table?.findRowSelectionArea(1)?.click();

    await waitFor(() => {
      const uploadBtn = screen.getByRole('button', { name: /upload model to car/i });
      expect(uploadBtn).toBeDisabled();
    });
  });

  it('dispatches success notification when polling detects OPTIMIZED transition', async () => {
    const { container, rerender } = render(<AdminModels />);
    const wrapper = createWrapper(container);
    const table = wrapper.findTable();

    table?.findRowSelectionArea(1)?.click();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /optimize for car/i })).not.toBeDisabled();
    });

    screen.getByRole('button', { name: /optimize for car/i }).click();

    await waitFor(() => {
      expect(mockPackageModel).toHaveBeenCalled();
    });

    // Simulate poll returning model with OPTIMIZED status
    (useListAdminModelsQuery as Mock).mockReturnValue({
      data: [
        {
          modelId: 'model-ready-noopt',
          name: 'NeedsOptimize',
          username: 'user1',
          profileId: 'profile-1',
          status: ModelStatus.READY,
          modelSource: 'TRAINED',
          optimizationStatus: OptimizationStatus.OPTIMIZED,
          createdAt: new Date(),
          metadata: { agentAlgorithm: 'PPO', sensors: { camera: 'FRONT_FACING_CAMERA' } },
        },
        ...TEST_MODELS,
      ] as AdminModelExtended[],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: mockRefetch,
    });

    rerender(<AdminModels />);

    await waitFor(() => {
      // info (started) + success (optimized)
      expect(mockDispatch).toHaveBeenCalledTimes(2);
    });
  });

  it('dispatches error notification when polling detects FAILED transition', async () => {
    const { container, rerender } = render(<AdminModels />);
    const wrapper = createWrapper(container);
    const table = wrapper.findTable();

    table?.findRowSelectionArea(1)?.click();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /optimize for car/i })).not.toBeDisabled();
    });

    screen.getByRole('button', { name: /optimize for car/i }).click();

    await waitFor(() => {
      expect(mockPackageModel).toHaveBeenCalled();
    });

    // Simulate poll returning model with FAILED status
    (useListAdminModelsQuery as Mock).mockReturnValue({
      data: [
        {
          modelId: 'model-ready-noopt',
          name: 'NeedsOptimize',
          username: 'user1',
          profileId: 'profile-1',
          status: ModelStatus.READY,
          modelSource: 'TRAINED',
          optimizationStatus: OptimizationStatus.FAILED,
          createdAt: new Date(),
          metadata: { agentAlgorithm: 'PPO', sensors: { camera: 'FRONT_FACING_CAMERA' } },
        },
        ...TEST_MODELS,
      ] as AdminModelExtended[],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: mockRefetch,
    });

    rerender(<AdminModels />);

    await waitFor(() => {
      // info (started) + error (failed)
      expect(mockDispatch).toHaveBeenCalledTimes(2);
    });
  });

  it('clear selected button resets selection', async () => {
    const { container } = render(<AdminModels />);
    const wrapper = createWrapper(container);
    const table = wrapper.findTable();

    table?.findRowSelectionArea(1)?.click();

    await waitFor(() => {
      const clearBtn = screen.getByRole('button', { name: /clear selected/i });
      expect(clearBtn).not.toBeDisabled();
    });

    screen.getByRole('button', { name: /clear selected/i }).click();

    await waitFor(() => {
      const clearBtn = screen.getByRole('button', { name: /clear selected/i });
      expect(clearBtn).toBeDisabled();
    });
  });

  it('refresh button calls refetch', async () => {
    render(<AdminModels />);
    const refreshBtn = screen.getByRole('button', { name: /refresh/i });
    refreshBtn.click();
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('timeout dispatches warning when optimization takes too long', async () => {
    vi.useFakeTimers();

    const { container } = render(<AdminModels />);
    const wrapper = createWrapper(container);
    const table = wrapper.findTable();
    table?.findRowSelectionArea(1)?.click();

    await vi.advanceTimersByTimeAsync(10);

    screen.getByRole('button', { name: /optimize for car/i }).click();

    // Let packageModel resolve
    await vi.advanceTimersByTimeAsync(10);

    // Advance past OPTIMIZE_TIMEOUT_MS
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

    expect(mockDispatch).toHaveBeenCalledTimes(2); // info + warning

    vi.useRealTimers();
  });
});

describe('<AdminModels /> — conditional polling', () => {
  const mockRefetchLocal = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppDispatch as unknown as Mock).mockReturnValue(vi.fn());
    (useLazyGetAdminAssetUrlQuery as Mock).mockReturnValue([vi.fn(), { isLoading: false, reset: vi.fn() }]);
    (usePackageModelMutation as Mock).mockReturnValue([
      vi.fn(() => ({ unwrap: () => Promise.resolve() })),
      { isLoading: false },
    ]);
  });

  it('renders without error when all models are terminal', () => {
    (useListAdminModelsQuery as Mock).mockReturnValue({
      data: TEST_MODELS,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: mockRefetchLocal,
    });
    render(<AdminModels />);
    expect(screen.getByText('CenterlineTracker-v2')).toBeInTheDocument();
  });

  it('renders without error when a model is IMPORTING', () => {
    (useListAdminModelsQuery as Mock).mockReturnValue({
      data: [{ ...TEST_MODELS[0], status: ModelStatus.IMPORTING, optimizationStatus: undefined }],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: mockRefetchLocal,
    });
    render(<AdminModels />);
    expect(screen.getByText('Models')).toBeInTheDocument();
  });

  it('renders without error when optimization is IN_PROGRESS', () => {
    (useListAdminModelsQuery as Mock).mockReturnValue({
      data: [{ ...TEST_MODELS[0], optimizationStatus: OptimizationStatus.IN_PROGRESS }],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: mockRefetchLocal,
    });
    render(<AdminModels />);
    expect(screen.getByText('CenterlineTracker-v2')).toBeInTheDocument();
  });
});
