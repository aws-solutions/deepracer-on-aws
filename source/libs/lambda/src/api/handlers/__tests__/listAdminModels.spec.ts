// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { modelDao, profileDao, TEST_PROFILE_ID_1 } from '@deepracer-indy/database';
import {
  ModelSource,
  ModelStatus,
  NotAuthorizedError,
  OptimizationStatus,
} from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { ListAdminModelsOperation } from '../listAdminModels.js';

const mockIsUserAdminOrFacilitator = vi.fn().mockResolvedValue(true);
vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdminOrFacilitator: (...args: unknown[]) => mockIsUserAdminOrFacilitator(...args) };
});

const TEST_PROFILE_1 = { profileId: TEST_PROFILE_ID_1, alias: 'alice' };
const TEST_PROFILE_2 = { profileId: 'profile-002', alias: 'bob' };

const TEST_MODEL_1 = {
  modelId: 'model-001',
  profileId: TEST_PROFILE_ID_1,
  name: 'SpeedDemon',
  status: ModelStatus.READY,
  modelSource: ModelSource.TRAINED,
  optimizationStatus: OptimizationStatus.OPTIMIZED,
  createdAt: '2026-06-04T10:00:00Z',
  metadata: { agentAlgorithm: 'PPO', sensors: { camera: 'FRONT_FACING_CAMERA' } },
};

const TEST_MODEL_2 = {
  modelId: 'model-002',
  profileId: 'profile-002',
  name: 'WallHugger',
  status: ModelStatus.READY,
  modelSource: ModelSource.IMPORTED_PHYSICAL,
  optimizationStatus: OptimizationStatus.OPTIMIZED,
  createdAt: '2026-06-05T10:00:00Z',
  metadata: { agentAlgorithm: 'SAC', sensors: { camera: 'FRONT_FACING_CAMERA', lidar: 'LIDAR' } },
};

const TEST_MODEL_3_IMPORTING = {
  modelId: 'model-003',
  profileId: TEST_PROFILE_ID_1,
  name: 'NewUpload',
  status: ModelStatus.IMPORTING,
  modelSource: ModelSource.IMPORTED_PHYSICAL,
  createdAt: '2026-06-06T10:00:00Z',
};

describe('ListAdminModels operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsUserAdminOrFacilitator.mockResolvedValue(true);
    vi.spyOn(profileDao, 'listProjected').mockResolvedValue([TEST_PROFILE_1, TEST_PROFILE_2] as never);
    vi.spyOn(modelDao, 'listAll')
      .mockResolvedValueOnce({ data: [TEST_MODEL_1, TEST_MODEL_3_IMPORTING] } as never)
      .mockResolvedValueOnce({ data: [TEST_MODEL_2] } as never);
  });

  it('throws NotAuthorizedError for non-admin/facilitator users', async () => {
    mockIsUserAdminOrFacilitator.mockResolvedValueOnce(false);

    await expect(ListAdminModelsOperation({}, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotAuthorizedError);
  });

  it('returns models from all profiles with denormalized username', async () => {
    const result = await ListAdminModelsOperation({}, TEST_OPERATION_CONTEXT);

    expect(result.models).toHaveLength(3);
    // Sorted by createdAt desc: model-003 (June 6) > model-002 (June 5) > model-001 (June 4)
    expect(result.models[0].username).toBe('alice'); // model-003
    expect(result.models[1].username).toBe('bob'); // model-002
    expect(result.models[2].username).toBe('alice'); // model-001
  });

  it('sorts models by createdAt descending (newest first)', async () => {
    const result = await ListAdminModelsOperation({}, TEST_OPERATION_CONTEXT);

    const dates = result.models.map((m) => new Date(m.createdAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
  });

  it('returns empty models array when no profiles exist', async () => {
    vi.spyOn(profileDao, 'listProjected').mockResolvedValue([] as never);

    const result = await ListAdminModelsOperation({}, TEST_OPERATION_CONTEXT);

    expect(result.models).toEqual([]);
  });

  it('returns empty models when all profiles have zero models', async () => {
    vi.spyOn(modelDao, 'listAll')
      .mockReset()
      .mockResolvedValue({ data: [] } as never);

    const result = await ListAdminModelsOperation({}, TEST_OPERATION_CONTEXT);

    expect(result.models).toEqual([]);
  });

  it('tolerates partial failure from allSettled — failed profiles are excluded, not thrown', async () => {
    vi.spyOn(modelDao, 'listAll')
      .mockReset()
      .mockResolvedValueOnce({ data: [TEST_MODEL_1] } as never) // profile-1 succeeds
      .mockRejectedValueOnce(new Error('DDB throttle')); // profile-2 fails

    const result = await ListAdminModelsOperation({}, TEST_OPERATION_CONTEXT);

    // Only profile-1's models returned, no throw
    expect(result.models).toHaveLength(1);
    expect(result.models[0].modelId).toBe('model-001');
  });

  it('filters by status when provided', async () => {
    const result = await ListAdminModelsOperation({ status: ModelStatus.IMPORTING }, TEST_OPERATION_CONTEXT);

    expect(result.models).toHaveLength(1);
    expect(result.models[0].modelId).toBe('model-003');
  });

  it('filters by optimizationStatus when provided', async () => {
    const result = await ListAdminModelsOperation(
      { optimizationStatus: OptimizationStatus.OPTIMIZED },
      TEST_OPERATION_CONTEXT,
    );

    expect(result.models).toHaveLength(2);
    expect(result.models.every((m) => m.optimizationStatus === OptimizationStatus.OPTIMIZED)).toBe(true);
  });

  it('maps metadata correctly including undefined for models without metadata', async () => {
    const result = await ListAdminModelsOperation({}, TEST_OPERATION_CONTEXT);

    const withMetadata = result.models.find((m) => m.modelId === 'model-001');
    expect(withMetadata?.metadata?.agentAlgorithm).toBe('PPO');
    expect(withMetadata?.metadata?.sensors).toEqual({ camera: 'FRONT_FACING_CAMERA' });

    const withoutMetadata = result.models.find((m) => m.modelId === 'model-003');
    expect(withoutMetadata?.metadata).toBeUndefined();
  });
});
