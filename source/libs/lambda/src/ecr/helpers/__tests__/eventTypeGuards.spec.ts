// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { isCustomResourceEvent, isAPIGatewayEvent } from '../eventTypeGuards.js';

describe('eventTypeGuards', () => {
  describe('isCustomResourceEvent', () => {
    it('should return true for valid CloudFormation custom resource event', () => {
      const event = {
        RequestType: 'Create',
        ResourceType: 'Custom::TestResource',
        LogicalResourceId: 'TestLogicalId',
        StackId: 'test-stack-id',
        RequestId: 'test-request-id',
        ResourceProperties: {},
      };

      expect(isCustomResourceEvent(event)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isCustomResourceEvent(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isCustomResourceEvent(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isCustomResourceEvent('string')).toBe(false);
      expect(isCustomResourceEvent(123)).toBe(false);
      expect(isCustomResourceEvent(true)).toBe(false);
    });

    it('should return false for object missing RequestType', () => {
      const event = {
        ResourceType: 'Custom::TestResource',
        LogicalResourceId: 'TestLogicalId',
      };

      expect(isCustomResourceEvent(event)).toBe(false);
    });

    it('should return false for object missing ResourceType', () => {
      const event = {
        RequestType: 'Create',
        LogicalResourceId: 'TestLogicalId',
      };

      expect(isCustomResourceEvent(event)).toBe(false);
    });

    it('should return false for object missing LogicalResourceId', () => {
      const event = {
        RequestType: 'Create',
        ResourceType: 'Custom::TestResource',
      };

      expect(isCustomResourceEvent(event)).toBe(false);
    });
  });

  describe('isAPIGatewayEvent', () => {
    it('should return true for valid API Gateway event', () => {
      const event = {
        httpMethod: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        path: '/test',
        body: '{}',
      };

      expect(isAPIGatewayEvent(event)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isAPIGatewayEvent(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isAPIGatewayEvent(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isAPIGatewayEvent('string')).toBe(false);
      expect(isAPIGatewayEvent(123)).toBe(false);
      expect(isAPIGatewayEvent(true)).toBe(false);
    });

    it('should return false for object missing httpMethod', () => {
      const event = {
        headers: {
          'Content-Type': 'application/json',
        },
      };

      expect(isAPIGatewayEvent(event)).toBe(false);
    });

    it('should return false for object missing headers', () => {
      const event = {
        httpMethod: 'POST',
      };

      expect(isAPIGatewayEvent(event)).toBe(false);
    });
  });
});
