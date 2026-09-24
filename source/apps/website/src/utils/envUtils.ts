// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface EnvironmentConfig {
  apiEndpointUrl: string;
  userPoolId: string;
  userPoolClientId: string;
  identityPoolId: string;
  region: string;
  uploadBucketName: string;
  iotEndpoint?: string;
  namespace?: string;
  solutionVersion?: string;
  cloudFrontDomainName?: string;
}

declare global {
  interface Window {
    EnvironmentConfig: EnvironmentConfig;
  }
}

export const environmentConfig: EnvironmentConfig = {
  apiEndpointUrl: globalThis.window?.EnvironmentConfig?.apiEndpointUrl ?? 'https://localhost',
  userPoolId: globalThis.window?.EnvironmentConfig?.userPoolId ?? 'placeholder-user-pool-id',
  identityPoolId: globalThis.window?.EnvironmentConfig?.identityPoolId ?? 'placeholder-identity-pool-id',
  userPoolClientId: globalThis.window?.EnvironmentConfig?.userPoolClientId ?? 'placeholder-user-pool-client-id',
  region: globalThis.window?.EnvironmentConfig?.region ?? 'us-east-1',
  uploadBucketName: globalThis.window?.EnvironmentConfig?.uploadBucketName ?? 'upload-bucket',
  iotEndpoint: globalThis.window?.EnvironmentConfig?.iotEndpoint,
  namespace: globalThis.window?.EnvironmentConfig?.namespace,
  solutionVersion: globalThis.window?.EnvironmentConfig?.solutionVersion,
  cloudFrontDomainName: globalThis.window?.EnvironmentConfig?.cloudFrontDomainName,
};
