// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnGroup } from 'aws-cdk-lib/aws-resourcegroups';
import { Construct } from 'constructs';

import { drTagName, getDrTagValue } from '../common/taggingHelper.js';

interface ResourceGroupProps {
  namespace: string;
}

export class ResourceGroup extends Construct {
  constructor(scope: Construct, id: string, { namespace }: ResourceGroupProps) {
    super(scope, id);

    new CfnGroup(this, 'TaggedResourceGroup', {
      name: `${namespace}-DeepRacerOnAWS-TaggedResourceGroup`,
      resourceQuery: {
        query: {
          resourceTypeFilters: ['AWS::AllSupported'],
          tagFilters: [
            {
              key: drTagName,
              values: [getDrTagValue(namespace)],
            },
          ],
        },
        type: 'TAG_FILTERS_1_0',
      },
    });
  }
}
