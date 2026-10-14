// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DynamoDBRecord } from 'aws-lambda';

import { buildCarLogBroadcast } from '../carLogBroadcast.js';

const record = (eventName: string, dynamodb: DynamoDBRecord['dynamodb']): DynamoDBRecord =>
  ({ eventName, dynamodb }) as DynamoDBRecord;

const job = (status: string) => ({
  pk: { S: 'carlogjob_abcdefghij12345' },
  sk: { S: 'carlogjob_abcdefghij12345' },
  jobId: { S: 'abcdefghij12345' },
  status: { S: status },
  errorMessage: { S: 'secret detail' },
});

const asset = {
  pk: { S: 'profile_racer1' },
  sk: { S: 'carlogasset_abc' },
  profileId: { S: 'racer1' },
  assetId: { S: 'abc' },
  assetType: { S: 'VIDEO' },
  s3Key: { S: 'carlogs/racer1/videos/x.mp4' },
  filename: { S: 'x.mp4' },
};

describe('buildCarLogBroadcast', () => {
  it('emits a job update on insert and on status change, with ids and status only', () => {
    expect(buildCarLogBroadcast(record('INSERT', { NewImage: job('CREATED') }))).toEqual({
      kind: 'job',
      event: expect.objectContaining({ eventType: 'CAR_LOG_JOB_UPDATED', jobId: 'abcdefghij12345', status: 'CREATED' }),
    });
    const changed = buildCarLogBroadcast(
      record('MODIFY', { NewImage: job('DONE'), OldImage: job('QUEUED_FOR_PROCESSING') }),
    );
    expect(changed).toMatchObject({ kind: 'job', event: { status: 'DONE' } });
    expect(JSON.stringify(changed)).not.toContain('secret');
  });

  it('ignores job updates that do not change the status and job removals', () => {
    expect(buildCarLogBroadcast(record('MODIFY', { NewImage: job('DONE'), OldImage: job('DONE') }))).toBeUndefined();
    expect(buildCarLogBroadcast(record('REMOVE', { OldImage: job('DONE') }))).toBeUndefined();
  });

  it('emits asset events for the owner without keys or file names', () => {
    const added = buildCarLogBroadcast(record('INSERT', { NewImage: asset }));
    expect(added).toEqual({
      kind: 'asset',
      profileId: 'racer1',
      event: expect.objectContaining({ eventType: 'CAR_LOG_ASSET_ADDED', assetId: 'abc', assetType: 'VIDEO' }),
    });
    expect(JSON.stringify(added)).not.toMatch(/carlogs\/|x\.mp4/);

    expect(buildCarLogBroadcast(record('REMOVE', { OldImage: asset }))).toMatchObject({
      event: { eventType: 'CAR_LOG_ASSET_DELETED' },
    });
  });

  it('ignores other records', () => {
    expect(
      buildCarLogBroadcast(record('INSERT', { NewImage: { pk: { S: 'profile_racer1' }, sk: { S: 'model_abc' } } })),
    ).toBeUndefined();
    expect(buildCarLogBroadcast(record('INSERT', { NewImage: { pk: { S: 'device#mi-1' } } }))).toBeUndefined();
  });
});
