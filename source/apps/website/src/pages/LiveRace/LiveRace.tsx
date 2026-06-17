// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import Flashbar from '@cloudscape-design/components/flashbar';
import Grid from '@cloudscape-design/components/grid';
import Header from '@cloudscape-design/components/header';
import Modal from '@cloudscape-design/components/modal';
import ProgressBar from '@cloudscape-design/components/progress-bar';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { UserGroups } from '@deepracer-indy/typescript-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';

import deepRacerLogo from '#assets/deepracer_logo.svg';
import { useAppDispatch } from '#hooks/useAppDispatch.js';
import { useLiveRaceMqtt } from '#hooks/useLiveRaceMqtt.js';
import type { LiveRaceEvent } from '#pages/LiveRace/types/events.js';
import { DeepRacerApiQueryTagType } from '#services/deepRacer/constants.js';
import { deepRacerApi } from '#services/deepRacer/deepRacerApi.js';
import {
  useClearLiveLeaderboardMutation,
  useDeclareWinnerMutation,
  useEditLeaderboardMutation,
  useGetLeaderboardQuery,
  useGetLiveRaceStateQuery,
  useLaunchLiveRaceMutation,
  useListLiveQueueItemsQuery,
  useRemoveLiveQueueItemMutation,
  useReorderLiveQueueMutation,
  useResetLiveQueueModelMutation,
} from '#services/deepRacer/leaderboardsApi.js';
import { useGetProfileQuery, useListProfilesQuery } from '#services/deepRacer/profileApi.js';
import { displayInfoNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { millisToMinutesAndSeconds } from '#utils/dateTimeUtils.js';

import LeaderboardPanel from './components/LeaderboardPanel';
import ParticipantNotificationToast from './components/ParticipantNotificationToast';
import QueueManagementPanel from './components/QueueManagementPanel';
import RaceInfoPanel from './components/RaceInfoPanel';
import RaceProgressBar from './components/RaceProgressBar';
import RacerInfoBanner from './components/RacerInfoBanner';
import VideoPanel from './components/VideoPanel';
import WinnerOverlay from './components/WinnerOverlay';
import { applyEvent, initialState } from './liveRaceState.js';
import { mapLiveEventStatusToRaceStatus } from './mapLiveEventStatusToRaceStatus.js';

import './styles.css';

interface LiveRaceProps {
  /** @internal Storybook-only: bypass auth check */
  __forceFacilitator?: boolean;
}

const LiveRace = ({ __forceFacilitator }: LiveRaceProps = {}) => {
  const { t } = useTranslation('liveRace');
  const { leaderboardId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const isBroadcastMode = searchParams.get('mode') === 'broadcast';

  const [raceState, setRaceState] = useState(initialState);
  const [isFacilitator, setIsFacilitator] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [resetElapsed, setResetElapsed] = useState(0);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [lastNotificationEvent, setLastNotificationEvent] = useState<LiveRaceEvent | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeclareConfirm, setShowDeclareConfirm] = useState(false);
  const [, forceRender] = useState(0);
  const cursorTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [cursorHidden, setCursorHidden] = useState(false);

  // Fetch initial state from REST APIs
  const { data: liveRaceState, refetch: refetchLiveState } = useGetLiveRaceStateQuery(
    { leaderboardId },
    { refetchOnMountOrArgChange: true },
  );
  const { data: liveQueueData, refetch: refetchQueue } = useListLiveQueueItemsQuery(
    { leaderboardId },
    { refetchOnMountOrArgChange: true },
  );
  const { data: leaderboard } = useGetLeaderboardQuery({ leaderboardId });
  const { data: profile } = useGetProfileQuery();
  const { data: profilesData } = useListProfilesQuery();

  // Seed reducer state from REST response
  useEffect(() => {
    if (!liveRaceState) return;
    setRaceState((prev) => ({
      ...prev,
      raceStatus: mapLiveEventStatusToRaceStatus(liveRaceState.race.liveEventStatus),
      autolaunchEnabled: liveRaceState.race.autoLaunchEnabled,
      submissionPeriodOpen: liveRaceState.race.submissionPeriodOpen,
      totalModels: liveRaceState.queue.totalModels,
      completedModels: liveRaceState.queue.completedModels,
      rankings:
        prev.rankings.length === 0
          ? liveRaceState.rankings.map((r) => ({
              rank: r.rank,
              participantName: r.participantName,
              modelName: r.modelName,
              bestLapTime: r.bestLapTime ?? null,
              submissionId: r.participantName,
              avatar: r.avatar ?? {},
            }))
          : prev.rankings,
      ...(liveRaceState.currentEvaluation
        ? {
            participantName: liveRaceState.currentEvaluation.participantName,
            modelName: liveRaceState.currentEvaluation.modelName,
            streamUrl: liveRaceState.currentEvaluation.streamUrl ?? null,
            isExecutionRunning: true,
          }
        : { isExecutionRunning: false }),
      // Winner details (participantName, modelName, bestLapTime) are not returned by
      // getLiveRaceState today — only submissionId and winnerDeclaredAt are on WinnerInfo.
      // The WINNER_DECLARED event carries enriched winner data; we intentionally skip
      // seeding winner from REST to avoid rendering the overlay with empty fields.
    }));
  }, [liveRaceState]);

  // Tick elapsed time during reset
  useEffect(() => {
    if (!isResetting) {
      setResetElapsed(0);
      return;
    }
    const interval = setInterval(() => setResetElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [isResetting]);

  // Seed queue items from REST response
  const lastQueueRef = useRef<string>('');
  const profileAvatarMap = useMemo(
    () => new Map((profilesData ?? []).map((p) => [p.profileId, p.avatar])),
    [profilesData],
  );
  useEffect(() => {
    if (!liveQueueData?.items) return;
    const key = liveQueueData.items.map((i) => `${i.submissionId}:${i.status}`).join(',');
    if (key === lastQueueRef.current) return;
    lastQueueRef.current = key;
    const items = liveQueueData.items.map((item) => ({
      submissionId: item.submissionId,
      profileId: item.profileId,
      participantName: item.participantName,
      modelName: item.modelName,
      queuePosition: item.queuePosition,
      status: item.status as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
      submittedAt: typeof item.submittedAt === 'string' ? item.submittedAt : new Date(item.submittedAt).toISOString(),
      avatar: profileAvatarMap.get(item.profileId),
    }));
    const nextPending = items.find((i) => i.status === 'PENDING');
    setRaceState((prev) => ({
      ...prev,
      queueItems: items,
      ...(prev.participantName == null && nextPending
        ? {
            participantName: nextPending.participantName,
            modelName: nextPending.modelName,
            currentAvatar: nextPending.avatar ?? null,
          }
        : {}),
    }));
  }, [liveQueueData, profileAvatarMap]);

  // When profiles load after queue items, back-fill avatars on existing queue items
  useEffect(() => {
    if (!profilesData?.length) return;
    setRaceState((prev) => {
      const enriched = prev.queueItems.map((item) =>
        item.avatar ? item : { ...item, avatar: profileAvatarMap.get(item.profileId ?? '') },
      );
      const currentItem = enriched.find(
        (i) => i.participantName === prev.participantName && i.status === 'IN_PROGRESS',
      );
      return {
        ...prev,
        queueItems: enriched,
        currentAvatar: currentItem?.avatar ?? prev.currentAvatar,
      };
    });
  }, [profilesData, profileAvatarMap]);

  // Check facilitator role

  useEffect(() => {
    if (__forceFacilitator) {
      setIsFacilitator(true);
      setIsAuthLoading(false);
      return;
    }
    const checkRole = async () => {
      const hasAccess = await checkUserGroupMembership([UserGroups.ADMIN, UserGroups.RACE_FACILITATORS]);
      setIsFacilitator(hasAccess);
      setIsAuthLoading(false);
    };
    void checkRole();
  }, [__forceFacilitator]);

  const onReconnect = useCallback(() => {
    void refetchLiveState();
    void refetchQueue();
  }, [refetchLiveState, refetchQueue]);

  const onEvent = useCallback(
    (event: LiveRaceEvent) => {
      setRaceState((prev) => applyEvent(prev, event));
      setLastNotificationEvent(event);

      if (event.eventType === 'RACE_STATUS_CHANGED') {
        const msg = t(`raceStatusBanner.${event.status}`);
        if (event.status === 'COMPLETED') {
          dispatch(displaySuccessNotification({ content: msg }));
        } else {
          dispatch(displayInfoNotification({ content: msg }));
        }
      }
      if (event.eventType === 'QUEUE_CHANGED' && event.action === 'SUBMISSION_ADDED') {
        refetchQueue().catch(() => {
          /** no-op */
        });
      }
    },
    [refetchQueue, dispatch, t],
  );

  useLiveRaceMqtt(leaderboardId, { onEvent, onReconnect });

  // Invalidate submissions cache on unmount so Race Details shows fresh data
  useEffect(() => {
    return () => {
      dispatch(deepRacerApi.util.invalidateTags([{ type: DeepRacerApiQueryTagType.SUBMISSIONS, id: leaderboardId }]));
    };
  }, [dispatch, leaderboardId]);

  // Broadcast mode: auto-hide cursor after 3 seconds of inactivity
  useEffect(() => {
    if (!isBroadcastMode) return;

    const handleMouseMove = () => {
      setCursorHidden(false);
      clearTimeout(cursorTimeoutRef.current);
      cursorTimeoutRef.current = setTimeout(() => setCursorHidden(true), 3000);
    };

    handleMouseMove();
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(cursorTimeoutRef.current);
    };
  }, [isBroadcastMode]);

  // Re-render when liveEventTime passes so Launch button enables
  useEffect(() => {
    const liveEventTime = leaderboard?.liveEventTime ?? null;
    if (liveEventTime == null) return;
    const ms = new Date(liveEventTime).getTime() - Date.now();
    if (ms <= 0) return;
    const timer = setTimeout(() => forceRender((n) => n + 1), ms);
    return () => clearTimeout(timer);
  }, [leaderboard?.liveEventTime]);

  const isCompleted = raceState.raceStatus === 'COMPLETED';
  const isBeforeLiveTime = leaderboard?.liveEventTime != null && new Date() < new Date(leaderboard.liveEventTime);
  const canLaunch = !raceState.isExecutionRunning && !isCompleted && !isBeforeLiveTime;
  const canClear = !isCompleted;
  const canDeclareWinner = !raceState.isExecutionRunning && !isCompleted;

  // Facilitator action handlers
  const [launchLiveRace] = useLaunchLiveRaceMutation();
  const [declareWinner] = useDeclareWinnerMutation();
  const [editLeaderboard] = useEditLeaderboardMutation();
  const [reorderLiveQueue] = useReorderLiveQueueMutation();
  const [removeLiveQueueItem] = useRemoveLiveQueueItemMutation();
  const [resetLiveQueueModel] = useResetLiveQueueModelMutation();
  const [clearLiveLeaderboard] = useClearLiveLeaderboardMutation();
  const handleLaunch = () => {
    setRaceState((state) => ({ ...state, isExecutionRunning: true }));
    launchLiveRace({ leaderboardId })
      .unwrap()
      .catch(() => setRaceState((state) => ({ ...state, isExecutionRunning: false })));
  };
  const handleToggleAutolaunch = (enabled: boolean) => {
    const previousValue = raceState.autolaunchEnabled;
    setRaceState((state) => ({ ...state, autolaunchEnabled: enabled }));
    editLeaderboard({ leaderboardId, autoLaunchEnabled: enabled })
      .unwrap()
      .catch(() => setRaceState((state) => ({ ...state, autolaunchEnabled: previousValue })));
  };
  const handleToggleSubmissions = (open: boolean) => {
    const previousValue = raceState.submissionPeriodOpen;
    setRaceState((state) => ({ ...state, submissionPeriodOpen: open }));
    editLeaderboard({ leaderboardId, submissionPeriodOpen: open })
      .unwrap()
      .catch(() => setRaceState((state) => ({ ...state, submissionPeriodOpen: previousValue })));
  };
  const handleClearLeaderboard = () => {
    const prevQueueItems = raceState.queueItems;
    const prevRankings = raceState.rankings;
    const prevCompletedModels = raceState.completedModels;
    const prevAutolaunch = raceState.autolaunchEnabled;
    const prevIsRunning = raceState.isExecutionRunning;
    const prevStreamUrl = raceState.streamUrl;
    const prevParticipant = raceState.participantName;
    const prevModel = raceState.modelName;
    setRaceState((state) => ({
      ...state,
      queueItems: state.queueItems.map((i) => ({ ...i, status: 'PENDING' as const })),
      rankings: [],
      isExecutionRunning: false,
      autolaunchEnabled: false,
      streamUrl: null,
      participantName: null,
      modelName: null,
      completedModels: 0,
    }));
    clearLiveLeaderboard({ leaderboardId })
      .unwrap()
      .catch(() =>
        setRaceState((state) => ({
          ...state,
          queueItems: prevQueueItems,
          rankings: prevRankings,
          completedModels: prevCompletedModels,
          autolaunchEnabled: prevAutolaunch,
          isExecutionRunning: prevIsRunning,
          streamUrl: prevStreamUrl,
          participantName: prevParticipant,
          modelName: prevModel,
        })),
      );
  };
  const handleDeclareWinner = () => {
    setRaceState((state) => ({ ...state, raceStatus: 'COMPLETED', isExecutionRunning: false }));
    declareWinner({ leaderboardId })
      .unwrap()
      .catch(() => setRaceState((state) => ({ ...state, raceStatus: 'IN_PROGRESS', isExecutionRunning: false })));
  };
  const handleQueueReorder = (submissionId: string, afterSubmissionId: string | null) => {
    void reorderLiveQueue({ leaderboardId, submissionId, afterSubmissionId: afterSubmissionId ?? undefined }).unwrap();
  };
  const handleQueueRemove = (submissionId: string) => {
    const prevQueueItems = raceState.queueItems;
    setRaceState((state) => ({
      ...state,
      queueItems: state.queueItems.filter((i) => i.submissionId !== submissionId),
    }));
    removeLiveQueueItem({ leaderboardId, submissionId })
      .unwrap()
      .catch(() => setRaceState((state) => ({ ...state, queueItems: prevQueueItems })));
  };
  const handleQueueReset = (submissionId: string) => {
    const prevStatus = raceState.queueItems.find((i) => i.submissionId === submissionId)?.status;
    const isCurrentlyRunning = prevStatus === 'IN_PROGRESS';
    const prevStreamUrl = raceState.streamUrl;
    const prevParticipantName = raceState.participantName;
    const prevModelName = raceState.modelName;
    setIsResetting(true);
    setRaceState((state) => ({
      ...state,
      ...(isCurrentlyRunning ? { streamUrl: null, participantName: null, modelName: null } : {}),
      queueItems: state.queueItems.map((i) =>
        i.submissionId === submissionId ? { ...i, status: 'PENDING' as const } : i,
      ),
    }));
    resetLiveQueueModel({ leaderboardId, submissionId })
      .unwrap()
      .then(() => {
        setTimeout(() => {
          void Promise.all([refetchLiveState(), refetchQueue()]).then(() => {
            setIsResetting(false);
            setResetSuccess(true);
            setTimeout(() => setResetSuccess(false), 5000);
          });
        }, 30000);
      })
      .catch(() => {
        setRaceState((state) => ({
          ...state,
          ...(isCurrentlyRunning
            ? { streamUrl: prevStreamUrl, participantName: prevParticipantName, modelName: prevModelName }
            : {}),
          queueItems: state.queueItems.map((i) =>
            i.submissionId === submissionId ? { ...i, status: prevStatus ?? ('PENDING' as const) } : i,
          ),
        }));
        setIsResetting(false);
      });
  };

  const content = isBroadcastMode ? (
    <div className={`broadcastLayout${cursorHidden ? ' cursorHidden' : ''}`} data-testid="live-race-content">
      <img src={deepRacerLogo} alt="DeepRacer on AWS" className="broadcastLogo" />
      <SpaceBetween size="s">
        <div className="broadcastRaceName">
          {leaderboard?.name ?? leaderboardId}
          {raceState.raceStatus === 'IN_PROGRESS' && (
            <span className="liveBadge">
              <span className="liveDot" /> {t('header.live')}
            </span>
          )}
        </div>
        <RacerInfoBanner participantName={raceState.participantName} avatar={raceState.currentAvatar ?? undefined} />
        <VideoPanel
          streamUrl={raceState.streamUrl}
          participantName={raceState.participantName ?? ''}
          modelName={raceState.modelName ?? ''}
          allComplete={
            raceState.queueItems.length > 0 &&
            !raceState.queueItems.some((i) => i.status === 'PENDING' || i.status === 'IN_PROGRESS')
          }
          hasFailed={raceState.queueItems.some((i) => i.status === 'FAILED')}
          winnerDeclared={raceState.raceStatus === 'COMPLETED'}
          waitingForLaunch={
            !raceState.isExecutionRunning &&
            raceState.raceStatus !== 'COMPLETED' &&
            raceState.queueItems.every((i) => i.status === 'PENDING')
          }
          isExecutionRunning={raceState.queueItems.some((i) => i.status === 'IN_PROGRESS')}
        />
        <RaceProgressBar completedModels={raceState.completedModels} totalModels={raceState.queueItems.length} />
      </SpaceBetween>
      <ParticipantNotificationToast lastEvent={lastNotificationEvent} currentProfileId={profile?.profileId ?? ''} />
      <WinnerOverlay winner={raceState.winner} />
    </div>
  ) : (
    <div data-testid="live-race-content">
      <SpaceBetween size="m">
        <Grid gridDefinition={[{ colspan: { default: 12, s: 8 } }, { colspan: { default: 12, s: 4 } }]}>
          <SpaceBetween size="s">
            <VideoPanel
              streamUrl={raceState.streamUrl}
              participantName={raceState.participantName ?? ''}
              modelName={raceState.modelName ?? ''}
              allComplete={
                raceState.queueItems.length > 0 &&
                !raceState.queueItems.some((i) => i.status === 'PENDING' || i.status === 'IN_PROGRESS')
              }
              hasFailed={raceState.queueItems.some((i) => i.status === 'FAILED')}
              winnerDeclared={raceState.raceStatus === 'COMPLETED'}
              waitingForLaunch={
                !raceState.isExecutionRunning &&
                raceState.raceStatus !== 'COMPLETED' &&
                raceState.queueItems.every((i) => i.status === 'PENDING')
              }
              isExecutionRunning={raceState.queueItems.some((i) => i.status === 'IN_PROGRESS')}
            />
            <RaceProgressBar completedModels={raceState.completedModels} totalModels={raceState.queueItems.length} />
          </SpaceBetween>
          <LeaderboardPanel rankings={raceState.rankings} timingMethod={leaderboard?.timingMethod} />
        </Grid>
        <QueueManagementPanel
          items={raceState.queueItems}
          onReorder={isFacilitator ? handleQueueReorder : () => undefined}
          onRemove={isFacilitator ? handleQueueRemove : () => undefined}
          onReset={isFacilitator ? handleQueueReset : () => undefined}
          isRaceCompleted={raceState.raceStatus === 'COMPLETED'}
          readOnly={!isFacilitator}
          autolaunchEnabled={isFacilitator ? raceState.autolaunchEnabled : undefined}
          submissionPeriodOpen={isFacilitator ? raceState.submissionPeriodOpen : undefined}
          onToggleAutolaunch={isFacilitator ? handleToggleAutolaunch : undefined}
          onToggleSubmissions={isFacilitator ? handleToggleSubmissions : undefined}
        />
      </SpaceBetween>
      <ParticipantNotificationToast lastEvent={lastNotificationEvent} currentProfileId={profile?.profileId ?? ''} />
      <WinnerOverlay winner={raceState.winner} onDismiss={() => setRaceState((prev) => ({ ...prev, winner: null }))} />
    </div>
  );

  if (isAuthLoading) {
    return null;
  }

  if (isBroadcastMode) {
    return content;
  }

  return (
    <div className="liveRacePage">
      <SpaceBetween size="s">
        <Header
          variant="h1"
          description={
            raceState.raceStatus === 'IN_PROGRESS' ? (
              <span className="liveBadge">
                <span className="liveDot" /> {t('header.live')}
              </span>
            ) : raceState.raceStatus === 'COMPLETED' || liveRaceState?.race.liveEventStatus === 'COMPLETED' ? (
              <StatusIndicator type="success">{t('header.raceCompleted')}</StatusIndicator>
            ) : (
              <StatusIndicator type="pending">{t('header.startingSoon')}</StatusIndicator>
            )
          }
          actions={
            <SpaceBetween size="xs" direction="horizontal">
              {isFacilitator && (
                <Button variant="primary" onClick={handleLaunch} disabled={!canLaunch} data-testid="launch-button">
                  {t('facilitatorPanel.launch')}
                </Button>
              )}
              {isFacilitator && (
                <ButtonDropdown
                  items={[
                    {
                      text: t('facilitatorPanel.declareWinner'),
                      id: 'declare-winner',
                      disabled: !canDeclareWinner,
                    },
                    {
                      text: t('facilitatorPanel.clearLeaderboard'),
                      id: 'clear-leaderboard',
                      disabled: !canClear,
                    },
                  ]}
                  onItemClick={({ detail }) => {
                    if (detail.id === 'declare-winner') setShowDeclareConfirm(true);
                    if (detail.id === 'clear-leaderboard') setShowClearConfirm(true);
                  }}
                  data-testid="actions-dropdown"
                >
                  {t('facilitatorPanel.actions')}
                </ButtonDropdown>
              )}
              <Button
                variant="link"
                href={`${window.location.pathname}?mode=broadcast`}
                target="_blank"
                iconName="external"
                data-testid="broadcast-mode-link"
              >
                {t('facilitatorPanel.openBroadcast')}
              </Button>
            </SpaceBetween>
          }
        >
          {leaderboard?.name}
        </Header>
        <RacerInfoBanner participantName={raceState.participantName} avatar={raceState.currentAvatar ?? undefined} />
        <RaceInfoPanel liveEventTime={leaderboard?.liveEventTime?.toISOString() ?? null} />
        {isFacilitator && isResetting && (
          <Flashbar
            items={[
              {
                type: 'in-progress',
                content: (
                  <ProgressBar
                    value={Math.min((resetElapsed / 30) * 100, 100)}
                    variant="flash"
                    label={t('facilitatorPanel.resetting')}
                  />
                ),
                id: 'resetting',
              },
            ]}
          />
        )}
        {isFacilitator && resetSuccess && (
          <Flashbar items={[{ type: 'success', content: t('facilitatorPanel.resetSuccess'), id: 'reset-success' }]} />
        )}
        {content}
      </SpaceBetween>

      <Modal
        visible={showClearConfirm}
        onDismiss={() => setShowClearConfirm(false)}
        header={t('facilitatorPanel.clearConfirmTitle')}
        footer={
          <Box float="right">
            <SpaceBetween size="xs" direction="horizontal">
              <Button variant="link" onClick={() => setShowClearConfirm(false)}>
                {t('facilitatorPanel.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setShowClearConfirm(false);
                  handleClearLeaderboard();
                }}
                data-testid="confirm-clear-button"
              >
                {t('facilitatorPanel.confirmClear')}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        {t('facilitatorPanel.clearConfirmMessage')}
      </Modal>

      <Modal
        visible={showDeclareConfirm}
        onDismiss={() => setShowDeclareConfirm(false)}
        header={t('facilitatorPanel.declareConfirmTitle')}
        footer={
          <Box float="right">
            <SpaceBetween size="xs" direction="horizontal">
              <Button variant="link" onClick={() => setShowDeclareConfirm(false)}>
                {t('facilitatorPanel.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setShowDeclareConfirm(false);
                  handleDeclareWinner();
                }}
                data-testid="confirm-declare-button"
              >
                {t('facilitatorPanel.confirmDeclare')}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="s">
          <Box>{t('facilitatorPanel.declareConfirmMessage')}</Box>
          {raceState.rankings.slice(0, 3).length > 0 && (
            <SpaceBetween size="xxs">
              {raceState.rankings.slice(0, 3).map((entry) => (
                <Box key={entry.submissionId}>
                  #{entry.rank} — {entry.participantName} (
                  {entry.bestLapTime != null ? millisToMinutesAndSeconds(entry.bestLapTime) : '—'})
                </Box>
              ))}
            </SpaceBetween>
          )}
        </SpaceBetween>
      </Modal>
    </div>
  );
};

export default LiveRace;
