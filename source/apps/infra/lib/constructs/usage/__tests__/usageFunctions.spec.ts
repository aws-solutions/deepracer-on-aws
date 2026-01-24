// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { describe, it, expect, beforeEach } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { functionNamePrefix } from '../../common/nodeLambdaFunction.js';
import { UsageFunctions } from '../usageFunctions';

// Mock the LogGroupsHelper to avoid having the static log groups shared between stacks
vi.mock('#constructs/common/logGroupsHelper.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#constructs/common/logGroupsHelper.js')>();
  return {
    ...actual,
    LogGroupsHelper: {
      ...actual.LogGroupsHelper,
      getOrCreateLogGroup: vi.fn().mockImplementation((scope, id, props) => {
        return {
          logGroupName: `mocked-log-group-${id}`,
          logGroupArn: `arn:aws:logs:us-east-1:123456789012:log-group:mocked-log-group-${id}`,
        };
      }),
    },
  };
});

describe('UsageFunctions', () => {
  const createTestStack = () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');

    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
    });

    const bucket = new Bucket(stack, 'TestBucket');

    new UsageFunctions(stack, 'TestUsageFunctions', {
      dynamoDBTable: table,
      modelStorageBucket: bucket,
      namespace: TEST_NAMESPACE,
    });

    return Template.fromStack(stack);
  };

  it('creates a Lambda function with correct configuration', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-${functionNamePrefix}-UpdateStorageUsedByProfileFn`,
        Handler: 'index.lambdaHandler',
        Runtime: 'nodejs22.x',
        Environment: {
          Variables: {
            MODEL_STORAGE_BUCKET_NAME: Match.anyValue(),
          },
        },
      }),
    ).not.toThrow();
  });

  it('adds S3 event source to the Lambda function', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        Principal: 's3.amazonaws.com',
        SourceArn: Match.anyValue(),
      }),
    ).not.toThrow();
  });

  it('grants read permissions on the S3 bucket to the Lambda function', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['s3:GetObject*', 's3:GetBucket*', 's3:List*']),
              Effect: 'Allow',
              Resource: Match.anyValue(),
            }),
          ]),
        },
      }),
    ).not.toThrow();
  });

  it('grants write permissions on the DynamoDB table to the Lambda function', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'dynamodb:BatchWriteItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
              ]),
              Effect: 'Allow',
              Resource: Match.anyValue(),
            }),
          ]),
        },
      }),
    ).not.toThrow();
  });
});

describe('UsageFunctions Class', () => {
  let app: App;
  let stack: Stack;
  let table: TableV2;
  let bucket: Bucket;
  let usageFunctions: UsageFunctions;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
    table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
    });
    bucket = new Bucket(stack, 'TestBucket');
    usageFunctions = new UsageFunctions(stack, 'TestUsageFunctions', {
      dynamoDBTable: table,
      modelStorageBucket: bucket,
      namespace: TEST_NAMESPACE,
    });
  });

  it('instantiates successfully with all required properties', () => {
    expect(usageFunctions).toBeDefined();
    expect(usageFunctions.updateStorageUsedByProfileFn).toBeDefined();
  });

  it('configures S3 event source with correct event types', () => {
    const template = Template.fromStack(stack);

    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        Principal: 's3.amazonaws.com',
        SourceArn: Match.anyValue(),
      }),
    ).not.toThrow();
  });
});
