// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  GetCommandInvocationCommand,
  InvocationDoesNotExist,
  SendCommandCommand,
  SSMClient,
} from '@aws-sdk/client-ssm';
import { carLogFetchJobDao } from '@deepracer-indy/database';
import { CarLogFetchStatus } from '@deepracer-indy/typescript-server-client';
import { s3Helper } from '@deepracer-indy/utils';
import { mockClient } from 'aws-sdk-client-mock';

import { lambdaHandler as jobFail } from '../jobFail.js';
import { lambdaHandler as jobInit } from '../jobInit.js';
import { lambdaHandler as jobPollCommand } from '../jobPollCommand.js';
import { lambdaHandler as jobSendCommand } from '../jobSendCommand.js';
import { lambdaHandler as jobUpdateStatus } from '../jobUpdateStatus.js';

const ssmMock = mockClient(SSMClient);
const JOB_ID = 'abcdefghij12345';
const run = <T>(handler: unknown, input: unknown) =>
  (handler as (i: unknown, c: unknown, cb: unknown) => Promise<T>)(input, {}, vi.fn());

describe('car log workflow: control handlers', () => {
  beforeEach(() => {
    ssmMock.reset();
    vi.restoreAllMocks();
    vi.stubEnv('DEVICE_LOGS_BUCKET_NAME', 'logs-bucket');
    vi.spyOn(carLogFetchJobDao, 'updateStatus').mockResolvedValue({} as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('jobInit', () => {
    it('passes an API-started car job through', async () => {
      vi.spyOn(carLogFetchJobDao, 'load').mockResolvedValue({
        source: 'CAR',
        status: CarLogFetchStatus.CREATED,
      } as never);

      await expect(run(jobInit, { jobId: JOB_ID })).resolves.toEqual({ jobId: JOB_ID, source: 'CAR' });
    });

    it('refuses to start a car job twice', async () => {
      vi.spyOn(carLogFetchJobDao, 'load').mockResolvedValue({
        source: 'CAR',
        status: CarLogFetchStatus.REQUESTED_UPLOAD,
      } as never);

      await expect(run(jobInit, { jobId: JOB_ID })).rejects.toThrow('already been started');
    });

    it('marks a manual upload as uploaded when the expected object arrived', async () => {
      vi.spyOn(carLogFetchJobDao, 'load').mockResolvedValue({
        source: 'UPLOAD',
        status: CarLogFetchStatus.WAITING_FOR_UPLOAD,
      } as never);

      const out = await run(jobInit, { uploadKey: `staging/manual/${JOB_ID}.tar.gz` });

      expect(out).toEqual({ jobId: JOB_ID, source: 'UPLOAD' });
      expect(carLogFetchJobDao.updateStatus).toHaveBeenCalledWith({
        jobId: JOB_ID,
        status: CarLogFetchStatus.UPLOADED,
        attributes: { uploadKey: `staging/manual/${JOB_ID}.tar.gz` },
      });
    });

    it('rejects a duplicate upload event', async () => {
      vi.spyOn(carLogFetchJobDao, 'load').mockResolvedValue({
        source: 'UPLOAD',
        status: CarLogFetchStatus.UPLOADED,
      } as never);

      await expect(run(jobInit, { uploadKey: `staging/manual/${JOB_ID}.tar.gz` })).rejects.toThrow('not expected');
    });

    it('rejects an upload key that is not a job archive', async () => {
      await expect(run(jobInit, { uploadKey: 'staging/manual/evil.txt' })).rejects.toThrow('does not belong');
    });

    it('rejects an upload event for a car job', async () => {
      vi.spyOn(carLogFetchJobDao, 'load').mockResolvedValue({
        source: 'CAR',
        status: CarLogFetchStatus.CREATED,
      } as never);

      await expect(run(jobInit, { uploadKey: `staging/manual/${JOB_ID}.tar.gz` })).rejects.toThrow('not expected');
    });
  });

  describe('jobSendCommand', () => {
    it('sends the upload script to the car and records the command', async () => {
      vi.spyOn(carLogFetchJobDao, 'load').mockResolvedValue({
        source: 'CAR',
        instanceId: 'mi-123',
        modelId: 'abcdefghij12345',
      } as never);
      vi.spyOn(s3Helper, 'getPresignedPutUrl').mockResolvedValue('https://logs-bucket.s3.amazonaws.com/x?sig=1');
      ssmMock.on(SendCommandCommand).resolves({ Command: { CommandId: 'cmd-1' } });

      const out = await run(jobSendCommand, { jobId: JOB_ID });

      expect(out).toEqual({ jobId: JOB_ID, instanceId: 'mi-123', commandId: 'cmd-1' });
      expect(s3Helper.getPresignedPutUrl).toHaveBeenCalledWith(
        `s3://logs-bucket/staging/car/${JOB_ID}.tar.gz`,
        900,
        'application/gzip',
      );
      const call = ssmMock.commandCalls(SendCommandCommand)[0].args[0].input;
      expect(call.InstanceIds).toEqual(['mi-123']);
      expect(call.Parameters?.commands?.join('\n')).toContain('abcdefghij12345');
      expect(carLogFetchJobDao.updateStatus).toHaveBeenCalledWith({
        jobId: JOB_ID,
        status: CarLogFetchStatus.REQUESTED_UPLOAD,
        attributes: { ssmCommandId: 'cmd-1', uploadKey: `staging/car/${JOB_ID}.tar.gz` },
      });
    });

    it('rejects jobs that are not car fetches', async () => {
      vi.spyOn(carLogFetchJobDao, 'load').mockResolvedValue({ source: 'UPLOAD' } as never);

      await expect(run(jobSendCommand, { jobId: JOB_ID })).rejects.toThrow('not a car fetch');
    });
  });

  describe('jobPollCommand', () => {
    const input = { jobId: JOB_ID, instanceId: 'mi-123', commandId: 'cmd-1' };

    it('reports pending and marks the job as waiting once', async () => {
      ssmMock.on(GetCommandInvocationCommand).resolves({ Status: 'InProgress' });

      const first = await run<{ outcome: string; pollCount: number; waitingMarked: boolean }>(jobPollCommand, input);
      expect(first).toMatchObject({ outcome: 'PENDING', pollCount: 1, waitingMarked: true });

      await run(jobPollCommand, first);
      expect(carLogFetchJobDao.updateStatus).toHaveBeenCalledTimes(1);
    });

    it('treats a not yet visible invocation as pending', async () => {
      ssmMock.on(GetCommandInvocationCommand).rejects(new InvocationDoesNotExist({ message: 'x', $metadata: {} }));

      await expect(run(jobPollCommand, input)).resolves.toMatchObject({ outcome: 'PENDING' });
    });

    it('marks the job uploaded on success', async () => {
      ssmMock.on(GetCommandInvocationCommand).resolves({ Status: 'Success' });

      await expect(run(jobPollCommand, input)).resolves.toMatchObject({ outcome: 'SUCCESS' });
      expect(carLogFetchJobDao.updateStatus).toHaveBeenCalledWith({
        jobId: JOB_ID,
        status: CarLogFetchStatus.UPLOADED,
      });
    });

    it('marks the upload failed with the reason from the car', async () => {
      ssmMock
        .on(GetCommandInvocationCommand)
        .resolves({ Status: 'Failed', StandardErrorContent: 'No matching log folders found\n' });

      await expect(run(jobPollCommand, input)).resolves.toMatchObject({ outcome: 'FAILED' });
      expect(carLogFetchJobDao.updateStatus).toHaveBeenCalledWith({
        jobId: JOB_ID,
        status: CarLogFetchStatus.UPLOAD_FAILED,
        errorMessage: 'The car could not upload its logs (Failed): No matching log folders found',
      });
    });
  });

  describe('jobUpdateStatus', () => {
    it('sets the status and returns only the job id', async () => {
      const out = await run(jobUpdateStatus, { jobId: JOB_ID, status: CarLogFetchStatus.QUEUED_FOR_PROCESSING });

      expect(out).toEqual({ jobId: JOB_ID });
      expect(carLogFetchJobDao.updateStatus).toHaveBeenCalledWith({
        jobId: JOB_ID,
        status: CarLogFetchStatus.QUEUED_FOR_PROCESSING,
      });
    });
  });

  describe('jobFail', () => {
    it('shows messages of expected job errors', async () => {
      await run(jobFail, {
        jobId: JOB_ID,
        error: { Error: 'CarLogJobError', Cause: JSON.stringify({ errorMessage: 'No log folders.' }) },
      });

      expect(carLogFetchJobDao.updateStatus).toHaveBeenCalledWith({
        jobId: JOB_ID,
        status: CarLogFetchStatus.FAILED,
        errorMessage: 'No log folders.',
      });
    });

    it('hides the details of unexpected errors', async () => {
      await run(jobFail, { jobId: JOB_ID, error: { Error: 'Error', Cause: 'secret internals' } });

      expect(carLogFetchJobDao.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({ errorMessage: 'Processing of the car logs failed.' }),
      );
    });

    it('does not throw when the job cannot be updated', async () => {
      vi.spyOn(carLogFetchJobDao, 'updateStatus').mockRejectedValue(new Error('conditional check failed'));

      await expect(run(jobFail, { jobId: JOB_ID })).resolves.toEqual({ jobId: JOB_ID });
    });
  });
});
