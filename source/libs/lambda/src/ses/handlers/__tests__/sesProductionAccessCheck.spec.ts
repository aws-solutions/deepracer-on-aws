// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetAccountCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import type { CloudFormationCustomResourceEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';

import { SesProductionAccessCheck } from '../sesProductionAccessCheck.js';

describe('sesproductionaccesscheck', () => {
  const sesv2Mock = mockClient(SESv2Client);

  const baseEvent: CloudFormationCustomResourceEvent = {
    RequestType: 'Create',
    ServiceToken: 'arn:aws:lambda:us-east-1:123456789012:function:test',
    ResponseURL: 'https://example.com/response',
    StackId: 'arn:aws:cloudformation:us-east-1:123456789012:stack/test/guid',
    RequestId: 'unique-id-1234',
    ResourceType: 'Custom::SesProductionAccessCheck',
    LogicalResourceId: 'SesProductionAccessCheck',
    ResourceProperties: {
      ServiceToken: 'arn:aws:lambda:us-east-1:123456789012:function:test',
      emailDeliveryMethod: 'SES',
    },
  };

  beforeEach(() => {
    sesv2Mock.reset();
  });

  it('returns success when production access is enabled', async () => {
    sesv2Mock.on(GetAccountCommand).resolves({
      ProductionAccessEnabled: true,
    });

    const result = await SesProductionAccessCheck(baseEvent);

    expect(result.Status).toBe('SUCCESS');
    expect(result.Data).toEqual({ ProductionAccessEnabled: 'true' });
  });

  it('throws when production access is not enabled', async () => {
    sesv2Mock.on(GetAccountCommand).resolves({
      ProductionAccessEnabled: false,
    });

    await expect(SesProductionAccessCheck(baseEvent)).rejects.toThrow(
      'SES production access is not enabled for this account',
    );
  });

  it('throws when production access field is undefined', async () => {
    sesv2Mock.on(GetAccountCommand).resolves({});

    await expect(SesProductionAccessCheck(baseEvent)).rejects.toThrow(
      'SES production access is not enabled for this account',
    );
  });

  it('returns success for delete requests without calling ses', async () => {
    const deleteEvent: CloudFormationCustomResourceEvent = {
      ...baseEvent,
      RequestType: 'Delete',
      PhysicalResourceId: 'ses-production-access-check',
    };

    const result = await SesProductionAccessCheck(deleteEvent);

    expect(result.Status).toBe('SUCCESS');
    expect(sesv2Mock.calls()).toHaveLength(0);
  });

  it('returns success for update requests when production access is enabled', async () => {
    sesv2Mock.on(GetAccountCommand).resolves({
      ProductionAccessEnabled: true,
    });

    const updateEvent: CloudFormationCustomResourceEvent = {
      ...baseEvent,
      RequestType: 'Update',
      PhysicalResourceId: 'ses-production-access-check',
      OldResourceProperties: baseEvent.ResourceProperties,
    };

    const result = await SesProductionAccessCheck(updateEvent);

    expect(result.Status).toBe('SUCCESS');
  });

  it('skips check and returns success when delivery method is cognito', async () => {
    const cognitoEvent: CloudFormationCustomResourceEvent = {
      ...baseEvent,
      ResourceProperties: {
        ...baseEvent.ResourceProperties,
        emailDeliveryMethod: 'COGNITO',
      },
    };

    const result = await SesProductionAccessCheck(cognitoEvent);

    expect(result.Status).toBe('SUCCESS');
    expect(sesv2Mock.calls()).toHaveLength(0);
  });

  it('skips check when delivery method is missing', async () => {
    const noMethodEvent: CloudFormationCustomResourceEvent = {
      ...baseEvent,
      ResourceProperties: {
        ServiceToken: baseEvent.ResourceProperties.ServiceToken,
      },
    };

    const result = await SesProductionAccessCheck(noMethodEvent);

    expect(result.Status).toBe('SUCCESS');
    expect(sesv2Mock.calls()).toHaveLength(0);
  });

  it('throws when ses api call fails', async () => {
    sesv2Mock.on(GetAccountCommand).rejects(new Error('Access denied'));

    await expect(SesProductionAccessCheck(baseEvent)).rejects.toThrow(
      'Unable to verify SES production access. Ensure the Lambda execution role has ses:GetAccount permission and try again.',
    );
  });

  it('throws with distinct message for non error exceptions', async () => {
    sesv2Mock.on(GetAccountCommand).rejects('unknown failure');

    await expect(SesProductionAccessCheck(baseEvent)).rejects.toThrow(
      'Unable to verify SES production access. Ensure the Lambda execution role has ses:GetAccount permission and try again.',
    );
  });
});
