// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { JobName } from '../../types/jobName.js';
import { jobNameHelper } from '../../utils/JobNameHelper.js';
import { DynamoDBItemAttribute, getWorkflowJobAttributes } from '../itemAttributes.js';
import { JobType } from '../jobType.js';

const A = DynamoDBItemAttribute;

/**
 * Regression coverage for the divergent video S3 timestamp bug (upstream #53).
 *
 * The assetS3Locations setter must generate a single timestamp and share it across
 * every timestamped location. Previously each S3PathHelper method called
 * `new Date().toISOString()` independently, so `videosS3Location` and
 * `primaryVideoS3Location` could resolve to different prefixes — the simulator then
 * uploaded to one prefix while lookup happened at another, producing missing videos.
 */
describe('getWorkflowJobAttributes – assetS3Locations setter', () => {
  const modelId = 'testModelId';
  const profileId = 'testProfileId';
  const jobName = 'deepracerindy-evaluation-testModelId' as JobName;

  beforeEach(() => {
    vi.spyOn(jobNameHelper, 'getJobType').mockReturnValue(JobType.EVALUATION);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const runSetter = () => {
    const assetAttribute = getWorkflowJobAttributes(false)[A.ASSET_S3_LOCATIONS] as unknown as {
      set: (item: unknown, ctx: { modelId: string; profileId: string; name: JobName }) => Record<string, string>;
    };
    return assetAttribute.set(undefined, { modelId, profileId, name: jobName });
  };

  it('derives primaryVideoS3Location from exactly the videosS3Location base prefix', () => {
    const result = runSetter();

    expect(result[A.PRIMARY_VIDEO_S3_LOCATION]).toBe(`${result[A.VIDEOS_S3_LOCATION]}camera-pip/0-video.mp4`);
  });

  it('uses a single shared timestamp across all timestamped asset locations', () => {
    // Return a different ISO string on every call so any setter path that generates
    // more than one timestamp is caught deterministically (the old buggy code called
    // Date#toISOString four times; the fixed code calls it exactly once).
    let callCount = 0;
    vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => `2024-01-01T00:00:0${callCount++}.000Z`);

    const result = runSetter();

    const extractTimestamp = (location: string) => location.match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/)?.[0];
    const sharedTimestamp = extractTimestamp(result[A.VIDEOS_S3_LOCATION]);

    expect(sharedTimestamp).toBeDefined();
    expect(extractTimestamp(result[A.PRIMARY_VIDEO_S3_LOCATION])).toBe(sharedTimestamp);
    expect(extractTimestamp(result[A.METRICS_S3_LOCATION])).toBe(sharedTimestamp);
    expect(extractTimestamp(result[A.SIM_TRACE_S3_LOCATION])).toBe(sharedTimestamp);
    expect(callCount).toBe(1);
  });
});
