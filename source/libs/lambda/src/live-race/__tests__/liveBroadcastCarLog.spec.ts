// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane';
import { mockClient } from 'aws-sdk-client-mock';

const mockIoTClient = mockClient(IoTDataPlaneClient);

describe('liveBroadcastHandler car log routing', () => {
  beforeEach(() => {
    mockIoTClient.reset();
    mockIoTClient.on(PublishCommand).resolves({});
    vi.resetModules();
    vi.stubEnv('CAR_LOG_TOPIC_PREFIX', 'deepracer/test/carlogs');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const run = async (records: unknown[]) => {
    const { handler } = await import('../liveBroadcastHandler.js');
    return handler({ Records: records } as never);
  };

  it('publishes job updates to the jobs topic and asset changes to the owner topic', async () => {
    const result = await run([
      {
        eventName: 'MODIFY',
        dynamodb: {
          NewImage: { pk: { S: 'carlogjob_abc' }, jobId: { S: 'abc' }, status: { S: 'DONE' } },
          OldImage: { pk: { S: 'carlogjob_abc' }, status: { S: 'QUEUED_FOR_PROCESSING' } },
        },
      },
      {
        eventName: 'INSERT',
        dynamodb: {
          NewImage: {
            pk: { S: 'profile_racer1' },
            sk: { S: 'carlogasset_x' },
            profileId: { S: 'racer1' },
            assetId: { S: 'x' },
            assetType: { S: 'VIDEO' },
          },
        },
      },
    ]);

    const topics = mockIoTClient.commandCalls(PublishCommand).map((call) => call.args[0].input.topic);
    expect(topics).toEqual(['deepracer/test/carlogs/jobs', 'deepracer/test/carlogs/assets/racer1']);
    expect(result.batchItemFailures).toEqual([]);
  });

  it('reports a batch failure when publishing fails', async () => {
    mockIoTClient.on(PublishCommand).rejects(new Error('iot down'));

    const result = await run([
      {
        eventName: 'INSERT',
        dynamodb: {
          SequenceNumber: '1',
          NewImage: { pk: { S: 'carlogjob_abc' }, jobId: { S: 'abc' }, status: { S: 'CREATED' } },
        },
      },
    ]);

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: '1' }]);
  });
});
