// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ConnectionStatus, useRaceTopicMqtt } from '#hooks/useRaceTopicMqtt';
import { render } from '#utils/testUtils';

import CommentatorView from '../index';

// ── Mocks ──────────────────────────────────────────────────────────────────────

let capturedOnEvent: ((event: unknown) => void) | null = null;

vi.mock('#hooks/useRaceTopicMqtt', () => ({
  useRaceTopicMqtt: vi.fn((_eventId: string, _trackId: string, options: { onEvent: (e: unknown) => void }) => {
    capturedOnEvent = options.onEvent;
    return { connectionStatus: ConnectionStatus.CONNECTED, publish: vi.fn().mockResolvedValue(true) };
  }),
  ConnectionStatus: {
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
    DISCONNECTED: 'DISCONNECTED',
    ERROR: 'ERROR',
  },
}));

vi.mock('#services/deepRacer/raceManagementApi', () => ({
  useGetEventLeaderboardQuery: vi.fn(() => ({ data: undefined })),
}));

vi.mock('#services/deepRacer/eventsApi', () => ({
  useListEventsQuery: vi.fn(() => ({
    data: [
      { eventId: 'evt-1', name: 'Grand Prix' },
      { eventId: 'evt-2', name: 'Qualifiers' },
    ],
    isLoading: false,
  })),
  useListEventTracksQuery: vi.fn(() => ({
    data: [{ leaderboardId: 'trk-1', name: 'Track A' }],
    isLoading: false,
  })),
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
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const renderPage = () =>
  render(<CommentatorView />, {
    componentRoute: '/race-management/commentator',
    initialRouteEntries: ['/race-management/commentator'],
  });

const emitEvent = (event: unknown) => {
  act(() => {
    capturedOnEvent?.(event);
  });
};

const subscribe = () => {
  const wrapper = createWrapper();
  const eventSelect = wrapper.findSelect('[data-testid="event-select"]');
  eventSelect?.openDropdown();
  eventSelect?.selectOptionByValue('evt-1');

  const trackSelect = wrapper.findSelect('[data-testid="track-select"]');
  trackSelect?.openDropdown();
  trackSelect?.selectOptionByValue('trk-1');

  fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
};

const OVERLAY_UPDATE = {
  eventType: 'OVERLAY_UPDATE',
  eventId: 'evt-1',
  trackId: 'trk-1',
  racerName: 'Alice Chen',
  laps: [],
  timeLeftMilliseconds: 120_000,
  currentLapTimeMilliseconds: 8_000,
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

describe('<CommentatorView />', () => {
  beforeEach(() => {
    capturedOnEvent = null;
    vi.mocked(useRaceTopicMqtt).mockImplementation(
      (_eventId, _trackId, options: Parameters<typeof useRaceTopicMqtt>[2]) => {
        capturedOnEvent = options.onEvent as (e: unknown) => void;
        return { connectionStatus: ConnectionStatus.CONNECTED, publish: vi.fn().mockResolvedValue(true) };
      },
    );
  });

  describe('initial state', () => {
    it('renders page header', () => {
      renderPage();
      expect(screen.getByText('Commentator view')).toBeInTheDocument();
    });

    it('renders track selection form', () => {
      renderPage();
      expect(screen.getByText('Track selection')).toBeInTheDocument();
      expect(screen.getByTestId('event-select')).toBeInTheDocument();
      expect(screen.getByTestId('track-select')).toBeInTheDocument();
    });

    it('does not show a connection status badge before subscribing', () => {
      renderPage();
      expect(screen.queryByText('Connected')).not.toBeInTheDocument();
      expect(screen.queryByText('Connecting')).not.toBeInTheDocument();
    });

    it('Subscribe button is disabled when fields are empty', () => {
      renderPage();
      expect(screen.getByRole('button', { name: 'Subscribe' })).toBeDisabled();
    });

    it('Subscribe button is enabled when both fields filled', () => {
      renderPage();
      const wrapper = createWrapper();
      const eventSelect = wrapper.findSelect('[data-testid="event-select"]');
      eventSelect?.openDropdown();
      eventSelect?.selectOptionByValue('evt-1');

      const trackSelect = wrapper.findSelect('[data-testid="track-select"]');
      trackSelect?.openDropdown();
      trackSelect?.selectOptionByValue('trk-1');

      expect(screen.getByRole('button', { name: 'Subscribe' })).not.toBeDisabled();
    });

    it('shows description before subscribing', () => {
      renderPage();
      expect(screen.getByText('Subscribe to a track to start receiving live data')).toBeInTheDocument();
    });

    it('disables the track selector until an event is selected', () => {
      renderPage();
      const wrapper = createWrapper();
      expect(wrapper.findSelect('[data-testid="track-select"]')?.findTrigger().getElement()).toBeDisabled();

      const eventSelect = wrapper.findSelect('[data-testid="event-select"]');
      eventSelect?.openDropdown();
      eventSelect?.selectOptionByValue('evt-1');

      expect(wrapper.findSelect('[data-testid="track-select"]')?.findTrigger().getElement()).not.toBeDisabled();
    });

    it('resets the selected track when the event changes', () => {
      renderPage();
      const wrapper = createWrapper();
      const eventSelect = wrapper.findSelect('[data-testid="event-select"]');
      eventSelect?.openDropdown();
      eventSelect?.selectOptionByValue('evt-1');

      const trackSelect = wrapper.findSelect('[data-testid="track-select"]');
      trackSelect?.openDropdown();
      trackSelect?.selectOptionByValue('trk-1');
      expect(screen.getByRole('button', { name: 'Subscribe' })).not.toBeDisabled();

      eventSelect?.openDropdown();
      eventSelect?.selectOptionByValue('evt-2');
      expect(screen.getByRole('button', { name: 'Subscribe' })).toBeDisabled();
    });
  });

  describe('after subscribing', () => {
    it('shows connection status after subscribe', () => {
      renderPage();
      subscribe();
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('calls useRaceTopicMqtt with correct IDs after subscribe', () => {
      renderPage();
      subscribe();
      expect(useRaceTopicMqtt).toHaveBeenCalledWith('evt-1', 'trk-1', expect.any(Object));
    });
  });

  describe('race status label', () => {
    it('shows a human-readable label for a finished run instead of the raw status', async () => {
      renderPage();
      subscribe();
      emitEvent({ ...OVERLAY_UPDATE, raceStatus: 'RACE_FINISHED' });
      expect(await screen.findByText('Lap complete')).toBeInTheDocument();
      expect(screen.queryByText('RACE FINISHED')).not.toBeInTheDocument();
    });

    it('labels a submitted result distinctly from a finished run', async () => {
      renderPage();
      subscribe();
      emitEvent({ ...OVERLAY_UPDATE, raceStatus: 'RACE_SUBMITTED' });
      expect(await screen.findByText('Lap submitted')).toBeInTheDocument();
    });
  });

  describe('active race KPI panel', () => {
    it('shows racer name as panel header during race', async () => {
      renderPage();
      subscribe();
      emitEvent(OVERLAY_UPDATE);
      expect(await screen.findByText('Alice Chen')).toBeInTheDocument();
      expect(screen.getByText('Race in progress')).toBeInTheDocument();
    });

    it('shows time remaining KPI', async () => {
      renderPage();
      subscribe();
      emitEvent(OVERLAY_UPDATE);
      // 120000ms = 2:00
      expect(await screen.findByText('2:00')).toBeInTheDocument();
    });

    it('shows time remaining label', async () => {
      renderPage();
      subscribe();
      emitEvent(OVERLAY_UPDATE);
      expect(await screen.findByText('Time remaining')).toBeInTheDocument();
      expect(screen.getByText('Laps completed')).toBeInTheDocument();
    });

    it('shows laps completed count', async () => {
      renderPage();
      subscribe();
      const withLap = {
        ...OVERLAY_UPDATE,
        laps: [{ lapNumber: 1, lapTimeMilliseconds: 48_000, isValid: true }],
      };
      emitEvent(withLap);
      expect(await screen.findByText('Laps completed')).toBeInTheDocument();
      expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    });

    it('shows fastest lap after lap captured', async () => {
      renderPage();
      subscribe();
      const withLap = {
        ...OVERLAY_UPDATE,
        laps: [{ lapNumber: 1, lapTimeMilliseconds: 48_000, isValid: true }],
      };
      emitEvent(withLap);
      expect(await screen.findByText('Fastest lap')).toBeInTheDocument();
      expect(screen.getByText('48.000s')).toBeInTheDocument();
    });

    it('shows current position KPI', async () => {
      renderPage();
      subscribe();
      emitEvent(OVERLAY_UPDATE);
      emitEvent(LEADERBOARD_UPDATED);
      expect(await screen.findByText('Current position')).toBeInTheDocument();
    });

    it('shows projected position KPI', async () => {
      renderPage();
      subscribe();
      // Emit a lap faster than Bob Santos (47890ms) but slower than Alice (45231ms)
      // → projected position = #2
      const withLap = { ...OVERLAY_UPDATE, laps: [{ lapNumber: 1, lapTimeMilliseconds: 46_000, isValid: true }] };
      emitEvent(withLap);
      emitEvent(LEADERBOARD_UPDATED);
      expect(await screen.findByText('Projected position')).toBeInTheDocument();
      expect(screen.getByText('if race ended now')).toBeInTheDocument();
    });

    it('hides race KPI panel after race finishes', async () => {
      renderPage();
      subscribe();
      emitEvent(OVERLAY_UPDATE);
      expect(await screen.findByText('Alice Chen')).toBeInTheDocument();

      emitEvent({ eventType: 'RACE_STATUS_CHANGED', eventId: 'evt-1', trackId: 'trk-1', status: 'COMPLETED' });
      await waitFor(() => {
        expect(screen.queryByText('Race in progress')).not.toBeInTheDocument();
      });
    });

    it("clears the previous racer's lap history once a new racer's OVERLAY_UPDATE arrives, without an intervening RACE_STATUS_CHANGED", async () => {
      // A facilitator typically runs many racers back-to-back while the event/track stays
      // IN_PROGRESS the whole time, so RACE_STATUS_CHANGED never fires between individual
      // racers — the only signal of a racer switch is OVERLAY_UPDATE carrying a new racerName.
      renderPage();
      subscribe();

      const aliceWithLap = {
        ...OVERLAY_UPDATE,
        laps: [{ lapNumber: 1, lapTimeMilliseconds: 48_000, isValid: true }],
      };
      emitEvent(aliceWithLap);
      expect(await screen.findByText('Alice Chen')).toBeInTheDocument();
      expect(screen.getByText('Current race laps')).toBeInTheDocument();
      expect(screen.getByText('48.000s')).toBeInTheDocument();

      // No RACE_STATUS_CHANGED here — Bob's first OVERLAY_UPDATE arrives directly.
      const bobFirstUpdate = {
        ...OVERLAY_UPDATE,
        racerName: 'Bob Santos',
        laps: [],
        currentLapTimeMilliseconds: 2_000,
      };
      emitEvent(bobFirstUpdate);

      expect(await screen.findByText('Bob Santos')).toBeInTheDocument();
      // Alice's lap must not still be displayed under Bob's name.
      expect(screen.queryByText('48.000s')).not.toBeInTheDocument();
      expect(screen.queryByText('Current race laps')).not.toBeInTheDocument();
    });
  });

  describe('RACE_STATUS_CHANGED without an OVERLAY_UPDATE (Event-only transition)', () => {
    it('does not show the race KPI panel from RACE_STATUS_CHANGED alone (needs OVERLAY_UPDATE for currentRace)', async () => {
      renderPage();
      subscribe();
      // Only RACE_STATUS_CHANGED, no OVERLAY_UPDATE.
      emitEvent({ eventType: 'RACE_STATUS_CHANGED', eventId: 'evt-1', trackId: 'trk-1', status: 'IN_PROGRESS' });
      // The KPI panel and "Race status" box both require currentRace, which only OVERLAY_UPDATE sets.
      await waitFor(() => {
        expect(screen.queryByText('Race in progress')).not.toBeInTheDocument();
      });
      expect(screen.queryByText('Race status')).not.toBeInTheDocument();
    });

    it('shows the race KPI panel once OVERLAY_UPDATE arrives after a real RACE_STATUS_CHANGED', async () => {
      renderPage();
      subscribe();
      emitEvent({ eventType: 'RACE_STATUS_CHANGED', eventId: 'evt-1', trackId: 'trk-1', status: 'IN_PROGRESS' });
      emitEvent(OVERLAY_UPDATE);
      expect(await screen.findByText('Race in progress')).toBeInTheDocument();
    });
  });

  describe('leaderboard table', () => {
    it('renders leaderboard after LEADERBOARD_UPDATED', async () => {
      renderPage();
      subscribe();
      emitEvent(LEADERBOARD_UPDATED);
      expect(await screen.findByText('Alice Chen')).toBeInTheDocument();
      expect(screen.getByText('Bob Santos')).toBeInTheDocument();
    });

    it('shows gap to leader column', async () => {
      renderPage();
      subscribe();
      emitEvent(LEADERBOARD_UPDATED);
      expect((await screen.findAllByText('Gap to leader')).length).toBeGreaterThan(0);
    });

    it('shows — for leader gap-to-leader', async () => {
      renderPage();
      subscribe();
      emitEvent(LEADERBOARD_UPDATED);
      expect((await screen.findAllByText('Gap to leader')).length).toBeGreaterThan(0);
      // Leader (#1) should show —
      const cells = screen.getAllByText('—');
      expect(cells.length).toBeGreaterThan(0);
    });

    it('shows empty state before subscribing', () => {
      renderPage();
      expect(screen.getByText('Select a track and click Subscribe to start.')).toBeInTheDocument();
    });
  });

  describe('connection error', () => {
    it('shows error alert on connection error after subscribing', async () => {
      // First render: connected (from beforeEach implementation)
      renderPage();
      // Override for the re-render triggered by subscribe
      vi.mocked(useRaceTopicMqtt).mockImplementation(
        (_eventId, _trackId, options: Parameters<typeof useRaceTopicMqtt>[2]) => {
          capturedOnEvent = options.onEvent as (e: unknown) => void;
          return { connectionStatus: ConnectionStatus.ERROR, publish: vi.fn().mockResolvedValue(true) };
        },
      );
      subscribe();
      expect(
        await screen.findByText('Unable to connect to live race data. Check your permissions and try again.'),
      ).toBeInTheDocument();
    });
  });
});
