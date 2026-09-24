// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Shared helpers for viewing/downloading race videos, used by both the Race leaderboard and
 * Your submissions table configs. Extracted to a single module to avoid duplicated logic.
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '#hooks/useAppDispatch.js';
import { displayErrorNotification } from '#store/notifications/notificationsSlice.js';

export interface SelectedVideo {
  url: string;
  title: string;
}

const sanitize = (value: string) => value.replaceAll(/[^a-zA-Z0-9-_]/g, '_');

const formatTimestamp = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}`;

/**
 * Builds a stable, filesystem-safe `.mp4` download filename for a submission/ranking video.
 * The whole base (including submissionNumber) is sanitized in a single pass; only the `.mp4`
 * extension is appended afterwards so its `.` is preserved.
 */
export const buildVideoFilename = (
  leaderboardName: string,
  racerLabel: string,
  submissionNumber: number,
  submittedAt: Date,
) => {
  const base = `${leaderboardName}_${racerLabel}_${submissionNumber}_${formatTimestamp(submittedAt)}`;
  return `${sanitize(base)}.mp4`;
};

const downloadVideo = async (url: string, filename: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`);
  }
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(blobUrl);
  }
};

/**
 * Returns a fire-and-forget video download handler. On failure (expired/403 presigned URL,
 * network error, or non-OK response — see the `response.ok` guard in downloadVideo) it surfaces
 * an error notification to the user instead of silently swallowing the error.
 */
export const useVideoDownload = () => {
  const { t } = useTranslation('raceDetails');
  const dispatch = useAppDispatch();

  return useCallback(
    (url: string, filename: string) => {
      downloadVideo(url, filename).catch(() => {
        dispatch(displayErrorNotification({ content: t('videoModal.downloadError') }));
      });
    },
    [dispatch, t],
  );
};
