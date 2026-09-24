// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deploymentDao } from '@deepracer-indy/database';
import { DeploymentStatus } from '@deepracer-indy/typescript-server-client';

import { lambdaHandler, type UpdateDeploymentStatusInput } from '../pushUpdateDeploymentStatus.js';

const TEST_CONTEXT = {
  deploymentId: 'deploy-1' as never,
  modelId: 'model-1' as never,
  carInstanceId: 'i-123',
  presignedUrl: 'https://example.com/model.tar.gz',
  carType: 'DEEPRACER_RPI',
};

describe('pushUpdateDeploymentStatus', () => {
  beforeEach(() => {
    vi.spyOn(deploymentDao, 'updateStatus').mockResolvedValue({} as never);
  });

  it('should update status from PENDING to IN_PROGRESS', async () => {
    const input: UpdateDeploymentStatusInput = {
      context: TEST_CONTEXT,
      status: DeploymentStatus.IN_PROGRESS,
      expectedStatus: DeploymentStatus.PENDING,
    };

    const result = await lambdaHandler(input, {} as never, vi.fn() as never);

    expect(deploymentDao.updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        status: DeploymentStatus.IN_PROGRESS,
        expectedStatus: DeploymentStatus.PENDING,
      }),
    );
    expect(result).toEqual(TEST_CONTEXT);
  });

  it('should update status from IN_PROGRESS to COMPLETED', async () => {
    const input: UpdateDeploymentStatusInput = {
      context: TEST_CONTEXT,
      status: DeploymentStatus.COMPLETED,
      expectedStatus: DeploymentStatus.IN_PROGRESS,
    };

    await lambdaHandler(input, {} as never, vi.fn() as never);

    expect(deploymentDao.updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        status: DeploymentStatus.COMPLETED,
        expectedStatus: DeploymentStatus.IN_PROGRESS,
        errorMessage: undefined,
      }),
    );
  });

  it('should include error message when setting FAILED', async () => {
    const input: UpdateDeploymentStatusInput = {
      context: { ...TEST_CONTEXT, commandError: 'curl: connection refused' },
      status: DeploymentStatus.FAILED,
      expectedStatus: DeploymentStatus.IN_PROGRESS,
    };

    await lambdaHandler(input, {} as never, vi.fn() as never);

    expect(deploymentDao.updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        status: DeploymentStatus.FAILED,
        errorMessage: 'curl: connection refused',
      }),
    );
  });

  it('should use fallback error message when no commandError provided', async () => {
    const input: UpdateDeploymentStatusInput = {
      context: TEST_CONTEXT,
      status: DeploymentStatus.FAILED,
      expectedStatus: DeploymentStatus.IN_PROGRESS,
    };

    await lambdaHandler(input, {} as never, vi.fn() as never);

    expect(deploymentDao.updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: 'Deployment failed',
      }),
    );
  });
});
