// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { decodeCursor, encodeCursor } from '../cursorUtils.js';

describe('cursorUtils', () => {
  describe('encodeCursor', () => {
    it('should encode a cursor object to base64 string', () => {
      const cursor = { pk: 'test', sk: 'value' };
      const encoded = encodeCursor(cursor);

      expect(encoded).toBe(Buffer.from(JSON.stringify(cursor)).toString('base64'));
    });

    it('should return null for null cursor', () => {
      expect(encodeCursor(null)).toBe(null);
    });

    it('should return null for undefined cursor', () => {
      expect(encodeCursor(undefined)).toBe(null);
    });

    it('should handle complex objects', () => {
      const cursor = {
        pk: 'model_profile',
        sk: 'model_abc123',
        nested: { value: 42, array: [1, 2, 3] },
      };
      const encoded = encodeCursor(cursor);

      expect(encoded).toBe(Buffer.from(JSON.stringify(cursor)).toString('base64'));
    });
  });

  describe('decodeCursor', () => {
    it('should decode a base64 string back to cursor object', () => {
      const cursor = { pk: 'test', sk: 'value' };
      const encoded = Buffer.from(JSON.stringify(cursor)).toString('base64');
      const decoded = decodeCursor(encoded);

      expect(decoded).toEqual(cursor);
    });

    it('should return undefined for null cursor', () => {
      expect(decodeCursor(null)).toBeUndefined();
    });

    it('should return undefined for undefined cursor', () => {
      expect(decodeCursor(undefined)).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(decodeCursor('')).toBeUndefined();
    });

    it('should handle complex objects', () => {
      const cursor = {
        pk: 'model_profile',
        sk: 'model_abc123',
        nested: { value: 42, array: [1, 2, 3] },
      };
      const encoded = Buffer.from(JSON.stringify(cursor)).toString('base64');
      const decoded = decodeCursor(encoded);

      expect(decoded).toEqual(cursor);
    });
  });

  describe('round-trip encoding/decoding', () => {
    it('should maintain data integrity through encode/decode cycle', () => {
      const originalCursor = {
        pk: 'evaluation_model',
        sk: 'evaluation_xyz789',
        timestamp: 1234567890,
        metadata: { count: 100, hasMore: true },
      };

      const encoded = encodeCursor(originalCursor);
      const decoded = decodeCursor(encoded);

      expect(decoded).toEqual(originalCursor);
    });

    it('should handle null values in round-trip', () => {
      expect(decodeCursor(encodeCursor(null))).toBeUndefined();
    });
  });
});
