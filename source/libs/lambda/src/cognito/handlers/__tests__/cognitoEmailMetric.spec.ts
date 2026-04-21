// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { logger } from '@deepracer-indy/utils';
import type { CustomMessageTriggerEvent, Context, Callback } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CognitoEmailMetricHandler } from '../cognitoEmailMetric.js';

describe('CognitoEmailMetricHandler', () => {
  const cloudwatchMock = mockClient(CloudWatchClient);
  const context = {} as Context;
  const callback = vi.fn() as unknown as Callback<unknown>;

  const baseEvent: CustomMessageTriggerEvent = {
    version: '1',
    region: 'us-east-1',
    userPoolId: 'us-east-1_TestPool',
    userName: 'test-user',
    callerContext: {
      awsSdkVersion: 'aws-sdk-unknown-unknown',
      clientId: 'test-client-id',
    },
    triggerSource: 'CustomMessage_SignUp',
    request: {
      userAttributes: { sub: 'user-sub-123', email: 'test@example.com' },
      codeParameter: '{####}',
      linkParameter: '{##Click Here##}',
      usernameParameter: 'test-user',
    },
    response: {
      smsMessage: null,
      emailMessage: null,
      emailSubject: null,
    },
  };

  beforeEach(() => {
    cloudwatchMock.reset();
    vi.stubEnv('NAMESPACE', 'test-namespace');
  });

  it('should return the event unchanged on successful metric publish', async () => {
    cloudwatchMock.on(PutMetricDataCommand).resolves({});

    const result = await CognitoEmailMetricHandler(baseEvent, context, callback);

    expect(result).toEqual(baseEvent);
  });

  it('should return the event unchanged when PutMetricData fails', async () => {
    cloudwatchMock.on(PutMetricDataCommand).rejects(new Error('CloudWatch error'));
    const warnSpy = vi.spyOn(logger, 'warn');

    const result = await CognitoEmailMetricHandler(baseEvent, context, callback);

    expect(result).toEqual(baseEvent);
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to publish email metric',
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });

  it('should call PutMetricData with correct parameters', async () => {
    cloudwatchMock.on(PutMetricDataCommand).resolves({});

    await CognitoEmailMetricHandler(baseEvent, context, callback);

    expect(cloudwatchMock.calls()).toHaveLength(1);
    const call = cloudwatchMock.calls()[0];
    expect(call.args[0].input).toEqual({
      Namespace: 'DeepRacerOnAWS/Email',
      MetricData: [
        {
          MetricName: 'TransactionalEmailSent',
          Value: 1,
          Unit: 'Count',
          Dimensions: [
            {
              Name: 'Namespace',
              Value: 'test-namespace',
            },
          ],
        },
      ],
    });
  });

  it('should use default namespace when NAMESPACE env var is not set', async () => {
    vi.stubEnv('NAMESPACE', '');
    delete process.env.NAMESPACE;
    cloudwatchMock.on(PutMetricDataCommand).resolves({});

    await CognitoEmailMetricHandler(baseEvent, context, callback);

    const call = cloudwatchMock.calls()[0];
    const input = call.args[0].input as PutMetricDataCommand['input'];
    const dimensions = input.MetricData?.[0]?.Dimensions;
    expect(dimensions).toEqual([{ Name: 'Namespace', Value: 'default' }]);
  });
});
