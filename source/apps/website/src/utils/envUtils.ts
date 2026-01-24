// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface EnvironmentConfig {
  apiEndpointUrl: string;
  userPoolId: string;
  userPoolClientId: string;
  identityPoolId: string;
  region: string;
  uploadBucketName: string;
}

declare global {
  interface Window {
    EnvironmentConfig: EnvironmentConfig;
  }
}

export const environmentConfig: EnvironmentConfig = {
  apiEndpointUrl: window.EnvironmentConfig?.apiEndpointUrl ?? 'https://localhost',
  userPoolId: window.EnvironmentConfig?.userPoolId ?? 'placeholder-user-pool-id',
  identityPoolId: window.EnvironmentConfig?.identityPoolId ?? 'placeholder-identity-pool-id',
  userPoolClientId: window.EnvironmentConfig?.userPoolClientId ?? 'placeholder-user-pool-client-id',
  region: window.EnvironmentConfig?.region ?? 'us-east-1',
  uploadBucketName: window.EnvironmentConfig?.uploadBucketName ?? 'upload-bucket',
};
