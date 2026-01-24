// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';

import { getImageTag } from '../helpers.js';

describe('getImageTag', () => {
  it('returns provided tag when tag is given', () => {
    expect(getImageTag('v1.0.0')).toBe('v1.0.0');
  });

  it('returns latest when tag is undefined', () => {
    expect(getImageTag(undefined)).toBe('latest');
  });

  it('returns latest when tag is empty string', () => {
    expect(getImageTag('')).toBe('latest');
  });

  it('returns latest when no parameter is provided', () => {
    expect(getImageTag()).toBe('latest');
  });
});
