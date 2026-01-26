// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import { AuthState } from '#constants/auth.js';
import Auth from '#pages/Auth';

const meta = {
  component: Auth,
  title: 'pages/Auth',
} satisfies Meta<typeof Auth>;

export default meta;

type Story = StoryObj<typeof Auth>;

export const Default: Story = {};

export const ForgotPassword: Story = {
  args: {
    initialAuthState: AuthState.FORGOT_PASSWORD_REQUEST,
  },
};
