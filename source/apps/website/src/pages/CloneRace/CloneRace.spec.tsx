// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { mockLeaderboardTTFuture } from '#constants/testConstants.js';
import { render } from '#utils/testUtils';

import CloneRace from './CloneRace';
import i18n from '../../i18n/index.js';

interface MockInitialFormValues {
  raceName?: string;
  raceType?: string;
  track?: {
    trackId?: string;
  };
  desc?: string;
}

const mockUseGetLeaderboardQuery = vi.fn();

vi.mock('#services/deepRacer/leaderboardsApi.js', () => ({
  useGetLeaderboardQuery: () => mockUseGetLeaderboardQuery(),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ leaderboardId: 'test-leaderboard-id' }),
}));

vi.mock('#pages/CreateRace/CreateRace', () => ({
  default: ({ initialFormValues }: { initialFormValues: MockInitialFormValues }) => (
    <div data-testid="create-race-component">
      <div data-testid="initial-race-name">{initialFormValues?.raceName}</div>
      <div data-testid="initial-race-type">{initialFormValues?.raceType}</div>
      <div data-testid="initial-track-id">{initialFormValues?.track?.trackId}</div>
      <div data-testid="initial-description">{initialFormValues?.desc}</div>
    </div>
  ),
}));

describe('<CloneRace />', () => {
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

      render(<CloneRace />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('createRace:raceDoesNotExist'))).toBeInTheDocument();
      });

      expect(screen.queryByTestId('create-race-component')).not.toBeInTheDocument();
    });
  });

  describe('Successful Data Loading', () => {
    beforeEach(() => {
      mockUseGetLeaderboardQuery.mockReturnValue({
        data: mockLeaderboardTTFuture,
        isLoading: false,
        isUninitialized: false,
      });
    });

    it('should render CreateRace component with cloned leaderboard data', async () => {
      render(<CloneRace />);

      await waitFor(() => {
        expect(screen.getByTestId('create-race-component')).toBeInTheDocument();
      });

      // Verify the initial form values are populated from the leaderboard
      expect(screen.getByTestId('initial-race-name')).toHaveTextContent(`${mockLeaderboardTTFuture.name}_clone`);
      expect(screen.getByTestId('initial-race-type')).toHaveTextContent(mockLeaderboardTTFuture.raceType);
      expect(screen.getByTestId('initial-track-id')).toHaveTextContent(mockLeaderboardTTFuture.trackConfig.trackId);
    });

    it('should handle leaderboard with description', async () => {
      const leaderboardWithDescription = {
        ...mockLeaderboardTTFuture,
        description: 'Test race description',
      };

      mockUseGetLeaderboardQuery.mockReturnValue({
        data: leaderboardWithDescription,
        isLoading: false,
        isUninitialized: false,
      });

      render(<CloneRace />);

      await waitFor(() => {
        expect(screen.getByTestId('initial-description')).toHaveTextContent('Test race description');
      });
    });

    it('should handle leaderboard without description', async () => {
      const leaderboardWithoutDescription = {
        ...mockLeaderboardTTFuture,
        description: undefined,
      };

      mockUseGetLeaderboardQuery.mockReturnValue({
        data: leaderboardWithoutDescription,
        isLoading: false,
        isUninitialized: false,
      });

      render(<CloneRace />);

      await waitFor(() => {
        expect(screen.getByTestId('initial-description')).toHaveTextContent('');
      });
    });

    it('should handle object avoidance leaderboard with object positions', async () => {
      const objectAvoidanceLeaderboard = {
        ...mockLeaderboardTTFuture,
        raceType: 'OBJECT_AVOIDANCE',
        objectAvoidanceConfig: {
          numberOfObjects: 3,
          objectPositions: [
            { x: 1, y: 2 },
            { x: 3, y: 4 },
            { x: 5, y: 6 },
          ],
        },
      };

      mockUseGetLeaderboardQuery.mockReturnValue({
        data: objectAvoidanceLeaderboard,
        isLoading: false,
        isUninitialized: false,
      });

      render(<CloneRace />);

      await waitFor(() => {
        expect(screen.getByTestId('create-race-component')).toBeInTheDocument();
      });

      expect(screen.getByTestId('initial-race-type')).toHaveTextContent('OBJECT_AVOIDANCE');
    });

    it('should handle object avoidance leaderboard without object positions', async () => {
      const objectAvoidanceLeaderboard = {
        ...mockLeaderboardTTFuture,
        raceType: 'OBJECT_AVOIDANCE',
        objectAvoidanceConfig: {
          numberOfObjects: 2,
          objectPositions: undefined,
        },
      };

      mockUseGetLeaderboardQuery.mockReturnValue({
        data: objectAvoidanceLeaderboard,
        isLoading: false,
        isUninitialized: false,
      });

      render(<CloneRace />);

      await waitFor(() => {
        expect(screen.getByTestId('create-race-component')).toBeInTheDocument();
      });
    });

    it('should handle leaderboard with missing optional penalty values', async () => {
      const leaderboardWithMissingPenalties = {
        ...mockLeaderboardTTFuture,
        resettingBehaviorConfig: {
          offTrackPenaltySeconds: undefined,
          collisionPenaltySeconds: undefined,
        },
      };

      mockUseGetLeaderboardQuery.mockReturnValue({
        data: leaderboardWithMissingPenalties,
        isLoading: false,
        isUninitialized: false,
      });

      render(<CloneRace />);

      await waitFor(() => {
        expect(screen.getByTestId('create-race-component')).toBeInTheDocument();
      });

      // Should still render without errors
      expect(screen.getByTestId('initial-race-name')).toHaveTextContent(`${mockLeaderboardTTFuture.name}_clone`);
    });
  });

  describe('URL Parameter Handling', () => {
    it('should handle missing leaderboardId parameter', () => {
      vi.doMock('react-router-dom', () => ({
        useParams: () => ({ leaderboardId: undefined }),
      }));

      mockUseGetLeaderboardQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isUninitialized: false,
      });

      render(<CloneRace />);

      expect(screen.getByText(i18n.t('createRace:raceDoesNotExist'))).toBeInTheDocument();
    });

    it('should handle empty leaderboardId parameter', () => {
      vi.doMock('react-router-dom', () => ({
        useParams: () => ({ leaderboardId: '' }),
      }));

      mockUseGetLeaderboardQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isUninitialized: false,
      });

      render(<CloneRace />);

      expect(screen.getByText(i18n.t('createRace:raceDoesNotExist'))).toBeInTheDocument();
    });
  });

  describe('Form Values Initialization', () => {
    it('should create proper initial form values with all required fields', async () => {
      const completeLeaderboard = {
        ...mockLeaderboardTTFuture,
        description: 'Original description',
        resettingBehaviorConfig: {
          offTrackPenaltySeconds: 2,
          collisionPenaltySeconds: 3,
        },
        maxSubmissionsPerUser: 5,
      };

      mockUseGetLeaderboardQuery.mockReturnValue({
        data: completeLeaderboard,
        isLoading: false,
        isUninitialized: false,
      });

      render(<CloneRace />);

      await waitFor(() => {
        expect(screen.getByTestId('create-race-component')).toBeInTheDocument();
      });

      // Verify cloned name suffix
      expect(screen.getByTestId('initial-race-name')).toHaveTextContent(`${completeLeaderboard.name}_clone`);

      // Verify description is passed through
      expect(screen.getByTestId('initial-description')).toHaveTextContent('Original description');
    });
  });
});
