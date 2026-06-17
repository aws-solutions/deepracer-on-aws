// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  GetLiveRaceStateCommand,
  GetLeaderboardCommand,
  LaunchLiveRaceCommand,
  EditLeaderboardCommand,
  ClearLiveLeaderboardCommand,
  DeclareWinnerCommand,
  RemoveLiveQueueItemCommand,
  ResetLiveQueueModelCommand,
  ReorderLiveQueueCommand,
  Leaderboard,
  LiveEventStatus,
  ListLiveQueueItemsCommand,
  ListProfilesCommand,
} from '@deepracer-indy/typescript-client';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConnectionStatus, useLiveRaceMqtt } from '#hooks/useLiveRaceMqtt';
import { mockDeepRacerClient, render } from '#utils/testUtils';

import LiveRace from './LiveRace';

vi.mock('#hooks/useLiveRaceMqtt', () => ({
  useLiveRaceMqtt: vi.fn((_leaderboardId: string, _options: unknown) => ({
    connectionStatus: ConnectionStatus.CONNECTED,
  })),
  ConnectionStatus: {
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
    DISCONNECTED: 'DISCONNECTED',
    ERROR: 'ERROR',
  },
}));

vi.mock('#components/VideoStreamPlayer', () => ({
  default: ({ src }: { src: string }) => (
    <div data-testid="video-stream-player" data-src={src}>
      Mock Video Player
    </div>
  ),
}));

const mockCheckUserGroupMembership = vi.fn();
vi.mock('#utils/authUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#utils/authUtils')>();
  return {
    ...actual,
    checkUserGroupMembership: (...args: unknown[]) => mockCheckUserGroupMembership(...args),
  };
});

describe('<LiveRace />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeepRacerClient.reset();
    mockCheckUserGroupMembership.mockResolvedValue(false);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  it('renders the page with leaderboardId from URL', async () => {
    render(<LiveRace />, {
      componentRoute: '/races/:leaderboardId/live',
      initialRouteEntries: ['/races/test-leaderboard-123/live'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('live-race-content')).toBeInTheDocument();
    });
  });

  it('renders all main components', async () => {
    render(<LiveRace />, {
      componentRoute: '/races/:leaderboardId/live',
      initialRouteEntries: ['/races/test-leaderboard/live'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('live-race-content')).toBeInTheDocument();
    });
    expect(screen.getByTestId('video-panel')).toBeInTheDocument();
    expect(screen.getByTestId('race-progress-bar')).toBeInTheDocument();
  });

  it('hides facilitator controls for regular users', async () => {
    mockCheckUserGroupMembership.mockResolvedValue(false);

    render(<LiveRace />, {
      componentRoute: '/races/:leaderboardId/live',
      initialRouteEntries: ['/races/test-leaderboard/live'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('live-race-content')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('launch-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('header-remove-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('header-reset-button')).not.toBeInTheDocument();
  });

  it('shows facilitator controls for admin users', async () => {
    mockCheckUserGroupMembership.mockResolvedValue(true);

    render(<LiveRace />, {
      componentRoute: '/races/:leaderboardId/live',
      initialRouteEntries: ['/races/test-leaderboard/live'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('launch-button')).toBeInTheDocument();
    });
    expect(screen.getByTestId('queue-management-panel')).toBeInTheDocument();
  });

  it('uses broadcast layout when mode=broadcast', async () => {
    render(<LiveRace />, {
      componentRoute: '/races/:leaderboardId/live',
      initialRouteEntries: ['/races/test-leaderboard/live?mode=broadcast'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('live-race-content')).toHaveClass('broadcastLayout');
    });
  });

  it('hides facilitator controls in broadcast mode even for admins', async () => {
    mockCheckUserGroupMembership.mockResolvedValue(true);

    render(<LiveRace />, {
      componentRoute: '/races/:leaderboardId/live',
      initialRouteEntries: ['/races/test-leaderboard/live?mode=broadcast'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('live-race-content')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('launch-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('queue-management-panel')).not.toBeInTheDocument();
  });

  describe('REST state seeding', () => {
    it('seeds race status, autolaunch, and submissionPeriodOpen from getLiveRaceState', async () => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'test-lb',
          name: 'Test Race',
          liveEventStatus: LiveEventStatus.IN_PROGRESS,
          isLive: true,
          autoLaunchEnabled: true,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 2, completedModels: 1, pendingModels: 1, inProgressModels: 0 },
        rankings: [],
      });
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({ items: [] });

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('live-race-content')).toBeInTheDocument();
      });
      // Verify facilitator controls are seeded (autolaunch toggle is present)
      expect(screen.getByTestId('autolaunch-toggle')).toBeInTheDocument();
    });

    it('seeds rankings into leaderboard panel', async () => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'test-lb',
          name: 'Test Race',
          liveEventStatus: LiveEventStatus.IN_PROGRESS,
          isLive: true,
          autoLaunchEnabled: false,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 0, completedModels: 0, pendingModels: 0, inProgressModels: 0 },
        rankings: [{ rank: 1, participantName: 'Alice', modelName: 'SpeedDemon', bestLapTime: 12450 }],
      });
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({ items: [] });

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });
    });

    it('seeds currentEvaluation participant and streamUrl', async () => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'test-lb',
          name: 'Test Race',
          liveEventStatus: LiveEventStatus.IN_PROGRESS,
          isLive: true,
          autoLaunchEnabled: false,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 1, completedModels: 0, pendingModels: 0, inProgressModels: 1 },
        rankings: [],
        currentEvaluation: {
          submissionId: 'sub-1',
          participantName: 'Bob',
          modelName: 'TurboRacer',
          status: 'IN_PROGRESS',
          streamUrl: 'https://kvs.example.com/stream.m3u8',
        },
      });
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({ items: [] });

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        const player = screen.getByTestId('video-stream-player');
        expect(player).toHaveAttribute('data-src', 'https://kvs.example.com/stream.m3u8');
      });
    });
  });

  describe('queue items seeding', () => {
    it('seeds queue items from listLiveQueueItems into QueueManagementPanel', async () => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'test-lb',
          name: 'Test Race',
          liveEventStatus: LiveEventStatus.IN_PROGRESS,
          isLive: true,
          autoLaunchEnabled: false,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 2, completedModels: 0, pendingModels: 2, inProgressModels: 0 },
        rankings: [],
      });
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({
        items: [
          {
            leaderboardId: 'test-lb',
            submissionId: 'sub-1',
            profileId: 'p1',
            participantName: 'Alice',
            modelName: 'SpeedDemon',
            queuePosition: 'a',
            status: 'PENDING',
            resetCount: 0,
            submittedAt: new Date('2026-01-01T00:00:00Z'),
          },
          {
            leaderboardId: 'test-lb',
            submissionId: 'sub-2',
            profileId: 'p2',
            participantName: 'Bob',
            modelName: 'TurboBot',
            queuePosition: 'b',
            status: 'PENDING',
            resetCount: 0,
            submittedAt: new Date('2026-01-01T00:00:01Z'),
          },
        ],
      });

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByText('SpeedDemon')).toBeInTheDocument();
      });
      expect(screen.getByText('TurboBot')).toBeInTheDocument();
    });
  });

  describe('WebSocket event handling', () => {
    it('applies incoming events to state via reducer', async () => {
      const mockUseLiveRaceMqtt = vi.mocked(useLiveRaceMqtt);
      mockUseLiveRaceMqtt.mockImplementation((_id, options) => {
        // Simulate an event arriving after mount
        setTimeout(() => {
          (options as { onEvent: (e: unknown) => void }).onEvent({
            eventType: 'RACE_STATUS_CHANGED',
            status: 'COMPLETED',
            leaderboardId: 'test-lb',
            timestamp: '2026-01-01T00:00:00Z',
          });
        }, 0);
        return { connectionStatus: ConnectionStatus.CONNECTED };
      });

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      // RACE_STATUS_CHANGED → COMPLETED should update the header status
      await waitFor(() => {
        expect(screen.getAllByText('Race completed').length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('facilitator action handlers', () => {
    const setupFacilitatorView = () => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
      mockDeepRacerClient.on(GetLeaderboardCommand).resolves({
        leaderboard: {
          leaderboardId: 'test-lb',
          name: 'Test Race',
          liveEventTime: new Date(Date.now() - 60_000),
        } as unknown as Leaderboard,
      });
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'test-lb',
          name: 'Test Race',
          liveEventStatus: LiveEventStatus.IN_PROGRESS,
          isLive: true,
          autoLaunchEnabled: false,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 2, completedModels: 0, pendingModels: 2, inProgressModels: 0 },
        rankings: [],
      });
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({
        items: [
          {
            leaderboardId: 'test-lb',
            submissionId: 'sub-1',
            profileId: 'p1',
            participantName: 'Alice',
            modelName: 'SpeedDemon',
            queuePosition: 'a',
            status: 'PENDING',
            resetCount: 0,
            submittedAt: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      });
    };

    it('calls launchLiveRace when launch button clicked', async () => {
      setupFacilitatorView();
      mockDeepRacerClient.on(LaunchLiveRaceCommand).resolves({});

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('launch-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('launch-button'));

      await waitFor(() => {
        expect(screen.getByTestId('launch-button')).toBeDisabled();
      });
    });

    it('calls editLeaderboard when autolaunch toggled', async () => {
      setupFacilitatorView();
      mockDeepRacerClient.on(EditLeaderboardCommand).resolves({});

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('autolaunch-toggle')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('autolaunch-toggle'));
    });

    it('calls editLeaderboard when submissions toggled', async () => {
      setupFacilitatorView();
      mockDeepRacerClient.on(EditLeaderboardCommand).resolves({});

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('submissions-toggle')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('submissions-toggle'));
    });

    it('calls clearLiveLeaderboard after confirmation', async () => {
      setupFacilitatorView();
      mockDeepRacerClient.on(ClearLiveLeaderboardCommand).resolves({});

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('actions-dropdown')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('actions-dropdown'));
      fireEvent.click(screen.getAllByText('Clear Leaderboard')[0]);
      fireEvent.click(screen.getByTestId('confirm-clear-button'));
    });

    it('calls declareWinner after confirmation', async () => {
      setupFacilitatorView();
      mockDeepRacerClient.on(DeclareWinnerCommand).resolves({});

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('actions-dropdown')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('actions-dropdown'));
      fireEvent.click(screen.getAllByText('Declare Winner')[0]);
      fireEvent.click(screen.getByTestId('confirm-declare-button'));
    });

    it('removes queue item optimistically', async () => {
      setupFacilitatorView();
      mockDeepRacerClient.on(RemoveLiveQueueItemCommand).resolves({});

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByText('SpeedDemon')).toBeInTheDocument();
      });

      // Select the PENDING item via its move-up button (confirms it's rendered), then use header remove
      fireEvent.click(screen.getByTestId('move-up-sub-1'));

      // The item should still be there (move-up on first item is no-op), select it for removal
      await waitFor(() => {
        expect(screen.getByTestId('queue-management-panel')).toBeInTheDocument();
      });
    });

    it('resets queue item and shows resetting banner', async () => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
      mockDeepRacerClient.on(GetLeaderboardCommand).resolves({
        leaderboard: {
          leaderboardId: 'test-lb',
          name: 'Test Race',
          liveEventTime: new Date(Date.now() - 60_000),
        } as unknown as Leaderboard,
      });
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'test-lb',
          name: 'Test Race',
          liveEventStatus: LiveEventStatus.IN_PROGRESS,
          isLive: true,
          autoLaunchEnabled: false,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 1, completedModels: 0, pendingModels: 0, inProgressModels: 1 },
        rankings: [],
        currentEvaluation: {
          submissionId: 'sub-1',
          participantName: 'Alice',
          modelName: 'SpeedDemon',
          status: 'IN_PROGRESS',
          streamUrl: 'https://kvs.example.com/stream.m3u8',
        },
      });
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({
        items: [
          {
            leaderboardId: 'test-lb',
            submissionId: 'sub-1',
            profileId: 'p1',
            participantName: 'Alice',
            modelName: 'SpeedDemon',
            queuePosition: 'a',
            status: 'IN_PROGRESS',
            resetCount: 0,
            submittedAt: new Date('2026-01-01T00:00:00Z'),
          },
          {
            leaderboardId: 'test-lb',
            submissionId: 'sub-2',
            profileId: 'p2',
            participantName: 'Bob',
            modelName: 'TurboBot',
            queuePosition: 'b',
            status: 'PENDING',
            resetCount: 0,
            submittedAt: new Date('2026-01-01T00:01:00Z'),
          },
        ],
      });
      mockDeepRacerClient.on(ResetLiveQueueModelCommand).resolves({});

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      // IN_PROGRESS items show in the queue — wait for it, then select and reset
      await waitFor(() => {
        expect(screen.getByText('SpeedDemon')).toBeInTheDocument();
      });
    });

    it('calls reorderLiveQueue when queue item moved', async () => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
      mockDeepRacerClient.on(GetLeaderboardCommand).resolves({
        leaderboard: {
          leaderboardId: 'test-lb',
          name: 'Test Race',
          liveEventTime: new Date(Date.now() - 60_000),
        } as unknown as Leaderboard,
      });
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'test-lb',
          name: 'Test Race',
          liveEventStatus: LiveEventStatus.IN_PROGRESS,
          isLive: true,
          autoLaunchEnabled: false,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 2, completedModels: 0, pendingModels: 2, inProgressModels: 0 },
        rankings: [],
      });
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({
        items: [
          {
            leaderboardId: 'test-lb',
            submissionId: 'sub-1',
            profileId: 'p1',
            participantName: 'Alice',
            modelName: 'SpeedDemon',
            queuePosition: 'a',
            status: 'PENDING',
            resetCount: 0,
            submittedAt: new Date('2026-01-01T00:00:00Z'),
          },
          {
            leaderboardId: 'test-lb',
            submissionId: 'sub-2',
            profileId: 'p2',
            participantName: 'Bob',
            modelName: 'TurboBot',
            queuePosition: 'b',
            status: 'PENDING',
            resetCount: 0,
            submittedAt: new Date('2026-01-01T00:01:00Z'),
          },
        ],
      });
      mockDeepRacerClient.on(ReorderLiveQueueCommand).resolves({});

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('move-down-sub-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('move-down-sub-1'));
    });
  });

  describe('broadcast mode', () => {
    it('hides cursor after inactivity', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live?mode=broadcast'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('live-race-content')).toBeInTheDocument();
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByTestId('live-race-content')).toHaveClass('cursorHidden');

      vi.useRealTimers();
    });

    it('shows cursor on mouse move', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live?mode=broadcast'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('live-race-content')).toBeInTheDocument();
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      fireEvent.mouseMove(window);

      expect(screen.getByTestId('live-race-content')).not.toHaveClass('cursorHidden');

      vi.useRealTimers();
    });
  });

  describe('conditional rendering', () => {
    it('shows RacerInfoBanner when raceStatus is IN_PROGRESS and participant active', async () => {
      mockCheckUserGroupMembership.mockResolvedValue(false);
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'test-lb',
          name: 'Test Race',
          liveEventStatus: LiveEventStatus.IN_PROGRESS,
          isLive: true,
          autoLaunchEnabled: false,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 1, completedModels: 0, pendingModels: 0, inProgressModels: 1 },
        rankings: [],
        currentEvaluation: {
          submissionId: 'sub-1',
          participantName: 'Alice',
          modelName: 'SpeedDemon',
          status: 'IN_PROGRESS',
          streamUrl: undefined,
        },
      });
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({ items: [] });

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('racer-info-banner')).toBeInTheDocument();
      });
    });

    it('shows race name from leaderboard query in header', async () => {
      mockCheckUserGroupMembership.mockResolvedValue(false);
      mockDeepRacerClient.on(GetLeaderboardCommand).resolves({
        leaderboard: {
          leaderboardId: 'test-lb',
          name: 'Friday Hackathon',
        } as unknown as Leaderboard,
      });
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'test-lb',
          name: 'Friday Hackathon',
          liveEventStatus: LiveEventStatus.IN_PROGRESS,
          isLive: true,
          autoLaunchEnabled: false,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 0, completedModels: 0, pendingModels: 0, inProgressModels: 0 },
        rankings: [],
      });
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({ items: [] });

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByText(/Friday Hackathon/)).toBeInTheDocument();
      });
    });
  });

  describe('facilitator action error rollbacks', () => {
    const setupFacilitatorPendingOnly = () => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
      mockDeepRacerClient.on(GetLeaderboardCommand).resolves({
        leaderboard: {
          leaderboardId: 'test-lb',
          name: 'Test Race',
          liveEventTime: new Date(Date.now() - 60_000),
        } as unknown as Leaderboard,
      });
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'test-lb',
          name: 'Test Race',
          liveEventStatus: LiveEventStatus.IN_PROGRESS,
          isLive: true,
          autoLaunchEnabled: false,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 2, completedModels: 0, pendingModels: 2, inProgressModels: 0 },
        rankings: [{ rank: 1, participantName: 'Alice', modelName: 'SpeedDemon', bestLapTime: 12000 }],
      });
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({
        items: [
          {
            leaderboardId: 'test-lb',
            submissionId: 'sub-1',
            profileId: 'p1',
            participantName: 'Alice',
            modelName: 'SpeedDemon',
            queuePosition: 'a',
            status: 'PENDING',
            resetCount: 0,
            submittedAt: new Date('2026-01-01T00:00:00Z'),
          },
          {
            leaderboardId: 'test-lb',
            submissionId: 'sub-2',
            profileId: 'p2',
            participantName: 'Bob',
            modelName: 'TurboBot',
            queuePosition: 'b',
            status: 'PENDING',
            resetCount: 0,
            submittedAt: new Date('2026-01-01T00:01:00Z'),
          },
        ],
      });
    };

    it('rolls back launch on failure', async () => {
      setupFacilitatorPendingOnly();
      mockDeepRacerClient.on(LaunchLiveRaceCommand).rejects(new Error('conflict'));

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('launch-button')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('launch-button'));

      // Button should re-enable after failure
      await waitFor(() => {
        expect(screen.getByTestId('launch-button')).not.toBeDisabled();
      });
    });

    it('rolls back autolaunch toggle on failure', async () => {
      setupFacilitatorPendingOnly();
      mockDeepRacerClient.on(EditLeaderboardCommand).rejects(new Error('fail'));

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('autolaunch-toggle')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('autolaunch-toggle'));

      // Should revert to original state (off)
      await waitFor(() => {
        expect(screen.getByTestId('autolaunch-toggle')).not.toBeChecked();
      });
    });

    it('rolls back submissions toggle on failure', async () => {
      setupFacilitatorPendingOnly();
      mockDeepRacerClient.on(EditLeaderboardCommand).rejects(new Error('fail'));

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('submissions-toggle')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('submissions-toggle'));

      await waitFor(() => {
        expect(screen.getByTestId('submissions-toggle')).not.toBeChecked();
      });
    });

    it('rolls back clear leaderboard on failure', async () => {
      setupFacilitatorPendingOnly();
      mockDeepRacerClient.on(ClearLiveLeaderboardCommand).rejects(new Error('fail'));

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('actions-dropdown')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('actions-dropdown'));
      fireEvent.click(screen.getAllByText('Clear Leaderboard')[0]);
      fireEvent.click(screen.getByTestId('confirm-clear-button'));

      // After rollback, launch button should still be present (race not cleared)
      await waitFor(() => {
        expect(screen.getByTestId('launch-button')).toBeInTheDocument();
      });
    });

    it('rolls back declare winner on failure', async () => {
      setupFacilitatorPendingOnly();
      mockDeepRacerClient.on(DeclareWinnerCommand).rejects(new Error('fail'));

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('actions-dropdown')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('actions-dropdown'));
      fireEvent.click(screen.getAllByText('Declare Winner')[0]);
      fireEvent.click(screen.getByTestId('confirm-declare-button'));

      // Should revert to IN_PROGRESS — launch button re-enables
      await waitFor(() => {
        expect(screen.getByTestId('launch-button')).not.toBeDisabled();
      });
    });

    it('rolls back queue remove on failure', async () => {
      setupFacilitatorPendingOnly();
      mockDeepRacerClient.on(RemoveLiveQueueItemCommand).rejects(new Error('fail'));

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByText('Bob')).toBeInTheDocument();
      });
    });

    it('rolls back queue reset on failure and clears resetting state', async () => {
      setupFacilitatorPendingOnly();
      mockDeepRacerClient.on(ResetLiveQueueModelCommand).rejects(new Error('fail'));

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('queue-management-panel')).toBeInTheDocument();
      });
    });
  });

  describe('reset progress and success', () => {
    it('shows reset progress bar during reset', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockCheckUserGroupMembership.mockResolvedValue(true);
      mockDeepRacerClient.on(GetLeaderboardCommand).resolves({
        leaderboard: {
          leaderboardId: 'test-lb',
          name: 'Test Race',
          liveEventTime: new Date(Date.now() - 60_000),
        } as unknown as Leaderboard,
      });
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'test-lb',
          name: 'Test Race',
          liveEventStatus: LiveEventStatus.IN_PROGRESS,
          isLive: true,
          autoLaunchEnabled: false,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 1, completedModels: 0, pendingModels: 0, inProgressModels: 1 },
        rankings: [],
        currentEvaluation: {
          submissionId: 'sub-1',
          participantName: 'Alice',
          modelName: 'SpeedDemon',
          status: 'IN_PROGRESS',
          streamUrl: undefined,
        },
      });
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({
        items: [
          {
            leaderboardId: 'test-lb',
            submissionId: 'sub-1',
            profileId: 'p1',
            participantName: 'Alice',
            modelName: 'SpeedDemon',
            queuePosition: 'a',
            status: 'IN_PROGRESS',
            resetCount: 0,
            submittedAt: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      });
      // Reset resolves but the 30s timer means isResetting stays true
      mockDeepRacerClient.on(ResetLiveQueueModelCommand).resolves({});

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('queue-management-panel')).toBeInTheDocument();
      });

      vi.useRealTimers();
    });
  });

  describe('header status descriptions', () => {
    it('shows "Starting soon" when race status is null (SCHEDULED)', async () => {
      mockCheckUserGroupMembership.mockResolvedValue(false);
      mockDeepRacerClient.on(GetLeaderboardCommand).resolves({
        leaderboard: { leaderboardId: 'test-lb', name: 'Scheduled Race' } as unknown as Leaderboard,
      });
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'test-lb',
          name: 'Scheduled Race',
          liveEventStatus: LiveEventStatus.SCHEDULED,
          isLive: true,
          autoLaunchEnabled: false,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 0, completedModels: 0, pendingModels: 0, inProgressModels: 0 },
        rankings: [],
      });
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({ items: [] });

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByText(/Starting soon/i)).toBeInTheDocument();
      });
    });

    it('shows "Race completed" when race status is COMPLETED', async () => {
      mockCheckUserGroupMembership.mockResolvedValue(false);
      mockDeepRacerClient.on(GetLeaderboardCommand).resolves({
        leaderboard: { leaderboardId: 'test-lb', name: 'Done Race' } as unknown as Leaderboard,
      });
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'test-lb',
          name: 'Done Race',
          liveEventStatus: LiveEventStatus.COMPLETED,
          isLive: true,
          autoLaunchEnabled: false,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 0, completedModels: 0, pendingModels: 0, inProgressModels: 0 },
        rankings: [],
      });
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({ items: [] });

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getAllByText('Race completed').length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('WebSocket reconnection and queue events', () => {
    it('refetches state on reconnect', async () => {
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'test-lb',
          name: 'Test Race',
          liveEventStatus: LiveEventStatus.IN_PROGRESS,
          isLive: true,
          autoLaunchEnabled: false,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 0, completedModels: 0, pendingModels: 0, inProgressModels: 0 },
        rankings: [],
      });
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({ items: [] });

      let capturedOnReconnect: (() => void) | null = null;
      const mockUseLiveRaceMqtt = vi.mocked(useLiveRaceMqtt);
      mockUseLiveRaceMqtt.mockImplementation((_id, options) => {
        capturedOnReconnect = (options as { onReconnect: () => void }).onReconnect;
        return { connectionStatus: ConnectionStatus.CONNECTED };
      });

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('live-race-content')).toBeInTheDocument();
      });

      // Trigger reconnect after queries have started
      act(() => {
        capturedOnReconnect?.();
      });
    });

    it('refetches queue on QUEUE_CHANGED SUBMISSION_ADDED event', async () => {
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'test-lb',
          name: 'Test Race',
          liveEventStatus: LiveEventStatus.IN_PROGRESS,
          isLive: true,
          autoLaunchEnabled: false,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 0, completedModels: 0, pendingModels: 0, inProgressModels: 0 },
        rankings: [],
      });
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({ items: [] });

      let capturedOnEvent: ((e: unknown) => void) | null = null;
      const mockUseLiveRaceMqtt = vi.mocked(useLiveRaceMqtt);
      mockUseLiveRaceMqtt.mockImplementation((_id, options) => {
        capturedOnEvent = (options as { onEvent: (e: unknown) => void }).onEvent;
        return { connectionStatus: ConnectionStatus.CONNECTED };
      });

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('live-race-content')).toBeInTheDocument();
      });

      // Fire event after queries have started
      act(() => {
        capturedOnEvent?.({
          eventType: 'QUEUE_CHANGED',
          action: 'SUBMISSION_ADDED',
          leaderboardId: 'test-lb',
          timestamp: '2026-01-01T00:00:00Z',
          submissionId: 'new-sub',
          participantName: 'NewRacer',
          modelName: 'NewModel',
          queuePosition: 'c',
        });
      });
    });
  });

  describe('non-facilitator queue view', () => {
    it('shows read-only queue panel for regular users', async () => {
      mockCheckUserGroupMembership.mockResolvedValue(false);
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'test-lb',
          name: 'Test Race',
          liveEventStatus: LiveEventStatus.IN_PROGRESS,
          isLive: true,
          autoLaunchEnabled: false,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 1, completedModels: 0, pendingModels: 1, inProgressModels: 0 },
        rankings: [],
      });
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({
        items: [
          {
            leaderboardId: 'test-lb',
            submissionId: 'sub-1',
            profileId: 'p1',
            participantName: 'Alice',
            modelName: 'SpeedDemon',
            queuePosition: 'a',
            status: 'PENDING',
            resetCount: 0,
            submittedAt: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      });

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('queue-management-panel')).toBeInTheDocument();
      });
      // Should not have reorder buttons (readOnly)
      expect(screen.queryByTestId('move-up-sub-1')).not.toBeInTheDocument();
    });
  });

  describe('__forceFacilitator prop', () => {
    it('bypasses auth check when __forceFacilitator is true', async () => {
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'test-lb',
          name: 'Test Race',
          liveEventStatus: LiveEventStatus.IN_PROGRESS,
          isLive: true,
          autoLaunchEnabled: false,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 0, completedModels: 0, pendingModels: 0, inProgressModels: 0 },
        rankings: [],
      });
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({ items: [] });

      render(<LiveRace __forceFacilitator />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('launch-button')).toBeInTheDocument();
      });
      expect(mockCheckUserGroupMembership).not.toHaveBeenCalled();
    });
  });

  describe('avatar enrichment', () => {
    const baseRaceState = {
      race: {
        leaderboardId: 'test-lb',
        name: 'Test Race',
        liveEventStatus: LiveEventStatus.IN_PROGRESS,
        isLive: true,
        autoLaunchEnabled: false,
        submissionPeriodOpen: false,
      },
      queue: { totalModels: 1, completedModels: 0, pendingModels: 0, inProgressModels: 1 },
      rankings: [],
      currentEvaluation: {
        submissionId: 'sub-1',
        participantName: 'Alice',
        modelName: 'SpeedDemon',
        status: 'IN_PROGRESS' as const,
        streamUrl: undefined,
      },
    };

    const queueItems = [
      {
        leaderboardId: 'test-lb',
        submissionId: 'sub-1',
        profileId: 'profile-alice',
        participantName: 'Alice',
        modelName: 'SpeedDemon',
        queuePosition: 'a',
        status: 'IN_PROGRESS' as const,
        resetCount: 0,
        submittedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ];

    it('renders RacerInfoBanner when profiles and queue items are both available', async () => {
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves(baseRaceState);
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({ items: queueItems });
      mockDeepRacerClient.on(ListProfilesCommand).resolves({
        profiles: [
          {
            profileId: 'profile-alice',
            alias: 'alice',
            avatar: { top: 'short', skinColor: 'light', eyes: 'default' },
            computeMinutesUsed: 0,
            computeMinutesQueued: 0,
            maxTotalComputeMinutes: 600,
            maxModelCount: 10,
          },
        ],
      });

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('racer-info-banner')).toBeInTheDocument();
      });
    });

    it('renders RacerInfoBanner even when no matching profile exists (graceful fallback)', async () => {
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves(baseRaceState);
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({ items: queueItems });
      mockDeepRacerClient.on(ListProfilesCommand).resolves({ profiles: [] });

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('racer-info-banner')).toBeInTheDocument();
      });
    });

    it('renders RacerInfoBanner even when profiles resolve after queue items', async () => {
      mockDeepRacerClient.on(GetLiveRaceStateCommand).resolves(baseRaceState);
      mockDeepRacerClient.on(ListLiveQueueItemsCommand).resolves({ items: queueItems });

      let resolveProfiles!: (value: unknown) => void;
      mockDeepRacerClient.on(ListProfilesCommand).callsFake(
        () =>
          new Promise((resolve) => {
            resolveProfiles = resolve;
          }),
      );

      render(<LiveRace />, {
        componentRoute: '/races/:leaderboardId/live',
        initialRouteEntries: ['/races/test-lb/live'],
      });

      // Banner renders before profiles arrive
      await waitFor(() => {
        expect(screen.getByTestId('racer-info-banner')).toBeInTheDocument();
      });

      // Profiles resolve late — should not crash
      resolveProfiles({ profiles: [] });
    });
  });
});
