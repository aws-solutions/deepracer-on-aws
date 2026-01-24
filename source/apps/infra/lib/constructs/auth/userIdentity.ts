// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { BASE_USER_POOL_NAME } from '@deepracer-indy/config/src/defaults/userPoolDefaults';
import { aws_events_targets, CfnOutput, CustomResource, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Alarm, ComparisonOperator, Metric, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import {
  UserPool,
  IUserPool,
  UserPoolClient,
  CfnUserPoolGroup,
  CfnIdentityPool,
  CfnIdentityPoolRoleAttachment,
} from 'aws-cdk-lib/aws-cognito';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Rule } from 'aws-cdk-lib/aws-events';
import { FederatedPrincipal, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

import { addCfnGuardSuppressionForAutoCreatedLambdas } from '../common/cfnGuardHelper.js';
import { LogGroupCategory, LogGroupsHelper } from '../common/logGroupsHelper.js';
import { functionNamePrefix, NodeLambdaFunction } from '../common/nodeLambdaFunction.js';
import { grantAppConfigAccess } from '../common/permissionsHelper.js';
import { GlobalSettings } from '../storage/appConfig.js';

export interface UserRoles {
  adminRole: Role;
  raceFacilitatorRole: Role;
  racerRole: Role;
}

export interface UserIdentityProps {
  dynamoDBTable: TableV2;
  globalSettings: GlobalSettings;
  adminEmail?: string;
  namespace: string;
}

export const BASE_IDENTITY_POOL_NAME = 'dr-idp';

export class UserIdentity extends Construct {
  readonly userPool: UserPool | IUserPool;
  readonly userPoolClient: UserPoolClient;
  readonly identityPool: CfnIdentityPool;
  readonly userRoles: UserRoles;

  readonly profileRoleChangeHandler: NodeLambdaFunction;
  readonly profileEmailChangeHandler: NodeLambdaFunction;
  readonly emailTemplateSyncHandler: NodeLambdaFunction;

  readonly preSignUpErrorAlarm: Alarm;
  readonly postSignUpErrorAlarm: Alarm;

  private readonly namespace: string;

  constructor(scope: Construct, id: string, props: UserIdentityProps) {
    super(scope, id);

    const { dynamoDBTable, globalSettings, adminEmail, namespace } = props;
    this.namespace = namespace;

    // Configure the pre-signup hook
    const preSignUpFn = new NodeLambdaFunction(this, 'PreSignUpFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/cognito/handlers/preSignUp.ts'),
      functionName: `${functionNamePrefix}-PreSignUpFn`,
      logGroupCategory: LogGroupCategory.USER_IDENTITY,
      namespace,
      environment: {
        AWS_APPCONFIG_APPLICATION_ID: globalSettings.app.attrApplicationId,
        AWS_APPCONFIG_ENVIRONMENT_ID: globalSettings.environment.attrEnvironmentId,
        AWS_APPCONFIG_CONFIGURATION_PROFILE_ID: globalSettings.configurationProfile.attrConfigurationProfileId,
        AWS_APPCONFIG_DEPLOYMENT_STRATEGY: globalSettings.deploymentStrategy.attrId,
      },
    });

    dynamoDBTable.grantReadWriteData(preSignUpFn);
    grantAppConfigAccess(this, preSignUpFn, globalSettings);

    const preSignUpFnErrorMetric = new Metric({
      namespace: 'AWS/Lambda',
      metricName: `${namespace}-PreSignUpFunctionErrors`,
      dimensionsMap: {
        FunctionName: preSignUpFn.functionName,
      },
      period: Duration.minutes(1),
      statistic: 'Sum',
    });

    this.preSignUpErrorAlarm = new Alarm(this, 'PreSignUpErrorAlarm', {
      metric: preSignUpFnErrorMetric,
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Alert when a PreSignUpFunction failure occurs',
    });

    // Configure the post-confirmation hook
    const postConfirmationFn = new NodeLambdaFunction(this, 'PostConfirmationFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/cognito/handlers/postConfirmation.ts'),
      functionName: `${functionNamePrefix}-PostConfirmationFn`,
      logGroupCategory: LogGroupCategory.USER_IDENTITY,
      namespace: props.namespace,
    });

    const postSignUpFnErrorMetric = new Metric({
      namespace: 'AWS/Lambda',
      metricName: `${namespace}-PostSignUpFunctionErrors`,
      dimensionsMap: {
        FunctionName: postConfirmationFn.functionName,
      },
      period: Duration.minutes(1),
      statistic: 'Sum',
    });

    this.postSignUpErrorAlarm = new Alarm(this, 'PostSignUpErrorAlarm', {
      metric: postSignUpFnErrorMetric,
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Alert when a PostSignUpFunction failure occurs',
    });

    // Configure the user pool
    this.userPool = new UserPool(this, 'UserPool', {
      lambdaTriggers: {
        preSignUp: preSignUpFn,
        postConfirmation: postConfirmationFn,
      },
      signInAliases: {
        email: true,
        username: true,
      },
      userPoolName: `${namespace}-${BASE_USER_POOL_NAME}`,
      signInCaseSensitive: false,
      passwordPolicy: {
        requireDigits: true,
        requireLowercase: true,
        requireSymbols: true,
        requireUppercase: true,
        minLength: 8,
      },
      selfSignUpEnabled: deepRacerIndyAppConfig.userPool.enableSignups,
      userInvitation: {
        emailSubject: 'Welcome to DeepRacer on AWS',
        emailBody:
          'Hello,<br><br>You have been invited to join DeepRacer on AWS. Your temporary password is: {####}<br><br>You will be asked to create a new password upon successful verification.<br><br><br><br><i>Account ID: {username}</i>',
      },
    });

    this.userPool.applyRemovalPolicy(RemovalPolicy.DESTROY); // TODO: link to config value

    // Add permissions to post confirmation function to manage user groups
    postConfirmationFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['cognito-idp:AdminAddUserToGroup'],
        resources: [
          `arn:${Stack.of(this).partition}:cognito-idp:${Stack.of(this).region}:${Stack.of(this).account}:userpool/${Stack.of(this).region}_*`,
        ],
      }),
    );

    this.userPoolClient = this.userPool.addClient('WebClient', {
      refreshTokenValidity: Duration.days(1),
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    this.userPoolClient.applyRemovalPolicy(RemovalPolicy.DESTROY); // TODO: link to config value

    // Configure the identity pool
    this.identityPool = new CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: `${namespace}-${BASE_IDENTITY_POOL_NAME}`,
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
        },
      ],
    });

    // Setup user roles and role mappings
    const federatedPrincipal = new FederatedPrincipal(
      'cognito-identity.amazonaws.com',
      {
        StringEquals: {
          'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
        },
        'ForAnyValue:StringLike': {
          'cognito-identity.amazonaws.com:amr': 'authenticated',
        },
      },
      'sts:AssumeRoleWithWebIdentity',
    );

    this.userRoles = {} as UserRoles;

    this.userRoles.adminRole = new Role(this, 'AdminRole', {
      assumedBy: federatedPrincipal,
    });

    this.userRoles.raceFacilitatorRole = new Role(this, 'RaceFacilitatorRole', {
      assumedBy: federatedPrincipal,
    });

    this.userRoles.racerRole = new Role(this, 'RacerRole', {
      assumedBy: federatedPrincipal,
    });

    new CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {},
      roleMappings: {
        ['cognito-user-pool']: {
          type: 'Rules',
          ambiguousRoleResolution: 'Deny',
          identityProvider: `${this.userPool.userPoolProviderName}:${this.userPoolClient.userPoolClientId}`,
          rulesConfiguration: {
            rules: [
              {
                claim: 'cognito:groups',
                matchType: 'Contains',
                value: 'dr-admins',
                roleArn: this.userRoles.adminRole.roleArn,
              },
              {
                claim: 'cognito:groups',
                matchType: 'Contains',
                value: 'dr-race-facilitators',
                roleArn: this.userRoles.raceFacilitatorRole.roleArn,
              },
              {
                claim: 'cognito:groups',
                matchType: 'Contains',
                value: 'dr-racers',
                roleArn: this.userRoles.racerRole.roleArn,
              },
            ],
          },
        },
      },
    });

    // If an admin email was provided, configure the default admin profile
    if (adminEmail) {
      const addAdminToGroupFn = new NodeLambdaFunction(this, 'AddAdminToGroupFunction', {
        entry: path.join(__dirname, '../../../../../libs/lambda/src/cognito/handlers/addAdminToGroup.ts'),
        functionName: `${functionNamePrefix}-AddAdminToGroupFn`,
        logGroupCategory: LogGroupCategory.USER_IDENTITY,
        namespace: props.namespace,
      });

      addAdminToGroupFn.addToRolePolicy(
        new PolicyStatement({
          actions: ['cognito-idp:AdminAddUserToGroup', 'cognito-idp:AdminCreateUser'],
          resources: [this.userPool.userPoolArn],
        }),
      );

      // Custom resource to create admin user
      new CustomResource(this, 'AddAdminToGroup', {
        serviceToken: new Provider(this, 'AddAdminToGroupProvider', {
          onEventHandler: addAdminToGroupFn,
          logGroup: LogGroupsHelper.getOrCreateLogGroup(scope, id, {
            functionName: `${functionNamePrefix}-AddAdminToGroupProvider`,
            logGroupCategory: LogGroupCategory.USER_IDENTITY,
            namespace: props.namespace,
          }),
        }).serviceToken,
        properties: {
          userPoolId: this.userPool.userPoolId,
          adminEmail: adminEmail,
        },
      });
      addCfnGuardSuppressionForAutoCreatedLambdas(this, 'AddAdminToGroupProvider');
    }

    // Add user pool groups
    new CfnUserPoolGroup(this, 'AdminUserPoolGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'dr-admins',
      description: 'DeepRacer on AWS - Admin user group',
    });

    new CfnUserPoolGroup(this, 'RaceFacilitatorUserPoolGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'dr-race-facilitators',
      description: 'DeepRacer on AWS - Race facilitator user group',
    });

    new CfnUserPoolGroup(this, 'RacerUserPoolGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'dr-racers',
      description: 'DeepRacer on AWS - Racer user group',
    });

    // Create a function that updates the role property on the profile in response to a user group change
    this.profileRoleChangeHandler = new NodeLambdaFunction(this, 'ProfileRoleChangeHandler', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/cognito/handlers/profileRoleChangeHandler.ts'),
      functionName: `${functionNamePrefix}-ProfileRoleChangeHandler`,
      logGroupCategory: LogGroupCategory.USER_IDENTITY,
      namespace: props.namespace,
    });

    new Rule(this, 'CognitoUserPoolGroupChangeRule', {
      eventPattern: {
        source: ['aws.cognito-idp'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['cognito-idp.amazonaws.com'],
          eventName: ['AdminAddUserToGroup', 'AdminRemoveUserFromGroup'],
          requestParameters: {
            userPoolId: [this.userPool.userPoolId],
          },
        },
      },
      targets: [new aws_events_targets.LambdaFunction(this.profileRoleChangeHandler)],
    });

    this.profileRoleChangeHandler.addPermission('AllowEventRuleInvoke', {
      principal: new ServicePrincipal('events.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:${Stack.of(this).partition}:events:${Stack.of(this).region}:${Stack.of(this).account}:rule/CognitoUserPoolGroupChangeRule*`,
    });

    this.profileRoleChangeHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ['cognito-idp:ListUsers'],
        resources: [this.userPool.userPoolArn],
      }),
    );

    dynamoDBTable.grantWriteData(this.profileRoleChangeHandler);

    // Create a function that updates the email property on the profile in response to a user attribute change
    this.profileEmailChangeHandler = new NodeLambdaFunction(this, 'ProfileEmailChangeHandler', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/cognito/handlers/profileEmailChangeHandler.ts'),
      functionName: `${functionNamePrefix}-ProfileEmailChangeHandler`,
      logGroupCategory: LogGroupCategory.USER_IDENTITY,
      namespace: props.namespace,
    });

    new Rule(this, 'CognitoUserPoolEmailChangeRule', {
      eventPattern: {
        source: ['aws.cognito-idp'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['cognito-idp.amazonaws.com'],
          eventName: ['AdminUpdateUserAttributes'],
          requestParameters: {
            userPoolId: [this.userPool.userPoolId],
          },
        },
      },
      targets: [new aws_events_targets.LambdaFunction(this.profileEmailChangeHandler)],
    });

    this.profileEmailChangeHandler.addPermission('AllowEmailChangeEventRuleInvoke', {
      principal: new ServicePrincipal('events.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:${Stack.of(this).partition}:events:${Stack.of(this).region}:${Stack.of(this).account}:rule/CognitoUserPoolEmailChangeRule*`,
    });

    this.profileEmailChangeHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ['cognito-idp:AdminGetUser', 'cognito-idp:ListUsers'],
        resources: [this.userPool.userPoolArn],
      }),
    );

    dynamoDBTable.grantWriteData(this.profileEmailChangeHandler);

    // Create a function that updates the email template when the stack is deployed
    this.emailTemplateSyncHandler = new NodeLambdaFunction(this, 'EmailTemplateSyncHandler', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/cognito/handlers/emailTemplateSyncHandler.ts'),
      functionName: `${functionNamePrefix}-EmailTemplateSyncHandler`,
      logGroupCategory: LogGroupCategory.USER_IDENTITY,
      namespace: props.namespace,
      environment: {
        USER_POOL_ID: this.userPool.userPoolId,
        ADMIN_EMAIL: adminEmail || '',
      },
    });

    this.emailTemplateSyncHandler.addToRolePolicy(
      new PolicyStatement({
        actions: [
          'cognito-idp:UpdateUserPool',
          'cognito-idp:DescribeUserPool',
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminGetUser',
          'cognito-idp:ListUsers',
          'cloudformation:DescribeStacks',
        ],
        resources: [
          this.userPool.userPoolArn,
          `arn:${Stack.of(this).partition}:cloudformation:${Stack.of(this).region}:${Stack.of(this).account}:stack/${Stack.of(this).stackName}/*`,
        ],
      }),
    );

    // Outputs
    new CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
    });
    new CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
    });
    new CfnOutput(this, 'IdentityPoolId', {
      value: this.identityPool.ref,
    });
  }

  /**
   * Updates the email template with the website URL and sends admin email
   * This should be called after the website is deployed
   */
  updateEmailTemplateWithWebsiteUrl(websiteUrl: string) {
    // Custom resource to update email template and send admin email
    new CustomResource(this, 'UpdateEmailTemplateWithUrl', {
      serviceToken: new Provider(this, 'UpdateEmailTemplateWithUrlProvider', {
        onEventHandler: this.emailTemplateSyncHandler,
        logGroup: LogGroupsHelper.getOrCreateLogGroup(this, 'UpdateEmailTemplateWithUrlProvider', {
          functionName: `${functionNamePrefix}-UpdateEmailTemplateWithUrlProvider`,
          logGroupCategory: LogGroupCategory.USER_IDENTITY,
          namespace: this.namespace,
        }),
      }).serviceToken,
      properties: {
        websiteUrl: websiteUrl,
        stackName: Stack.of(this).stackName,
        forceUpdate: Date.now().toString(),
      },
    });
    addCfnGuardSuppressionForAutoCreatedLambdas(this, 'UpdateEmailTemplateWithUrlProvider');
  }
}
