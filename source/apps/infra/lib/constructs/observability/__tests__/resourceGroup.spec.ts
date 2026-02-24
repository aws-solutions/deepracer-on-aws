// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, it, expect, beforeEach } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { drTagName, getDrTagValue } from '../../common/taggingHelper.js';
import { ResourceGroup } from '../resourceGroup.js';

describe('ResourceGroup', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
  });

  it('should create a resource group', () => {
    new ResourceGroup(stack, 'TestResourceGroup', {
      namespace: TEST_NAMESPACE,
    });

    const template = Template.fromStack(stack);

    expect(() => {
      template.resourceCountIs('AWS::ResourceGroups::Group', 1);
    }).not.toThrow();

    expect(() => {
      template.hasResourceProperties('AWS::ResourceGroups::Group', {
        Name: `${TEST_NAMESPACE}-DeepRacerOnAWS-TaggedResourceGroup`,
        ResourceQuery: {
          Query: {
            ResourceTypeFilters: ['AWS::AllSupported'],
            TagFilters: [
              {
                Key: drTagName,
                Values: [getDrTagValue(TEST_NAMESPACE)],
              },
            ],
          },
          Type: 'TAG_FILTERS_1_0',
        },
      });
    }).not.toThrow();
  });
});
