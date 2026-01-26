// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export enum AuthState {
  SIGNIN = 'SignIn',
  VERIFY_EMAIL = 'VerifyEmail',
  FORGOT_PASSWORD_REQUEST = 'ForgotPasswordRequest',
  FORGOT_PASSWORD_RESET = 'ForgotPasswordReset',
  NEW_PASSWORD_REQUIRED = 'NewPasswordRequired',
}

export interface AuthValues {
  emailAddress: string;
  password: string;
  racerAlias: string;
}

export interface SignInValues {
  emailAddress: string;
  password: string;
}
