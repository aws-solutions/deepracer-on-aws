// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnResource, Tags } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

export const drTagName = 'aws-solutions:dr-id';
const drTagPrefix = 'DeepRacerOnAWS';

export function getDrTagValue(namespace: string) {
  return `${drTagPrefix}-${namespace}`;
}

export function applyDrTag(scope: IConstruct, namespace: string) {
  tagAll(scope, {
    tagName: drTagName,
    tagValue: getDrTagValue(namespace),
  });
}

/**
 * Tags all resources within a scope
 * Using Aspects or Tag.of on the stack results in
 * We detected an Aspect was added via another Aspect, and will not be applied [ack: @aws-cdk/core:ignoredAspect]
 */
export function tagAll(
  scope: IConstruct,
  options: {
    tagName: string;
    tagValue: string;
    excludeResourceTypes?: string[];
  },
) {
  scope.node.findAll().forEach((node: IConstruct) => {
    if (node instanceof CfnResource) {
      const shouldExclude = options.excludeResourceTypes?.includes(node.cfnResourceType);
      if (!shouldExclude) {
        Tags.of(node).add(options.tagName, options.tagValue);
      }
    }
  });
}
