// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import {
  AdminCreateUserCommand,
  UpdateUserPoolCommand,
  ListUsersCommand,
  DescribeUserPoolCommand,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { logger } from '@deepracer-indy/utils';
import type { CloudFormationCustomResourceEvent, CloudFormationCustomResourceResponse } from 'aws-lambda';

import { cognitoClient } from '../../utils/clients/cognitoClient.js';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

export const EmailTemplateSyncHandler = async (
  event: CloudFormationCustomResourceEvent,
): Promise<CloudFormationCustomResourceResponse> => {
  logger.info('EmailTemplateSyncHandler lambda start', { input: event });

  // Only process Create and Update events
  if (event.RequestType === 'Delete') {
    return {
      Status: 'SUCCESS',
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      StackId: event.StackId,
      PhysicalResourceId: 'email-template-update',
    };
  }

  const { websiteUrl, stackName } = event.ResourceProperties;

  try {
    // Get UserPool ID from environment variable
    const userPoolId = process.env.USER_POOL_ID;
    if (!userPoolId) {
      throw new Error('USER_POOL_ID environment variable not set');
    }

    // Use provided website URL or get from stack outputs
    let finalWebsiteUrl = websiteUrl;
    if (!finalWebsiteUrl && stackName) {
      finalWebsiteUrl = await getWebsiteUrlFromStack(stackName);
    }

    if (!finalWebsiteUrl) {
      throw new Error('Website URL not found');
    }

    // Update email template with website URL
    await updateEmailTemplate(userPoolId, finalWebsiteUrl);

    // Send admin email if admin email is provided
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendAdminEmail(userPoolId, adminEmail);
    }

    logger.info('Successfully updated email template and sent admin email');

    return {
      Status: 'SUCCESS',
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      StackId: event.StackId,
      PhysicalResourceId: 'email-template-update',
      Data: {
        Message: 'Email template updated and admin email sent successfully',
      },
    };
  } catch (error) {
    logger.error('Failed to process email template sync', { error });
    throw error;
  }
};

async function getWebsiteUrlFromStack(stackName: string): Promise<string | null> {
  const cloudFormationClient = new CloudFormationClient({
    region: process.env.AWS_REGION,
  });

  try {
    const response = await cloudFormationClient.send(
      new DescribeStacksCommand({
        StackName: stackName,
      }),
    );

    const stack = response.Stacks?.[0];
    if (!stack?.Outputs) {
      return null;
    }

    // Find the website URL output (looks for output key starting with 'WebsiteUrl' or containing 'Url')
    const websiteOutput = stack.Outputs.find(
      (output: { OutputKey?: string; OutputValue?: string }) =>
        output.OutputKey?.includes('Url') || output.OutputKey?.startsWith('Website'),
    );

    return websiteOutput?.OutputValue || null;
  } catch (error) {
    logger.error('Failed to get stack outputs', { error, stackName });
    return null;
  }
}

async function updateEmailTemplate(userPoolId: string, websiteUrl: string): Promise<void> {
  logger.info('Updating email template', { userPoolId, websiteUrl });

  // First, get the current user pool configuration to preserve existing settings
  const describeResponse = await cognitoClient.send(
    new DescribeUserPoolCommand({
      UserPoolId: userPoolId,
    }),
  );

  const currentUserPool = describeResponse.UserPool;
  if (!currentUserPool) {
    throw new Error('Failed to get current user pool configuration');
  }

  // Update user pool with the new email template while preserving all other configurations
  // Note: UpdateUserPool requires all configurations to be specified, or they will be reset to defaults
  await cognitoClient.send(
    new UpdateUserPoolCommand({
      UserPoolId: userPoolId,
      LambdaConfig: currentUserPool.LambdaConfig,
      Policies: currentUserPool.Policies,
      AutoVerifiedAttributes: currentUserPool.AutoVerifiedAttributes,
      MfaConfiguration: currentUserPool.MfaConfiguration,
      EmailConfiguration: currentUserPool.EmailConfiguration,
      SmsConfiguration: currentUserPool.SmsConfiguration,
      UserAttributeUpdateSettings: currentUserPool.UserAttributeUpdateSettings,
      DeviceConfiguration: currentUserPool.DeviceConfiguration,
      VerificationMessageTemplate: currentUserPool.VerificationMessageTemplate,
      AccountRecoverySetting: currentUserPool.AccountRecoverySetting,
      AdminCreateUserConfig: {
        ...currentUserPool.AdminCreateUserConfig,
        InviteMessageTemplate: {
          EmailSubject: 'Welcome to DeepRacer on AWS',
          EmailMessage: `Hello,

You have been invited to join DeepRacer on AWS. Your temporary password is: {####}

You will be asked to create a new password upon successful verification.

Access the application here: ${websiteUrl}


Account ID: {username}`,
        },
      },
    }),
  );

  logger.info('Successfully updated email template');
}

async function sendAdminEmail(userPoolId: string, adminEmail: string): Promise<void> {
  logger.info('Sending admin email', { userPoolId, adminEmail });

  // Find the existing admin user by email
  const listUsersResponse = await cognitoClient.send(
    new ListUsersCommand({
      UserPoolId: userPoolId,
      Filter: `email = "${adminEmail}"`,
    }),
  );

  const existingUser = listUsersResponse.Users?.[0];
  if (!existingUser?.Username) {
    logger.error('Admin user not found or missing username', { adminEmail });
    return;
  }

  try {
    // Get the user's current status
    const userResponse = await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: existingUser.Username,
      }),
    );

    // Only attempt to resend if the user is in FORCE_CHANGE_PASSWORD status
    if (userResponse.UserStatus === 'FORCE_CHANGE_PASSWORD') {
      // Send email to existing user with RESEND
      await cognitoClient.send(
        new AdminCreateUserCommand({
          UserPoolId: userPoolId,
          Username: existingUser.Username,
          MessageAction: 'RESEND',
          DesiredDeliveryMediums: ['EMAIL'],
          UserAttributes: [
            {
              Name: 'email',
              Value: adminEmail,
            },
            {
              Name: 'email_verified',
              Value: 'true',
            },
          ],
        }),
      );

      logger.info('Successfully sent admin email');
    } else {
      logger.info('Admin user is not in FORCE_CHANGE_PASSWORD status, skipping email resend', {
        username: existingUser.Username,
        userStatus: userResponse.UserStatus,
        adminEmail,
      });
    }
  } catch (error) {
    logger.error('Failed to send admin email', { error, adminEmail, username: existingUser.Username });
    // Don't throw the error as email resend is optional and shouldn't fail the deployment
    logger.warn('Continuing deployment despite email send failure');
  }
}

export const lambdaHandler = instrumentHandler(EmailTemplateSyncHandler);
