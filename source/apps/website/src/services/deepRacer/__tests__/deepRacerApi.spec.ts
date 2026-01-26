// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';

import { sanitizeErrorMessage } from '../deepRacerApi.js';

// Mock the notification slice
vi.mock('../../../store/notifications/notificationsSlice.js', () => ({
  displayErrorNotification: vi.fn(),
}));

// Mock the deepRacerClient
vi.mock('../deepRacerClient.js', () => ({
  deepRacerClient: {
    send: vi.fn(),
  },
}));

describe('deepRacerApi error sanitization', () => {
  it('should sanitize errors containing execute-api:Invoke and not authorized to perform', () => {
    // Mock an error that would contain both required strings when converted to string
    const mockError = {
      name: 'AccessDenied',
      message:
        'User: arn:aws:iam::123456789012:user/testuser is not authorized to perform: execute-api:Invoke on resource: arn:aws:execute-api:us-west-2:123456789012:*/*/POST/*',
      toString: () =>
        'User: arn:aws:iam::123456789012:user/testuser is not authorized to perform: execute-api:Invoke on resource: arn:aws:execute-api:us-west-2:123456789012:*/*/POST/*',
    };

    const result = sanitizeErrorMessage(mockError);
    expect(result).toBe("You don't have permission to perform this action");
  });

  it('should sanitize errors with different format but containing both required strings', () => {
    const mockError = {
      name: 'Forbidden',
      message: 'Access denied: not authorized to perform execute-api:Invoke action',
      toString: () => 'AccessDenied: User is not authorized to perform execute-api:Invoke on this resource',
    };

    const result = sanitizeErrorMessage(mockError);
    expect(result).toBe("You don't have permission to perform this action");
  });

  it('should preserve original message when execute-api:Invoke is present but not authorized to perform is missing', () => {
    const mockError = {
      name: 'SomeError',
      message: 'Failed to invoke execute-api:Invoke due to invalid parameters',
      toString: () => 'Failed to invoke execute-api:Invoke due to invalid parameters',
    };

    const result = sanitizeErrorMessage(mockError);
    expect(result).toBe('Failed to invoke execute-api:Invoke due to invalid parameters');
  });

  it('should preserve original message when not authorized to perform is present but execute-api:Invoke is missing', () => {
    const mockError = {
      name: 'AuthError',
      message: 'User is not authorized to perform this action on the resource',
      toString: () => 'User is not authorized to perform this action on the resource',
    };

    const result = sanitizeErrorMessage(mockError);
    expect(result).toBe('User is not authorized to perform this action on the resource');
  });

  it('should preserve original messages for standard AWS service errors', () => {
    const serviceErrors = [
      {
        name: 'NotFoundError',
        message: 'Model not found',
        toString: () => 'NotFoundError: Model not found',
      },
      {
        name: 'ValidationException',
        message: 'Model name must be between 1 and 255 characters',
        toString: () => 'ValidationException: Model name must be between 1 and 255 characters',
      },
      {
        name: 'InternalFailureError',
        message: 'Service temporarily unavailable',
        toString: () => 'InternalFailureError: Service temporarily unavailable',
      },
      {
        name: 'NotAuthorizedError',
        message: 'User not authorized for this resource',
        toString: () => 'NotAuthorizedError: User not authorized for this resource',
      },
    ];

    serviceErrors.forEach((error) => {
      const result = sanitizeErrorMessage(error);
      expect(result).toBe(error.message);
    });
  });

  it('should handle errors without message property', () => {
    const errorWithoutMessage = {
      name: 'SomeError',
      toString: () => 'SomeError occurred',
    };

    const result = sanitizeErrorMessage(errorWithoutMessage);
    expect(result).toBe('An error occurred'); // Fallback when error.message is undefined
  });

  it('should handle errors with custom toString implementation', () => {
    const errorWithCustomToString = {
      name: 'CustomError',
      message: 'Custom error message',
      toString: () => 'Custom string representation that includes execute-api:Invoke and not authorized to perform',
    };

    const result = sanitizeErrorMessage(errorWithCustomToString);
    expect(result).toBe("You don't have permission to perform this action");
  });

  it('should be case sensitive for the required strings', () => {
    const errorWithDifferentCase = {
      name: 'CaseError',
      message: 'Case sensitive test',
      toString: () => 'User is NOT AUTHORIZED TO PERFORM Execute-Api:Invoke', // Different case
    };

    const result = sanitizeErrorMessage(errorWithDifferentCase);
    expect(result).toBe('Case sensitive test'); // Should preserve original message
  });

  describe('comprehensive coverage of execute-api:Invoke && not authorized to perform logic', () => {
    it('should sanitize when both strings appear in different order', () => {
      const mockError = {
        name: 'AuthError',
        message: 'Some error occurred',
        toString: () => 'execute-api:Invoke failed because user is not authorized to perform this action',
      };

      const result = sanitizeErrorMessage(mockError);
      expect(result).toBe("You don't have permission to perform this action");
    });

    it('should sanitize when both strings appear with different spacing and formatting', () => {
      const mockError = {
        name: 'APIError',
        message: 'API call failed',
        toString: () => 'Error: User not authorized to perform action execute-api:Invoke on resource xyz',
      };

      const result = sanitizeErrorMessage(mockError);
      expect(result).toBe("You don't have permission to perform this action");
    });

    it('should NOT sanitize when only execute-api:Invoke is present', () => {
      const mockError = {
        name: 'APIError',
        message: 'API Gateway error',
        toString: () => 'Failed to call execute-api:Invoke due to network timeout',
      };

      const result = sanitizeErrorMessage(mockError);
      expect(result).toBe('API Gateway error');
    });

    it('should NOT sanitize when only not authorized to perform is present', () => {
      const mockError = {
        name: 'AuthError',
        message: 'Authorization failed',
        toString: () => 'User is not authorized to perform this database operation',
      };

      const result = sanitizeErrorMessage(mockError);
      expect(result).toBe('Authorization failed');
    });

    it('should NOT sanitize when execute-api:Invoke has different case', () => {
      const mockError = {
        name: 'APIError',
        message: 'API error',
        toString: () => 'User is not authorized to perform EXECUTE-API:INVOKE action',
      };

      const result = sanitizeErrorMessage(mockError);
      expect(result).toBe('API error');
    });

    it('should NOT sanitize when not authorized to perform has different case', () => {
      const mockError = {
        name: 'AuthError',
        message: 'Auth error',
        toString: () => 'User is NOT AUTHORIZED TO PERFORM execute-api:Invoke',
      };

      const result = sanitizeErrorMessage(mockError);
      expect(result).toBe('Auth error');
    });

    it('should handle String() conversion of primitive values', () => {
      const stringError = 'String error containing execute-api:Invoke and not authorized to perform';

      const result = sanitizeErrorMessage(stringError);
      expect(result).toBe("You don't have permission to perform this action");
    });

    it('should handle String() conversion of number values', () => {
      const numberError = 123;

      const result = sanitizeErrorMessage(numberError);
      expect(result).toBe('An error occurred'); // No message property on numbers
    });

    it('should verify both strings must be exact substring matches', () => {
      const testCases = [
        {
          description: 'partial execute-api match',
          toString: () => 'execute-api and not authorized to perform',
          expectedMessage: 'Test message',
        },
        {
          description: 'partial not authorized match',
          toString: () => 'execute-api:Invoke and not authorized',
          expectedMessage: 'Test message',
        },
        {
          description: 'both strings with extra characters',
          toString: () => 'prefix-execute-api:Invoke-suffix and extra-not authorized to perform-suffix',
          expectedMessage: "You don't have permission to perform this action",
        },
      ];

      testCases.forEach(({ description, toString, expectedMessage }) => {
        const mockError = {
          name: 'TestError',
          message: 'Test message',
          toString,
        };

        const result = sanitizeErrorMessage(mockError);
        expect(result).toBe(expectedMessage);
      });
    });

    it('should work with errors that have complex toString implementations', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }

        toString() {
          return `${this.name}: User is not authorized to perform execute-api:Invoke - ${this.message}`;
        }
      }

      const customError = new CustomError('Custom error details');
      const result = sanitizeErrorMessage(customError);
      expect(result).toBe("You don't have permission to perform this action");
    });
  });
});
