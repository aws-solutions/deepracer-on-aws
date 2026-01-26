// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Returns the image tag or 'latest' if not provided
 * @param imageTag The image tag to use
 * @returns The image tag or 'latest' as default
 */
export function getImageTag(imageTag?: string): string {
  return imageTag || 'latest';
}
