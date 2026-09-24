// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import { DeploymentStatus, DeploymentSummary } from '@deepracer-indy/typescript-client';
import { Mock, vi } from 'vitest';

import UploadStatus from '#pages/UploadStatus/UploadStatus';
import { useListEventsQuery } from '#services/deepRacer/eventsApi';
import { useListDeploymentsByEventQuery } from '#services/deepRacer/modelsApi';
import { render, screen } from '#utils/testUtils';

vi.mock('#services/deepRacer/modelsApi', async () => {
  const actual = await vi.importActual<typeof import('#services/deepRacer/modelsApi')>('#services/deepRacer/modelsApi');
  return {
    ...actual,
    useListDeploymentsByEventQuery: vi.fn(),
  };
});

vi.mock('#services/deepRacer/eventsApi', async () => {
  const actual = await vi.importActual<typeof import('#services/deepRacer/eventsApi')>('#services/deepRacer/eventsApi');
  return {
    ...actual,
    useListEventsQuery: vi.fn(),
  };
});

vi.mock('#hooks/useLocalStorage', () => ({
  useLocalStorage: vi.fn(() => ['event-001', vi.fn()]),
}));

const TEST_DEPLOYMENTS: DeploymentSummary[] = [
  {
    deploymentId: 'deploy-001',
    modelId: 'model-1',
    modelName: 'CenterlineTracker-v2',
    carInstanceId: 'i-abc001',
    carName: 'Car-Alpha',
    batchId: 'batch-001',
    status: DeploymentStatus.COMPLETED,
    createdAt: new Date('2026-08-15T10:00:00Z'),
    uploadStartedAt: new Date('2026-08-15T10:00:05Z'),
    completedAt: new Date('2026-08-15T10:00:12Z'),
  },
  {
    deploymentId: 'deploy-002',
    modelId: 'model-2',
    modelName: 'SteeringPenalty-v1',
    carInstanceId: 'i-abc002',
    carName: 'Car-Beta',
    batchId: 'batch-001',
    status: DeploymentStatus.IN_PROGRESS,
    createdAt: new Date('2026-08-15T10:05:00Z'),
    uploadStartedAt: new Date('2026-08-15T10:05:03Z'),
  },
  {
    deploymentId: 'deploy-003',
    modelId: 'model-3',
    modelName: 'ThrottlePenalty-v3',
    carInstanceId: 'i-abc003',
    carName: 'Car-Gamma',
    batchId: 'batch-002',
    status: DeploymentStatus.FAILED,
    createdAt: new Date('2026-08-15T10:10:00Z'),
    uploadStartedAt: new Date('2026-08-15T10:10:02Z'),
    completedAt: new Date('2026-08-15T10:10:30Z'),
  },
];

describe('<UploadStatus />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useListEventsQuery as Mock).mockReturnValue({
      data: [
        { eventId: 'event-001', name: 'Morning Race' },
        { eventId: 'event-002', name: 'Afternoon Race' },
      ],
    });
    (useListDeploymentsByEventQuery as Mock).mockReturnValue({
      data: TEST_DEPLOYMENTS,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  it('renders page header', () => {
    render(<UploadStatus />);
    const headers = screen.getAllByText(/uploads to car status/i);
    expect(headers.length).toBeGreaterThanOrEqual(1);
  });

  it('renders event selector', () => {
    render(<UploadStatus />);
    expect(screen.getByText(/morning race/i)).toBeInTheDocument();
  });

  it('renders deployments table with data', async () => {
    const { container } = render(<UploadStatus />);
    const wrapper = createWrapper(container);
    const table = wrapper.findTable();
    expect(table).not.toBeNull();
  });

  it('renders summary chart container', () => {
    render(<UploadStatus />);
    expect(screen.getByText('Summary')).toBeInTheDocument();
  });

  it('renders upload times chart container', () => {
    render(<UploadStatus />);
    expect(screen.getByText('Upload times')).toBeInTheDocument();
  });

  it('renders status indicators in table', () => {
    render(<UploadStatus />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders model names in table', () => {
    render(<UploadStatus />);
    expect(screen.getByText('CenterlineTracker-v2')).toBeInTheDocument();
    expect(screen.getByText('SteeringPenalty-v1')).toBeInTheDocument();
    expect(screen.getByText('ThrottlePenalty-v3')).toBeInTheDocument();
  });

  it('renders car names in table', () => {
    render(<UploadStatus />);
    expect(screen.getByText('Car-Alpha')).toBeInTheDocument();
    expect(screen.getByText('Car-Beta')).toBeInTheDocument();
    expect(screen.getByText('Car-Gamma')).toBeInTheDocument();
  });

  it('computes duration for completed deployments', () => {
    render(<UploadStatus />);
    // deploy-001: 12s - 5s = 7s
    expect(screen.getByText('7.0s')).toBeInTheDocument();
  });

  it('shows dash for duration when not completed', () => {
    render(<UploadStatus />);
    // deploy-002 is IN_PROGRESS, no completedAt
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders refresh button', () => {
    render(<UploadStatus />);
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    (useListDeploymentsByEventQuery as Mock).mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: true,
      refetch: vi.fn(),
    });
    render(<UploadStatus />);
    expect(screen.getByText(/loading deployments/i)).toBeInTheDocument();
  });

  it('shows empty state when no deployments', () => {
    (useListDeploymentsByEventQuery as Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    render(<UploadStatus />);
    expect(screen.getByText(/no deployments/i)).toBeInTheDocument();
  });

  it('passes polling interval to query', () => {
    render(<UploadStatus />);
    expect(useListDeploymentsByEventQuery).toHaveBeenCalledWith(
      { eventId: 'event-001' },
      expect.objectContaining({
        pollingInterval: 3000,
        skipPollingIfUnfocused: true,
      }),
    );
  });

  it('refresh button calls refetch', () => {
    const mockRefetch = vi.fn();
    (useListDeploymentsByEventQuery as Mock).mockReturnValue({
      data: TEST_DEPLOYMENTS,
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    });
    render(<UploadStatus />);
    screen.getByRole('button', { name: /refresh/i }).click();
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('event selector onChange updates persisted event', async () => {
    const mockSetEvent = vi.fn();
    const { useLocalStorage } = await vi.importMock<typeof import('#hooks/useLocalStorage')>('#hooks/useLocalStorage');
    vi.mocked(useLocalStorage).mockReturnValue(['event-001', mockSetEvent]);

    const { container } = render(<UploadStatus />);
    const wrapper = createWrapper(container);
    const select = wrapper.findSelect();
    select?.openDropdown();
    select?.selectOption(2); // Afternoon Race

    expect(mockSetEvent).toHaveBeenCalled();
  });

  it('shows hint text when no event is selected', async () => {
    const { useLocalStorage } = await vi.importMock<typeof import('#hooks/useLocalStorage')>('#hooks/useLocalStorage');
    vi.mocked(useLocalStorage).mockReturnValue([null, vi.fn()]);

    render(<UploadStatus />);
    expect(screen.getByText(/select an event to view deployment history/i)).toBeInTheDocument();
  });

  it('does not render charts or table when no event is selected', async () => {
    const { useLocalStorage } = await vi.importMock<typeof import('#hooks/useLocalStorage')>('#hooks/useLocalStorage');
    vi.mocked(useLocalStorage).mockReturnValue([null, vi.fn()]);

    render(<UploadStatus />);
    expect(screen.queryByText('Summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Upload times')).not.toBeInTheDocument();
  });

  it('handles deployments with unknown status in summary chart', () => {
    (useListDeploymentsByEventQuery as Mock).mockReturnValue({
      data: [
        {
          ...TEST_DEPLOYMENTS[0],
          status: 'UNKNOWN_STATUS' as DeploymentStatus,
        },
      ],
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(<UploadStatus />);
    expect(screen.getByText('Summary')).toBeInTheDocument();
  });

  it('renders table header with deployment count when no filter active', () => {
    render(<UploadStatus />);
    // 3 deployments in TEST_DEPLOYMENTS, counter shows the count
    expect(screen.getByText('(3)')).toBeInTheDocument();
  });
});
