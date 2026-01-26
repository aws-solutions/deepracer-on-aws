// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack, NestedStack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { describe, it, expect, beforeEach } from 'vitest';

import { applyDrTag, tagAll, drTagName, drTagValue } from '../taggingHelper.js';

const TEST_LAMBDA_CONFIG = {
  runtime: Runtime.NODEJS_LATEST,
  handler: 'index.handler',
  code: Code.fromInline('exports.handler = async () => {};'),
} as const;

const TEST_ROLE_ID = 'TestRole';
const TEST_FUNCTION_ID = 'TestFunction';

function createTestResources(scope: Construct, idPrefix = '') {
  const role = new Role(scope, `${idPrefix}${TEST_ROLE_ID}`, {
    assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
  });
  const lambda = new Function(scope, `${idPrefix}${TEST_FUNCTION_ID}`, TEST_LAMBDA_CONFIG);
  return { role, lambda };
}

class TestNestedStack extends NestedStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    createTestResources(this, 'Nested');
  }
}

describe('taggingHelper', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
  });

  it('should tag IAM role and Lambda function', () => {
    createTestResources(stack);

    applyDrTag(stack);

    const template = Template.fromStack(stack);

    expect(() => {
      template.hasResourceProperties('AWS::IAM::Role', {
        Tags: [{ Key: drTagName, Value: drTagValue }],
      });
    }).not.toThrow();

    expect(() => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Tags: [{ Key: drTagName, Value: drTagValue }],
      });
    }).not.toThrow();
  });

  it('should tag resources in nested stack', () => {
    const nestedStack = new TestNestedStack(stack, 'NestedStack');

    createTestResources(stack, 'Parent');

    applyDrTag(stack);

    const parentTemplate = Template.fromStack(stack);
    const nestedTemplate = Template.fromStack(nestedStack);

    expect(() => {
      parentTemplate.hasResourceProperties('AWS::IAM::Role', {
        Tags: [{ Key: drTagName, Value: drTagValue }],
      });
    }).not.toThrow();

    expect(() => {
      parentTemplate.hasResourceProperties('AWS::Lambda::Function', {
        Tags: [{ Key: drTagName, Value: drTagValue }],
      });
    }).not.toThrow();

    expect(() => {
      nestedTemplate.hasResourceProperties('AWS::IAM::Role', {
        Tags: [{ Key: drTagName, Value: drTagValue }],
      });
    }).not.toThrow();

    expect(() => {
      nestedTemplate.hasResourceProperties('AWS::Lambda::Function', {
        Tags: [{ Key: drTagName, Value: drTagValue }],
      });
    }).not.toThrow();
  });

  it('should handle empty stack without errors', () => {
    const emptyStack = new Stack(app, 'EmptyStack');

    expect(() => applyDrTag(emptyStack)).not.toThrow();

    const template = Template.fromStack(emptyStack);
    expect(template).toBeDefined();
  });

  it('should exclude specified resource types', () => {
    createTestResources(stack);

    tagAll(stack, {
      tagName: drTagName,
      tagValue: drTagValue,
      excludeResourceTypes: ['AWS::IAM::Role'],
    });

    const template = Template.fromStack(stack);

    expect(() => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Tags: [{ Key: drTagName, Value: drTagValue }],
      });
    }).not.toThrow();

    expect(() => {
      template.hasResourceProperties('AWS::IAM::Role', {
        Tags: [{ Key: drTagName, Value: drTagValue }],
      });
    }).toThrow();

    expect(() => {
      template.hasResourceProperties('AWS::IAM::Role', {});
    }).not.toThrow();
  });
});
