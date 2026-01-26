// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UserGroups } from '@deepracer-indy/typescript-client';
import { composeStories } from '@storybook/react';
import { vi } from 'vitest';

import { mockProfile } from '#constants/testConstants.js';
import i18n from '#i18n/index.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { screen, fireEvent, waitFor } from '#utils/testUtils';

import * as stories from './RaceDetails.stories';

vi.mock('#utils/authUtils.js', () => ({
  checkUserGroupMembership: vi.fn(),
}));

const { OALeaderboard, TTLeaderboard } = composeStories(stories);

describe('<RaceDetails />', () => {
  it('OA leaderboard renders without crashing', async () => {
    await OALeaderboard.run();
    await screen.findByText(i18n.t('raceDetails:raceType.OBJECT_AVOIDANCE'));

    // Tabs should exist
    await screen.findByText(i18n.t('raceDetails:tabs.raceLeaderboard'));
    await waitFor(() =>
      expect(screen.getAllByText(`${i18n.t('raceDetails:tabs.yourSubmissions')} (3)`)[0]).toBeInTheDocument(),
    );
    // Leaderboard table items
    await screen.findByText(i18n.t('raceDetails:raceLeaderboardTable.header.rank'));
    await screen.findByText(i18n.t('raceDetails:raceLeaderboardTable.header.racer'));
    await screen.findByText(i18n.t('raceDetails:raceLeaderboardTable.header.gapToFirst'));

    // Race details items
    await screen.findByText(i18n.t('raceDetails:raceTrackColumn.competitionTrack'));
    await screen.findByText(i18n.t('raceDetails:raceRulesColumn.rankingMethod'));
    await screen.findByText(i18n.t('raceDetails:raceRulesColumn.style'));
    await screen.findByText(i18n.t('raceDetails:raceRulesColumn.offTrackPenalty'));

    // Racer profile items
    await waitFor(() => expect(screen.getAllByText(mockProfile.alias)[0]).toBeInTheDocument());
    await screen.findByText(i18n.t('raceDetails:yourFastestTime'));
    await screen.findByText(i18n.t('raceDetails:fastestModelSubmitted'));

    // Your submissions table items
    const button = screen.getAllByText(`${i18n.t('raceDetails:submissionsTable.tableHeader')} (3)`);
    fireEvent.click(button[0]);
    await screen.findByText(i18n.t('common:jobStatus.COMPLETED'));
    await screen.findByText(i18n.t('common:jobStatus.IN_PROGRESS'));
    await screen.findByText(i18n.t('common:jobStatus.FAILED'));
    await screen.findByText(i18n.t('raceDetails:submissionsTable.header.status'));
    await screen.findByText(i18n.t('raceDetails:submissionsTable.header.modelName'));
    await screen.findByText(i18n.t('raceDetails:submissionsTable.header.date'));

    await waitFor(() =>
      expect(screen.queryByText(i18n.t('raceDetails:raceLeaderboardTable.header.rank'))).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.queryByText(i18n.t('raceDetails:raceLeaderboardTable.header.racer'))).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.queryByText(i18n.t('raceDetails:raceLeaderboardTable.header.gapToFirst'))).not.toBeInTheDocument(),
    );
  });
  it('TT leaderboard renders without crashing', async () => {
    await TTLeaderboard.run();
    await screen.findByText(i18n.t('raceDetails:raceType.TIME_TRIAL'));

    // Tabs should exist
    await screen.findByText(i18n.t('raceDetails:tabs.raceLeaderboard'));
    await waitFor(() =>
      expect(screen.getAllByText(`${i18n.t('raceDetails:tabs.yourSubmissions')} (3)`)[0]).toBeInTheDocument(),
    );
    // Leaderboard table items
    await screen.findByText(i18n.t('raceDetails:raceLeaderboardTable.header.rank'));
    await screen.findByText(i18n.t('raceDetails:raceLeaderboardTable.header.racer'));
    await screen.findByText(i18n.t('raceDetails:raceLeaderboardTable.header.gapToFirst'));

    // Race details items
    await screen.findByText(i18n.t('raceDetails:raceTrackColumn.competitionTrack'));
    await screen.findByText(i18n.t('raceDetails:raceRulesColumn.rankingMethod'));
    await screen.findByText(i18n.t('raceDetails:raceRulesColumn.style'));
    await screen.findByText(i18n.t('raceDetails:raceRulesColumn.offTrackPenalty'));

    // Racer profile items
    await waitFor(() => expect(screen.getAllByText(mockProfile.alias)[0]).toBeInTheDocument());
    await screen.findByText(i18n.t('raceDetails:yourFastestTime'));
    await screen.findByText(i18n.t('raceDetails:fastestModelSubmitted'));

    // Your submissions table items
    const button = screen.getAllByText(`${i18n.t('raceDetails:submissionsTable.tableHeader')} (3)`);
    fireEvent.click(button[0]);
    await screen.findByText(i18n.t('common:jobStatus.COMPLETED'));
    await screen.findByText(i18n.t('common:jobStatus.IN_PROGRESS'));
    await screen.findByText(i18n.t('common:jobStatus.FAILED'));
    await screen.findByText(i18n.t('raceDetails:submissionsTable.header.status'));
    await screen.findByText(i18n.t('raceDetails:submissionsTable.header.modelName'));
    await screen.findByText(i18n.t('raceDetails:submissionsTable.header.date'));

    await waitFor(() =>
      expect(screen.queryByText(i18n.t('raceDetails:raceLeaderboardTable.header.rank'))).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.queryByText(i18n.t('raceDetails:raceLeaderboardTable.header.racer'))).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.queryByText(i18n.t('raceDetails:raceLeaderboardTable.header.gapToFirst'))).not.toBeInTheDocument(),
    );
  });

  describe('Button visibility based on user roles', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should show management buttons for race facilitators', async () => {
      vi.mocked(checkUserGroupMembership).mockResolvedValue(true);

      await OALeaderboard.run();

      await screen.findByText(i18n.t('raceDetails:raceType.OBJECT_AVOIDANCE'));

      await waitFor(() => {
        expect(screen.getByText(i18n.t('raceDetails:editRace'))).toBeInTheDocument();
      });
      expect(screen.getByTestId('btn-delete-race')).toBeInTheDocument();

      expect(screen.getByText(i18n.t('raceDetails:enterRace'))).toBeInTheDocument();

      expect(checkUserGroupMembership).toHaveBeenCalledWith([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]);
    });

    it('should show management buttons for admin users', async () => {
      vi.mocked(checkUserGroupMembership).mockResolvedValue(true);

      await TTLeaderboard.run();

      await screen.findByText(i18n.t('raceDetails:raceType.TIME_TRIAL'));

      await waitFor(() => {
        expect(screen.getByText(i18n.t('raceDetails:editRace'))).toBeInTheDocument();
      });
      expect(screen.getByTestId('btn-delete-race')).toBeInTheDocument();

      expect(screen.getByText(i18n.t('raceDetails:enterRace'))).toBeInTheDocument();

      expect(checkUserGroupMembership).toHaveBeenCalledWith([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]);
    });

    it('should not show management buttons for regular users', async () => {
      vi.mocked(checkUserGroupMembership).mockResolvedValue(false);

      await OALeaderboard.run();

      await screen.findByText(i18n.t('raceDetails:raceType.OBJECT_AVOIDANCE'));

      await waitFor(() => {
        expect(screen.queryByText(i18n.t('raceDetails:editRace'))).not.toBeInTheDocument();
      });
      expect(screen.queryByTestId('btn-delete-race')).not.toBeInTheDocument();

      expect(screen.getByText(i18n.t('raceDetails:enterRace'))).toBeInTheDocument();

      expect(checkUserGroupMembership).toHaveBeenCalledWith([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]);
    });
  });
});
