// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const URL_PATTERN = /^https:\/\/[A-Za-z0-9._~:/?#[\]@!$&()*+,;=%-]+$/;
const MODEL_ID_PATTERN = /^[A-Za-z0-9]{15}$/;
const RACER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export interface CarLogUploadScriptParams {
  /** Presigned PUT URL of the staging object. */
  uploadUrl: string;
  /** Only bags modified after this time are collected. */
  laterThan?: Date;
  /** Selects bags written by this model (preferred). */
  modelId?: string;
  /** Selects bags of this racer when no model id is given. */
  racerName?: string;
}

/**
 * Builds the shell script run on the car through SSM: it stops logging, packs the matching rosbag
 * directories into a `.tar.gz` and uploads it with a presigned PUT.
 *
 * Every value is checked against a strict allow-list *and* kept inside single quotes, so a value
 * can never break out into the shell even if one of the two protections was wrong.
 */
export function buildCarLogUploadScript({
  uploadUrl,
  laterThan,
  modelId,
  racerName,
}: CarLogUploadScriptParams): string[] {
  if (!URL_PATTERN.test(uploadUrl)) {
    throw new Error('Invalid upload URL');
  }
  if (!modelId && !racerName) {
    throw new Error('A model id or racer name is required');
  }
  if (modelId && !MODEL_ID_PATTERN.test(modelId)) {
    throw new Error('Invalid model id');
  }
  if (!modelId && racerName && !RACER_NAME_PATTERN.test(racerName)) {
    throw new Error('Invalid racer name');
  }
  if (laterThan && Number.isNaN(laterThan.getTime())) {
    throw new Error('Invalid timestamp');
  }

  // Folder names are `<racer>_<model>_<modelId>-<timestamp>`; the model id is unique, the racer name is not.
  const namePattern = modelId ? `*_${modelId}-*` : `${racerName}_*`;
  const newerThan = laterThan ? ` -newermt '${laterThan.toISOString().slice(0, 19).replace('T', ' ')} UTC'` : '';

  return [
    '#!/bin/bash',
    'set -o pipefail',
    'export HOME=/root',
    'source /opt/aws/deepracer/lib/setup.bash',
    // Logging may not be running; stopping it is best effort.
    'ros2 service call /logging_pkg/stop_logging std_srvs/srv/Trigger || true',
    'LOG_DIR="$(ros2 param get /logging_pkg/bag_log_node output_path --hide-type --no-daemon)" || LOG_DIR=""',
    'if [ -z "$LOG_DIR" ] || [ ! -d "$LOG_DIR" ]; then LOG_DIR="/opt/aws/deepracer/logs"; fi',
    'cd "$LOG_DIR" || exit 1',
    'ARCHIVE="$(mktemp /tmp/carlogs.XXXXXX.tar)"',
    'trap \'rm -f "$ARCHIVE" "$ARCHIVE.gz"\' EXIT',
    `find . -mindepth 1 -maxdepth 1 -type d${newerThan} -name '${namePattern}' -print0 | tar --null -T - -cf "$ARCHIVE"`,
    'if [ ! -s "$ARCHIVE" ]; then echo "No matching log folders found" >&2; exit 3; fi',
    'gzip -f "$ARCHIVE"',
    `curl -sSf -X PUT -H 'Content-Type: application/gzip' -T "$ARCHIVE.gz" '${uploadUrl}'`,
    'echo "Upload complete"',
  ];
}
