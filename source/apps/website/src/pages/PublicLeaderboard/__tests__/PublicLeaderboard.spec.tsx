// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ConnectionStatus, usePublicRaceTopicMqtt } from '#hooks/usePublicRaceTopicMqtt';
import { render } from '#utils/testUtils';

import PublicLeaderboard from '../index';

// ── Mocks ──────────────────────────────────────────────────────────────────────

let capturedOnEvent: ((event: unknown) => void) | null = null;
let capturedOnReconnect: (() => void) | null = null;

vi.mock('#hooks/usePublicRaceTopicMqtt', () => ({
  usePublicRaceTopicMqtt: vi.fn(
    (_eventId: string, _trackId: string, options: { onEvent: (e: unknown) => void; onReconnect?: () => void }) => {
      capturedOnEvent = options.onEvent;
      capturedOnReconnect = options.onReconnect ?? null;
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

global.fetch = vi.fn().mockResolvedValue({ ok: false });

// ── Helpers ───────────────────────────────────────────────────────────────────

const renderPage = (search = '?track=trk-1') => {
  vi.mocked(usePublicRaceTopicMqtt).mockImplementation(
    (_eventId, _trackId, options: Parameters<typeof usePublicRaceTopicMqtt>[2]) => {
      capturedOnEvent = options.onEvent as (e: unknown) => void;
      capturedOnReconnect = (options.onReconnect as (() => void) | undefined) ?? null;
      return { connectionStatus: ConnectionStatus.CONNECTED, publish: vi.fn().mockResolvedValue(true) };
    },
  );
  return render(<PublicLeaderboard />, {
    componentRoute: '/race-management/events/:eventId/leaderboard',
    initialRouteEntries: [`/race-management/events/evt-1/leaderboard${search}`],
  });
};

const emitEvent = (event: unknown) => {
  act(() => {
    capturedOnEvent?.(event);
  });
};

const RANKINGS = [
  { rank: 1, participantName: 'Alice Chen', bestLapTimeMilliseconds: 45231, country: 'US' },
  { rank: 2, participantName: 'Bob Santos', bestLapTimeMilliseconds: 47890, country: 'BR' },
  { rank: 3, participantName: 'Carol Kim', bestLapTimeMilliseconds: 48102, country: 'KR' },
];

const LEADERBOARD_UPDATED = {
  eventType: 'LEADERBOARD_UPDATED',
  eventId: 'evt-1',
  trackId: 'trk-1',
  rankings: RANKINGS,
};

const OVERLAY_UPDATE = {
  eventType: 'OVERLAY_UPDATE',
  eventId: 'evt-1',
  trackId: 'trk-1',
  racerName: 'Alice Chen',
  laps: [],
  timeLeftMilliseconds: 120_000,
  currentLapTimeMilliseconds: 5_000,
  raceStatus: 'RACE_IN_PROGRESS',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('<PublicLeaderboard />', () => {
  beforeEach(() => {
    capturedOnEvent = null;
    capturedOnReconnect = null;
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });
  });

  describe('no track param', () => {
    it('shows add track message when no track param', async () => {
      renderPage('');
      expect(await screen.findByText(/Add \?track=/)).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows waiting message when no rankings', async () => {
      renderPage();
      expect(await screen.findByText('Waiting for race results…')).toBeInTheDocument();
    });

    it('shows live connection indicator when connected', async () => {
      renderPage();
      expect(await screen.findByText('Live')).toBeInTheDocument();
    });

    it('shows leaderboard header', async () => {
      renderPage();
      expect(await screen.findByText('Live Leaderboard', { exact: false })).toBeInTheDocument();
    });

    it('shows the race/track name in the header when the S3 file includes a name', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'Madrid Summit — Track A', rankings: [] }),
      });
      renderPage();
      expect(await screen.findByText('Madrid Summit — Track A')).toBeInTheDocument();
    });

    it('falls back to "Live Leaderboard" when the S3 file has no name', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ rankings: [] }),
      });
      renderPage();
      expect(await screen.findByText('Live Leaderboard', { exact: false })).toBeInTheDocument();
    });

    it('shows the leaderboard footer when the S3 file includes one', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'Madrid Summit — Track A', footer: 'Sponsored by Acme Corp', rankings: [] }),
      });
      renderPage();
      expect(await screen.findByText('Sponsored by Acme Corp')).toBeInTheDocument();
    });

    it('renders no footer element when the S3 file has no footer', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'Madrid Summit — Track A', rankings: [] }),
      });
      renderPage();
      await screen.findByText('Madrid Summit — Track A');
      expect(screen.queryByText('Sponsored by Acme Corp')).not.toBeInTheDocument();
    });

    it('clears a previously-shown name/footer on reconnect if the re-fetched S3 file no longer has one', async () => {
      // Regression guard: setLeaderboardName/setLeaderboardFooter used to only fire on a truthy
      // value, so a stale name/footer from before a reconnect could stay displayed even though
      // the freshly re-fetched file has none — this happens on the exact same code path a track
      // switch would take, since both re-run this same fetch-and-set logic.
      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'Madrid Summit — Track A', footer: 'Sponsored by Acme Corp', rankings: [] }),
      });
      renderPage();
      expect(await screen.findByText('Madrid Summit — Track A')).toBeInTheDocument();
      expect(screen.getByText('Sponsored by Acme Corp')).toBeInTheDocument();

      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ rankings: [] }) });
      await act(async () => {
        capturedOnReconnect?.();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(screen.getByText('Live Leaderboard', { exact: false })).toBeInTheDocument();
      });
      expect(screen.queryByText('Sponsored by Acme Corp')).not.toBeInTheDocument();
    });

    it('decodes HTML entities in the name, footer, and rankings so they display as literal characters, not double-encoded', async () => {
      // liveBroadcastHandler HTML-encodes these fields before writing them to S3 (see
      // sanitizeDisplayField). React already escapes text children on render, so the S3 response
      // must be decoded once on read — otherwise "Acme & Co" (stored as "Acme &amp; Co") would
      // literally display as "Acme &amp; Co" instead of "Acme & Co".
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          name: 'Acme &amp; Co Summit',
          footer: 'Presented by &lt;Acme Racing&gt;',
          rankings: [
            {
              rank: 1,
              participantName: 'Bob &amp; Bots',
              bestLapTimeMilliseconds: 10000,
              modelName: 'FastBot',
              country: 'CA',
            },
          ],
        }),
      });
      renderPage();
      expect(await screen.findByText('Acme & Co Summit')).toBeInTheDocument();
      expect(screen.getByText('Presented by <Acme Racing>')).toBeInTheDocument();
      expect(screen.getByText('Bob & Bots')).toBeInTheDocument();
    });
  });

  describe('combined leaderboard (track=combined)', () => {
    it('fetches the combined S3 file keyed by eventId, not the track sentinel', async () => {
      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ name: 'Grand Final', rankings: [] }) });

      renderPage('?track=combined');
      await screen.findByText('Grand Final');

      // The combined file is keyed by eventId (evt-1), never by the literal "combined" sentinel.
      const fetchedUrls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(fetchedUrls.some((u) => u.includes('/public/leaderboards/evt-1.json'))).toBe(true);
      expect(fetchedUrls.some((u) => u.includes('combined.json'))).toBe(false);
    });

    it('renders combined rankings from the eventId-keyed S3 file', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'Grand Final', rankings: RANKINGS }),
      });

      renderPage('?track=combined');

      expect(await screen.findByText('Alice Chen')).toBeInTheDocument();
      expect(screen.getByText('Bob Santos')).toBeInTheDocument();
    });

    it('applies live push updates via LEADERBOARD_UPDATED in combined mode', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'Grand Final', rankings: [] }),
      });

      renderPage('?track=combined');
      await screen.findByText('Waiting for race results…');

      // The combined view subscribes to race/{eventId}/combined; a pushed LEADERBOARD_UPDATED
      // (published by the combined aggregation) updates the standings without polling.
      emitEvent(LEADERBOARD_UPDATED);

      expect(await screen.findByText('Alice Chen')).toBeInTheDocument();
      expect(screen.getByText('Carol Kim')).toBeInTheDocument();
    });

    it('subscribes with the "combined" trackId, not a single-track id', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ rankings: [] }) });

      renderPage('?track=combined');
      await screen.findByText('Waiting for race results…');

      // usePublicRaceTopicMqtt(eventId, trackId, options) — trackId must be the literal
      // sentinel so the subscription lands on race/{eventId}/combined, not a track topic.
      expect(usePublicRaceTopicMqtt).toHaveBeenCalledWith('evt-1', 'combined', expect.anything());
    });
  });

  describe('with rankings', () => {
    it('renders racer names after LEADERBOARD_UPDATED', async () => {
      renderPage();
      // Wait for hydration to complete (fetch resolves, isHydrating → false)
      await screen.findByText('Waiting for race results…');
      emitEvent(LEADERBOARD_UPDATED);
      expect(await screen.findByText('Alice Chen')).toBeInTheDocument();
      expect(screen.getByText('Bob Santos')).toBeInTheDocument();
      expect(screen.getByText('Carol Kim')).toBeInTheDocument();
    });

    it('shows rank numbers with # prefix', async () => {
      renderPage();
      await screen.findByText('Waiting for race results…');
      emitEvent(LEADERBOARD_UPDATED);
      expect(await screen.findByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
      expect(screen.getByText('#3')).toBeInTheDocument();
    });

    it('shows lap times for each racer', async () => {
      renderPage();
      await screen.findByText('Waiting for race results…');
      emitEvent(LEADERBOARD_UPDATED);
      expect(await screen.findByText('45.231s')).toBeInTheDocument();
      expect(screen.getByText('47.890s')).toBeInTheDocument();
    });

    it('shows country codes', async () => {
      renderPage();
      await screen.findByText('Waiting for race results…');
      emitEvent(LEADERBOARD_UPDATED);
      expect(await screen.findByText('US')).toBeInTheDocument();
      expect(screen.getByText('BR')).toBeInTheDocument();
    });

    it('updates rankings when new LEADERBOARD_UPDATED arrives', async () => {
      renderPage();
      await screen.findByText('Waiting for race results…');
      emitEvent(LEADERBOARD_UPDATED);
      expect(await screen.findByText('Alice Chen')).toBeInTheDocument();

      const updatedRankings = [
        { rank: 1, participantName: 'Alice Chen', bestLapTimeMilliseconds: 43100, country: 'US' },
        ...RANKINGS.slice(1),
      ];
      emitEvent({ ...LEADERBOARD_UPDATED, rankings: updatedRankings });
      expect(await screen.findByText('43.100s')).toBeInTheDocument();
    });
  });

  describe('active race footer', () => {
    it('shows race info footer during active race', async () => {
      renderPage();
      emitEvent(OVERLAY_UPDATE);
      expect(await screen.findByText('Racing now')).toBeInTheDocument();
      expect(screen.getByText('Alice Chen')).toBeInTheDocument();
    });

    it('shows countdown in footer', async () => {
      renderPage();
      emitEvent(OVERLAY_UPDATE);
      // 120000ms = 2:00
      expect(await screen.findByText('2:00')).toBeInTheDocument();
    });

    it('shows time left label in footer', async () => {
      renderPage();
      emitEvent(OVERLAY_UPDATE);
      expect(await screen.findByText('Time left')).toBeInTheDocument();
    });

    it('hides race info footer after race finishes', async () => {
      renderPage();
      emitEvent(OVERLAY_UPDATE);
      expect(await screen.findByText('Racing now')).toBeInTheDocument();

      emitEvent({ eventType: 'RACE_STATUS_CHANGED', eventId: 'evt-1', trackId: 'trk-1', status: 'COMPLETED' });
      await waitFor(() => {
        expect(screen.queryByText('Racing now')).not.toBeInTheDocument();
      });
    });

    it('shows red countdown when under 30s', async () => {
      renderPage();
      emitEvent({ ...OVERLAY_UPDATE, timeLeftMilliseconds: 20_000 });
      // 20000ms = 0:20
      const countdown = await screen.findByText('0:20');
      expect(countdown).toBeInTheDocument();
      expect(countdown).toHaveStyle({ color: '#ef5350' });
    });
  });

  describe('connection status', () => {
    it('shows connecting state', async () => {
      vi.mocked(usePublicRaceTopicMqtt).mockReturnValueOnce({
        connectionStatus: ConnectionStatus.CONNECTING,
        publish: vi.fn().mockResolvedValue(true),
      });
      renderPage();
      expect(await screen.findByText('Connecting…')).toBeInTheDocument();
    });

    it('shows offline when error', async () => {
      vi.mocked(usePublicRaceTopicMqtt).mockReturnValueOnce({
        connectionStatus: ConnectionStatus.ERROR,
        publish: vi.fn().mockResolvedValue(true),
      });
      renderPage();
      expect(await screen.findByText('Offline')).toBeInTheDocument();
    });
  });
});
