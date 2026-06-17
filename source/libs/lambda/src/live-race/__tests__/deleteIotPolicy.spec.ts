// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DeletePolicyCommand, DetachPolicyCommand, IoTClient, ListTargetsForPolicyCommand } from '@aws-sdk/client-iot';
import type {
  CloudFormationCustomResourceCreateEvent,
  CloudFormationCustomResourceDeleteEvent,
  CloudFormationCustomResourceUpdateEvent,
} from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, it, expect, beforeEach } from 'vitest';

import { onEventHandler, isCompleteHandler } from '../deleteIotPolicy.js';

const iotMock = mockClient(IoTClient);

const baseEvent = {
  ServiceToken: 'token',
  ResponseURL: 'https://example.com',
  StackId: 'stack-id',
  RequestId: 'request-id',
  LogicalResourceId: 'resource-id',
  ResourceType: 'Custom::DeleteIoTPolicy',
  ResourceProperties: { ServiceToken: 'token', policyName: 'test-SpectatorIoTPolicy' },
};

describe('onEventHandler', () => {
  beforeEach(() => iotMock.reset());

  it('no-ops on Create', async () => {
    await onEventHandler({ ...baseEvent, RequestType: 'Create' } as CloudFormationCustomResourceCreateEvent);
    expect(iotMock.calls()).toHaveLength(0);
  });

  it('no-ops on Update', async () => {
    await onEventHandler({
      ...baseEvent,
      RequestType: 'Update',
      PhysicalResourceId: 'id',
      OldResourceProperties: { ServiceToken: 'token' },
    } as CloudFormationCustomResourceUpdateEvent);
    expect(iotMock.calls()).toHaveLength(0);
  });

  it('detaches all principals across pages', async () => {
    iotMock
      .on(ListTargetsForPolicyCommand)
      .resolvesOnce({ targets: ['arn:a', 'arn:b'], nextMarker: 'page2' })
      .resolvesOnce({ targets: ['arn:c'] });
    iotMock.on(DetachPolicyCommand).resolves({});

    await onEventHandler({
      ...baseEvent,
      RequestType: 'Delete',
      PhysicalResourceId: 'id',
    } as CloudFormationCustomResourceDeleteEvent);

    const listCalls = iotMock.commandCalls(ListTargetsForPolicyCommand);
    expect(listCalls).toHaveLength(2);
    expect(listCalls[0].args[0].input).toMatchObject({ policyName: 'test-SpectatorIoTPolicy', marker: undefined });
    expect(listCalls[1].args[0].input).toMatchObject({ policyName: 'test-SpectatorIoTPolicy', marker: 'page2' });
    expect(iotMock.commandCalls(DetachPolicyCommand)).toHaveLength(3);
    expect(iotMock.commandCalls(DeletePolicyCommand)).toHaveLength(0);
  });

  it('is idempotent when ListTargetsForPolicy throws ResourceNotFoundException', async () => {
    iotMock
      .on(ListTargetsForPolicyCommand)
      .rejectsOnce(Object.assign(new Error('not found'), { name: 'ResourceNotFoundException' }));

    await expect(
      onEventHandler({
        ...baseEvent,
        RequestType: 'Delete',
        PhysicalResourceId: 'id',
      } as CloudFormationCustomResourceDeleteEvent),
    ).resolves.toBeUndefined();
  });

  it('tolerates ResourceNotFoundException and UnauthorizedException from DetachPolicy', async () => {
    iotMock.on(ListTargetsForPolicyCommand).resolves({ targets: ['arn:a', 'arn:b'] });
    iotMock
      .on(DetachPolicyCommand, { target: 'arn:a' })
      .rejectsOnce(Object.assign(new Error('gone'), { name: 'ResourceNotFoundException' }));
    iotMock
      .on(DetachPolicyCommand, { target: 'arn:b' })
      .rejectsOnce(Object.assign(new Error('unauth'), { name: 'UnauthorizedException' }));

    await expect(
      onEventHandler({
        ...baseEvent,
        RequestType: 'Delete',
        PhysicalResourceId: 'id',
      } as CloudFormationCustomResourceDeleteEvent),
    ).resolves.toBeUndefined();
  });

  it('propagates unexpected errors from DetachPolicy', async () => {
    iotMock.on(ListTargetsForPolicyCommand).resolves({ targets: ['arn:a'] });
    iotMock.on(DetachPolicyCommand).rejectsOnce(Object.assign(new Error('throttled'), { name: 'ThrottlingException' }));

    await expect(
      onEventHandler({
        ...baseEvent,
        RequestType: 'Delete',
        PhysicalResourceId: 'id',
      } as CloudFormationCustomResourceDeleteEvent),
    ).rejects.toThrow('throttled');
  });
});

describe('isCompleteHandler', () => {
  beforeEach(() => iotMock.reset());

  it('returns IsComplete: true for Create/Update', async () => {
    await expect(
      isCompleteHandler({ ...baseEvent, RequestType: 'Create' } as CloudFormationCustomResourceCreateEvent),
    ).resolves.toEqual({ IsComplete: true });
    expect(iotMock.calls()).toHaveLength(0);
  });

  it('returns IsComplete: true when delete succeeds', async () => {
    iotMock.on(DeletePolicyCommand).resolves({});
    await expect(
      isCompleteHandler({
        ...baseEvent,
        RequestType: 'Delete',
        PhysicalResourceId: 'id',
      } as CloudFormationCustomResourceDeleteEvent),
    ).resolves.toEqual({ IsComplete: true });
  });

  it('returns IsComplete: false on DeleteConflictException (propagation window)', async () => {
    iotMock
      .on(DeletePolicyCommand)
      .rejectsOnce(Object.assign(new Error('conflict'), { name: 'DeleteConflictException' }));
    await expect(
      isCompleteHandler({
        ...baseEvent,
        RequestType: 'Delete',
        PhysicalResourceId: 'id',
      } as CloudFormationCustomResourceDeleteEvent),
    ).resolves.toEqual({ IsComplete: false });
  });

  it('returns IsComplete: true when policy already deleted', async () => {
    iotMock
      .on(DeletePolicyCommand)
      .rejectsOnce(Object.assign(new Error('not found'), { name: 'ResourceNotFoundException' }));
    await expect(
      isCompleteHandler({
        ...baseEvent,
        RequestType: 'Delete',
        PhysicalResourceId: 'id',
      } as CloudFormationCustomResourceDeleteEvent),
    ).resolves.toEqual({ IsComplete: true });
  });

  it('propagates unexpected errors', async () => {
    iotMock.on(DeletePolicyCommand).rejectsOnce(new Error('throttled'));
    await expect(
      isCompleteHandler({
        ...baseEvent,
        RequestType: 'Delete',
        PhysicalResourceId: 'id',
      } as CloudFormationCustomResourceDeleteEvent),
    ).rejects.toThrow('throttled');
  });
});
