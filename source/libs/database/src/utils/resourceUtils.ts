// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { randomBytes } from 'node:crypto';

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { customAlphabet, urlAlphabet } from 'nanoid';

import type { ResourceId } from '../types/resource.js';

/**
 * - "_" is not accepted in resource names by some AWS services
 * - "-" is used as our workflow job identifier separator (in addition to making IDs frustrating to copy+paste)
 */
const awsSafeAlphabet = urlAlphabet.replace('_', '').replace('-', '');
const nanoid = customAlphabet(awsSafeAlphabet, deepRacerIndyAppConfig.dynamoDB.resourceIdLength);

/**
 * Generates a secure URL-friendly unique ID typed as a special string.
 */
export const generateResourceId = () => {
  return nanoid() as ResourceId;
};

/** Crockford base32 alphabet used by ULID (excludes I, L, O, U). */
const ULID_ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ULID_TIME_LEN = 10;
const ULID_RANDOM_LEN = 16; // 16 chars × 5 bits = 80 bits of randomness (ULID spec)

/** Encode a millisecond timestamp as 10 big-endian Crockford base32 chars (48-bit range). */
const encodeUlidTime = (now: number): string => {
  let time = now;
  let out = '';
  for (let i = 0; i < ULID_TIME_LEN; i++) {
    out = ULID_ENCODING[time % 32] + out;
    time = Math.floor(time / 32);
  }
  return out;
};

/**
 * Encode 16 Crockford base32 chars of randomness. Each random byte maps to one char via `% 32`;
 * because 256 is an exact multiple of 32 the mapping is unbiased (no modulo skew), and it avoids
 * bitwise operators (repo lint rule).
 */
const encodeUlidRandom = (): string => {
  const bytes = randomBytes(ULID_RANDOM_LEN);
  let out = '';
  for (const byte of bytes) {
    out += ULID_ENCODING[byte % 32];
  }
  return out;
};

/**
 * Generate a ULID (Crockford base32, 26 chars): a 48-bit millisecond timestamp followed by 80 bits
 * of randomness.
 */
export const generateUlid = (): string => encodeUlidTime(Date.now()) + encodeUlidRandom();
