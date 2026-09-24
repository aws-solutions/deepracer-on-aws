// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { EventStatus } from '@deepracer-indy/typescript-client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { usePublicRaceTopicMqtt } from '#hooks/usePublicRaceTopicMqtt';
import { mapEventStatusToRaceStatus } from '#pages/PhysicalRace/mapEventStatusToRaceStatus';
import type { LeaderboardRankingEntry, OverlayUpdateEvent, OverlayLap } from '#pages/PhysicalRace/types/events';
import { environmentConfig } from '#utils/envUtils';

// ── Formatting helpers ────────────────────────────────────────────────────────

const formatLapTime = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  const m = ms % 1000;
  return `${s}.${m.toString().padStart(3, '0')}`;
};

const formatCountdown = (ms: number): string => {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// ── F1-style lap color coding ─────────────────────────────────────────────────
// purple = fastest of event, green = fastest of race, yellow = valid lap

const LAP_COLOR_EVENT_BEST = '#b468ff'; // purple
const LAP_COLOR_RACE_BEST = '#4caf50'; // green
const LAP_COLOR_VALID = '#f5c518'; // yellow

type LapStatus = 'eventBest' | 'raceBest' | 'valid';

const classifyLap = (lapMs: number, racerBestMs: number | null, eventBestMs: number | null): LapStatus => {
  if (eventBestMs !== null && lapMs <= eventBestMs) return 'eventBest';
  if (racerBestMs !== null && lapMs <= racerBestMs) return 'raceBest';
  return 'valid';
};

const lapStatusColor = (status: LapStatus): string => {
  if (status === 'eventBest') return LAP_COLOR_EVENT_BEST;
  if (status === 'raceBest') return LAP_COLOR_RACE_BEST;
  return LAP_COLOR_VALID;
};

// ── S3 hydration ──────────────────────────────────────────────────────────────

const fetchLeaderboardFromS3 = async (leaderboardId: string): Promise<LeaderboardRankingEntry[]> => {
  const baseUrl = environmentConfig.cloudFrontDomainName ? `https://${environmentConfig.cloudFrontDomainName}` : '';
  const url = `${baseUrl}/public/leaderboards/${encodeURIComponent(leaderboardId)}.json?t=${Date.now()}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.rankings ?? [];
  } catch {
    return [];
  }
};

// ── Sub-components ────────────────────────────────────────────────────────────

interface LowerThirdProps {
  racerName: string;
  timeLeftMs: number;
  currentLapMs: number;
  laps: OverlayLap[];
  visible: boolean;
}

const LowerThird = ({ racerName, timeLeftMs, currentLapMs, laps, visible }: LowerThirdProps) => {
  const validLaps = laps.filter((l) => l.isValid);
  const fastestLapMs = validLaps.length > 0 ? Math.min(...validLaps.map((l) => l.lapTimeMilliseconds)) : null;
  const lastLap = laps.at(-1) ?? null;
  // eventBestMs needs global leaderboard data — not in OVERLAY_UPDATE alone.
  // Pass null so fastest-lap indicator uses racerBest (green) not eventBest (purple).
  const eventBestMs = null;

  const fastestStatus = fastestLapMs === null ? null : classifyLap(fastestLapMs, fastestLapMs, eventBestMs);
  const previousStatus =
    lastLap?.isValid === true ? classifyLap(lastLap.lapTimeMilliseconds, fastestLapMs, eventBestMs) : null;

  const isLow = timeLeftMs < 30_000;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 40,
        left: 40,
        width: 640,
        padding: '16px 20px 14px 28px',
        background: 'linear-gradient(135deg, rgba(16, 24, 40, 0.94), rgba(28, 38, 64, 0.88))',
        borderRadius: 12,
        color: '#ffffff',
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
        transform: visible ? 'translateX(0)' : 'translateX(-110%)',
        transition: 'transform 1s cubic-bezier(0.65, 0, 0.35, 1)',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        // Left accent bar via box-shadow workaround
        boxShadow: '4px 0 0 0 #FF9900 inset', // AWS orange accent
      }}
    >
      {/* Racer name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#4caf50',
            flexShrink: 0,
            boxShadow: '0 0 6px #4caf50',
          }}
        />
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.3px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {racerName}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 24 }}>
        {/* Time remaining */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 2,
            }}
          >
            Time remaining
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: isLow ? '#ef5350' : '#ffffff',
            }}
          >
            {formatCountdown(timeLeftMs)}
          </div>
          {/* No color indicator on countdown */}
          <div style={{ height: 3, background: 'transparent', borderRadius: 2, marginTop: 4 }} />
        </div>

        {/* Fastest lap */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 2,
            }}
          >
            Fastest lap
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {fastestLapMs === null ? '—' : formatLapTime(fastestLapMs)}
          </div>
          <div
            style={{
              height: 3,
              background: fastestStatus ? lapStatusColor(fastestStatus) : 'transparent',
              borderRadius: 2,
              marginTop: 4,
            }}
          />
        </div>

        {/* Previous lap */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 2,
            }}
          >
            Previous lap
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {lastLap?.isValid ? formatLapTime(lastLap.lapTimeMilliseconds) : '—'}
          </div>
          <div
            style={{
              height: 3,
              background: previousStatus ? lapStatusColor(previousStatus) : 'transparent',
              borderRadius: 2,
              marginTop: 4,
            }}
          />
        </div>

        {/* Current lap */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 2,
            }}
          >
            Current lap
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#4fc3f7' }}>
            {formatLapTime(currentLapMs)}
          </div>
          <div style={{ height: 3, background: 'transparent', borderRadius: 2, marginTop: 4 }} />
        </div>
      </div>
    </div>
  );
};

interface LeaderboardPanelProps {
  entries: LeaderboardRankingEntry[];
  visible: boolean;
  highlightedName?: string | null;
}

const POSITION_LABELS = ['1st', '2nd', '3rd', '4th'];

const podiumColor = (index: number): string => {
  if (index === 0) return '#FFD700';
  if (index === 1) return '#C0C0C0';
  if (index === 2) return '#CD7F32';
  return 'rgba(255,255,255,0.4)';
};

const LeaderboardPanel = ({ entries, visible, highlightedName }: LeaderboardPanelProps) => {
  const top4 = entries.slice(0, 4);

  return (
    <div
      style={{
        position: 'fixed',
        top: 40,
        right: 40,
        width: 320,
        background: 'linear-gradient(135deg, rgba(16, 24, 40, 0.94), rgba(28, 38, 64, 0.88))',
        borderRadius: 12,
        color: '#ffffff',
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
        transform: visible ? 'translateX(0)' : 'translateX(130%)',
        transition: 'transform 1s cubic-bezier(0.65, 0, 0.35, 1)',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 16px',
          background: 'rgba(255,153,0,0.15)',
          borderBottom: '1px solid rgba(255,153,0,0.2)',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#FF9900',
        }}
      >
        <span role="img" aria-label="trophy">
          🏆
        </span>{' '}
        Leaderboard
      </div>

      {/* Entries */}
      {top4.length === 0 ? (
        <div style={{ padding: '20px 16px', fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
          Waiting for race results…
        </div>
      ) : (
        top4.map((entry, index) => {
          const isHighlighted = highlightedName && entry.participantName === highlightedName;
          return (
            <div
              key={entry.rank}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 16px',
                borderBottom: index < top4.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                background: isHighlighted ? 'rgba(255,153,0,0.12)' : 'transparent',
                transition: 'background 0.3s',
              }}
            >
              {/* Position */}
              <div
                style={{
                  width: 40,
                  fontSize: 11,
                  fontWeight: 700,
                  color: podiumColor(index),
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  flexShrink: 0,
                }}
              >
                {POSITION_LABELS[index]}
              </div>

              {/* Name */}
              <div
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: index === 0 ? 700 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginRight: 8,
                }}
              >
                {entry.participantName}
              </div>

              {/* Time */}
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: index === 0 ? '#FFD700' : '#4fc3f7',
                  flexShrink: 0,
                }}
              >
                {formatLapTime(entry.bestLapTimeMilliseconds)}s
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

// ── Main overlay component ────────────────────────────────────────────────────

/**
 * Streaming overlay — transparent/chroma-key background for OBS/Twitch.
 * Add as a browser source in OBS at /race-management/overlay?event=ID&track=ID
 *
 * Active race:   LowerThird bar (bottom-left) with racer name, countdown,
 *                F1-style lap color coding (purple/green/yellow)
 * Between races: Leaderboard panel (top-right) with top 4 entries
 * No data 10s:   Both panels hidden
 */
const StreamingOverlay = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event') ?? '';
  const trackId = searchParams.get('track') ?? '';

  const [overlay, setOverlay] = useState<OverlayUpdateEvent | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRankingEntry[]>([]);
  const [raceStatus, setRaceStatus] = useState<string>('NO_RACER_SELECTED');
  const [lastEventMs, setLastEventMs] = useState<number>(Date.now());
  const [noDataTimeout, setNoDataTimeout] = useState(false);
  const [highlightedName, setHighlightedName] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard: once a live LEADERBOARD_UPDATED event arrives, don't overwrite with stale S3 data
  const liveDataReceivedRef = useRef(false);

  // Hydrate leaderboard from S3
  useEffect(() => {
    if (!trackId) {
      setIsHydrating(false);
      return;
    }
    let mounted = true;
    liveDataReceivedRef.current = false;
    setIsHydrating(true);
    fetchLeaderboardFromS3(trackId)
      .then((r) => {
        if (mounted && !liveDataReceivedRef.current) setLeaderboard(r);
      })
      .catch(() => {
        /* silent */
      })
      .finally(() => {
        if (mounted) setIsHydrating(false);
      });
    return () => {
      mounted = false;
    };
  }, [trackId]);

  // 10s no-data timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      if (Date.now() - lastEventMs > 10_000) setNoDataTimeout(true);
    }, 10_000);
    return () => clearTimeout(timer);
  }, [lastEventMs]);

  // Cleanup highlight timer on unmount
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  usePublicRaceTopicMqtt(eventId, trackId, {
    onEvent: (event) => {
      setLastEventMs(Date.now());
      setNoDataTimeout(false);
      if (event.eventType === 'OVERLAY_UPDATE') {
        setOverlay(event);
        setRaceStatus(event.raceStatus);
      } else if (event.eventType === 'LEADERBOARD_UPDATED') {
        liveDataReceivedRef.current = true;
        setLeaderboard(event.rankings);
      } else if (event.eventType === 'RACE_STATUS_CHANGED') {
        // RACE_STATUS_CHANGED carries the real EventStatus enum, not the RaceStatus
        // vocabulary OVERLAY_UPDATE uses — normalize before storing/comparing so isRacing
        // (which checks for the RaceStatus value 'RACE_IN_PROGRESS') works for both sources.
        const mappedStatus = mapEventStatusToRaceStatus(event.status as EventStatus);
        setRaceStatus(mappedStatus);
        if (mappedStatus !== 'RACE_IN_PROGRESS') {
          setOverlay(null);
          // Highlight the last racer on the leaderboard briefly after finish
          if (overlay?.racerName) {
            if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
            setHighlightedName(overlay.racerName);
            highlightTimerRef.current = setTimeout(() => setHighlightedName(null), 30_000);
          }
        }
      }
    },
    onReconnect: () => {
      if (trackId) {
        liveDataReceivedRef.current = false;
        fetchLeaderboardFromS3(trackId)
          .then((r) => {
            if (!liveDataReceivedRef.current) setLeaderboard(r);
          })
          .catch(() => {
            /* silent */
          });
      }
    },
  });

  const isRacing = raceStatus === 'RACE_IN_PROGRESS';

  // Hide entirely when no event/track configured or timed out
  if (!eventId || !trackId || noDataTimeout) return null;

  return (
    // Transparent background for chroma-key compositing
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'transparent',
        pointerEvents: 'none',
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      }}
    >
      {/* Active race: lower-third bar */}
      <LowerThird
        racerName={overlay?.racerName ?? ''}
        timeLeftMs={overlay?.timeLeftMilliseconds ?? 0}
        currentLapMs={overlay?.currentLapTimeMilliseconds ?? 0}
        laps={overlay?.laps ?? []}
        visible={isRacing && overlay !== null}
      />

      {/* Between races / leaderboard panel */}
      <LeaderboardPanel entries={leaderboard} visible={!isHydrating && !isRacing} highlightedName={highlightedName} />
    </div>
  );
};

export default StreamingOverlay;
