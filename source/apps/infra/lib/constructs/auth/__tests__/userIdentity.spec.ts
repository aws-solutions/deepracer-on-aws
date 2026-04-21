// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { BASE_USER_POOL_NAME } from '@deepracer-indy/config/src/defaults/userPoolDefaults';
import { App, CfnCondition, Duration, Fn, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { describe, it, expect, beforeEach } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { createNodeLambdaFunctionMock, createLogGroupsHelperMock } from '../../../constants/testMocks.js';
import { functionNamePrefix } from '../../common/nodeLambdaFunction.js';
import { GlobalSettings } from '../../storage/appConfig.js';
import { BASE_IDENTITY_POOL_NAME, UserIdentity } from '../userIdentity';

// Mock the LogGroupsHelper to avoid having the static log groups shared between stacks
vi.mock('../../common/logGroupsHelper.js', () => createLogGroupsHelperMock());

// Mock NodeLambdaFunction to use inline code instead of esbuild bundling.
vi.mock('../../common/nodeLambdaFunction.js', () => createNodeLambdaFunctionMock());

describe('UserIdentity', () => {
  const createTestStack = () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');

    // Create a mock DynamoDB table
    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
    });

    const mockGlobalSettings = new GlobalSettings(stack, 'MockGlobalSettings', {
      namespace: TEST_NAMESPACE,
    });

    // Create the UserIdentity construct
    new UserIdentity(stack, 'TestUserIdentity', {
      dynamoDBTable: table,
      globalSettings: mockGlobalSettings,
      namespace: TEST_NAMESPACE,
    });

    return Template.fromStack(stack);
  };

  it('creates a user pool with correct configuration', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UserPoolName: `${TEST_NAMESPACE}-${BASE_USER_POOL_NAME}`,
        UsernameConfiguration: {
          CaseSensitive: false,
        },
        Policies: {
          PasswordPolicy: {
            MinimumLength: 8,
            RequireLowercase: true,
            RequireNumbers: true,
            RequireSymbols: true,
            RequireUppercase: true,
          },
        },
        AutoVerifiedAttributes: ['email'],
        AliasAttributes: ['email'],
        AdminCreateUserConfig: {
          AllowAdminCreateUserOnly: true,
        },
      }),
    ).not.toThrow();
  });

  it('creates a user pool client with correct configuration', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        RefreshTokenValidity: Duration.days(1).toMinutes(),
        ExplicitAuthFlows: ['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_USER_SRP_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
      }),
    ).not.toThrow();
  });

  it('creates an identity pool with correct configuration', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::Cognito::IdentityPool', {
        IdentityPoolName: `${TEST_NAMESPACE}-${BASE_IDENTITY_POOL_NAME}`,
        AllowUnauthenticatedIdentities: false,
      }),
    ).not.toThrow();
  });

  it('creates required user groups', () => {
    const template = createTestStack();

    // Verify admin group
    expect(() =>
      template.hasResourceProperties('AWS::Cognito::UserPoolGroup', {
        GroupName: 'dr-admins',
        Description: 'DeepRacer on AWS - Admin user group',
      }),
    ).not.toThrow();

    // Verify race facilitator group
    expect(() =>
      template.hasResourceProperties('AWS::Cognito::UserPoolGroup', {
        GroupName: 'dr-race-facilitators',
        Description: 'DeepRacer on AWS - Race facilitator user group',
      }),
    ).not.toThrow();

    // Verify racer group
    expect(() =>
      template.hasResourceProperties('AWS::Cognito::UserPoolGroup', {
        GroupName: 'dr-racers',
        Description: 'DeepRacer on AWS - Racer user group',
      }),
    ).not.toThrow();
  });

  it('creates required IAM roles', () => {
    const template = createTestStack();

    // Verify admin role
    expect(() =>
      template.hasResourceProperties(
        'AWS::IAM::Role',
        Match.objectLike({
          AssumeRolePolicyDocument: {
            Statement: [
              {
                Action: 'sts:AssumeRoleWithWebIdentity',
                Effect: 'Allow',
                Principal: {
                  Federated: 'cognito-identity.amazonaws.com',
                },
                Condition: {
                  StringEquals: {
                    'cognito-identity.amazonaws.com:aud': Match.anyValue(),
                  },
                  'ForAnyValue:StringLike': {
                    'cognito-identity.amazonaws.com:amr': 'authenticated',
                  },
                },
              },
            ],
            Version: '2012-10-17',
          },
        }),
      ),
    ).not.toThrow();
  });

  it('creates pre-signup lambda function with error alarm', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-${functionNamePrefix}-PreSignUpFn`,
        Handler: 'index.lambdaHandler',
        Runtime: 'nodejs22.x',
      }),
    ).not.toThrow();

    // Verify the CloudWatch alarms for Lambda errors
    expect(() =>
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: `${TEST_NAMESPACE}-PreSignUpFunctionErrors`,
        Namespace: 'AWS/Lambda',
        Dimensions: [
          {
            Name: 'FunctionName',
            Value: Match.anyValue(),
          },
        ],
        Period: 60,
        Statistic: 'Sum',
        Threshold: 1,
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
        EvaluationPeriods: 1,
        TreatMissingData: 'notBreaching',
        AlarmDescription: 'Alert when a PreSignUpFunction failure occurs',
      }),
    ).not.toThrow();

    expect(() =>
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: `${TEST_NAMESPACE}-PostSignUpFunctionErrors`,
        Namespace: 'AWS/Lambda',
        Dimensions: [
          {
            Name: 'FunctionName',
            Value: Match.anyValue(),
          },
        ],
        Period: 60,
        Statistic: 'Sum',
        Threshold: 1,
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
        EvaluationPeriods: 1,
        TreatMissingData: 'notBreaching',
        AlarmDescription: 'Alert when a PostSignUpFunction failure occurs',
      }),
    ).not.toThrow();
  });

  it('grants DynamoDB permissions to pre-signup lambda', () => {
    const template = createTestStack();

    // The policy should contain both DynamoDB and X-Ray permissions
    expect(() =>
      template.hasResourceProperties(
        'AWS::IAM::Policy',
        Match.objectLike({
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: Match.arrayWith([
              Match.objectLike({
                Action: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords'],
                Effect: 'Allow',
                Resource: '*',
              }),
              Match.objectLike({
                Action: Match.arrayWith([
                  'dynamodb:BatchGetItem',
                  'dynamodb:GetRecords',
                  'dynamodb:GetShardIterator',
                  'dynamodb:Query',
                  'dynamodb:GetItem',
                  'dynamodb:Scan',
                  'dynamodb:ConditionCheckItem',
                  'dynamodb:BatchWriteItem',
                  'dynamodb:PutItem',
                  'dynamodb:UpdateItem',
                  'dynamodb:DeleteItem',
                  'dynamodb:DescribeTable',
                ]),
                Effect: 'Allow',
                Resource: Match.anyValue(),
              }),
            ]),
          },
        }),
      ),
    ).not.toThrow();
  });

  it('creates identity pool role mappings', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::Cognito::IdentityPoolRoleAttachment', {
        RoleMappings: {
          'cognito-user-pool': {
            Type: 'Rules',
            AmbiguousRoleResolution: 'Deny',
            RulesConfiguration: {
              Rules: [
                {
                  Claim: 'cognito:groups',
                  MatchType: 'Contains',
                  Value: 'dr-admins',
                  RoleARN: Match.anyValue(),
                },
                {
                  Claim: 'cognito:groups',
                  MatchType: 'Contains',
                  Value: 'dr-race-facilitators',
                  RoleARN: Match.anyValue(),
                },
                {
                  Claim: 'cognito:groups',
                  MatchType: 'Contains',
                  Value: 'dr-racers',
                  RoleARN: Match.anyValue(),
                },
              ],
            },
          },
        },
      }),
    ).not.toThrow();
  });

  it('creates admin group assignment resources when adminEmail is provided', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
    });

    const mockGlobalSettings = new GlobalSettings(stack, 'MockGlobalSettings', {
      namespace: TEST_NAMESPACE,
    });

    new UserIdentity(stack, 'TestUserIdentity', {
      dynamoDBTable: table,
      globalSettings: mockGlobalSettings,
      adminEmail: 'admin@example.com',
      namespace: TEST_NAMESPACE,
    });

    const template = Template.fromStack(stack);

    // Verify the Lambda function is created
    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-${functionNamePrefix}-AddAdminToGroupFn`,
        Handler: 'index.lambdaHandler',
      }),
    ).not.toThrow();

    // Verify Lambda has permission to add users to groups
    expect(() =>
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            {
              Action: ['cognito-idp:AdminAddUserToGroup', 'cognito-idp:AdminCreateUser'],
              Effect: 'Allow',
              Resource: Match.anyValue(),
            },
          ]),
        },
      }),
    ).not.toThrow();

    // Verify Custom Resource is created with correct properties
    expect(() =>
      template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
        ServiceToken: Match.anyValue(),
        userPoolId: Match.anyValue(),
        adminEmail: 'admin@example.com',
      }),
    ).not.toThrow();
  });

  it('creates profile role change handler lambda function', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-${functionNamePrefix}-ProfileRoleChangeHandler`,
      }),
    ).not.toThrow();
  });

  it('creates profile email change handler lambda function', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-${functionNamePrefix}-ProfileEmailChangeHandler`,
      }),
    ).not.toThrow();
  });

  it('creates EventBridge rule for Cognito group membership changes', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::Events::Rule', {
        EventPattern: {
          source: ['aws.cognito-idp'],
          'detail-type': ['AWS API Call via CloudTrail'],
          detail: {
            eventSource: ['cognito-idp.amazonaws.com'],
            eventName: ['AdminAddUserToGroup', 'AdminRemoveUserFromGroup'],
            requestParameters: {
              userPoolId: Match.anyValue(),
            },
          },
        },
      }),
    ).not.toThrow();

    expect(() =>
      template.hasResourceProperties('AWS::Events::Rule', {
        Targets: Match.arrayWith([
          Match.objectLike({
            Arn: Match.anyValue(),
            Id: Match.anyValue(),
          }),
        ]),
      }),
    ).not.toThrow();
  });

  it('creates EventBridge rule for Cognito user attribute changes', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::Events::Rule', {
        EventPattern: {
          source: ['aws.cognito-idp'],
          'detail-type': ['AWS API Call via CloudTrail'],
          detail: {
            eventSource: ['cognito-idp.amazonaws.com'],
            eventName: ['AdminUpdateUserAttributes'],
            requestParameters: {
              userPoolId: Match.anyValue(),
            },
          },
        },
      }),
    ).not.toThrow();
  });

  it('creates post-confirmation lambda function with correct configuration', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-${functionNamePrefix}-PostConfirmationFn`,
        Handler: 'index.lambdaHandler',
        Runtime: 'nodejs22.x',
      }),
    ).not.toThrow();
  });

  it('grants AppConfig permissions to pre-signup lambda', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            {
              Action: ['appconfig:GetLatestConfiguration', 'appconfig:StartConfigurationSession'],
              Effect: 'Allow',
              Resource: Match.anyValue(),
            },
          ]),
        },
      }),
    ).not.toThrow();
  });

  it('grants Cognito permissions to post-confirmation lambda', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            {
              Action: 'cognito-idp:AdminAddUserToGroup',
              Effect: 'Allow',
              Resource: Match.anyValue(),
            },
          ]),
        },
      }),
    ).not.toThrow();
  });

  it('grants Cognito permissions to profile role change handler', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            {
              Action: 'cognito-idp:ListUsers',
              Effect: 'Allow',
              Resource: Match.anyValue(),
            },
          ]),
        },
      }),
    ).not.toThrow();
  });

  it('grants DynamoDB write permissions to profile role change handler', () => {
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
                'dynamodb:DescribeTable',
              ]),
              Effect: 'Allow',
              Resource: Match.anyValue(),
            }),
          ]),
        },
      }),
    ).not.toThrow();
  });

  it('configures user pool with correct sign-in aliases', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        AliasAttributes: ['email'],
      }),
    ).not.toThrow();
  });

  it('configures user pool with correct self sign-up setting', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        AdminCreateUserConfig: {
          AllowAdminCreateUserOnly: !deepRacerIndyAppConfig.userPool.enableSignups,
        },
      }),
    ).not.toThrow();
  });

  it('configures user pool with custom invitation message', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        AdminCreateUserConfig: {
          InviteMessageTemplate: {
            EmailSubject: 'Welcome to DeepRacer on AWS',
            EmailMessage: Match.stringLikeRegexp('.*You have been invited to join DeepRacer on AWS.*'),
          },
        },
      }),
    ).not.toThrow();
  });

  it('exposes userRoles property with all three roles', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
    });
    const mockGlobalSettings = new GlobalSettings(stack, 'MockGlobalSettings', {
      namespace: TEST_NAMESPACE,
    });

    const userIdentity = new UserIdentity(stack, 'TestUserIdentity', {
      dynamoDBTable: table,
      globalSettings: mockGlobalSettings,
      namespace: TEST_NAMESPACE,
    });

    expect(userIdentity.userRoles).toBeDefined();
    expect(userIdentity.userRoles.adminRole).toBeDefined();
    expect(userIdentity.userRoles.raceFacilitatorRole).toBeDefined();
    expect(userIdentity.userRoles.racerRole).toBeDefined();
  });
});

describe('UserIdentity Class', () => {
  let app: App;
  let stack: Stack;
  let table: TableV2;
  let userIdentity: UserIdentity;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
    table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
    });

    const mockGlobalSettings = new GlobalSettings(stack, 'MockGlobalSettings', {
      namespace: TEST_NAMESPACE,
    });

    userIdentity = new UserIdentity(stack, 'TestUserIdentity', {
      dynamoDBTable: table,
      globalSettings: mockGlobalSettings,
      namespace: TEST_NAMESPACE,
    });
  });

  it('instantiates successfully with all required properties', () => {
    expect(userIdentity.userPool).toBeDefined();
    expect(userIdentity.userPoolClient).toBeDefined();
    expect(userIdentity.identityPool).toBeDefined();
    expect(userIdentity.profileRoleChangeHandler).toBeDefined();
    expect(userIdentity.profileEmailChangeHandler).toBeDefined();
  });

  it('exposes the correct user pool properties', () => {
    expect(userIdentity.userPool.userPoolId).toBeDefined();
    expect(userIdentity.userPoolClient.userPoolClientId).toBeDefined();
    expect(userIdentity.identityPool.ref).toBeDefined();
  });

  it('configures identity pool with correct settings', () => {
    expect(userIdentity.identityPool.allowUnauthenticatedIdentities).toBe(false);
    expect(userIdentity.identityPool.cognitoIdentityProviders).toEqual([
      {
        clientId: userIdentity.userPoolClient.userPoolClientId,
        providerName: userIdentity.userPool.userPoolProviderName,
      },
    ]);
  });

  it('configures user pool with correct name', () => {
    const template = Template.fromStack(stack);
    expect(() =>
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UserPoolName: `${TEST_NAMESPACE}-${BASE_USER_POOL_NAME}`,
      }),
    ).not.toThrow();
  });

  it('configures user pool client with correct auth flows', () => {
    const template = Template.fromStack(stack);
    expect(() =>
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ExplicitAuthFlows: ['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_USER_SRP_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
      }),
    ).not.toThrow();
  });

  it('configures profile role change handler with correct permissions', () => {
    expect(userIdentity.profileRoleChangeHandler).toBeDefined();

    const template = Template.fromStack(stack);
    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-${functionNamePrefix}-ProfileRoleChangeHandler`,
      }),
    ).not.toThrow();
  });
});

describe('UserIdentity - Conditional SES Email Configuration', () => {
  const createSesEnabledStack = () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');

    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
    });

    const mockGlobalSettings = new GlobalSettings(stack, 'MockGlobalSettings', {
      namespace: TEST_NAMESPACE,
    });

    const isSesEnabled = new CfnCondition(stack, 'IsSesEnabled', {
      expression: Fn.conditionEquals('SES', 'SES'),
    });

    new UserIdentity(stack, 'TestUserIdentity', {
      dynamoDBTable: table,
      globalSettings: mockGlobalSettings,
      namespace: TEST_NAMESPACE,
      isSesEnabled,
      sesVerifiedEmail: 'test@example.com',
    });

    return Template.fromStack(stack);
  };

  it('CfnUserPool EmailConfiguration contains Fn::If with correct SES and COGNITO branches', () => {
    const template = createSesEnabledStack();

    template.hasResourceProperties('AWS::Cognito::UserPool', {
      EmailConfiguration: {
        EmailSendingAccount: {
          'Fn::If': ['IsSesEnabled', 'DEVELOPER', 'COGNITO_DEFAULT'],
        },
        SourceArn: {
          'Fn::If': Match.arrayWith(['IsSesEnabled']),
        },
        From: {
          'Fn::If': Match.arrayWith(['IsSesEnabled']),
        },
      },
    });
    expect(template).toBeDefined();
  });

  it('EmailConfiguration sourceArn references the SES identity when IsSesEnabled is true', () => {
    const template = createSesEnabledStack();
    const templateJson = JSON.stringify(template.toJSON());

    expect(templateJson).toContain('identity/test@example.com');
    expect(templateJson).toContain('"IsSesEnabled"');
  });

  it('EmailConfiguration from references the SES verified email when IsSesEnabled is true', () => {
    const template = createSesEnabledStack();

    expect(() =>
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        EmailConfiguration: {
          From: {
            'Fn::If': ['IsSesEnabled', 'test@example.com', { Ref: 'AWS::NoValue' }],
          },
        },
      }),
    ).not.toThrow();
  });
});

describe('UserIdentity - CustomMessage Trigger', () => {
  const createTestStack = () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');

    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
    });

    const mockGlobalSettings = new GlobalSettings(stack, 'MockGlobalSettings', {
      namespace: TEST_NAMESPACE,
    });

    new UserIdentity(stack, 'TestUserIdentity', {
      dynamoDBTable: table,
      globalSettings: mockGlobalSettings,
      namespace: TEST_NAMESPACE,
    });

    return Template.fromStack(stack);
  };

  it('creates CustomMessage Lambda function', () => {
    const template = createTestStack();

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: `${TEST_NAMESPACE}-${functionNamePrefix}-CognitoEmailMetricFn`,
      Handler: 'index.lambdaHandler',
      Runtime: 'nodejs22.x',
    });
    expect(template).toBeDefined();
  });

  it('CfnUserPool lambdaConfig includes CustomMessage trigger', () => {
    const template = createTestStack();

    template.hasResourceProperties('AWS::Cognito::UserPool', {
      LambdaConfig: Match.objectLike({
        CustomMessage: Match.anyValue(),
      }),
    });
    expect(template).toBeDefined();
  });
});

describe('Feature: ses-email-delivery, Property 1: User Pool logical ID stability', () => {
  const synthesizeWithDeliveryMethod = (method: 'COGNITO' | 'SES') => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');

    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
    });

    const mockGlobalSettings = new GlobalSettings(stack, 'MockGlobalSettings', {
      namespace: TEST_NAMESPACE,
    });

    const isSesEnabled = new CfnCondition(stack, 'IsSesEnabled', {
      expression: Fn.conditionEquals(method, 'SES'),
    });

    new UserIdentity(stack, 'TestUserIdentity', {
      dynamoDBTable: table,
      globalSettings: mockGlobalSettings,
      namespace: TEST_NAMESPACE,
      isSesEnabled,
      sesVerifiedEmail: 'test@example.com',
    });

    return Template.fromStack(stack);
  };

  const getUserPoolLogicalIds = (template: Template): string[] => {
    const resources = template.findResources('AWS::Cognito::UserPool');
    return Object.keys(resources);
  };

  it.each(['COGNITO', 'SES'] as const)('User Pool logical ID is stable when EmailDeliveryMethod is %s', (method) => {
    const template = synthesizeWithDeliveryMethod(method);
    const logicalIds = getUserPoolLogicalIds(template);
    expect(logicalIds).toHaveLength(1);
  });

  it('User Pool logical ID is identical for COGNITO and SES delivery methods', () => {
    const cognitoTemplate = synthesizeWithDeliveryMethod('COGNITO');
    const sesTemplate = synthesizeWithDeliveryMethod('SES');

    const cognitoLogicalIds = getUserPoolLogicalIds(cognitoTemplate);
    const sesLogicalIds = getUserPoolLogicalIds(sesTemplate);

    expect(cognitoLogicalIds).toEqual(sesLogicalIds);
  });
});

describe('UserIdentity - SES Reputation Alarms', () => {
  const createSesStack = () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');

    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
    });

    const mockGlobalSettings = new GlobalSettings(stack, 'MockGlobalSettings', {
      namespace: TEST_NAMESPACE,
    });

    const isSesEnabled = new CfnCondition(stack, 'IsSesEnabled', {
      expression: Fn.conditionEquals('SES', 'SES'),
    });

    new UserIdentity(stack, 'TestUserIdentity', {
      dynamoDBTable: table,
      globalSettings: mockGlobalSettings,
      namespace: TEST_NAMESPACE,
      isSesEnabled,
      sesVerifiedEmail: 'test@example.com',
    });

    return Template.fromStack(stack);
  };

  it('creates bounce rate alarm with 5% threshold when SES is enabled', () => {
    const template = createSesStack();

    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      Namespace: 'AWS/SES',
      MetricName: 'Reputation.BounceRate',
      Threshold: 0.05,
      ComparisonOperator: 'GreaterThanThreshold',
    });
    expect(template).toBeDefined();
  });

  it('creates complaint rate alarm with 0.1% threshold when SES is enabled', () => {
    const template = createSesStack();

    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      Namespace: 'AWS/SES',
      MetricName: 'Reputation.ComplaintRate',
      Threshold: 0.001,
      ComparisonOperator: 'GreaterThanThreshold',
    });
    expect(template).toBeDefined();
  });

  it('SES reputation alarms are conditional on IsSesEnabled when SES is configured', () => {
    const template = createSesStack();

    const alarms = template.findResources('AWS::CloudWatch::Alarm', {
      Properties: {
        Namespace: 'AWS/SES',
      },
    });

    expect(Object.keys(alarms)).toHaveLength(2);
    // Alarms are conditional on IsSesEnabled so they only exist when SES delivery is active
    for (const logicalId of Object.keys(alarms)) {
      expect(alarms[logicalId].Condition).toBe('IsSesEnabled');
    }
  });

  it('does not create SES reputation alarms when SES is not configured', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');

    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
    });

    const mockGlobalSettings = new GlobalSettings(stack, 'MockGlobalSettings', {
      namespace: TEST_NAMESPACE,
    });

    new UserIdentity(stack, 'TestUserIdentity', {
      dynamoDBTable: table,
      globalSettings: mockGlobalSettings,
      namespace: TEST_NAMESPACE,
    });

    const template = Template.fromStack(stack);
    const sesAlarms = template.findResources('AWS::CloudWatch::Alarm', {
      Properties: {
        Namespace: 'AWS/SES',
      },
    });

    expect(Object.keys(sesAlarms)).toHaveLength(0);
  });
});
