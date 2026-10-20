// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { BASE_USER_POOL_NAME } from '@deepracer-indy/config/src/defaults/userPoolDefaults';
import {
  Aws,
  aws_events_targets,
  CfnCondition,
  CfnOutput,
  CfnResource,
  CustomResource,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  Token,
} from 'aws-cdk-lib';
import {
  Alarm,
  CfnAlarm,
  CfnAnomalyDetector,
  ComparisonOperator,
  Metric,
  TreatMissingData,
} from 'aws-cdk-lib/aws-cloudwatch';
import {
  UserPool,
  IUserPool,
  UserPoolClient,
  CfnUserPool,
  CfnUserPoolDomain,
  CfnUserPoolGroup,
  CfnUserPoolIdentityProvider,
  CfnIdentityPool,
  CfnIdentityPoolRoleAttachment,
  StringAttribute,
  ProviderAttribute,
  UserPoolClientIdentityProvider,
  UserPoolIdentityProviderSaml,
  UserPoolIdentityProviderSamlMetadata,
} from 'aws-cdk-lib/aws-cognito';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Rule } from 'aws-cdk-lib/aws-events';
import { Effect, FederatedPrincipal, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId, Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

import { iotRaceTopicPrefix } from '../../constants/iotTopics.js';
import { addCfnGuardSuppressionForAutoCreatedLambdas } from '../common/cfnGuardHelper.js';
import { LogGroupCategory, LogGroupsHelper } from '../common/logGroupsHelper.js';
import { functionNamePrefix, NodeLambdaFunction } from '../common/nodeLambdaFunction.js';
import { grantAppConfigAccess } from '../common/permissionsHelper.js';
import { GlobalSettings } from '../storage/appConfig.js';

export interface UserRoles {
  adminRole: Role;
  raceFacilitatorRole: Role;
  racerRole: Role;
  commentatorRole: Role;
  registrationManagerRole: Role;
}

export interface UserIdentityProps {
  dynamoDBTable: TableV2;
  globalSettings: GlobalSettings;
  adminEmail?: string;
  namespace: string;
  isSesEnabled?: CfnCondition;
  sesVerifiedEmail?: string;
  sesIdentity?: string;
  isSesIdentityProvided?: CfnCondition;
  /** SAML IdP metadata URL — the actual metadata URL value, used when the IdP is actually
   * provisioned. A concrete (possibly empty) string at synth time; provisioning itself is
   * gated by isSamlIdpEnabled, not by this value being non-empty. */
  samlMetadataUrl?: string;
  /** Deploy-time condition: true when a SAML IdP should actually be provisioned. The SAML
   * IdP, Hosted UI domain, and WebClient OAuth config are always present in the synthesized
   * template but gated by this CfnCondition so they're never actually provisioned in AWS
   * when it's false. */
  isSamlIdpEnabled?: CfnCondition;
  /** The SAML assertion attribute Name (a claim URI, not a friendly label) that carries the
   * user's email address. Cognito's AttributeMapping matches this verbatim against the
   * assertion, so it must exactly match what the configured IdP actually emits — this varies
   * by IdP and even by how a given tenant's claim rules are configured (e.g. some Azure AD
   * Enterprise Apps emit email under the "name" claim rather than "emailaddress"). Defaults to
   * the SAML2-standard claim URI. */
  samlEmailClaim?: string;
}

export const DEFAULT_SAML_EMAIL_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress';

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
  readonly postAuthenticationErrorAlarm: Alarm;
  readonly sesAlarms: CfnAlarm[];

  /** Fixed identity provider name used for the (always-present-but-conditional) SAML IdP.
   * Referenced by updateOAuthCallbackUrls, which can't rely on resolving isSamlIdpEnabled's
   * actual deploy-time value at synth time, and by deepRacerIndyStack's idpName (must match
   * the lambda-side copy in cognito/handlers/common/constants.ts too — see its comment). */
  static readonly EXTERNAL_IDP_NAME = 'sso';

  private readonly namespace: string;
  private readonly isSamlIdpEnabled?: CfnCondition;
  private readonly samlEmailClaim: string;

  constructor(scope: Construct, id: string, props: UserIdentityProps) {
    super(scope, id);

    const { dynamoDBTable, globalSettings, adminEmail, namespace, samlMetadataUrl } = props;
    this.samlEmailClaim = props.samlEmailClaim ?? DEFAULT_SAML_EMAIL_CLAIM;
    this.namespace = namespace;
    this.isSamlIdpEnabled = props.isSamlIdpEnabled;
    this.sesAlarms = [];

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

    // Configure the post-authentication hook — PostConfirmation above only fires for users who
    // go through Cognito's native sign-up/confirm flow, never for federated (SAML/SSO) sign-in.
    // PostAuthentication fires on every successful authentication (native and federated), so it's
    // the mechanism that guarantees federated users land in dr-racers too.
    const postAuthenticationFn = new NodeLambdaFunction(this, 'PostAuthenticationFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/cognito/handlers/postAuthentication.ts'),
      functionName: `${functionNamePrefix}-PostAuthenticationFn`,
      logGroupCategory: LogGroupCategory.USER_IDENTITY,
      namespace: props.namespace,
    });

    const postAuthenticationFnErrorMetric = new Metric({
      namespace: 'AWS/Lambda',
      metricName: `${namespace}-PostAuthenticationFunctionErrors`,
      dimensionsMap: {
        FunctionName: postAuthenticationFn.functionName,
      },
      period: Duration.minutes(1),
      statistic: 'Sum',
    });

    this.postAuthenticationErrorAlarm = new Alarm(this, 'PostAuthenticationErrorAlarm', {
      metric: postAuthenticationFnErrorMetric,
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Alert when a PostAuthenticationFunction failure occurs',
    });

    postAuthenticationFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['cognito-idp:AdminListGroupsForUser', 'cognito-idp:AdminAddUserToGroup'],
        resources: [
          `arn:${Stack.of(this).partition}:cognito-idp:${Stack.of(this).region}:${Stack.of(this).account}:userpool/${Stack.of(this).region}_*`,
        ],
      }),
    );

    // Configure the user pool
    this.userPool = new UserPool(this, 'UserPool', {
      lambdaTriggers: {
        preSignUp: preSignUpFn,
        postConfirmation: postConfirmationFn,
        postAuthentication: postAuthenticationFn,
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
      customAttributes: {
        // Persisted by PostConfirmation (self-registered) and registerUser handler
        // (walk-up), so both paths produce identical profile records.
        countryCode: new StringAttribute({ mutable: true }),
        // Sanitized alias candidate derived from a bulk-invite CSV's displayName.
        // AdminCreateUser has no ClientMetadata parameter — unlike the
        // self-service SignUp flow, which passes racerAlias via clientMetadata — so this custom
        // attribute is the only way to carry a display-name-derived alias through to the
        // PreSignUp trigger for admin-created (bulk-invited) users.
        racerAlias: new StringAttribute({ mutable: true, minLen: 3, maxLen: 20 }),
      },
      userInvitation: {
        emailSubject: 'Welcome to DeepRacer on AWS',
        emailBody:
          'Hello,<br><br>You have been invited to join DeepRacer on AWS. Your temporary password is: {####}<br><br>You will be asked to create a new password upon successful verification.<br><br><br><br><i>Account ID: {username}</i>',
      },
    });

    this.userPool.applyRemovalPolicy(RemovalPolicy.DESTROY); // TODO: link to config value

    // L1 resource override handle, reused below for the CustomMessage trigger and the SES
    // emailConfiguration (same mechanism used for conditional config elsewhere in this file).
    const cfnUserPool = this.userPool.node.defaultChild as CfnUserPool;

    // Create CognitoEmailMetricFunction Lambda trigger for email metric tracking
    const cognitoEmailMetricFn = new NodeLambdaFunction(this, 'CognitoEmailMetricFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/cognito/handlers/cognitoEmailMetric.ts'),
      functionName: `${functionNamePrefix}-CognitoEmailMetricFn`,
      logGroupCategory: LogGroupCategory.USER_IDENTITY,
      namespace,
      environment: {
        NAMESPACE: namespace,
      },
    });

    // Grant CloudWatch PutMetricData permission scoped to the email metric namespace
    cognitoEmailMetricFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'DeepRacerOnAWS/Email',
          },
        },
      }),
    );

    // Add CognitoEmailMetricFunction trigger to the CfnUserPool
    cfnUserPool.addPropertyOverride('LambdaConfig.CustomMessage', cognitoEmailMetricFn.functionArn);

    // Grant Cognito permission to invoke the CognitoEmailMetricFunction
    cognitoEmailMetricFn.addPermission('AllowCognitoInvoke', {
      principal: new ServicePrincipal('cognito-idp.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: this.userPool.userPoolArn,
    });

    const sesPropsProvided = props.isSesEnabled !== undefined && props.sesVerifiedEmail !== undefined;
    if (sesPropsProvided && props.isSesEnabled && props.sesVerifiedEmail) {
      // Email volume anomaly detection — only created when SES is enabled
      const emailMetric = new Metric({
        namespace: 'DeepRacerOnAWS/Email',
        metricName: 'TransactionalEmailSent',
        dimensionsMap: {
          Namespace: namespace,
        },
        period: Duration.hours(1),
        statistic: 'Sum',
      });

      const anomalyDetector = new CfnAnomalyDetector(this, 'EmailVolumeAnomalyDetector', {
        namespace: emailMetric.namespace,
        metricName: emailMetric.metricName,
        dimensions: [{ name: 'Namespace', value: namespace }],
        stat: 'Sum',
      });
      anomalyDetector.cfnOptions.condition = props.isSesEnabled;

      const emailVolumeAnomalyAlarm = new CfnAlarm(this, 'EmailVolumeAnomalyAlarm', {
        alarmDescription: 'Unusual email sending volume detected',
        comparisonOperator: 'LessThanLowerOrGreaterThanUpperThreshold',
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        treatMissingData: 'notBreaching',
        metrics: [
          {
            id: 'emailVolume',
            metricStat: {
              metric: {
                namespace: emailMetric.namespace,
                metricName: emailMetric.metricName,
                dimensions: [{ name: 'Namespace', value: namespace }],
              },
              period: 3600,
              stat: 'Sum',
            },
            returnData: true,
          },
          {
            id: 'anomalyBand',
            expression: 'ANOMALY_DETECTION_BAND(emailVolume, 2)',
            returnData: true,
          },
        ],
        thresholdMetricId: 'anomalyBand',
      });
      emailVolumeAnomalyAlarm.cfnOptions.condition = props.isSesEnabled;

      const sesIdentityForArn = props.isSesIdentityProvided
        ? Fn.conditionIf(
            props.isSesIdentityProvided.logicalId,
            props.sesIdentity ?? '',
            props.sesVerifiedEmail ?? '',
          ).toString()
        : props.sesVerifiedEmail;
      const sesIdentityArn = `arn:${Stack.of(this).partition}:ses:${Stack.of(this).region}:${Stack.of(this).account}:identity/${sesIdentityForArn}`;

      cfnUserPool.emailConfiguration = {
        emailSendingAccount: Token.asString(
          Fn.conditionIf(props.isSesEnabled.logicalId, 'DEVELOPER', 'COGNITO_DEFAULT'),
        ),
        sourceArn: Token.asString(Fn.conditionIf(props.isSesEnabled.logicalId, sesIdentityArn, Aws.NO_VALUE)),
        from: Token.asString(Fn.conditionIf(props.isSesEnabled.logicalId, props.sesVerifiedEmail, Aws.NO_VALUE)),
      };

      // SES reputation alarms per SES best practices:
      // Bounce rate alarm at 5%, complaint rate alarm at 0.1%
      const sesBounceRateAlarm = new CfnAlarm(this, 'SesBounceRateAlarm', {
        alarmDescription: 'SES bounce rate exceeds 5% — risk of SES sending suspension',
        namespace: 'AWS/SES',
        metricName: 'Reputation.BounceRate',
        statistic: 'Average',
        period: 300,
        evaluationPeriods: 1,
        threshold: 0.05,
        comparisonOperator: 'GreaterThanThreshold',
        treatMissingData: 'notBreaching',
      });
      sesBounceRateAlarm.cfnOptions.condition = props.isSesEnabled;

      const sesComplaintRateAlarm = new CfnAlarm(this, 'SesComplaintRateAlarm', {
        alarmDescription: 'SES complaint rate exceeds 0.1% — risk of SES sending suspension',
        namespace: 'AWS/SES',
        metricName: 'Reputation.ComplaintRate',
        statistic: 'Average',
        period: 300,
        evaluationPeriods: 1,
        threshold: 0.001,
        comparisonOperator: 'GreaterThanThreshold',
        treatMissingData: 'notBreaching',
      });
      sesComplaintRateAlarm.cfnOptions.condition = props.isSesEnabled;

      this.sesAlarms = [emailVolumeAnomalyAlarm, sesBounceRateAlarm, sesComplaintRateAlarm];
    }

    // Add permissions to post confirmation function to manage user groups
    postConfirmationFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['cognito-idp:AdminAddUserToGroup', 'cognito-idp:AdminUpdateUserAttributes'],
        resources: [
          `arn:${Stack.of(this).partition}:cognito-idp:${Stack.of(this).region}:${Stack.of(this).account}:userpool/${Stack.of(this).region}_*`,
        ],
      }),
    );

    // ── Optional SAML IdP — now a real deploy-time CfnParameter/CfnCondition (isSamlIdpEnabled),
    // so the SAML IdP and Hosted UI domain are ALWAYS present in the synthesized template, gated
    // by a CfnCondition attached to their underlying L1 resources (same pattern as the SES
    // reputation alarms above), meaning they're simply never provisioned in AWS when the
    // condition is false — not absent from the template the way the previous synth-time
    // (env-var-gated) design kept them. The `if (props.isSamlIdpEnabled)` guard below only keeps
    // this block a no-op for call sites (e.g. most existing tests) that don't pass the new props
    // at all; it is NOT gating on samlMetadataUrl being a non-empty string, since that's now
    // always a concrete-but-possibly-empty Token at synth time.
    if (props.isSamlIdpEnabled) {
      const externalIdp = new UserPoolIdentityProviderSaml(this, 'ExternalIdP', {
        userPool: this.userPool,
        name: UserIdentity.EXTERNAL_IDP_NAME,
        metadata: UserPoolIdentityProviderSamlMetadata.url(samlMetadataUrl ?? ''),
        idpSignout: true,
        attributeMapping: {
          // racerAlias is intentionally not mapped from the IdP — federated users always land on
          // CompleteProfileForm (see RequiresAuth/postSignInRouting's needsProfileCompletion) to
          // set their alias manually instead.
          email: ProviderAttribute.other(this.samlEmailClaim),
        },
      });
      (externalIdp.node.defaultChild as CfnUserPoolIdentityProvider).cfnOptions.condition = props.isSamlIdpEnabled;

      // Standard Cognito Hosted UI prefix domain (*.auth.<region>.amazoncognito.com) —
      // intentionally no custom/vanity domain or ACM certificate.
      const hostedUiDomain = this.userPool.addDomain('HostedUiDomain', {
        cognitoDomain: {
          domainPrefix: `${namespace}-dr-auth`,
        },
      });
      (hostedUiDomain.node.defaultChild as CfnUserPoolDomain).cfnOptions.condition = props.isSamlIdpEnabled;

      // Outputs are left unconditional — harmless even when the IdP wasn't actually provisioned.
      new CfnOutput(this, 'SamlAcsUrl', {
        value: `https://${namespace}-dr-auth.auth.${Stack.of(this).region}.amazoncognito.com/saml2/idpresponse`,
        description: 'SAML ACS URL — register this as the Reply URL / ACS URL on the external IdP',
      });

      new CfnOutput(this, 'SamlEntityId', {
        value: `urn:amazon:cognito:sp:${this.userPool.userPoolId}`,
        description: 'SAML Entity ID (SP) — register this as the Identifier/Entity ID on the external IdP',
      });
    }

    // Baseline-only config at creation — all OAuth/SAML identity-provider config is applied
    // exclusively post-website-deploy, via updateOAuthCallbackUrls below. The WebClient must
    // exist unconditionally (CloudFormation disallows an unconditional resource depending on a
    // conditional one), so it can't declare a dependency on the conditionally-provisioned
    // ExternalIdP — see updateOAuthCallbackUrls for the residual ordering risk this implies.
    //
    // supportedIdentityProviders is pinned to COGNITO-only here (rather than left for the L2's
    // default auto-discovery of userPool.identityProviders) because that auto-discovery would
    // otherwise emit an unconditional Ref to the conditionally-provisioned ExternalIdP resource
    // whenever isSamlIdpEnabled is wired up at all — an invalid template shape (an unconditional
    // resource referencing a conditional one), caught by `cdk synth`'s template validation.
    this.userPoolClient = this.userPool.addClient('WebClient', {
      refreshTokenValidity: Duration.days(1),
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      supportedIdentityProviders: [UserPoolClientIdentityProvider.COGNITO],
    });

    this.userPoolClient.applyRemovalPolicy(RemovalPolicy.DESTROY); // TODO: link to config value

    // Configure the identity pool
    this.identityPool = new CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: `${namespace}-${BASE_IDENTITY_POOL_NAME}`,
      allowUnauthenticatedIdentities: true,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
        },
      ],
    });

    // cfn-guard suppression for AWS Solutions COGNITO_ALLOW_UNAUTHENTICATED_IDENTITIES_RULE:
    // unauthenticated identities are enabled intentionally to let public spectators subscribe to
    // live race topics without an account. The compensating control is the scoped
    // UnauthenticatedSpectatorRole below — race-tree read only, deny publish, no execute-api.
    this.identityPool.addMetadata('guard', {
      SuppressedRules: ['COGNITO_ALLOW_UNAUTHENTICATED_IDENTITIES_RULE'],
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

    this.userRoles.commentatorRole = new Role(this, 'CommentatorRole', {
      assumedBy: federatedPrincipal,
    });

    this.userRoles.registrationManagerRole = new Role(this, 'RegistrationManagerRole', {
      assumedBy: federatedPrincipal,
    });

    // Unauthenticated spectator identity: scoped to IoT subscribe/receive on the race tree only
    // — no publish, no execute-api. Permissions come entirely from this role.
    const unauthenticatedPrincipal = new FederatedPrincipal(
      'cognito-identity.amazonaws.com',
      {
        StringEquals: {
          'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
        },
        'ForAnyValue:StringLike': {
          'cognito-identity.amazonaws.com:amr': 'unauthenticated',
        },
      },
      'sts:AssumeRoleWithWebIdentity',
    );
    const unauthenticatedRole = new Role(this, 'UnauthenticatedSpectatorRole', {
      assumedBy: unauthenticatedPrincipal,
    });
    const { region, account, partition } = Stack.of(this);
    const raceTopicPrefix = iotRaceTopicPrefix(namespace);
    const iotArnBase = `arn:${partition}:iot:${region}:${account}`;
    // Connect only under a spectator-scoped client id. The ${...:sub} IoT policy variable is escaped
    // so it is emitted literally. The trailing wildcard permits a per-connection suffix (multiple
    // browser tabs for the same identity) — safe because :sub is server-injected from the verified
    // identity token, not client-controlled, so one identity can never construct another's prefix.
    // CONTRACT: the unauthenticated public-leaderboard client MUST connect with clientId
    // `spectator-${identityId}-<anything>` or it will be denied.
    unauthenticatedRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:Connect'],
        resources: [`${iotArnBase}:client/spectator-\${cognito-identity.amazonaws.com:sub}-*`],
      }),
    );
    unauthenticatedRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:Subscribe'],
        resources: [`${iotArnBase}:topicfilter/${raceTopicPrefix}/*`],
      }),
    );
    unauthenticatedRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:Receive'],
        resources: [`${iotArnBase}:topic/${raceTopicPrefix}/*`],
      }),
    );
    unauthenticatedRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.DENY,
        actions: ['iot:Publish'],
        resources: ['*'],
      }),
    );

    new CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        unauthenticated: unauthenticatedRole.roleArn,
      },
      roleMappings: {
        ['cognito-user-pool']: {
          type: 'Rules',
          ambiguousRoleResolution: 'Deny',
          identityProvider: `${this.userPool.userPoolProviderName}:${this.userPoolClient.userPoolClientId}`,
          rulesConfiguration: {
            // Cognito Identity Pool Rules-type mappings evaluate first-match-wins. Rules are
            // ordered highest-privilege first so a user in multiple groups resolves to their
            // most-privileged role. The order test in userIdentity.spec.ts guards this against
            // accidental reordering — do not shuffle without updating the test.
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
              {
                claim: 'cognito:groups',
                matchType: 'Contains',
                value: 'dr-commentators',
                roleArn: this.userRoles.commentatorRole.roleArn,
              },
              {
                claim: 'cognito:groups',
                matchType: 'Contains',
                value: 'dr-registration-managers',
                roleArn: this.userRoles.registrationManagerRole.roleArn,
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

    new CfnUserPoolGroup(this, 'CommentatorUserPoolGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'dr-commentators',
      description: 'DeepRacer on AWS - Commentator user group',
    });

    new CfnUserPoolGroup(this, 'RegistrationManagerUserPoolGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'dr-registration-managers',
      description: 'DeepRacer on AWS - Registration manager user group',
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
          // Adds only: a remove event would stamp roleName with the group the user just left.
          eventName: ['AdminAddUserToGroup'],
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

  /**
   * Patches the WebClient's OAuth callback/logout URLs to the real website URL.
   * Mirrors updateEmailTemplateWithWebsiteUrl's post-website-deploy pattern (the website's
   * CloudFront domain isn't known until the website construct has been created), but uses a
   * one-shot AwsCustomResource instead of a dedicated sync Lambda since this is a single
   * UpdateUserPoolClient API call.
   *
   * This ALWAYS runs one of two resources (never no-ops), because SAML can be disabled after
   * having been enabled, and the WebClient needs to be reset back to Cognito-only OAuth config
   * in that case. Split into two condition-gated custom resources — one with fully static
   * "SAML enabled" parameters, one with fully static "SAML disabled" parameters — rather than a
   * single resource with per-field Fn::If values.
   *
   * This split is required, not stylistic: AwsCustomResource serializes its `parameters` by
   * concatenating literal JSON text with embedded CDK tokens (visible in the synthesized template
   * as an `Fn::Join` building up the `Create`/`Update` call string). That serialization treats
   * every embedded token as an opaque *string* substitution — fine for scalar tokens like
   * UserPoolId/ClientId (a Ref that resolves to a string), but wrong for an Fn::If whose branches
   * are arrays/booleans (e.g. SupportedIdentityProviders, AllowedOAuthFlowsUserPoolClient): the
   * array/boolean value gets embedded inside quote marks as if it were a string, producing
   * invalid JSON that CloudFormation rejects at template-validation time with "every Fn::Join
   * object requires ... a list of strings to be joined" (confirmed by an actual failed deploy).
   * Gating two whole resources via `.cfnOptions.condition` (the same mechanism already used for
   * the SAML IdP and Hosted UI domain above) avoids this entirely — neither resource's payload
   * contains any Fn::If, only genuine scalar tokens (UserPoolId, ClientId, websiteUrl).
   *
   * KNOWN RESIDUAL RISK (first-deploy-only): both custom resources are each conditional on
   * isSamlIdpEnabled (true) / its negation (false), same as the IdP/domain, but exactly one of
   * them still isn't explicitly DependsOn the (also-conditional) ExternalIdP/HostedUiDomain
   * resources, since CloudFormation's dependency rules around shared conditions get fiddly here
   * and EXTERNAL_IDP_NAME is referenced as a plain string value, not a Ref/GetAtt.
   * On the very first deployment where SamlMetadataUrl goes from empty to populated, the
   * "SAML enabled" custom resource's UpdateUserPoolClient call could in principle race ahead of
   * the IdP's own creation within the same deployment. This is a narrow, one-time transition risk,
   * not a steady-state problem (every subsequent deploy, the IdP already exists) — validate this
   * specific transition in a test account before enabling SAML in an account for the first time.
   */
  updateOAuthCallbackUrls(websiteUrl: string) {
    const isSamlIdpEnabled = this.isSamlIdpEnabled;
    if (!isSamlIdpEnabled) {
      return;
    }

    const basePolicy = AwsCustomResourcePolicy.fromSdkCalls({ resources: [this.userPool.userPoolArn] });

    const enabledResource = new AwsCustomResource(this, 'UpdateOAuthCallbackUrlsEnabled', {
      onUpdate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'updateUserPoolClient',
        parameters: {
          UserPoolId: this.userPool.userPoolId,
          ClientId: this.userPoolClient.userPoolClientId,
          ExplicitAuthFlows: ['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_USER_SRP_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
          AllowedOAuthFlows: ['code'],
          AllowedOAuthScopes: ['openid', 'email', 'profile'],
          AllowedOAuthFlowsUserPoolClient: true,
          SupportedIdentityProviders: ['COGNITO', UserIdentity.EXTERNAL_IDP_NAME],
          CallbackURLs: [websiteUrl],
          LogoutURLs: [websiteUrl],
        },
        physicalResourceId: PhysicalResourceId.of(`${functionNamePrefix}-UpdateOAuthCallbackUrlsEnabled`),
      },
      policy: basePolicy,
    });
    // AwsCustomResource.customResource (the inner CustomResource L2, named "Resource") is a
    // private field at the TS type level, so reach it via the construct tree instead.
    (enabledResource.node.findChild('Resource').node.defaultChild as CfnResource).cfnOptions.condition =
      isSamlIdpEnabled;

    const disabledResource = new AwsCustomResource(this, 'UpdateOAuthCallbackUrlsDisabled', {
      onUpdate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'updateUserPoolClient',
        parameters: {
          UserPoolId: this.userPool.userPoolId,
          ClientId: this.userPoolClient.userPoolClientId,
          ExplicitAuthFlows: ['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_USER_SRP_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
          AllowedOAuthFlows: [],
          AllowedOAuthScopes: [],
          AllowedOAuthFlowsUserPoolClient: false,
          SupportedIdentityProviders: ['COGNITO'],
          CallbackURLs: [],
          LogoutURLs: [],
        },
        physicalResourceId: PhysicalResourceId.of(`${functionNamePrefix}-UpdateOAuthCallbackUrlsDisabled`),
      },
      policy: basePolicy,
    });
    // Fn::Not accepts another named Condition directly (CfnCondition.resolve() emits the valid
    // { Condition: logicalId } form) — so this negates isSamlIdpEnabled itself rather than
    // re-deriving an equivalent expression from samlMetadataUrl, which would otherwise need to be
    // kept in sync by hand with isSamlIdpEnabled's own expression in deepRacerIndyStack.ts.
    const isSamlIdpDisabled = new CfnCondition(this, 'IsSamlIdpDisabled', {
      expression: Fn.conditionNot(isSamlIdpEnabled),
    });
    (disabledResource.node.findChild('Resource').node.defaultChild as CfnResource).cfnOptions.condition =
      isSamlIdpDisabled;
  }
}
