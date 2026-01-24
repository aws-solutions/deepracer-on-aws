// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UserGroups } from '@deepracer-indy/typescript-client';
import { composeStories } from '@storybook/react';

import i18n from '#i18n/index.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { screen, waitFor } from '#utils/testUtils';

import * as stories from './Races.stories';

vi.mock('#utils/authUtils.js', () => ({
  checkUserGroupMembership: vi.fn(),
}));

const { Default } = composeStories(stories);
const mockCheckUserGroupMembership = vi.mocked(checkUserGroupMembership);

describe('<Races />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when user has race management permissions', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders the main page structure with create race button for authorized users', async () => {
      await Default.run();

      await screen.findByText(i18n.t('races:welcome'));

      await waitFor(() => {
        const createRaceButtons = screen.getAllByRole('button', { name: i18n.t('races:createRace') });
        expect(createRaceButtons.length).toBeGreaterThanOrEqual(1);
      });

      await screen.findByText(i18n.t('races:communityRaces'));
      await screen.findByText(i18n.t('races:completedRaces'));

      expect(mockCheckUserGroupMembership).toHaveBeenCalledWith([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]);
    });

    it('renders race management buttons in child components', async () => {
      await Default.run();

      await screen.findByText(i18n.t('races:welcome'));

      await waitFor(() => {
        const allCreateRaceButtons = screen.getAllByRole('button', { name: i18n.t('races:createRace') });
        expect(allCreateRaceButtons.length).toBeGreaterThanOrEqual(1);
      });

      await waitFor(() => {
        expect(screen.getByText(i18n.t('races:manageRace'))).toBeInTheDocument();
      });
    });

    it('calls checkUserGroupMembership with correct parameters', async () => {
      await Default.run();

      await waitFor(() => {
        expect(mockCheckUserGroupMembership).toHaveBeenCalledWith([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]);
      });
    });
  });

  describe('when user does not have race management permissions', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(false);
    });

    it('hides create race button in main header for unauthorized users', async () => {
      await Default.run();

      await screen.findByText(i18n.t('races:welcome'));

      await waitFor(() => {
        const headerButtons = screen.queryAllByRole('button', { name: i18n.t('races:createRace') });
        expect(headerButtons.length).toBe(0);
      });

      expect(mockCheckUserGroupMembership).toHaveBeenCalledWith([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]);
    });

    it('still renders race sections without management buttons', async () => {
      await Default.run();

      await screen.findByText(i18n.t('races:welcome'));
      await screen.findByText(i18n.t('races:communityRaces'));
      await screen.findByText(i18n.t('races:completedRaces'));

      expect(screen.getByText(i18n.t('races:communityRaces'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('races:completedRaces'))).toBeInTheDocument();
    });
  });

  describe('legacy test compatibility', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders without crashing (legacy test)', async () => {
      await Default.run();

      await screen.findByText(i18n.t('races:welcome'));

      await screen.findByText(i18n.t('races:communityRaces'));

      await waitFor(() => {
        expect(screen.getByText(i18n.t('races:manageRace'))).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getAllByText(i18n.t('races:createRace'))[0]).toBeInTheDocument();
      });

      await expect(screen.getAllByText(i18n.t('races:seeRaceDetails'))[0]).toBeInTheDocument();

      await screen.findByText(i18n.t('races:completedRaces'));
      await screen.findByText(i18n.t('races:closed'));
    });
  });
});
