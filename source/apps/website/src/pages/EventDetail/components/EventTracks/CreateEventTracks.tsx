// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Tabs, { TabsProps } from '@cloudscape-design/components/tabs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import TrackTabPanel from './components/TrackTabPanel';
import { ADD_TRACK_DEFAULTS, AddTrackFormValues } from './components/validation.js';
import { MAX_TRACKS_PER_EVENT } from './EventTracks';

/** Sentinel tab id for the trailing "add track" tab (matches EventTracks/DREM's tracksPanel.tsx pattern). */
const ADD_TAB_ID = 'add';
/** Sentinel tab id for the combined-leaderboard preview tab (matches DREM's tracksPanel.tsx 'combined' trackId). */
const COMBINED_TAB_ID = 'combined';

export interface CreateEventTracksProps {
  /**
   * Tracks queued for creation. Owned by the parent form (CreateEvent) so it can be
   * submitted via sequential AddTrackToEvent calls once the event itself is created —
   * there is no eventId yet for this component to call the API against directly.
   */
  queuedTracks: AddTrackFormValues[];
  onChange: (queuedTracks: AddTrackFormValues[]) => void;
  disabled?: boolean;
  /**
   * Seed a single default track on first mount when the list is empty. This is the
   * create-flow behavior (DREM seeds one track before any interaction). Edit mode owns
   * its own hydration from persisted tracks, so it disables seeding to avoid clobbering
   * the hydrated draft with a blank default (which, lacking a leaderboardId, would be
   * treated as a deletion of the real tracks on Save). Defaults to true.
   */
  seedInitialTrack?: boolean;
  /**
   * Combined leaderboard header/footer text, shown as editable fields on the Combined
   * preview tab (rendered only when 2+ tracks make that tab visible). These are
   * event-level values (the combined leaderboard is an aggregation across tracks, not a
   * track itself), so they are passed/lifted via plain value + callback props rather than
   * living in this component's track state. Omit the callbacks to render them read-only.
   */
  combinedLeaderBoardHeader?: string;
  combinedLeaderBoardFooter?: string;
  onCombinedLeaderBoardHeaderChange?: (value: string) => void;
  onCombinedLeaderBoardFooterChange?: (value: string) => void;
}

/**
 * Local-only track list builder used on the event creation form's Tracks section.
 * Matches DREM's tracksPanel.tsx behavior exactly:
 * - One track is pre-added on mount (DREM seeds `event.tracks` with a single default
 *   track before any user interaction — eventDomain.ts).
 * - Clicking "+" immediately adds a new editable tab — no separate "add track" form;
 *   each tab IS the editable form (TrackTabPanel, matching DREM's LeaderBoardConfigPanel).
 * - A "Combined" preview tab appears automatically once 2+ tracks are queued (DREM's
 *   `trackId: 'combined'` sentinel). It's UI-only — never a real queued track, never
 *   submitted via AddTrackToEvent — since there's no combinedScoringStrategy/real
 *   leaderboard to preview before the event exists.
 * - Each tab has a bottom-right Delete button, disabled with only 1 track queued or on
 *   the Combined tab (DREM: `deleteIsDisabled || trackId === 'combined'`).
 *
 * Our backend has separate CreateEvent/AddTrackToEvent operations (unlike DREM's single
 * addEvent mutation carrying the whole eventConfig.tracks array), so this only
 * accumulates queued tracks in local state — CreateEvent.tsx submits them via
 * sequential AddTrackToEvent calls after the event itself is created. Track layout
 * (trackType) is chosen once on the Race configuration section, not per queued track.
 */
const CreateEventTracks = ({
  queuedTracks,
  onChange,
  disabled,
  seedInitialTrack = true,
  combinedLeaderBoardHeader = '',
  combinedLeaderBoardFooter = '',
  onCombinedLeaderBoardHeaderChange,
  onCombinedLeaderBoardFooterChange,
}: CreateEventTracksProps) => {
  const { t } = useTranslation('events');
  const [activeTabId, setActiveTabId] = useState<string>('');

  // Seed a single default track once, on first mount, when nothing has been queued yet.
  // hasSeededInitialTrack initializes to true whenever tracks are already present on
  // mount (so a later removal down to zero never re-triggers seeding) and otherwise
  // flips true the one time this effect seeds the initial track.
  const [hasSeededInitialTrack, setHasSeededInitialTrack] = useState(queuedTracks.length > 0);
  useEffect(() => {
    if (!seedInitialTrack || hasSeededInitialTrack) return;
    setHasSeededInitialTrack(true);
    onChange([{ ...ADD_TRACK_DEFAULTS, leaderBoardTitle: t('detail.tracks.defaultTrackName', { number: 1 }) }]);
  }, [hasSeededInitialTrack, onChange, seedInitialTrack, t]);

  const showCombinedTab = queuedTracks.length >= 2;

  const canAddTracks = !disabled && queuedTracks.length < MAX_TRACKS_PER_EVENT;
  const addDisabledReason =
    queuedTracks.length >= MAX_TRACKS_PER_EVENT ? t('detail.tracks.table.addDisabledReasonMaxTracks') : undefined;

  // Mirrors DREM's addTrackHandler: clone the last track's values (fleet/footer carry
  // forward, matching the single-shared-configuration convention used elsewhere) rather
  // than resetting to blank defaults, and immediately show it as a new editable tab.
  const handleAddTrack = useCallback(() => {
    const lastTrack = queuedTracks.at(-1) ?? ADD_TRACK_DEFAULTS;
    const { leaderboardId: _leaderboardId, ...lastTrackValues } = lastTrack;
    const newTrack: AddTrackFormValues = {
      ...lastTrackValues,
      leaderBoardTitle: t('detail.tracks.defaultTrackName', { number: queuedTracks.length + 1 }),
    };
    onChange([...queuedTracks, newTrack]);
    setActiveTabId(String(queuedTracks.length));
  }, [onChange, queuedTracks, t]);

  const handleTrackChange = useCallback(
    (index: number, updatedTrack: AddTrackFormValues) => {
      onChange(queuedTracks.map((track, i) => (i === index ? updatedTrack : track)));
    },
    [onChange, queuedTracks],
  );

  const handleRemoveTrack = useCallback(
    (index: number) => {
      const remainingTracks = queuedTracks
        .map((track, trackIndex) => ({ track, trackIndex }))
        .filter(({ trackIndex }) => trackIndex !== index)
        .map(({ track, trackIndex }, newIndex) => {
          const generatedTitle = t('detail.tracks.defaultTrackName', { number: trackIndex + 1 });
          const shouldRenumberTitle = track.leaderBoardTitle === generatedTitle;

          return shouldRenumberTitle
            ? { ...track, leaderBoardTitle: t('detail.tracks.defaultTrackName', { number: newIndex + 1 }) }
            : track;
        });

      onChange(remainingTracks);
    },
    [onChange, queuedTracks, t],
  );

  const tabs: TabsProps.Tab[] = useMemo(() => {
    const isRemoveTrackDisabled = (trackId: string) =>
      disabled || queuedTracks.length <= 1 || trackId === COMBINED_TAB_ID;

    const trackTabs: TabsProps.Tab[] = queuedTracks.map((track, index) => ({
      id: String(index),
      label: t('detail.tracks.defaultTrackName', { number: index + 1 }),
      content: (
        <TrackTabPanel
          track={track}
          onChange={(updatedTrack) => handleTrackChange(index, updatedTrack)}
          onDelete={() => handleRemoveTrack(index)}
          deleteDisabled={isRemoveTrackDisabled(String(index))}
        />
      ),
    }));

    if (showCombinedTab) {
      trackTabs.push({
        id: COMBINED_TAB_ID,
        label: t('detail.tracks.combinedTabLabel'),
        content: (
          <Container>
            <SpaceBetween size="xl">
              <SpaceBetween size="m">
                <FormField
                  label={t('detail.tracks.combinedLeaderboard.fields.combinedLeaderBoardHeader.label')}
                  description={t('detail.tracks.combinedLeaderboard.fields.combinedLeaderBoardHeader.description')}
                >
                  <Input
                    value={combinedLeaderBoardHeader}
                    placeholder={t('detail.tracks.combinedLeaderboard.fields.combinedLeaderBoardHeader.placeholder')}
                    disabled={!onCombinedLeaderBoardHeaderChange}
                    onChange={({ detail }) => onCombinedLeaderBoardHeaderChange?.(detail.value)}
                    data-testid="input-combined-header"
                  />
                </FormField>
                <FormField
                  label={t('detail.tracks.combinedLeaderboard.fields.combinedLeaderBoardFooter.label')}
                  description={t('detail.tracks.combinedLeaderboard.fields.combinedLeaderBoardFooter.description')}
                >
                  <Input
                    value={combinedLeaderBoardFooter}
                    placeholder={t('detail.tracks.combinedLeaderboard.fields.combinedLeaderBoardFooter.placeholder')}
                    disabled={!onCombinedLeaderBoardFooterChange}
                    onChange={({ detail }) => onCombinedLeaderBoardFooterChange?.(detail.value)}
                    data-testid="input-combined-footer"
                  />
                </FormField>
              </SpaceBetween>
              <Box float="right">
                <Button disabled>{t('detail.tracks.removeTrackButton')}</Button>
              </Box>
            </SpaceBetween>
          </Container>
        ),
      });
    }

    if (!disabled) {
      trackTabs.push({
        id: ADD_TAB_ID,
        label: (
          <Button
            variant="icon"
            iconName="add-plus"
            ariaLabel={t('detail.tracks.addTrackButton')}
            disabled={!canAddTracks}
            disabledReason={addDisabledReason}
            data-testid="btn-add-queued-track"
            onClick={(event) => {
              event.stopPropagation();
              handleAddTrack();
            }}
          />
        ),
      });
    }

    return trackTabs;
  }, [
    queuedTracks,
    showCombinedTab,
    disabled,
    canAddTracks,
    addDisabledReason,
    handleAddTrack,
    handleTrackChange,
    handleRemoveTrack,
    combinedLeaderBoardHeader,
    combinedLeaderBoardFooter,
    onCombinedLeaderBoardHeaderChange,
    onCombinedLeaderBoardFooterChange,
    t,
  ]);

  const resolvedActiveTabId = useMemo(() => {
    if (tabs.some((tab) => tab.id === activeTabId)) return activeTabId;
    return tabs.find((tab) => tab.id !== ADD_TAB_ID)?.id;
  }, [tabs, activeTabId]);

  if (queuedTracks.length === 0) {
    // Only reachable for the single render before the seeding effect above fires.
    return null;
  }

  return (
    <Tabs
      variant="container"
      activeTabId={resolvedActiveTabId}
      onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
      tabs={tabs}
    />
  );
};

export default CreateEventTracks;
