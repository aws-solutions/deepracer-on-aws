// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * The car's logging package names a rosbag directory `<model folder>-<YYYYMMDD>-<HHMMSS>`, and the
 * model folder written by the push workflow is `<racerName>_<modelName>_<modelId>`. The trailing
 * 15-character model id is the only part that is relied upon: racer and model names can contain
 * underscores and hyphens themselves, and can be changed after the model was deployed.
 */
const BAG_DIR_PATTERN = /_([A-Za-z0-9]{15})-(\d{8})-(\d{6})$/;

/** Characters allowed in a bag directory name; keeps names safe to use in S3 keys and file names. */
const SAFE_BAG_DIR_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

export interface ParsedBagDir {
  modelId: string;
  /** Local car time as written by the logging package, e.g. `20250102-030405`. */
  recordedAt: string;
}

export const isSafeBagDirName = (name: string) => SAFE_BAG_DIR_PATTERN.test(name);

/** Extracts the model id from a bag directory name, or returns undefined when it does not follow the naming scheme. */
export function parseBagDirName(name: string): ParsedBagDir | undefined {
  if (!isSafeBagDirName(name)) {
    return undefined;
  }
  const match = BAG_DIR_PATTERN.exec(name);
  return match ? { modelId: match[1], recordedAt: `${match[2]}-${match[3]}` } : undefined;
}
