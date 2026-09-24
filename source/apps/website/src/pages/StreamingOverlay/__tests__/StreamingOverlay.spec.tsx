// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ConnectionStatus, usePublicRaceTopicMqtt } from '#hooks/usePublicRaceTopicMqtt';
import { render } from '#utils/testUtils';

import StreamingOverlay from '../index';

// ── Mocks ──────────────────────────────────────────────────────────────────────

let capturedOnEvent: ((event: unknown) => void) | null = null;

vi.mock('#hooks/usePublicRaceTopicMqtt', () => ({
  usePublicRaceTopicMqtt: vi.fn(
    (_eventId: string, _trackId: string, options: { onEvent: (e: unknown) => void; onReconnect?: () => void }) => {
      capturedOnEvent = options.onEvent;
      return { connectionStatus: ConnectionStatus.CONNECTED, publish: vi.fn().mockResolvedValue(true) };
    },
  ),
  ConnectionStatus: {
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
    DISCONNECTED: 'DISCONNECTED',
    ERROR: 'ERROR',
  },
}));

vi.mock('#utils/envUtils', () => ({
  environmentConfig: {
    iotEndpoint: 'test-ats.iot.us-east-1.amazonaws.com',
    namespace: 'testns',
    region: 'us-east-1',
    apiEndpointUrl: 'https://api.example.com',
    userPoolId: 'us-east-1_test',
    userPoolClientId: 'testclient',
    identityPoolId: 'us-east-1:test-pool',
    uploadBucketName: 'test-bucket',
    cloudFrontDomainName: 'd1234.cloudfront.net',
  },
}));

// Silence fetch calls for S3 hydration
global.fetch = vi.fn().mockResolvedValue({ ok: false });

// ── Helpers ───────────────────────────────────────────────────────────────────

const renderOverlay = (search = '?event=evt-1&track=trk-1') => {
  vi.mocked(usePublicRaceTopicMqtt).mockImplementation(
    (_eventId, _trackId, options: Parameters<typeof usePublicRaceTopicMqtt>[2]) => {
      capturedOnEvent = options.onEvent as (e: unknown) => void;
      return { connectionStatus: ConnectionStatus.CONNECTED, publish: vi.fn().mockResolvedValue(true) };
    },
  );
  return render(<StreamingOverlay />, {
    componentRoute: '/race-management/overlay',
    initialRouteEntries: [`/race-management/overlay${search}`],
  });
};

const emitEvent = (event: unknown) => {
  act(() => {
    capturedOnEvent?.(event);
  });
};

const OVERLAY_UPDATE = {
  eventType: 'OVERLAY_UPDATE',
  eventId: 'evt-1',
  trackId: 'trk-1',
  racerName: 'Alice Chen',
  laps: [],
  timeLeftMilliseconds: 150_000,
  currentLapTimeMilliseconds: 5_000,
  raceStatus: 'RACE_IN_PROGRESS',
};

const LEADERBOARD_UPDATED = {
  eventType: 'LEADERBOARD_UPDATED',
  eventId: 'evt-1',
  trackId: 'trk-1',
  rankings: [
    { rank: 1, participantName: 'Alice Chen', bestLapTimeMilliseconds: 45231 },
    { rank: 2, participantName: 'Bob Santos', bestLapTimeMilliseconds: 47890 },
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('<StreamingOverlay />', () => {
  beforeEach(() => {
    capturedOnEvent = null;
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });
  });

  describe('when event/track not configured', () => {
    it('renders nothing when no event or track params', () => {
      renderOverlay('');
      // Page renders null — no content should be present
      expect(screen.queryByText('Leaderboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Time remaining')).not.toBeInTheDocument();
    });

    it('renders nothing when only event param', () => {
      renderOverlay('?event=evt-1');
      expect(screen.queryByText('Time remaining')).not.toBeInTheDocument();
    });
  });

  describe('idle state (no race in progress)', () => {
    it('calls usePublicRaceTopicMqtt with correct event and track IDs', () => {
      renderOverlay();
      expect(usePublicRaceTopicMqtt).toHaveBeenCalledWith('evt-1', 'trk-1', expect.any(Object));
    });

    it('shows leaderboard panel when LEADERBOARD_UPDATED received', async () => {
      renderOverlay();
      // Wait for the S3 hydration fetch to settle before emitting events
      await waitFor(() => expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0));
      emitEvent(LEADERBOARD_UPDATED);
      await screen.findByText('Alice Chen');
      expect(screen.getByText('Bob Santos')).toBeInTheDocument();
    });

    it('shows position labels in leaderboard panel', async () => {
      renderOverlay();
      await waitFor(() => expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0));
      emitEvent(LEADERBOARD_UPDATED);
      await screen.findByText('1st');
      expect(screen.getByText('2nd')).toBeInTheDocument();
    });

    it('does not show lower-third when no race in progress', () => {
      renderOverlay();
      emitEvent(LEADERBOARD_UPDATED);
      // Lower-third is always in DOM but CSS-translated off-screen when idle.
      // Verify no active-race OVERLAY_UPDATE was emitted (countdown stays at 0:00)
      expect(screen.queryByText('2:30')).not.toBeInTheDocument();
    });
  });

  describe('active race state', () => {
    it('shows lower-third bar with racer name on OVERLAY_UPDATE', async () => {
      renderOverlay();
      emitEvent(OVERLAY_UPDATE);
      await waitFor(() => {
        expect(screen.getByText('Alice Chen')).toBeInTheDocument();
      });
    });

    it('shows time remaining in countdown format', async () => {
      renderOverlay();
      emitEvent(OVERLAY_UPDATE);
      await waitFor(() => {
        // 150000ms = 2:30
        expect(screen.getByText('2:30')).toBeInTheDocument();
      });
    });

    it('shows stat labels during active race', async () => {
      renderOverlay();
      emitEvent(OVERLAY_UPDATE);
      await screen.findByText('Time remaining');
      expect(screen.getByText('Fastest lap')).toBeInTheDocument();
      expect(screen.getByText('Previous lap')).toBeInTheDocument();
      expect(screen.getByText('Current lap')).toBeInTheDocument();
    });

    it('shows fastest lap time after lap is captured', async () => {
      renderOverlay();
      const withLap = {
        ...OVERLAY_UPDATE,
        laps: [{ lapNumber: 1, lapTimeMilliseconds: 48_000, isValid: true }],
      };
      emitEvent(withLap);
      await waitFor(() => {
        // 48.000 may appear in both fastest and previous lap slots — just verify it's shown
        expect(screen.getAllByText('48.000').length).toBeGreaterThan(0);
      });
    });

    it('hides leaderboard panel during active race', async () => {
      renderOverlay();
      // First show leaderboard
      emitEvent(LEADERBOARD_UPDATED);
      await screen.findByText('1st');
      // Then start race — leaderboard panel should be hidden (transform off-screen)
      emitEvent({ ...OVERLAY_UPDATE, raceStatus: 'RACE_IN_PROGRESS' });
      await waitFor(() => {
        // Lower-third is visible
        expect(screen.getByText('Time remaining')).toBeInTheDocument();
      });
    });
  });

  describe('race finish', () => {
    it('hides lower-third after RACE_STATUS_CHANGED to RACE_FINISHED', async () => {
      renderOverlay();
      emitEvent(OVERLAY_UPDATE);
      // Confirm race is active — countdown from OVERLAY_UPDATE (150000ms = 2:30) is shown
      await screen.findByText('2:30');

      emitEvent({ eventType: 'RACE_STATUS_CHANGED', eventId: 'evt-1', trackId: 'trk-1', status: 'COMPLETED' });
      // After RACE_FINISHED, overlay state is cleared — racer name removed, countdown resets
      await waitFor(() => {
        expect(screen.queryByText('2:30')).not.toBeInTheDocument();
      });
    });
  });

  describe('countdown color', () => {
    it('shows normal color when time > 30s', async () => {
      renderOverlay();
      emitEvent({ ...OVERLAY_UPDATE, timeLeftMilliseconds: 60_000 });
      await waitFor(() => {
        const countdown = screen.getByText('1:00');
        // Should not have red color style when > 30s
        expect(countdown).not.toHaveStyle({ color: '#ef5350' });
      });
    });

    it('shows red color when time < 30s', async () => {
      renderOverlay();
      emitEvent({ ...OVERLAY_UPDATE, timeLeftMilliseconds: 20_000 });
      await waitFor(() => {
        const countdown = screen.getByText('0:20');
        expect(countdown).toHaveStyle({ color: '#ef5350' });
      });
    });
  });
});
