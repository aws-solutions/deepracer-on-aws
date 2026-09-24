// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as Yup from 'yup';

import i18n from '#i18n/index.js';

/**
 * Per-track fields collected by the add-track form. Track layout (trackType) is NOT
 * part of this form — it's a single field on the event itself (Race configuration
 * section of CreateEvent), used as the layout for every track added to that event.
 * The data model still stores trackType per-track on Leaderboard/AddTrackToEvent (so a
 * future per-track override remains possible without a migration); the UI just always
 * supplies the event's chosen layout when adding a track.
 */
export interface AddTrackFormValues {
  leaderboardId?: string;
  trackType?: string;
  leaderBoardTitle: string;
  leaderBoardFooter: string;
  fleetId: string;
}

export const ADD_TRACK_DEFAULTS: AddTrackFormValues = {
  leaderBoardTitle: '',
  leaderBoardFooter: '',
  fleetId: '',
};

export const addTrackValidationSchema = Yup.object({
  leaderBoardTitle: Yup.string()
    .required(() => i18n.t('events:detail.tracks.addModal.validation.leaderBoardTitleRequired'))
    .max(128),
  leaderBoardFooter: Yup.string().max(255),
  fleetId: Yup.string(),
});
