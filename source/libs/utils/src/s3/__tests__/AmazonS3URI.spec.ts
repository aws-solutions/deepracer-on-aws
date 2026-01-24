// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AmazonS3URI } from '../AmazonS3URI.js';

describe('AmazonS3URI', () => {
  it('should parse out the bucket and key for a valid S3 URI', () => {
    const bucket = 'bucket';
    const key = 'key/path/item.json';
    const validS3Uri = `s3://${bucket}/${key}`;

    const s3Uri = new AmazonS3URI(validS3Uri);

    expect(s3Uri.bucket).toBe(bucket);
    expect(s3Uri.key).toBe(key);
    expect(s3Uri.uri).toBe(validS3Uri);
  });

  it('should throw if given a non-S3 URI', () => {
    expect(() => new AmazonS3URI('https://bucket-name.s3.region-code.amazonaws.com/key-name')).toThrow(
      'Only S3 URI are supported.',
    );
  });

  it('should throw if given an S3 URI with no bucket', () => {
    const noBucketS3Uri = 's3://';
    expect(() => new AmazonS3URI(noBucketS3Uri)).toThrow(`Invalid S3 URI, no bucket: ${noBucketS3Uri}`);
  });

  it('should throw if given an S3 URI with no key', () => {
    const noKeyS3Uri = 's3://bucket';
    const noKeyS3Uri2 = 's3://bucket/';

    expect(() => new AmazonS3URI(noKeyS3Uri)).toThrow(`Invalid S3 URI, no key: ${noKeyS3Uri}`);
    expect(() => new AmazonS3URI(noKeyS3Uri2)).toThrow(`Invalid S3 URI, no key: ${noKeyS3Uri2}`);
  });
});
