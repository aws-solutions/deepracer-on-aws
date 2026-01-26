// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UserGroups } from '@deepracer-indy/typescript-client';
import { composeStories } from '@storybook/react';

import i18n from '#i18n/index.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { screen, waitFor } from '#utils/testUtils';

import * as stories from './ManageRaces.stories';

vi.mock('#utils/authUtils.js', () => ({
  checkUserGroupMembership: vi.fn(),
}));

const { Default } = composeStories(stories);
const mockCheckUserGroupMembership = vi.mocked(checkUserGroupMembership);

describe('<ManageRaces />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when user has race management permissions', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders the manage races table for authorized users', async () => {
      await Default.run();

      await screen.findByText(i18n.t('leaderboards:table.status.open'));

      await waitFor(() => {
        expect(screen.getByText(i18n.t('leaderboards:table.status.closed'))).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getAllByText(i18n.t('leaderboards:table.raceType.timeTrial'))[0]).toBeInTheDocument();
      });

      await screen.findByText(i18n.t('leaderboards:table.raceType.objectAvoidance'));
      await screen.findByText(i18n.t('leaderboards:table.columnHeader.status'));
      await screen.findByText(i18n.t('leaderboards:table.columnHeader.name'));
      await screen.findByText(i18n.t('leaderboards:table.columnHeader.competitionFormat'));
      await screen.findByText(i18n.t('leaderboards:table.columnHeader.startDate'));
      await screen.findByText(i18n.t('leaderboards:table.columnHeader.endDate'));

      expect(mockCheckUserGroupMembership).toHaveBeenCalledWith([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]);
    });

    it('renders management action buttons for authorized users', async () => {
      await Default.run();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('leaderboards:table.createRaceButton') })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: i18n.t('leaderboards:table.cloneRaceButton') })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: i18n.t('leaderboards:table.raceDetailButton') })).toBeInTheDocument();
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

    it('renders unauthorized error alert for users without permissions', async () => {
      await Default.run();

      await waitFor(() => {
        expect(screen.getByText('Unauthorized')).toBeInTheDocument();
      });

      expect(
        screen.getByText('The page you are trying to view is only available to race facilitators or administrators.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Return to Home' })).toBeInTheDocument();

      expect(screen.queryByText(i18n.t('leaderboards:table.columnHeader.status'))).not.toBeInTheDocument();
      expect(screen.queryByText(i18n.t('leaderboards:table.columnHeader.name'))).not.toBeInTheDocument();

      expect(mockCheckUserGroupMembership).toHaveBeenCalledWith([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]);
    });

    it('does not render management action buttons for unauthorized users', async () => {
      await Default.run();

      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: i18n.t('leaderboards:table.createRaceButton') }),
        ).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: i18n.t('leaderboards:table.cloneRaceButton') }),
        ).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: i18n.t('leaderboards:table.raceDetailButton') }),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('legacy test compatibility', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders without crashing (legacy test)', async () => {
      await Default.run();

      await screen.findByText(i18n.t('leaderboards:table.status.open'));

      await waitFor(() => {
        expect(screen.getByText(i18n.t('leaderboards:table.status.closed'))).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getAllByText(i18n.t('leaderboards:table.raceType.timeTrial'))[0]).toBeInTheDocument();
      });

      await screen.findByText(i18n.t('leaderboards:table.raceType.objectAvoidance'));
      await screen.findByText(i18n.t('leaderboards:table.columnHeader.status'));
      await screen.findByText(i18n.t('leaderboards:table.columnHeader.name'));
      await screen.findByText(i18n.t('leaderboards:table.columnHeader.competitionFormat'));
      await screen.findByText(i18n.t('leaderboards:table.columnHeader.startDate'));
      await screen.findByText(i18n.t('leaderboards:table.columnHeader.endDate'));
    });
  });
});
