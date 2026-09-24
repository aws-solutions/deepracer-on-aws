// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DeploymentStatus, DeploymentSummary } from '@deepracer-indy/typescript-client';
import { renderHook } from '@testing-library/react';

import { render, screen } from '#utils/testUtils';

import { useUploadStatusTableConfig } from '../UploadStatusTableConfig';

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
  {
    deploymentId: 'deploy-004',
    modelId: 'model-4',
    modelName: 'PendingModel',
    carInstanceId: 'i-abc004',
    carName: 'Car-Delta',
    status: DeploymentStatus.PENDING,
    createdAt: new Date('2026-08-15T10:15:00Z'),
  },
];

describe('useUploadStatusTableConfig', () => {
  it('returns expected shape', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    expect(result.current.items).toBeDefined();
    expect(result.current.columnDefinitions).toBeDefined();
    expect(result.current.paginationProps).toBeDefined();
    expect(result.current.propertyFilterProps).toBeDefined();
    expect(result.current.collectionProps).toBeDefined();
    expect(result.current.preferences).toBeDefined();
    expect(result.current.uploadStatusPreferences).toBeDefined();
    expect(result.current.columnDisplay).toBeDefined();
  });

  it('returns all deployments as items', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    expect(result.current.items).toHaveLength(4);
  });

  it('returns correct number of column definitions (8)', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    expect(result.current.columnDefinitions).toHaveLength(8);
  });

  it('default preferences hide Job ID column', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    const contentDisplay = result.current.columnDisplay;
    const jobIdVisible = contentDisplay?.find((c: { id: string }) => c.id === 'jobId');
    expect(jobIdVisible).toBeUndefined();
  });

  it('default preferences include visible columns', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    const contentDisplay = result.current.columnDisplay;
    const visibleIds = contentDisplay?.map((c: { id: string }) => c.id) ?? [];
    expect(visibleIds).toContain('status');
    expect(visibleIds).toContain('modelName');
    expect(visibleIds).toContain('carName');
    expect(visibleIds).toContain('duration');
  });

  it('sorts by createdAt descending by default', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    expect(result.current.items[0].deploymentId).toBe('deploy-004');
  });
});

describe('DeploymentStatusIndicator', () => {
  it('renders Completed status', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    const statusCol = result.current.columnDefinitions.find((c) => c.id === 'status');
    render(statusCol?.cell(TEST_DEPLOYMENTS[0]) as JSX.Element);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders In progress status', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    const statusCol = result.current.columnDefinitions.find((c) => c.id === 'status');
    render(statusCol?.cell(TEST_DEPLOYMENTS[1]) as JSX.Element);
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('renders Failed status', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    const statusCol = result.current.columnDefinitions.find((c) => c.id === 'status');
    render(statusCol?.cell(TEST_DEPLOYMENTS[2]) as JSX.Element);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders Failed status with clickable popover when errorMessage is present', async () => {
    const deploymentWithError = {
      ...TEST_DEPLOYMENTS[2],
      errorMessage: 'tar: Cannot open: No such file or directory',
    };
    const { result } = renderHook(() => useUploadStatusTableConfig([deploymentWithError]));
    const statusCol = result.current.columnDefinitions.find((c) => c.id === 'status');
    render(statusCol?.cell(deploymentWithError) as JSX.Element);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    // Popover wraps the status indicator — verify the trigger role is present
    expect(screen.getByRole('button', { name: /failed/i })).toBeInTheDocument();
  });

  it('renders Failed status without popover when errorMessage is absent', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    const statusCol = result.current.columnDefinitions.find((c) => c.id === 'status');
    render(statusCol?.cell(TEST_DEPLOYMENTS[2]) as JSX.Element);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    screen.getByText('Failed').click();
    expect(screen.queryByText('tar')).not.toBeInTheDocument();
  });

  it('renders Pending status', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    const statusCol = result.current.columnDefinitions.find((c) => c.id === 'status');
    render(statusCol?.cell(TEST_DEPLOYMENTS[3]) as JSX.Element);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});

describe('Column cell renderers', () => {
  it('modelName column shows model name', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    const col = result.current.columnDefinitions.find((c) => c.id === 'modelName');
    expect(col?.cell(TEST_DEPLOYMENTS[0])).toBe('CenterlineTracker-v2');
  });

  it('modelName column falls back to modelId when name is missing', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    const col = result.current.columnDefinitions.find((c) => c.id === 'modelName');
    const noNameDeploy = { ...TEST_DEPLOYMENTS[0], modelName: undefined };
    expect(col?.cell(noNameDeploy as DeploymentSummary)).toBe('model-1');
  });

  it('carName column shows car name', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    const col = result.current.columnDefinitions.find((c) => c.id === 'carName');
    expect(col?.cell(TEST_DEPLOYMENTS[0])).toBe('Car-Alpha');
  });

  it('carName column shows dash when missing', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    const col = result.current.columnDefinitions.find((c) => c.id === 'carName');
    const noCarDeploy = { ...TEST_DEPLOYMENTS[0], carName: undefined };
    expect(col?.cell(noCarDeploy as DeploymentSummary)).toBe('—');
  });

  it('duration column computes correct duration', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    const col = result.current.columnDefinitions.find((c) => c.id === 'duration');
    expect(col?.cell(TEST_DEPLOYMENTS[0])).toBe('7.0s');
  });

  it('duration column shows dash when not completed', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    const col = result.current.columnDefinitions.find((c) => c.id === 'duration');
    expect(col?.cell(TEST_DEPLOYMENTS[1])).toBe('—');
  });

  it('startTime column formats date', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    const col = result.current.columnDefinitions.find((c) => c.id === 'startTime');
    const formatted = col?.cell(TEST_DEPLOYMENTS[0]);
    expect(formatted).not.toBe('—');
    expect(typeof formatted).toBe('string');
  });

  it('startTime column shows dash when undefined', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    const col = result.current.columnDefinitions.find((c) => c.id === 'startTime');
    const noDeploy = { ...TEST_DEPLOYMENTS[0], createdAt: undefined };
    expect(col?.cell(noDeploy as unknown as DeploymentSummary)).toBe('—');
  });

  it('jobId column shows batchId', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    const col = result.current.columnDefinitions.find((c) => c.id === 'jobId');
    expect(col?.cell(TEST_DEPLOYMENTS[0])).toBe('batch-001');
  });

  it('jobId column shows dash when no batchId', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    const col = result.current.columnDefinitions.find((c) => c.id === 'jobId');
    expect(col?.cell(TEST_DEPLOYMENTS[3])).toBe('—');
  });

  it('duration sorting comparator works correctly', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    const col = result.current.columnDefinitions.find((c) => c.id === 'duration');
    const comparator = col?.sortingComparator;
    expect(comparator).toBeDefined();
    const cmpResult = comparator?.(TEST_DEPLOYMENTS[0], TEST_DEPLOYMENTS[2]);
    expect(cmpResult).toBeLessThan(0);
  });
});

describe('CollectionPreferences', () => {
  it('uploadStatusPreferences renders a button', () => {
    const { result } = renderHook(() => useUploadStatusTableConfig(TEST_DEPLOYMENTS));
    render(result.current.uploadStatusPreferences as JSX.Element);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
