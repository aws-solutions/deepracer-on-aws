// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Decodes a base64-encoded cursor string back to its original object form
 * @param cursor - The base64-encoded cursor string
 * @returns The decoded cursor object or undefined if cursor is null/undefined
 */
export function decodeCursor<T = Record<string, unknown>>(cursor?: string | null): T | undefined {
  return cursor ? JSON.parse(Buffer.from(cursor, 'base64').toString()) : undefined;
}

/**
 * Encodes a cursor object to a base64 string for pagination
 * @param cursor - The cursor object to encode
 * @returns The base64-encoded cursor string or null if cursor is null/undefined
 */
export function encodeCursor<T = Record<string, unknown>>(cursor?: T | null): string | null {
  return cursor ? Buffer.from(JSON.stringify(cursor)).toString('base64') : null;
}
