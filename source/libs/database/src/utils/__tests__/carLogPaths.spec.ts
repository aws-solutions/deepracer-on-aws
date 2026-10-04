// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { carLogAssetId, carLogPaths } from '../carLogPaths.js';

describe('carLogPaths', () => {
  it('round-trips the job id of upload keys', () => {
    expect(carLogPaths.jobIdFromUploadKey(carLogPaths.carUploadKey('abcdefghij12345'))).toBe('abcdefghij12345');
    expect(carLogPaths.jobIdFromUploadKey(carLogPaths.manualUploadKey('abcdefghij12345'))).toBe('abcdefghij12345');
  });

  it('rejects keys outside the upload prefixes', () => {
    expect(carLogPaths.jobIdFromUploadKey('results/abcdefghij12345.json')).toBeUndefined();
    expect(carLogPaths.jobIdFromUploadKey('staging/car/../x.tar.gz')).toBeUndefined();
  });

  it('derives deterministic asset ids', () => {
    expect(carLogAssetId('k')).toBe(carLogAssetId('k'));
    expect(carLogAssetId('k')).not.toBe(carLogAssetId('k2'));
    expect(carLogAssetId('k')).toMatch(/^[0-9a-f]{64}$/);
  });
});
