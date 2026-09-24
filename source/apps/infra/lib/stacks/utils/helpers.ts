// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Names } from 'aws-cdk-lib';
import { md5hash } from 'aws-cdk-lib/core/lib/helpers-internal';
import { IConstruct } from 'constructs';

/**
 * Returns the image tag or 'latest' if not provided
 * @param imageTag The image tag to use
 * @returns The image tag or 'latest' as default
 */
export function getImageTag(imageTag?: string): string {
  return imageTag || 'latest';
}

/**
 * Generates a Unique ID for a given Construct. Walks up the node
 * hierarchy similar to CloudFormation to derive its name.
 *
 * Appends an 8 character hash of the path
 * @param construct Construct to generate a Unique ID
 * @param prefix Optional prefix
 * @param suffix Optional suffix
 * @returns string representing a unique id with the provided prefix and suffix
 */
export function generateUniqueConstructId(
  construct: IConstruct,
  prefix: string | undefined = '',
  suffix: string | undefined = '',
): string {
  //  Leverage CDK uniqueResourceName to walk the node hierarchy
  const baseId = Names.uniqueResourceName(construct, { maxLength: 240, separator: '' });
  const withoutHash = baseId.slice(0, -8);
  const fullId = `${prefix}${withoutHash}${suffix}`;
  const hash = md5hash(fullId).slice(0, 8).toUpperCase();
  const withHash = `${fullId}${hash}`;

  //  Deeply embedded resources can exceed the character limit
  if (withHash.length > 240) {
    return withHash.slice(0, 120) + withHash.slice(-120);
  }

  return withHash;
}

/**
 * Context values needed to resolve a single container image's source registry and repo name.
 */
export interface ImageContextOverride {
  /** The default registry used when this image has no override (e.g. PUBLIC_ECR_REGISTRY) */
  defaultRegistry: string;
  /** The registry to use when this image's own repo-name override is set, if any */
  overrideRegistry: string | undefined;
  /** The default repo name for this image (e.g. from SIMAPP_REPO_NAME) */
  defaultRepoName: string;
  /** This image's own repo-name override, if any (e.g. from OVERRIDE_SIMAPP_REPO_NAME) */
  overrideRepoName: string | undefined;
}

/**
 * Resolves the repo name and registry to use for a single container image.
 *
 * An image redirects to the override registry only when BOTH an override registry and that
 * image's own repo-name override are set — images that don't set their own override stay
 * pinned to the default registry, even when other images are redirected via the same shared
 * override registry value.
 */
export function resolveImageSource({
  defaultRegistry,
  overrideRegistry,
  defaultRepoName,
  overrideRepoName,
}: ImageContextOverride): { repoName: string; registry: string } {
  const repoName = overrideRepoName ?? defaultRepoName;
  const registry = overrideRegistry && overrideRepoName ? overrideRegistry : defaultRegistry;
  return { repoName, registry };
}
