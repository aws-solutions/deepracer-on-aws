// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { BASE_TABLE_NAME } from '@deepracer-indy/config/src/defaults/dynamoDBDefaults.js';
import { DynamoDBItemAttribute, GlobalSecondaryIndex, LocalSecondaryIndex } from '@deepracer-indy/database';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DynamoDBTableProps {
  namespace: string;
}

/**
 * DynamoDB table for DeepRacer Indy.
 */
export class DynamoDBTable extends Construct {
  readonly dynamoDBTable: TableV2;

  constructor(scope: Construct, id: string, props: DynamoDBTableProps) {
    super(scope, id);

    const tableName = `${props.namespace}-${BASE_TABLE_NAME}`;

    this.dynamoDBTable = new TableV2(this, 'Table', {
      tableName,
      partitionKey: { name: DynamoDBItemAttribute.PK, type: AttributeType.STRING },
      sortKey: { name: DynamoDBItemAttribute.SK, type: AttributeType.STRING },
      globalSecondaryIndexes: [
        {
          indexName: GlobalSecondaryIndex.GSI1,
          partitionKey: {
            name: DynamoDBItemAttribute.GSI1_PK,
            type: AttributeType.STRING,
          },
          sortKey: {
            name: DynamoDBItemAttribute.GSI1_SK,
            type: AttributeType.STRING,
          },
        },
        {
          indexName: 'sk-index',
          partitionKey: {
            name: 'sk',
            type: AttributeType.STRING,
          },
        },
      ],
      localSecondaryIndexes: [
        {
          indexName: LocalSecondaryIndex.CLOSE_TIME,
          sortKey: {
            name: DynamoDBItemAttribute.CLOSE_TIME,
            type: AttributeType.STRING,
          },
        },
        {
          indexName: LocalSecondaryIndex.RANKING_SCORE,
          sortKey: {
            name: DynamoDBItemAttribute.RANKING_SCORE,
            type: AttributeType.NUMBER,
          },
        },
      ],
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
    });
  }
}
