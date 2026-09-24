// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { BulkInviteJobStatus } from '@deepracer-indy/typescript-server-client';

import { ResourceType } from '#constants/resourceTypes.js';
import { BulkInviteJobEntity } from '#entities/BulkInviteJobEntity.js';

import { TEST_TABLE_NAME } from '../../constants/testConstants.js';
import { generateResourceId } from '../../utils/resourceUtils.js';
import { testDynamoDBDocumentClient } from '../../utils/testUtils.js';

const TEST_JOB = {
  adminProfileId: generateResourceId(),
  totalEntries: 5,
  status: BulkInviteJobStatus.PROCESSING,
};

describe('BulkInviteJobEntity', () => {
  describe('create()', () => {
    it('keys the job under the admin profile partition by job id, with zeroed defaults', async () => {
      const { data } = await BulkInviteJobEntity.create(TEST_JOB).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item = Items?.[0] as any;

      expect(item.pk).toBe(`profile_${TEST_JOB.adminProfileId}`);
      expect(item.sk).toBe(`bulkinvitejob_${data.bulkInviteJobId}`);
      expect(item.__edb_e__).toBe(ResourceType.BULK_INVITE_JOB);
      // Counters and results default so the append guard always has a valid list to size().
      expect(item.processedCount).toBe(0);
      expect(item.createdCount).toBe(0);
      expect(item.skippedCount).toBe(0);
      expect(item.failedCount).toBe(0);
      expect(item.results).toEqual([]);
    });
  });
});
