// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';
import type { Mock } from 'vitest';

import i18n from '#i18n/index.js';
import { useGetProfileQuery } from '#services/deepRacer/profileApi.js';
import { environmentConfig } from '#utils/envUtils.js';
import { render, screen } from '#utils/testUtils';

import * as stories from './Account.stories';

const { Default } = composeStories(stories);

vi.mock('#services/deepRacer/profileApi.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#services/deepRacer/profileApi.js')>()),
  useGetProfileQuery: vi.fn(),
}));

describe('<Account />', () => {
  const originalIdpName = environmentConfig.idpName;

  beforeEach(() => {
    (useGetProfileQuery as Mock).mockReturnValue({ data: undefined, isLoading: false, error: null });
  });

  afterEach(() => {
    environmentConfig.idpName = originalIdpName;
  });

  it('renders without crashing', () => {
    render(<Default />, { isStorybookStory: true });

    expect(screen.getByTestId('accountHeader')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('account:yourAccountInfo'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('account:yourEmail'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('account:yourPassword'))).toBeInTheDocument();
  });

  it('shows the change password link for a native (non-federated) user', () => {
    environmentConfig.idpName = 'ExternalIdP';
    (useGetProfileQuery as Mock).mockReturnValue({
      data: { profileId: 'abcdefghijklmno', alias: 'racer' },
      isLoading: false,
      error: null,
    });

    render(<Default />, { isStorybookStory: true });

    expect(screen.getByTestId('changePasswordLink')).toBeInTheDocument();
  });

  it('hides the change password link for a federated (SSO) user', () => {
    environmentConfig.idpName = 'ExternalIdP';
    // The user pool has signInCaseSensitive: false, so Cognito lowercases every username —
    // the real profileId is "externalidp_...", not "ExternalIdP_...".
    (useGetProfileQuery as Mock).mockReturnValue({
      data: { profileId: 'externalidp_01a2b3c4-d5e6-f7g8-h9i0', alias: '' },
      isLoading: false,
      error: null,
    });

    render(<Default />, { isStorybookStory: true });

    expect(screen.queryByTestId('changePasswordLink')).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('account:yourPassword'))).not.toBeInTheDocument();
  });
});
