// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { EventStatus } from '@deepracer-indy/typescript-client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import deepRacerLogo from '#assets/deepracer_logo.svg';
import { ConnectionStatus, usePublicRaceTopicMqtt } from '#hooks/usePublicRaceTopicMqtt';
import { mapEventStatusToRaceStatus } from '#pages/PhysicalRace/mapEventStatusToRaceStatus';
import type { LeaderboardRankingEntry, OverlayUpdateEvent } from '#pages/PhysicalRace/types/events';
import { environmentConfig } from '#utils/envUtils';

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatLapTime = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  const m = ms % 1000;
  return `${s}.${m.toString().padStart(3, '0')}s`;
};

const formatCountdown = (ms: number): string => {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Fields are HTML-encoded server-side before being stored (see sanitizeDisplayField in
// liveBroadcastHandler.ts). React already escapes text on render, so re-rendering an encoded
// string as-is double-encodes it — decode once here after parsing the response.
const HTML_DECODE_MAP: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#39;': "'" };
const decodeDisplayField = <T extends string | undefined>(value: T): T =>
  value === undefined ? value : (value.replace(/&lt;|&gt;|&amp;|&quot;|&#39;/g, (m) => HTML_DECODE_MAP[m]) as T);

const fetchLeaderboardFromS3 = async (
  leaderboardId: string,
): Promise<{ name?: string; footer?: string; rankings: LeaderboardRankingEntry[] }> => {
  const baseUrl = environmentConfig.cloudFrontDomainName ? `https://${environmentConfig.cloudFrontDomainName}` : '';
  const url = `${baseUrl}/public/leaderboards/${encodeURIComponent(leaderboardId)}.json?t=${Date.now()}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return { rankings: [] };
    const data = await resp.json();
    const rankings: LeaderboardRankingEntry[] = (data.rankings ?? []).map((entry: LeaderboardRankingEntry) => ({
      ...entry,
      participantName: decodeDisplayField(entry.participantName),
      modelName: decodeDisplayField(entry.modelName),
      country: decodeDisplayField(entry.country),
    }));
    return { name: decodeDisplayField(data.name), footer: decodeDisplayField(data.footer), rankings };
  } catch {
    return { rankings: [] };
  }
};

// ── Position styling ──────────────────────────────────────────────────────────

const rankColor = (rank: number): string => {
  if (rank === 1) return '#FFD700';
  if (rank === 2) return '#C0C0C0';
  if (rank === 3) return '#CD7F32';
  return 'rgba(255,255,255,0.7)';
};

const rankBg = (rank: number): string => {
  if (rank === 1) return 'rgba(255, 215, 0, 0.08)';
  if (rank === 2) return 'rgba(192, 192, 192, 0.06)';
  if (rank === 3) return 'rgba(205, 127, 50, 0.06)';
  return 'transparent';
};

// ── Race info footer (shown during active race) ───────────────────────────────

interface RaceInfoFooterProps {
  overlay: OverlayUpdateEvent;
}

const RaceInfoFooter = ({ overlay }: RaceInfoFooterProps) => {
  const validLaps = overlay.laps.filter((l) => l.isValid);
  const fastestMs = validLaps.length > 0 ? Math.min(...validLaps.map((l) => l.lapTimeMilliseconds)) : null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(90deg, rgba(16,24,40,0.97) 0%, rgba(28,38,64,0.95) 100%)',
        borderTop: '2px solid rgba(255,153,0,0.4)',
        padding: '12px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: 32,
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
        color: '#ffffff',
      }}
    >
      {/* Live indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#4caf50',
            boxShadow: '0 0 6px #4caf50',
            animation: 'pulse 1.5s infinite',
          }}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#4caf50',
          }}
        >
          Live
        </span>
      </div>

      {/* Racer name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          Racing now
        </div>
        <div
          style={{ fontSize: 18, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {overlay.racerName}
        </div>
      </div>

      {/* Time remaining */}
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div
          style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          Time left
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: overlay.timeLeftMilliseconds < 30_000 ? '#ef5350' : '#ffffff',
          }}
        >
          {formatCountdown(overlay.timeLeftMilliseconds)}
        </div>
      </div>

      {/* Laps */}
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div
          style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          Laps
        </div>
        <div style={{ fontSize: 24, fontWeight: 700 }}>{overlay.laps.length}</div>
      </div>

      {/* Fastest lap */}
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div
          style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          Fastest lap
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#4caf50' }}>
          {fastestMs === null ? '—' : formatLapTime(fastestMs)}
        </div>
      </div>
    </div>
  );
};

// ── Main leaderboard ──────────────────────────────────────────────────────────

/**
 * Public leaderboard — no login required, designed for venue monitors.
 * PRD 4.1.1: branded, live rankings, unauthenticated access.
 */
const PublicLeaderboard = () => {
  const { eventId = '' } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const trackParam = searchParams.get('track') ?? '';
  // `track=combined` is a sentinel (matching DREM) for the multi-track combined leaderboard.
  // The combined standings are published to S3 keyed by eventId; a single track is keyed by trackId.
  const isCombined = trackParam === 'combined';
  const s3Key = isCombined ? eventId : trackParam;

  const [rankings, setRankings] = useState<LeaderboardRankingEntry[]>([]);
  const [leaderboardName, setLeaderboardName] = useState<string | undefined>(undefined);
  const [leaderboardFooter, setLeaderboardFooter] = useState<string | undefined>(undefined);
  const [isHydrating, setIsHydrating] = useState(true);
  const [overlay, setOverlay] = useState<OverlayUpdateEvent | null>(null);
  const [highlightedName, setHighlightedName] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entriesRef = useRef<HTMLDivElement | null>(null);
  // Guard: once a live LEADERBOARD_UPDATED event arrives, don't overwrite with stale S3 data
  const liveDataReceivedRef = useRef(false);

  // Initial S3 hydration
  useEffect(() => {
    if (!trackParam) {
      setIsHydrating(false);
      return;
    }
    let mounted = true;
    liveDataReceivedRef.current = false;
    setIsHydrating(true);
    fetchLeaderboardFromS3(s3Key)
      .then((r) => {
        if (mounted && !liveDataReceivedRef.current) {
          setRankings(r.rankings);
          setLeaderboardName(r.name);
          setLeaderboardFooter(r.footer);
        }
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
  }, [trackParam, s3Key]);

  // Scroll to highlighted entry
  useEffect(() => {
    if (!highlightedName || !entriesRef.current) return;
    const el = Array.from(entriesRef.current.children).find(
      (child): child is HTMLElement => (child as HTMLElement).dataset.name === highlightedName,
    );
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedName, rankings]);

  // Cleanup highlight timer on unmount
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const { connectionStatus } = usePublicRaceTopicMqtt(eventId, trackParam, {
    onEvent: (event) => {
      if (event.eventType === 'LEADERBOARD_UPDATED') {
        liveDataReceivedRef.current = true;
        setRankings(event.rankings);
      } else if (event.eventType === 'OVERLAY_UPDATE') {
        setOverlay(event);
      } else if (event.eventType === 'RACE_STATUS_CHANGED') {
        // RACE_STATUS_CHANGED carries the real EventStatus enum, not the RaceStatus
        // vocabulary OVERLAY_UPDATE uses — normalize before comparing.
        if (mapEventStatusToRaceStatus(event.status as EventStatus) !== 'RACE_IN_PROGRESS') {
          setOverlay(null);
          // Highlight the last racer on finish
          if (overlay?.racerName) {
            if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
            setHighlightedName(overlay.racerName);
            highlightTimerRef.current = setTimeout(() => setHighlightedName(null), 12_000);
          }
        }
      }
    },
    onReconnect: () => {
      if (trackParam) {
        liveDataReceivedRef.current = false;
        fetchLeaderboardFromS3(s3Key)
          .then((r) => {
            if (!liveDataReceivedRef.current) {
              setRankings(r.rankings);
              setLeaderboardName(r.name);
              setLeaderboardFooter(r.footer);
            }
          })
          .catch(() => {
            /* silent */
          });
      }
    },
  });

  if (!trackParam) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0a0f1e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>
            <span role="img" aria-label="racing car">
              🏎
            </span>
          </div>
          <div style={{ fontSize: 16 }}>Add ?track=&lt;leaderboardId&gt; to the URL</div>
        </div>
      </div>
    );
  }

  const isLive = connectionStatus === ConnectionStatus.CONNECTED;
  const isRacing = overlay !== null && overlay.raceStatus === 'RACE_IN_PROGRESS';
  const connectingLabel = connectionStatus === ConnectionStatus.CONNECTING ? 'Connecting…' : 'Offline';
  const connectionLabel = isLive ? 'Live' : connectingLabel;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0a0f1e 0%, #0d1530 100%)',
        color: '#ffffff',
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
        paddingBottom: isRacing ? 80 : 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 32px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src={deepRacerLogo} alt="DeepRacer on AWS" style={{ height: 36 }} />
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>
            {leaderboardName ?? 'Live Leaderboard'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isLive ? '#4caf50' : 'rgba(255,255,255,0.2)',
              boxShadow: isLive ? '0 0 6px #4caf50' : 'none',
            }}
          />
          <span
            style={{
              fontSize: 12,
              color: isLive ? '#4caf50' : 'rgba(255,255,255,0.4)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {connectionLabel}
          </span>
        </div>
      </div>

      {/* Rankings */}
      <div ref={entriesRef} style={{ maxWidth: 900, margin: '0 auto', padding: '0 32px' }}>
        {isHydrating ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>
              <span role="img" aria-label="hourglass">
                ⏳
              </span>
            </div>
            <div>Loading…</div>
          </div>
        ) : rankings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              <span role="img" aria-label="racing car">
                🏎
              </span>
            </div>
            <div style={{ fontSize: 18 }}>Waiting for race results…</div>
            <div style={{ fontSize: 13, marginTop: 8, color: 'rgba(255,255,255,0.2)' }}>
              Rankings will appear once races are completed
            </div>
          </div>
        ) : (
          rankings.map((entry, index) => {
            const isHighlighted = highlightedName === entry.participantName;
            const isFirst = index === 0;
            const isLast = index === rankings.length - 1;
            let entryBorderRadius: string | number = 0;
            if (isFirst) entryBorderRadius = '8px 8px 0 0';
            else if (isLast) entryBorderRadius = '0 0 8px 8px';
            return (
              <div
                key={entry.rank}
                data-name={entry.participantName}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px 24px',
                  marginTop: isFirst ? 24 : 0,
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: isHighlighted ? 'rgba(255,153,0,0.1)' : rankBg(entry.rank),
                  transition: 'background 0.5s',
                  borderRadius: entryBorderRadius,
                }}
              >
                {/* Rank */}
                <div
                  style={{
                    width: 60,
                    fontSize: 20,
                    fontWeight: 800,
                    color: rankColor(entry.rank),
                    flexShrink: 0,
                  }}
                >
                  #{entry.rank}
                </div>

                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {entry.participantName}
                  </div>
                  {entry.country && (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{entry.country}</div>
                  )}
                </div>

                {/* Time */}
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: rankColor(entry.rank),
                    flexShrink: 0,
                  }}
                >
                  {formatLapTime(entry.bestLapTimeMilliseconds)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Leaderboard footer — custom text set on the event/track, shown at the bottom of the
          page (not to be confused with RaceInfoFooter below, which is the fixed live-race bar).
          Sits inside the reserved paddingBottom space so it is never obscured by that bar. */}
      {leaderboardFooter && (
        <div
          style={{
            maxWidth: 900,
            margin: '24px auto 0',
            padding: '0 32px 24px',
            textAlign: 'left',
            fontSize: 13,
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          {leaderboardFooter}
        </div>
      )}

      {/* Race info footer — shown during active race */}
      {isRacing && overlay && <RaceInfoFooter overlay={overlay} />}
    </div>
  );
};

export default PublicLeaderboard;
