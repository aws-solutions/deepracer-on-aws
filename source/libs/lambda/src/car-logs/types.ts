// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Contract between the workflow Lambdas and the video processor container. The container only
 * ever sees the job config (written by `jobProcessUpload`) and writes the result manifest that
 * `jobRegisterResults` validates; neither goes through AppSync or the database.
 */

export interface CarLogJobConfigBag {
  /** Directory name of the rosbag, `<racerName>_<modelName>_<modelId>-<YYYYMMDD>-<HHMMSS>`. */
  bagDir: string;
  /** Key prefix of the extracted bag in the bucket (ends with `/`). */
  bagPrefix: string;
  profileId: string;
  racerName?: string;
  modelId: string;
  modelName?: string;
  assetType: 'BAG_SQLITE' | 'BAG_MCAP';
  /** Key of the model archive in `modelBucket`, absent when the model's artifacts no longer exist. */
  modelArtifactKey?: string;
  /** Where the container may write the video this bag ends up in; bags combined into one video use the first one's. */
  videoKey: string;
}

export interface CarLogJobConfigLap {
  lapNumber: number;
  lapTimeMs: number;
  isValid: boolean;
  resets: number;
}

export interface CarLogJobConfig {
  jobId: string;
  bucket: string;
  modelBucket: string;
  carName?: string;
  eventName?: string;
  /** The laps are those of `racerName`; videos of other racers are made without lap data. */
  race?: { runId: string; racerName?: string; trackName?: string; laps: CarLogJobConfigLap[] };
  bags: CarLogJobConfigBag[];
}

export interface CarLogResultVideo {
  /** The bags the video was made from, all of the same owner. */
  bagDirs: string[];
  videoKey: string;
  durationSeconds?: number;
  fps?: number;
  codec?: string;
  resolution?: string;
}

export interface CarLogResultManifest {
  jobId: string;
  videos: CarLogResultVideo[];
  /** Bags the container could not turn into a video, with a short reason. */
  failures?: { bagDir: string; reason: string }[];
}
