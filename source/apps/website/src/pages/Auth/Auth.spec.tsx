// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';
import { expect, waitFor } from '@storybook/test';

import i18n from '#i18n/index.js';
import { screen } from '#utils/testUtils';

import * as stories from './Auth.stories';

const { Default, ForgotPassword } = composeStories(stories);

describe('<Auth />', () => {
  // SignIn page
  it('signin page renders without crashing', async () => {
    await Default.run();

    // Header
    await waitFor(async () => expect(screen.getAllByText(i18n.t('auth:signin'))[0]).toBeInTheDocument());
    await screen.findByText(i18n.t('common:serviceName'));

    // Container form
    await screen.findByText(i18n.t('auth:email'));
    await screen.findByText(i18n.t('auth:password'));
    await screen.findByText(i18n.t('auth:showPassword'));
    await screen.findByText(i18n.t('auth:forgotPassword'));
  });

  // Forgot password page
  it('forgot password page renders without crashing', async () => {
    await ForgotPassword.run();

    // Header
    await expect(screen.getByText(i18n.t('auth:forgotPassword'))).toBeInTheDocument();
    await screen.findByText(i18n.t('common:serviceName'));

    // Container form
    await screen.findByText(i18n.t('auth:email'));
    await screen.findByText(i18n.t('auth:forgotPasswordDesc'));

    // Subtext
    await screen.findByText(i18n.t('auth:sendResetEmail'));
  });
});
