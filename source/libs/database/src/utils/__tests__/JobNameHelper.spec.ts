// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { JobType } from '../../constants/jobType.js';
import type { JobName } from '../../types/jobName.js';
import type { ResourceId } from '../../types/resource.js';
import { jobNameHelper } from '../JobNameHelper.js';

describe('JobNameHelper', () => {
  const jobNamePrefix = 'deepracerindy';
  const TEST_JOB_ID = 'testJobId' as ResourceId;
  const TEST_JOB_TYPE = JobType.EVALUATION;
  const TEST_JOB_NAME = `${jobNamePrefix}-${TEST_JOB_TYPE}-${TEST_JOB_ID}` as JobName;

  describe('getJobId()', () => {
    it('should return the jobId parsed from the given jobName', () => {
      expect(jobNameHelper.getJobId(TEST_JOB_NAME)).toBe(TEST_JOB_ID);
    });
  });

  describe('getJobType()', () => {
    it('should return the jobType parsed from the given jobName', () => {
      expect(jobNameHelper.getJobType(TEST_JOB_NAME)).toBe(TEST_JOB_TYPE);
    });
  });

  describe('getJobName()', () => {
    it.each(Object.values(JobType))('should return a correctly formatted jobName for %s jobType', (jobType) => {
      expect(jobNameHelper.getJobName(jobType, TEST_JOB_ID)).toBe(`${jobNamePrefix}-${jobType}-${TEST_JOB_ID}`);
    });
  });
});
