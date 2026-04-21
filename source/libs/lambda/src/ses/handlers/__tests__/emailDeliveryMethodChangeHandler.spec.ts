// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logger } from '@deepracer-indy/utils';
import type { CloudFormationCustomResourceEvent } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailDeliveryMethodChangeHandler } from '../emailDeliveryMethodChangeHandler.js';

describe('emaildeliverymethodchangehandler', () => {
  const baseEvent: CloudFormationCustomResourceEvent = {
    RequestType: 'Create',
    ServiceToken: 'arn:aws:lambda:us-east-1:123456789012:function:test',
    ResponseURL: 'https://example.com/response',
    StackId: 'arn:aws:cloudformation:us-east-1:123456789012:stack/test/guid',
    RequestId: 'unique-id-1234',
    ResourceType: 'Custom::EmailDeliveryMethodAudit',
    LogicalResourceId: 'EmailDeliveryMethodAudit',
    ResourceProperties: {
      ServiceToken: 'arn:aws:lambda:us-east-1:123456789012:function:test',
      emailDeliveryMethod: 'COGNITO',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs delivery method on create and returns success', async () => {
    const infoSpy = vi.spyOn(logger, 'info');

    const result = await EmailDeliveryMethodChangeHandler(baseEvent);

    expect(result.Status).toBe('SUCCESS');
    expect(result.Data).toEqual({ emailDeliveryMethod: 'COGNITO' });
    expect(infoSpy).toHaveBeenCalledWith(
      'Email delivery method configuration',
      expect.objectContaining({
        requestType: 'Create',
        emailDeliveryMethod: 'COGNITO',
        changed: false,
      }),
    );
  });

  it('logs previous method on update when delivery method changes', async () => {
    const infoSpy = vi.spyOn(logger, 'info');

    const updateEvent: CloudFormationCustomResourceEvent = {
      ...baseEvent,
      RequestType: 'Update',
      PhysicalResourceId: 'email-delivery-method-audit',
      OldResourceProperties: {
        ...baseEvent.ResourceProperties,
        emailDeliveryMethod: 'COGNITO',
      },
      ResourceProperties: {
        ...baseEvent.ResourceProperties,
        emailDeliveryMethod: 'SES',
        sesVerifiedEmail: 'test@example.com',
      },
    };

    const result = await EmailDeliveryMethodChangeHandler(updateEvent);

    expect(result.Status).toBe('SUCCESS');
    expect(infoSpy).toHaveBeenCalledWith(
      'Email delivery method configuration',
      expect.objectContaining({
        requestType: 'Update',
        emailDeliveryMethod: 'SES',
        previousMethod: 'COGNITO',
        changed: true,
      }),
    );
  });

  it('logs unchanged on update when delivery method stays same', async () => {
    const infoSpy = vi.spyOn(logger, 'info');

    const updateEvent: CloudFormationCustomResourceEvent = {
      ...baseEvent,
      RequestType: 'Update',
      PhysicalResourceId: 'email-delivery-method-audit',
      OldResourceProperties: baseEvent.ResourceProperties,
    };

    const result = await EmailDeliveryMethodChangeHandler(updateEvent);

    expect(result.Status).toBe('SUCCESS');
    expect(infoSpy).toHaveBeenCalledWith(
      'Email delivery method configuration',
      expect.objectContaining({
        changed: false,
      }),
    );
  });

  it('returns success for delete without logging', async () => {
    const infoSpy = vi.spyOn(logger, 'info');

    const deleteEvent: CloudFormationCustomResourceEvent = {
      ...baseEvent,
      RequestType: 'Delete',
      PhysicalResourceId: 'email-delivery-method-audit',
    };

    const result = await EmailDeliveryMethodChangeHandler(deleteEvent);

    expect(result.Status).toBe('SUCCESS');
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('includes ses verified email when provided', async () => {
    const infoSpy = vi.spyOn(logger, 'info');

    const sesEvent: CloudFormationCustomResourceEvent = {
      ...baseEvent,
      ResourceProperties: {
        ...baseEvent.ResourceProperties,
        emailDeliveryMethod: 'SES',
        sesVerifiedEmail: 'admin@example.com',
      },
    };

    await EmailDeliveryMethodChangeHandler(sesEvent);

    expect(infoSpy).toHaveBeenCalledWith(
      'Email delivery method configuration',
      expect.objectContaining({
        sesVerifiedEmail: 'admin@example.com',
      }),
    );
  });
});
