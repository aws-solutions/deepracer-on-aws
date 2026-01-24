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

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(),
}));

vi.mock('#services/deepRacer/leaderboardsApi.js', () => ({
  useGetLeaderboardQuery: () => mockUseGetLeaderboardQuery(),
  useCreateLeaderboardMutation: () => [vi.fn(), { isLoading: false }],
  useEditLeaderboardMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('#hooks/useAppDispatch.js', () => ({
  useAppDispatch: () => vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ leaderboardId: 'test-leaderboard-id' }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to} data-testid="return-home-link">
      {children}
    </a>
  ),
}));

describe('<EditRace />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

      expect(screen.getByText('Loading...')).toBeInTheDocument();
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
});
