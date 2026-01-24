// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';
import { screen, waitFor } from '@testing-library/react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { describe, expect, it, Mock, vi, beforeEach } from 'vitest';

import { render } from '#utils/testUtils';

import CreateRace from './CreateRace';
import * as stories from './CreateRace.stories';
import i18n from '../../i18n/index.js';

const { Default } = composeStories(stories);

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(),
}));

vi.mock('#services/deepRacer/leaderboardsApi.js', () => ({
  useCreateLeaderboardMutation: () => [vi.fn(), { isLoading: false }],
  useEditLeaderboardMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('#hooks/useAppDispatch.js', () => ({
  useAppDispatch: () => vi.fn(),
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to} data-testid="return-home-link">
      {children}
    </a>
  ),
}));

describe('<CreateRace />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Storybook integration test', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('renders without crashing', async () => {
      // Mock successful auth for storybook test
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: {
          accessToken: {
            payload: {
              'cognito:groups': ['dr-race-facilitators'],
            },
          },
        },
      });

      await Default.run();

      // Header - just check that at least one instance exists
      await waitFor(() => {
        const headers = screen.getAllByText(i18n.t('createRace:addRaceDetails.header'));
        expect(headers.length).toBeGreaterThan(0);
      });

      await screen.findByText(i18n.t('createRace:addRaceDetails.description'));

      // Container header
      await screen.findByText(i18n.t('createRace:addRaceDetails.raceDetails'));
      await screen.findByText(i18n.t('createRace:addRaceDetails.raceDetailsDesc'));

      // race type
      await screen.findByText(i18n.t('createRace:addRaceDetails.chooseRaceType'));
      await screen.findByText(i18n.t('createRace:addRaceDetails.timeTrial'));
      await screen.findByText(i18n.t('createRace:addRaceDetails.objectAvoidance'));

      // Race event name
      await screen.findByText(i18n.t('createRace:addRaceDetails.nameOfRacingEvent'));

      // Race dates
      await screen.findByText(i18n.t('createRace:addRaceDetails.chooseRaceDates'));

      // Tracks
      await screen.findByText(i18n.t('createRace:addRaceDetails.competitionTracks'));
      await screen.findByText(i18n.t('trackSelection:sortBy'));
      await screen.findByText(i18n.t('trackSelection:trackDir'));
      await screen.findByText(i18n.t('trackSelection:COUNTER_CLOCKWISE'));
      await screen.findByText(i18n.t('trackSelection:CLOCKWISE'));

      // Race customizations
      await screen.findByText(i18n.t('createRace:addRaceDetails.raceCustom'));
    });
  });

  describe('Access Control', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should show loading state initially', () => {
      (fetchAuthSession as Mock).mockImplementation(
        () =>
          new Promise(() => {
            // This promise intentionally never resolves to simulate loading state
          }),
      );

      render(<CreateRace />);

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

      render(<CreateRace />);

      await waitFor(() => {
        expect(screen.getByText('Unauthorized')).toBeInTheDocument();
      });

      expect(
        screen.getByText('The page you are trying to view is only available to race facilitators or administrators.'),
      ).toBeInTheDocument();
      expect(screen.getByTestId('return-home-link')).toBeInTheDocument();
      expect(screen.getByText('Return to Home')).toBeInTheDocument();
    });

    it('should render create race form if user is a race facilitator', async () => {
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: {
          accessToken: {
            payload: {
              'cognito:groups': ['dr-race-facilitators'],
            },
          },
        },
      });

      render(<CreateRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:addRaceDetails.description'))).toBeInTheDocument();
      });

      expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument();
    });

    it('should render create race form if user is an admin', async () => {
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: {
          accessToken: {
            payload: {
              'cognito:groups': ['dr-admins'],
            },
          },
        },
      });

      render(<CreateRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:addRaceDetails.description'))).toBeInTheDocument();
      });

      expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument();
    });

    it('should render create race form if user has both race facilitator and admin roles', async () => {
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: {
          accessToken: {
            payload: {
              'cognito:groups': ['dr-race-facilitators', 'dr-admins'],
            },
          },
        },
      });

      render(<CreateRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:addRaceDetails.description'))).toBeInTheDocument();
      });

      expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument();
    });

    it('should handle error when fetching auth session', async () => {
      (fetchAuthSession as Mock).mockRejectedValue(new Error('Auth error'));

      render(<CreateRace />);

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

      render(<CreateRace />);

      await waitFor(() => {
        expect(screen.getByText('Unauthorized')).toBeInTheDocument();
      });
    });

    it('should handle missing tokens in auth session', async () => {
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: null,
      });

      render(<CreateRace />);

      await waitFor(() => {
        expect(screen.getByText('Unauthorized')).toBeInTheDocument();
      });
    });

    it('should handle missing accessToken in auth session', async () => {
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: {
          accessToken: null,
        },
      });

      render(<CreateRace />);

      await waitFor(() => {
        expect(screen.getByText('Unauthorized')).toBeInTheDocument();
      });
    });

    it('should handle missing payload in accessToken', async () => {
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: {
          accessToken: {
            payload: null,
          },
        },
      });

      render(<CreateRace />);

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

      render(<CreateRace />);

      await waitFor(() => {
        expect(screen.getByText('Unauthorized')).toBeInTheDocument();
      });
    });

    it('should show unauthorized for users with only non-privileged groups', async () => {
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: {
          accessToken: {
            payload: {
              'cognito:groups': ['dr-racers', 'some-other-group'],
            },
          },
        },
      });

      render(<CreateRace />);

      await waitFor(() => {
        expect(screen.getByText('Unauthorized')).toBeInTheDocument();
      });
    });

    it('should show create race form for user with race facilitator role among other groups', async () => {
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: {
          accessToken: {
            payload: {
              'cognito:groups': ['dr-racers', 'dr-race-facilitators', 'some-other-group'],
            },
          },
        },
      });

      render(<CreateRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:addRaceDetails.description'))).toBeInTheDocument();
      });

      expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument();
    });

    it('should show create race form for user with admin role among other groups', async () => {
      (fetchAuthSession as Mock).mockResolvedValue({
        tokens: {
          accessToken: {
            payload: {
              'cognito:groups': ['dr-racers', 'dr-admins', 'some-other-group'],
            },
          },
        },
      });

      render(<CreateRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:addRaceDetails.description'))).toBeInTheDocument();
      });

      expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument();
    });
  });
});
