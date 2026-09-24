// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { screen, waitFor } from '@testing-library/react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { describe, expect, it, Mock, vi, beforeEach } from 'vitest';

import { mockLeaderboardTTFuture } from '#constants/testConstants.js';
import { render } from '#utils/testUtils';

import EditRace from './EditRace';
import i18n from '../../i18n/index.js';

const mockUseGetLeaderboardQuery = vi.fn();
const mockUseListLiveQueueItemsQuery = vi.fn();

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(),
}));

vi.mock('#services/deepRacer/leaderboardsApi.js', () => ({
  useGetLeaderboardQuery: () => mockUseGetLeaderboardQuery(),
  useListLiveQueueItemsQuery: () => mockUseListLiveQueueItemsQuery(),
  useCreateLeaderboardMutation: () => [vi.fn(), { isLoading: false }],
  useEditLeaderboardMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('#hooks/useAppDispatch.js', () => ({
  useAppDispatch: () => vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ leaderboardId: 'test-leaderboard-id' }),
    useNavigate: () => vi.fn(),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to} data-testid="return-home-link">
        {children}
      </a>
    ),
  };
});

describe('<EditRace />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseListLiveQueueItemsQuery.mockReturnValue({ data: { items: [] } });
  });

  describe('Loading and Error States', () => {
    it('should show race does not exist message when leaderboard is not found', async () => {
      mockUseGetLeaderboardQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isUninitialized: false,
      });

      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:raceDoesNotExist'))).toBeInTheDocument();
      });
    });
  });

  describe('Access Control', () => {
    beforeEach(() => {
      mockUseGetLeaderboardQuery.mockReturnValue({
        data: mockLeaderboardTTFuture,
        isLoading: false,
        isUninitialized: false,
      });
    });

    it('should show loading state initially', () => {
      (fetchAuthSession as Mock).mockImplementation(
        () =>
          new Promise(() => {
            // This promise intentionally never resolves to simulate loading state
          }),
      );

      render(<EditRace />);

      // The admin-membership check (used to gate isActiveRaceAdminEdit) never resolves,
      // so EditRace must stay on its own loading spinner rather than rendering the form —
      // otherwise the form would briefly render unlocked before the check resolves.
      expect(screen.queryByText(i18n.t('createRace:addRaceDetails.nameOfRacingEvent'))).not.toBeInTheDocument();
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    it('should show unauthorized message if user is not a race facilitator or admin', async () => {
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: {
          accessToken: {
            payload: {
              'cognito:groups': ['dr-racers'],
            },
          },
        },
      });

      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText('Unauthorized')).toBeInTheDocument();
      });

      expect(
        screen.getByText('The page you are trying to view is only available to race facilitators or administrators.'),
      ).toBeInTheDocument();
      expect(screen.getByTestId('return-home-link')).toBeInTheDocument();
      expect(screen.getByText('Return to Home')).toBeInTheDocument();
      expect(screen.queryByText(i18n.t('createRace:addRaceDetails.header'))).not.toBeInTheDocument();
    });

    it('should render edit race form if user is a race facilitator', async () => {
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: {
          accessToken: {
            payload: {
              'cognito:groups': ['dr-race-facilitators'],
            },
          },
        },
      });

      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:addRaceDetails.description'))).toBeInTheDocument();
      });

      expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue(mockLeaderboardTTFuture.name)).toBeInTheDocument();
    });

    it('should render edit race form if user is an admin', async () => {
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: {
          accessToken: {
            payload: {
              'cognito:groups': ['dr-admins'],
            },
          },
        },
      });

      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:addRaceDetails.description'))).toBeInTheDocument();
      });

      expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue(mockLeaderboardTTFuture.name)).toBeInTheDocument();
    });

    it('should render edit race form if user has both race facilitator and admin roles', async () => {
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: {
          accessToken: {
            payload: {
              'cognito:groups': ['dr-race-facilitators', 'dr-admins'],
            },
          },
        },
      });

      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:addRaceDetails.description'))).toBeInTheDocument();
      });

      expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument();
    });

    it('should handle error when fetching auth session', async () => {
      (fetchAuthSession as Mock).mockRejectedValue(new Error('Auth error'));

      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText('Unauthorized')).toBeInTheDocument();
      });

      expect(
        screen.getByText('The page you are trying to view is only available to race facilitators or administrators.'),
      ).toBeInTheDocument();
    });

    it('should handle undefined groups in auth session', async () => {
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: {
          accessToken: {
            payload: {},
          },
        },
      });

      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText('Unauthorized')).toBeInTheDocument();
      });
    });

    it('should handle missing tokens in auth session', async () => {
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: null,
      });

      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText('Unauthorized')).toBeInTheDocument();
      });
    });

    it('should handle empty groups array in auth session', async () => {
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: {
          accessToken: {
            payload: {
              'cognito:groups': [],
            },
          },
        },
      });

      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText('Unauthorized')).toBeInTheDocument();
      });
    });

    it('should show edit race form for user with race facilitator role among other groups', async () => {
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: {
          accessToken: {
            payload: {
              'cognito:groups': ['dr-racers', 'dr-race-facilitators', 'some-other-group'],
            },
          },
        },
      });

      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:addRaceDetails.description'))).toBeInTheDocument();
      });

      expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument();
    });

    it('should show edit race form for user with admin role among other groups', async () => {
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: {
          accessToken: {
            payload: {
              'cognito:groups': ['dr-racers', 'dr-admins', 'some-other-group'],
            },
          },
        },
      });

      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:addRaceDetails.description'))).toBeInTheDocument();
      });

      expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument();
    });
  });

  describe('Content validation for authorized users', () => {
    beforeEach(() => {
      mockUseGetLeaderboardQuery.mockReturnValue({
        data: mockLeaderboardTTFuture,
        isLoading: false,
        isUninitialized: false,
      });

      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: {
          accessToken: {
            payload: {
              'cognito:groups': ['dr-race-facilitators'],
            },
          },
        },
      });
    });

    it('should display wizard navigation buttons', async () => {
      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:cancel'))).toBeInTheDocument();
      });

      expect(screen.getByText(i18n.t('createRace:next'))).toBeInTheDocument();
    });

    it('should display race type options', async () => {
      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:addRaceDetails.timeTrial'))).toBeInTheDocument();
      });

      expect(screen.getByText(i18n.t('createRace:addRaceDetails.objectAvoidance'))).toBeInTheDocument();
    });
  });

  describe('live race editing', () => {
    beforeEach(() => {
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: { accessToken: { payload: { 'cognito:groups': ['dr-admins'] } } },
      });
      mockUseGetLeaderboardQuery.mockReturnValue({
        data: {
          ...mockLeaderboardTTFuture,
          isLive: true,
          liveEventTime: new Date(2026, 5, 15, 14, 30),
          liveEventStatus: 'SCHEDULED',
          maxResets: 5,
        },
        isLoading: false,
        isUninitialized: false,
      });
    });

    it('should display live race fields when editing a live race', async () => {
      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:addRaceDetails.liveRaceToggle'))).toBeInTheDocument();
      });

      expect(screen.getByText(i18n.t('createRace:addRaceDetails.liveEventTime'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('createRace:addRaceDetails.maxResets'))).toBeInTheDocument();
    });

    it('should disable the live race toggle in edit mode', async () => {
      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:addRaceDetails.liveRace'))).toBeInTheDocument();
      });

      const tile = screen.getByLabelText(i18n.t('createRace:addRaceDetails.liveRace'));
      expect(tile).toHaveAttribute('aria-disabled', 'true');
    });

    it('should disable scoring fields when queue has submissions', async () => {
      mockUseListLiveQueueItemsQuery.mockReturnValue({
        data: { items: [{ submissionId: 'sub-1', status: 'PENDING' }] },
      });

      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:addRaceDetails.raceCustom'))).toBeInTheDocument();
      });

      const expandButton = screen.getByText(i18n.t('createRace:addRaceDetails.raceCustom'));
      expandButton.click();

      await waitFor(() => {
        expect(screen.getByLabelText(i18n.t('createRace:addRaceDetails.rankingMethod'))).toBeDisabled();
      });
      expect(screen.getByLabelText(i18n.t('createRace:addRaceDetails.maximumLaps'))).toBeDisabled();

      expect(
        screen.getAllByText(i18n.t('createRace:addRaceDetails.validationErrors.scoringLockedByQueue')).length,
      ).toBeGreaterThanOrEqual(1);
    });

    it('should not disable scoring fields when queue is empty', async () => {
      mockUseListLiveQueueItemsQuery.mockReturnValue({ data: { items: [] } });

      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:addRaceDetails.raceCustom'))).toBeInTheDocument();
      });

      const expandButton = screen.getByText(i18n.t('createRace:addRaceDetails.raceCustom'));
      expandButton.click();

      await waitFor(() => {
        expect(screen.getByLabelText(i18n.t('createRace:addRaceDetails.rankingMethod'))).not.toBeDisabled();
      });
      expect(screen.getByLabelText(i18n.t('createRace:addRaceDetails.maximumLaps'))).not.toBeDisabled();

      expect(
        screen.queryByText(i18n.t('createRace:addRaceDetails.validationErrors.scoringLockedByQueue')),
      ).not.toBeInTheDocument();
    });
  });

  describe('community race date/time editing', () => {
    it('should display openTime/closeTime in local time, not UTC', async () => {
      mockUseGetLeaderboardQuery.mockReturnValue({
        data: {
          ...mockLeaderboardTTFuture,
          openTime: new Date(2026, 8, 1, 23, 50), // Sept 1, 2026, 23:50 local
          closeTime: new Date(2026, 8, 1, 23, 54), // Sept 1, 2026, 23:54 local
        },
        isLoading: false,
        isUninitialized: false,
      });
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: { accessToken: { payload: { 'cognito:groups': ['dr-admins'] } } },
      });

      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:addRaceDetails.description'))).toBeInTheDocument();
      });

      // Regardless of the browser's UTC offset, the form must show the same local
      // date/time that was constructed above — not the UTC-shifted value.
      expect(screen.getByDisplayValue('23:50')).toBeInTheDocument();
      expect(screen.getByDisplayValue('23:54')).toBeInTheDocument();
    });
  });

  describe('active community race admin editing', () => {
    const activeCommunityRace = {
      ...mockLeaderboardTTFuture,
      isLive: false,
      openTime: new Date(Date.now() - 60 * 60 * 1000), // started 1h ago
      closeTime: new Date(Date.now() + 60 * 60 * 1000), // closes in 1h
    };

    it('locks the race name and start date/time, and shows the locked-field notice, for an admin', async () => {
      mockUseGetLeaderboardQuery.mockReturnValue({
        data: activeCommunityRace,
        isLoading: false,
        isUninitialized: false,
      });
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: { accessToken: { payload: { 'cognito:groups': ['dr-admins'] } } },
      });

      render(<EditRace />);

      await waitFor(() => {
        expect(
          screen.getByText(i18n.t('createRace:addRaceDetails.validationErrors.lockedForActiveRace')),
        ).toBeInTheDocument();
      });

      expect(screen.getByLabelText(i18n.t('createRace:addRaceDetails.nameOfRacingEvent'))).toBeDisabled();
    });

    it('does not show the queue-locked scoring notice for an active-race admin edit', async () => {
      // scoringLockedByQueue is specific to the live-race "submissions already queued" reason —
      // an active COMMUNITY race locks the same fields for a different reason (lockedForActiveRace,
      // already asserted above) and must not also show this unrelated/misleading message.
      mockUseGetLeaderboardQuery.mockReturnValue({
        data: activeCommunityRace,
        isLoading: false,
        isUninitialized: false,
      });
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: { accessToken: { payload: { 'cognito:groups': ['dr-admins'] } } },
      });

      render(<EditRace />);

      await waitFor(() => {
        expect(
          screen.getByText(i18n.t('createRace:addRaceDetails.validationErrors.lockedForActiveRace')),
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByText(i18n.t('createRace:addRaceDetails.validationErrors.scoringLockedByQueue')),
      ).not.toBeInTheDocument();
    });

    it('does not show a false-positive invalid state on the end time field', async () => {
      // The active race's start time is, by definition, already in the past — isDateRangeInvalid's
      // stale-start-time check must not be applied to endTime in this mode, or the field would
      // show an error state regardless of the (valid) end time the admin actually set.
      mockUseGetLeaderboardQuery.mockReturnValue({
        data: activeCommunityRace,
        isLoading: false,
        isUninitialized: false,
      });
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: { accessToken: { payload: { 'cognito:groups': ['dr-admins'] } } },
      });

      render(<EditRace />);

      await waitFor(() => {
        expect(
          screen.getByText(i18n.t('createRace:addRaceDetails.validationErrors.lockedForActiveRace')),
        ).toBeInTheDocument();
      });

      const timeInputs = screen.getAllByRole('textbox').filter((el) => el.getAttribute('name') === 'endTime');
      expect(timeInputs).toHaveLength(1);
      expect(timeInputs[0]).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('does not lock fields (or show the notice) for a race that has not started yet', async () => {
      mockUseGetLeaderboardQuery.mockReturnValue({
        data: mockLeaderboardTTFuture,
        isLoading: false,
        isUninitialized: false,
      });
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: { accessToken: { payload: { 'cognito:groups': ['dr-admins'] } } },
      });

      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:addRaceDetails.description'))).toBeInTheDocument();
      });

      expect(
        screen.queryByText(i18n.t('createRace:addRaceDetails.validationErrors.lockedForActiveRace')),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText(i18n.t('createRace:addRaceDetails.nameOfRacingEvent'))).not.toBeDisabled();
    });

    it('does not lock fields for a race-facilitator (non-admin) editing an active race', async () => {
      // Non-admins can't reach this form for an active race at all (RaceDetails disables the
      // Edit button per raceDetailsHelpers.isEditDisabled) — this verifies EditRace itself
      // doesn't lock fields it shouldn't in the unexpected case of a direct navigation.
      mockUseGetLeaderboardQuery.mockReturnValue({
        data: activeCommunityRace,
        isLoading: false,
        isUninitialized: false,
      });
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: { accessToken: { payload: { 'cognito:groups': ['dr-race-facilitators'] } } },
      });

      render(<EditRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:addRaceDetails.description'))).toBeInTheDocument();
      });

      expect(
        screen.queryByText(i18n.t('createRace:addRaceDetails.validationErrors.lockedForActiveRace')),
      ).not.toBeInTheDocument();
    });
  });
});
