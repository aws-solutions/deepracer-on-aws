// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Browser-specific types for aws-crt CredentialsProvider.
 * TypeScript resolves aws-crt/dist/native types at compile time, but Vite
 * resolves the browser bundle (aws-crt/dist.browser) at runtime. These
 * interfaces mirror the browser CredentialsProvider contract.
 */

declare module 'aws-crt/dist.browser/browser/auth' {
  export interface AWSCredentials {
    aws_region?: string;
    aws_access_id: string;
    aws_secret_key: string;
    aws_sts_token?: string;
  }

  export class CredentialsProvider {
    getCredentials(): AWSCredentials | undefined;
    refreshCredentials(): Promise<void>;
  }

  export class StaticCredentialProvider extends CredentialsProvider {
    credentials: AWSCredentials;
    constructor(credentials: AWSCredentials);
  }
}
