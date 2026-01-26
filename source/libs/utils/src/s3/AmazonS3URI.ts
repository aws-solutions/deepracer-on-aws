// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export class AmazonS3URI {
  readonly bucket: string;
  readonly key: string;
  readonly uri: string;

  constructor(uri: string) {
    const url = new URL(uri);

    if (url.protocol !== 's3:') {
      throw new Error('Only S3 URI are supported.');
    }

    this.bucket = url.host;

    if (!this.bucket) {
      throw new Error(`Invalid S3 URI, no bucket: ${uri}`);
    }

    if (!url.pathname || url.pathname.length <= 1) {
      // s3://bucket or s3://bucket/
      throw new Error(`Invalid S3 URI, no key: ${uri}`);
    } else {
      // s3://bucket/key
      // Remove the leading '/' and any encoding.
      this.key = decodeURIComponent(url.pathname.slice(1));
    }

    this.uri = url.href;
  }
}
