// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { isSafeBagDirName, parseBagDirName } from '../bagMatcher.js';

describe('parseBagDirName', () => {
  it('extracts the trailing model id', () => {
    expect(parseBagDirName('Alice_FastModel_abcdefghij12345-20250102-030405')).toEqual({
      modelId: 'abcdefghij12345',
      recordedAt: '20250102-030405',
    });
  });

  it('copes with underscores and hyphens in racer and model names', () => {
    expect(parseBagDirName('Team_Red-1_my_model-v2_ABCdefghij12345-20250102-030405')?.modelId).toBe('ABCdefghij12345');
  });

  it('uses the last id-shaped token when a name looks like an id itself', () => {
    expect(parseBagDirName('abcdefghij12345_abcdefghij12345_zzzzzzzzzz99999-20250102-030405')?.modelId).toBe(
      'zzzzzzzzzz99999',
    );
  });

  it.each([
    'Alice_FastModel-20250102-030405',
    'Alice_FastModel_abcdefghij1234-20250102-030405',
    'Alice_FastModel_abcdefghij123456-20250102-030405',
    'Alice_FastModel_abcdefghij12345-2025010-030405',
    'Alice_FastModel_abcdefghij12345',
    '',
  ])('does not match %j', (name) => {
    expect(parseBagDirName(name)).toBeUndefined();
  });

  it('rejects names with unsafe characters', () => {
    expect(parseBagDirName('../Alice_M_abcdefghij12345-20250102-030405')).toBeUndefined();
    expect(parseBagDirName('A b_M_abcdefghij12345-20250102-030405')).toBeUndefined();
    expect(isSafeBagDirName('x'.repeat(201))).toBe(false);
  });
});
