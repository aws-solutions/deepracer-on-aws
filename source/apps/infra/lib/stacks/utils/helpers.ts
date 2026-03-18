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
