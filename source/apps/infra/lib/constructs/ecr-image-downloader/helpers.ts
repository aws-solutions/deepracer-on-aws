// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ImageRepositoryMapping } from './ecrImageDownloaderWithTrigger.js';

export function extractEcrLoginMap(imageRepositoryMappings: ImageRepositoryMapping[]): string[] {
  return Array.from(
    new Set(
      imageRepositoryMappings
        .map((mapping) => {
          const match = mapping.publicImageUri.match(/^(\d{12})\.dkr\.ecr\.([^.]+)\.amazonaws\.com/);
          return match ? `${match[1]}:${match[2]}` : null;
        })
        .filter((tuple): tuple is string => tuple !== null),
    ),
  );
}

export function generateEcrLoginCommands(ecrLoginMap: string[]): string[] {
  return ecrLoginMap.map((tuple) => {
    const [accountId, region] = tuple.split(':');
    return `aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${accountId}.dkr.ecr.${region}.amazonaws.com || { echo "ERROR: Failed to authenticate with Amazon ECR"; exit 1; }`;
  });
}
