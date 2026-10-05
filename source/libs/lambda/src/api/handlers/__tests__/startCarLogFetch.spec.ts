// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { carLogFetchJobDao, deviceDao, eventDao, profileDao, runDao } from '@deepracer-indy/database';
import {
  BadRequestError,
  CarLogFetchStatus,
  ConflictError,
  InternalFailureError,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';

import { sfnClient } from '../../../utils/clients/sfnClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { StartCarLogFetchOperation } from '../startCarLogFetch.js';

vi.mock('../../../utils/clients/sfnClient.js', () => ({ sfnClient: { send: vi.fn() } }));

const mockIsAdminOrFacilitator = vi.fn();
vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdminOrFacilitator: (...args: unknown[]) => mockIsAdminOrFacilitator(...args) };
});

const INSTANCE = 'mi-0123456789abcdef0';
const MODEL_ID = 'abcdefghij12345';

describe('StartCarLogFetch operation', () => {
  beforeEach(() => {
    process.env.CAR_LOG_STATE_MACHINE_ARN = 'arn:aws:states:us-east-1:123456789012:stateMachine:carlogs';
    mockIsAdminOrFacilitator.mockResolvedValue(true);
    vi.spyOn(deviceDao, 'load').mockResolvedValue({
      instanceId: INSTANCE,
      name: 'Car-1',
      loggingCapable: true,
    } as never);
    vi.spyOn(carLogFetchJobDao, 'listActiveByInstance').mockResolvedValue([]);
    vi.spyOn(carLogFetchJobDao, 'createJob').mockResolvedValue({ jobId: 'job123456789012' } as never);
    vi.spyOn(carLogFetchJobDao, 'updateStatus').mockResolvedValue({} as never);
    vi.mocked(sfnClient.send).mockResolvedValue({} as never);
  });

  it('rejects callers who are not administrators or facilitators', async () => {
    mockIsAdminOrFacilitator.mockResolvedValue(false);

    await expect(
      StartCarLogFetchOperation({ instanceId: INSTANCE, modelId: MODEL_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(NotAuthorizedError);
    expect(carLogFetchJobDao.createJob).not.toHaveBeenCalled();
  });

  it('creates a job for a model and starts the workflow with only the job id', async () => {
    const out = await StartCarLogFetchOperation({ instanceId: INSTANCE, modelId: MODEL_ID }, TEST_OPERATION_CONTEXT);

    expect(out.jobId).toBe('job123456789012');
    expect(carLogFetchJobDao.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'CAR',
        status: CarLogFetchStatus.CREATED,
        instanceId: INSTANCE,
        modelId: MODEL_ID,
      }),
    );
    const command = vi.mocked(sfnClient.send).mock.calls[0][0] as unknown as { input: { input: string; name: string } };
    expect(JSON.parse(command.input.input)).toEqual({ jobId: 'job123456789012' });
    expect(command.input.name).toBe('job123456789012');
  });

  it('derives event, racer and start time from the run instead of trusting the client', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue({
      profileId: 'racer1234567890',
      eventId: 'event1234567890',
      createdAt: '2025-01-02T03:04:05.000Z',
    } as never);
    vi.spyOn(profileDao, 'load').mockResolvedValue({ alias: 'RealRacer' } as never);
    vi.spyOn(eventDao, 'load').mockResolvedValue({ eventId: 'event1234567890', name: 'Summit' } as never);

    await StartCarLogFetchOperation(
      {
        instanceId: INSTANCE,
        runId: 'run123456789012',
        leaderboardId: 'board1234567890',
        racerName: 'Spoofed',
        laterThan: new Date('2000-01-01'),
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(carLogFetchJobDao.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        racerName: 'RealRacer',
        eventId: 'event1234567890',
        eventName: 'Summit',
        laterThan: '2025-01-02T02:59:05.000Z',
      }),
    );
  });

  it('requires a leaderboard together with a run', async () => {
    await expect(
      StartCarLogFetchOperation({ instanceId: INSTANCE, runId: 'run123456789012' }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(BadRequestError);
  });

  it('requires something to select the logs by', async () => {
    await expect(StartCarLogFetchOperation({ instanceId: INSTANCE }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      BadRequestError,
    );
  });

  it('rejects cars without the logging feature', async () => {
    vi.spyOn(deviceDao, 'load').mockResolvedValue({ instanceId: INSTANCE, loggingCapable: false } as never);

    await expect(
      StartCarLogFetchOperation({ instanceId: INSTANCE, modelId: MODEL_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(BadRequestError);
  });

  it('rejects a second fetch while one is active on the same car', async () => {
    vi.spyOn(carLogFetchJobDao, 'listActiveByInstance').mockResolvedValue([{ jobId: 'other' }] as never);

    await expect(
      StartCarLogFetchOperation({ instanceId: INSTANCE, modelId: MODEL_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(ConflictError);
    expect(carLogFetchJobDao.createJob).not.toHaveBeenCalled();
  });

  it('marks the job failed when the workflow cannot be started', async () => {
    vi.mocked(sfnClient.send).mockRejectedValue(new Error('throttled'));

    await expect(
      StartCarLogFetchOperation({ instanceId: INSTANCE, modelId: MODEL_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(InternalFailureError);
    expect(carLogFetchJobDao.updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job123456789012', status: CarLogFetchStatus.FAILED }),
    );
  });
});
