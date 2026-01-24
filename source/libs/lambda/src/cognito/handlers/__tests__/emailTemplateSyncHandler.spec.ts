// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AdminCreateUserCommand,
  UpdateUserPoolCommand,
  ListUsersCommand,
  DescribeUserPoolCommand,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { CloudFormationCustomResourceEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cognitoClient } from '../../../utils/clients/cognitoClient.js';
import { EmailTemplateSyncHandler } from '../emailTemplateSyncHandler.js';

const cognitoMock = mockClient(cognitoClient);

// Mock CloudFormation client separately
const mockCloudFormationClient = {
  send: vi.fn(),
};

// Mock the CloudFormation client import
vi.mock('@aws-sdk/client-cloudformation', () => ({
  CloudFormationClient: vi.fn(() => mockCloudFormationClient),
  DescribeStacksCommand: vi.fn(),
}));

// Mock environment variables
const mockEnv = {
  USER_POOL_ID: 'us-west-2_test123',
  ADMIN_EMAIL: 'admin@example.com',
  AWS_REGION: 'us-west-2',
};

vi.stubEnv('USER_POOL_ID', mockEnv.USER_POOL_ID);
vi.stubEnv('ADMIN_EMAIL', mockEnv.ADMIN_EMAIL);
vi.stubEnv('AWS_REGION', mockEnv.AWS_REGION);

describe('EmailTemplateSyncHandler', () => {
  beforeEach(() => {
    cognitoMock.reset();
    mockCloudFormationClient.send.mockReset();
  });

  const createEvent = (
    requestType: 'Create' | 'Update' | 'Delete',
    websiteUrl?: string,
    stackName?: string,
  ): CloudFormationCustomResourceEvent =>
    ({
      RequestType: requestType,
      ResponseURL: 'https://example.com/response',
      StackId: 'arn:aws:cloudformation:us-west-2:123456789012:stack/test-stack/12345',
      RequestId: 'test-request-id',
      LogicalResourceId: 'EmailTemplateSync',
      ResourceType: 'Custom::EmailTemplateSync',
      ServiceToken: 'arn:aws:lambda:us-west-2:123456789012:function:test',
      PhysicalResourceId: requestType === 'Create' ? undefined : 'email-template-update',
      ResourceProperties: {
        ServiceToken: 'arn:aws:lambda:us-west-2:123456789012:function:test',
        ...(websiteUrl && { websiteUrl }),
        ...(stackName && { stackName }),
      },
    }) as CloudFormationCustomResourceEvent;

  it('should update email template and send admin email on Create event', async () => {
    const websiteUrl = 'https://d1234567890.cloudfront.net';
    const event = createEvent('Create', websiteUrl);

    // Mock current user pool configuration
    cognitoMock.on(DescribeUserPoolCommand).resolves({
      UserPool: {
        Id: mockEnv.USER_POOL_ID,
        Name: 'test-pool',
        AutoVerifiedAttributes: ['email'],
        UsernameAttributes: ['email'],
        AdminCreateUserConfig: {
          AllowAdminCreateUserOnly: false,
          InviteMessageTemplate: {
            EmailSubject: 'Old subject',
            EmailMessage: 'Old message',
          },
        },
      },
    });

    // Mock existing admin user
    cognitoMock.on(ListUsersCommand).resolves({
      Users: [
        {
          Username: 'admin123456789',
          Attributes: [{ Name: 'email', Value: mockEnv.ADMIN_EMAIL }],
        },
      ],
    });

    // Mock admin user status check (FORCE_CHANGE_PASSWORD)
    cognitoMock.on(AdminGetUserCommand).resolves({
      Username: 'admin123456789',
      UserStatus: 'FORCE_CHANGE_PASSWORD',
    });

    // Mock Cognito responses
    cognitoMock.on(UpdateUserPoolCommand).resolves({});
    cognitoMock.on(AdminCreateUserCommand).resolves({});

    const result = await EmailTemplateSyncHandler(event);

    expect(result.Status).toBe('SUCCESS');

    // Verify DescribeUserPool was called
    const describeCalls = cognitoMock.commandCalls(DescribeUserPoolCommand);
    expect(describeCalls).toHaveLength(1);
    expect(describeCalls[0].args[0].input.UserPoolId).toBe(mockEnv.USER_POOL_ID);

    // Verify UpdateUserPool was called with correct template
    const updateCalls = cognitoMock.commandCalls(UpdateUserPoolCommand);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].args[0].input.UserPoolId).toBe(mockEnv.USER_POOL_ID);
    expect(updateCalls[0].args[0].input.AdminCreateUserConfig?.InviteMessageTemplate?.EmailMessage).toContain(
      websiteUrl,
    );
    expect(updateCalls[0].args[0].input.AdminCreateUserConfig?.InviteMessageTemplate?.EmailMessage).toContain(
      'Access the application here:',
    );

    // Verify AdminCreateUser was called to send admin email
    const createCalls = cognitoMock.commandCalls(AdminCreateUserCommand);
    expect(createCalls).toHaveLength(1);
    expect(createCalls[0].args[0].input.UserPoolId).toBe(mockEnv.USER_POOL_ID);
    expect(createCalls[0].args[0].input.Username).toBe('admin123456789');
    expect(createCalls[0].args[0].input.MessageAction).toBe('RESEND');
    expect(createCalls[0].args[0].input.UserAttributes).toEqual([
      { Name: 'email', Value: mockEnv.ADMIN_EMAIL },
      { Name: 'email_verified', Value: 'true' },
    ]);
  });

  it('should update email template and send admin email on Update event', async () => {
    const websiteUrl = 'https://d1234567890.cloudfront.net';
    const event = createEvent('Update', websiteUrl);

    // Mock current user pool configuration
    cognitoMock.on(DescribeUserPoolCommand).resolves({
      UserPool: {
        Id: mockEnv.USER_POOL_ID,
        Name: 'test-pool',
        AutoVerifiedAttributes: ['email'],
        UsernameAttributes: ['email'],
        AdminCreateUserConfig: {
          AllowAdminCreateUserOnly: false,
          InviteMessageTemplate: {
            EmailSubject: 'Old subject',
            EmailMessage: 'Old message',
          },
        },
      },
    });

    // Mock existing admin user
    cognitoMock.on(ListUsersCommand).resolves({
      Users: [
        {
          Username: 'admin123456789',
          Attributes: [{ Name: 'email', Value: mockEnv.ADMIN_EMAIL }],
        },
      ],
    });

    // Mock admin user status check (FORCE_CHANGE_PASSWORD)
    cognitoMock.on(AdminGetUserCommand).resolves({
      Username: 'admin123456789',
      UserStatus: 'FORCE_CHANGE_PASSWORD',
    });

    cognitoMock.on(UpdateUserPoolCommand).resolves({});
    cognitoMock.on(AdminCreateUserCommand).resolves({});

    const result = await EmailTemplateSyncHandler(event);

    expect(result.Status).toBe('SUCCESS');
    expect(cognitoMock.commandCalls(DescribeUserPoolCommand)).toHaveLength(1);
    expect(cognitoMock.commandCalls(UpdateUserPoolCommand)).toHaveLength(1);
    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(1);
  });

  it('should return success on Delete event without processing', async () => {
    const event = createEvent('Delete');

    const result = await EmailTemplateSyncHandler(event);

    expect(result.Status).toBe('SUCCESS');
    expect(cognitoMock.commandCalls(UpdateUserPoolCommand)).toHaveLength(0);
    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(0);
  });

  it('should get website URL from stack outputs when not provided directly', async () => {
    const stackName = 'test-stack';
    const websiteUrl = 'https://d1234567890.cloudfront.net';
    const event = createEvent('Create', undefined, stackName);

    mockCloudFormationClient.send.mockResolvedValue({
      Stacks: [
        {
          Outputs: [
            {
              OutputKey: 'WebsiteUrl',
              OutputValue: websiteUrl,
            },
          ],
        },
      ],
    });

    // Mock current user pool configuration
    cognitoMock.on(DescribeUserPoolCommand).resolves({
      UserPool: {
        Id: mockEnv.USER_POOL_ID,
        Name: 'test-pool',
        AutoVerifiedAttributes: ['email'],
        UsernameAttributes: ['email'],
        AdminCreateUserConfig: {
          AllowAdminCreateUserOnly: false,
        },
      },
    });

    // Mock existing admin user
    cognitoMock.on(ListUsersCommand).resolves({
      Users: [
        {
          Username: 'admin123456789',
          Attributes: [{ Name: 'email', Value: mockEnv.ADMIN_EMAIL }],
        },
      ],
    });

    // Mock admin user status check (FORCE_CHANGE_PASSWORD)
    cognitoMock.on(AdminGetUserCommand).resolves({
      Username: 'admin123456789',
      UserStatus: 'FORCE_CHANGE_PASSWORD',
    });

    cognitoMock.on(UpdateUserPoolCommand).resolves({});
    cognitoMock.on(AdminCreateUserCommand).resolves({});

    const result = await EmailTemplateSyncHandler(event);

    expect(result.Status).toBe('SUCCESS');
    expect(cognitoMock.commandCalls(DescribeUserPoolCommand)).toHaveLength(1);
    expect(cognitoMock.commandCalls(UpdateUserPoolCommand)).toHaveLength(1);
    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(1);
  });

  it('should handle missing website URL gracefully', async () => {
    const event = createEvent('Create', undefined, 'test-stack');

    mockCloudFormationClient.send.mockResolvedValue({
      Stacks: [
        {
          Outputs: [],
        },
      ],
    });

    await expect(EmailTemplateSyncHandler(event)).rejects.toThrow('Website URL not found');
  });

  it('should handle missing admin email gracefully', async () => {
    vi.stubEnv('ADMIN_EMAIL', '');

    const event = createEvent('Create', 'https://d1234567890.cloudfront.net');

    // Mock current user pool configuration
    cognitoMock.on(DescribeUserPoolCommand).resolves({
      UserPool: {
        Id: mockEnv.USER_POOL_ID,
        Name: 'test-pool',
        AutoVerifiedAttributes: ['email'],
        UsernameAttributes: ['email'],
        AdminCreateUserConfig: {
          AllowAdminCreateUserOnly: false,
        },
      },
    });

    cognitoMock.on(UpdateUserPoolCommand).resolves({});

    const result = await EmailTemplateSyncHandler(event);

    expect(result.Status).toBe('SUCCESS');
    // Should update template but not send admin email
    expect(cognitoMock.commandCalls(DescribeUserPoolCommand)).toHaveLength(1);
    expect(cognitoMock.commandCalls(UpdateUserPoolCommand)).toHaveLength(1);
    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(0);
  });

  it('should handle admin user not found gracefully', async () => {
    const event = createEvent('Create', 'https://d1234567890.cloudfront.net');

    // Mock current user pool configuration
    cognitoMock.on(DescribeUserPoolCommand).resolves({
      UserPool: {
        Id: mockEnv.USER_POOL_ID,
        Name: 'test-pool',
        AutoVerifiedAttributes: ['email'],
        UsernameAttributes: ['email'],
        AdminCreateUserConfig: {
          AllowAdminCreateUserOnly: false,
        },
      },
    });

    // Mock no admin user found
    cognitoMock.on(ListUsersCommand).resolves({
      Users: [],
    });

    cognitoMock.on(UpdateUserPoolCommand).resolves({});

    const result = await EmailTemplateSyncHandler(event);

    expect(result.Status).toBe('SUCCESS');
    // Should update template but not send admin email
    expect(cognitoMock.commandCalls(DescribeUserPoolCommand)).toHaveLength(1);
    expect(cognitoMock.commandCalls(UpdateUserPoolCommand)).toHaveLength(1);
    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(0);
  });

  it('should handle CloudFormation errors gracefully', async () => {
    const event = createEvent('Create', undefined, 'test-stack');

    mockCloudFormationClient.send.mockRejectedValue(new Error('Stack not found'));

    await expect(EmailTemplateSyncHandler(event)).rejects.toThrow();
  });

  it('should skip email resend when admin user is not in FORCE_CHANGE_PASSWORD status', async () => {
    // Ensure ADMIN_EMAIL is set for this test
    vi.stubEnv('ADMIN_EMAIL', mockEnv.ADMIN_EMAIL);

    const event = createEvent('Create', 'https://d1234567890.cloudfront.net');

    // Mock current user pool configuration
    cognitoMock.on(DescribeUserPoolCommand).resolves({
      UserPool: {
        Id: mockEnv.USER_POOL_ID,
        Name: 'test-pool',
        AutoVerifiedAttributes: ['email'],
        UsernameAttributes: ['email'],
        AdminCreateUserConfig: {
          AllowAdminCreateUserOnly: false,
          InviteMessageTemplate: {
            EmailSubject: 'Old subject',
            EmailMessage: 'Old message',
          },
        },
      },
    });

    // Mock existing admin user
    cognitoMock.on(ListUsersCommand).resolves({
      Users: [
        {
          Username: 'admin123456789',
          Attributes: [{ Name: 'email', Value: mockEnv.ADMIN_EMAIL }],
        },
      ],
    });

    // Mock admin user status check (CONFIRMED - not FORCE_CHANGE_PASSWORD)
    cognitoMock.on(AdminGetUserCommand).resolves({
      Username: 'admin123456789',
      UserStatus: 'CONFIRMED',
    });

    cognitoMock.on(UpdateUserPoolCommand).resolves({});

    const result = await EmailTemplateSyncHandler(event);

    expect(result.Status).toBe('SUCCESS');

    // Verify template was updated
    expect(cognitoMock.commandCalls(DescribeUserPoolCommand)).toHaveLength(1);
    expect(cognitoMock.commandCalls(UpdateUserPoolCommand)).toHaveLength(1);

    // Verify user status was checked
    expect(cognitoMock.commandCalls(AdminGetUserCommand)).toHaveLength(1);
    expect(cognitoMock.commandCalls(AdminGetUserCommand)[0].args[0].input.Username).toBe('admin123456789');

    // Verify AdminCreateUser was NOT called because user is not in FORCE_CHANGE_PASSWORD status
    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(0);
  });

  it('should handle errors during email send gracefully and continue deployment', async () => {
    // Ensure ADMIN_EMAIL is set for this test
    vi.stubEnv('ADMIN_EMAIL', mockEnv.ADMIN_EMAIL);

    const event = createEvent('Create', 'https://d1234567890.cloudfront.net');

    // Mock current user pool configuration
    cognitoMock.on(DescribeUserPoolCommand).resolves({
      UserPool: {
        Id: mockEnv.USER_POOL_ID,
        Name: 'test-pool',
        AutoVerifiedAttributes: ['email'],
        UsernameAttributes: ['email'],
        AdminCreateUserConfig: {
          AllowAdminCreateUserOnly: false,
          InviteMessageTemplate: {
            EmailSubject: 'Old subject',
            EmailMessage: 'Old message',
          },
        },
      },
    });

    // Mock existing admin user
    cognitoMock.on(ListUsersCommand).resolves({
      Users: [
        {
          Username: 'admin123456789',
          Attributes: [{ Name: 'email', Value: mockEnv.ADMIN_EMAIL }],
        },
      ],
    });

    // Mock AdminGetUser to throw an error
    cognitoMock.on(AdminGetUserCommand).rejects(new Error('User not found in Cognito'));

    cognitoMock.on(UpdateUserPoolCommand).resolves({});

    const result = await EmailTemplateSyncHandler(event);

    expect(result.Status).toBe('SUCCESS');

    // Verify template was still updated despite email error
    expect(cognitoMock.commandCalls(DescribeUserPoolCommand)).toHaveLength(1);
    expect(cognitoMock.commandCalls(UpdateUserPoolCommand)).toHaveLength(1);

    // Verify AdminGetUser was called but failed
    expect(cognitoMock.commandCalls(AdminGetUserCommand)).toHaveLength(1);

    // Verify AdminCreateUser was NOT called because of error
    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(0);
  });

  it('should include correct email template content', async () => {
    const event = createEvent('Create', 'https://example.com');

    // Mock current user pool configuration
    cognitoMock.on(DescribeUserPoolCommand).resolves({
      UserPool: {
        Id: mockEnv.USER_POOL_ID,
        Name: 'test-pool',
        AutoVerifiedAttributes: ['email'],
        UsernameAttributes: ['email'],
        AdminCreateUserConfig: {
          AllowAdminCreateUserOnly: false,
        },
      },
    });

    // Mock existing admin user
    cognitoMock.on(ListUsersCommand).resolves({
      Users: [
        {
          Username: 'admin123456789',
          Attributes: [{ Name: 'email', Value: mockEnv.ADMIN_EMAIL }],
        },
      ],
    });

    // Mock admin user status check (FORCE_CHANGE_PASSWORD)
    cognitoMock.on(AdminGetUserCommand).resolves({
      Username: 'admin123456789',
      UserStatus: 'FORCE_CHANGE_PASSWORD',
    });

    cognitoMock.on(UpdateUserPoolCommand).resolves({});
    cognitoMock.on(AdminCreateUserCommand).resolves({});

    const result = await EmailTemplateSyncHandler(event);

    expect(result.Status).toBe('SUCCESS');

    const updateCall = cognitoMock.commandCalls(UpdateUserPoolCommand)[0];
    const emailMessage = updateCall.args[0].input.AdminCreateUserConfig?.InviteMessageTemplate?.EmailMessage;

    expect(emailMessage).toContain('Hello,');
    expect(emailMessage).toContain('You have been invited to join DeepRacer on AWS');
    expect(emailMessage).toContain('Your temporary password is: {####}');
    expect(emailMessage).toContain('Access the application here: https://example.com');
    expect(emailMessage).toContain('Account ID: {username}');
  });
});
