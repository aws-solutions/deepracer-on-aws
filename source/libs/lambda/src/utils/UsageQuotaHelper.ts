// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { profileDao, accountResourceUsageDao, ResourceId, DEFAULT_MAX_QUERY_RESULTS } from '@deepracer-indy/database';
import { logger, logMethod } from '@deepracer-indy/utils';

export interface ProfileQuotaUsage {
  computeMinutesQueued: number;
  computeMinutesUsed: number;
  maxTotalComputeMinutes: number | undefined;
  modelCount: number;
  maxModelCount: number | undefined;
}

/**
 * Helper class for managing compute usage quotas for profiles and accounts.
 * Provides functionality to load and update compute usage metrics.
 */
class UsageQuotaHelper {
  /**
   * Loads the compute usage metrics for a specific profile.
   *
   * @param profileId - The unique identifier of the profile
   * @returns An object containing the profile's compute minutes queued, used, and maximum allowed
   */
  loadProfileComputeUsage = async (profileId: ResourceId): Promise<ProfileQuotaUsage> => {
    const profileItem = await profileDao.load({ profileId });
    return profileItem as ProfileQuotaUsage;
  };

  /**
   * Updates a profile's compute usage metrics after a job completes.
   * Decreases queued minutes and increases used minutes based on actual usage.
   *
   * @param profileId - The unique identifier of the profile
   * @param minutesQueuedByUser - The number of compute minutes that were queued by the user
   * @param minutesUsedBySageMaker - The actual number of compute minutes used by SageMaker
   */
  finalizeProfileComputeUsage = async (
    profileId: ResourceId,
    minutesQueuedByUser: number,
    minutesUsedBySageMaker: number,
  ) => {
    const profileItem = await profileDao.load({ profileId });
    const profileComputeMinutesQueued = profileItem.computeMinutesQueued || 0;
    const profileComputeMinutesUsed = profileItem.computeMinutesUsed || 0;
    const finalizedComputeMinutesQueued =
      profileComputeMinutesQueued > minutesQueuedByUser ? profileComputeMinutesQueued - minutesQueuedByUser : 0;
    const finalizedComputeMinutesUsed =
      minutesQueuedByUser <= minutesUsedBySageMaker
        ? profileComputeMinutesUsed + minutesQueuedByUser
        : profileComputeMinutesUsed + minutesUsedBySageMaker;
    await profileDao.update(
      { profileId },
      {
        computeMinutesQueued: finalizedComputeMinutesQueued,
        computeMinutesUsed: finalizedComputeMinutesUsed,
      },
    );
  };

  /**
   * Updates an account's compute usage metrics for a specific year and month.
   * Adjusts the queued and used compute minutes based on actual usage.
   *
   * @param currentYear - The year for which to update the account usage
   * @param currentMonth - The month for which to update the account usage
   * @param minutesQueuedByUser - The number of compute minutes that were queued by the user
   * @param minutesUsedBySageMaker - The actual number of compute minutes used by SageMaker
   */
  finalizeAccountComputeUsage = async (
    currentYear: number,
    currentMonth: number,
    minutesQueuedByUser: number,
    minutesUsedBySageMaker: number,
  ) => {
    const accountResourceUsageItem = await accountResourceUsageDao.get({ year: currentYear, month: currentMonth });
    if (accountResourceUsageItem) {
      const accountComputeMinutesQueued =
        accountResourceUsageItem.accountComputeMinutesQueued === 0
          ? accountResourceUsageItem.accountComputeMinutesQueued
          : accountResourceUsageItem.accountComputeMinutesQueued - minutesQueuedByUser;
      const accountComputeMinutesUsed =
        minutesQueuedByUser <= minutesUsedBySageMaker
          ? accountResourceUsageItem.accountComputeMinutesUsed + minutesQueuedByUser
          : accountResourceUsageItem.accountComputeMinutesUsed + minutesUsedBySageMaker;
      await accountResourceUsageDao.update(
        { year: currentYear, month: currentMonth },
        { accountComputeMinutesQueued, accountComputeMinutesUsed },
      );
    }
  };

  /**
   * Resets monthly quotas for all profiles using bulk updates for better performance.
   * Handles large numbers of profiles by processing them in batches with bulk operations.
   */
  @logMethod
  async resetMonthlyQuotas(batchSize: number | undefined = undefined): Promise<void> {
    const BATCH_SIZE = batchSize ?? DEFAULT_MAX_QUERY_RESULTS;
    const CONCURRENT_UPDATES = Number(process.env.PROFILE_UPDATE_CONCURRENCY ?? 10); // Limit concurrent database operations

    let cursor: string | null = null;
    let totalProcessedProfiles = 0;
    let batchNumber = 0;

    do {
      batchNumber++;

      const profileBatch = await profileDao.list({
        maxResults: BATCH_SIZE,
        cursor,
      });

      logger.debug('Retrieved profile batch for quota reset', {
        batchNumber,
        profileCount: profileBatch.data.length,
        hasCursor: !!profileBatch.cursor,
        totalProcessedSoFar: totalProcessedProfiles,
      });

      if (profileBatch.data.length > 0) {
        // Process profiles in chunks to limit concurrent database operations
        for (let i = 0; i < profileBatch.data.length; i += CONCURRENT_UPDATES) {
          const chunk = profileBatch.data.slice(i, i + CONCURRENT_UPDATES);
          await Promise.all(
            chunk.map(async (profile) => {
              return profileDao.update(
                { profileId: profile.profileId },
                {
                  computeMinutesUsed: 0,
                  modelCount: 0,
                },
              );
            }),
          );
        }

        logger.debug('Completed bulk update for batch', {
          batchNumber,
          updatedProfiles: profileBatch.data.length,
        });
      }

      totalProcessedProfiles += profileBatch.data.length;
      cursor = profileBatch.cursor;

      logger.debug('Completed processing batch', {
        batchNumber,
        batchSize: profileBatch.data.length,
        totalProcessedProfiles,
        hasMoreBatches: !!cursor,
      });
    } while (cursor);

    logger.debug('Monthly quota reset completed', {
      totalProcessedProfiles,
      totalBatches: batchNumber,
    });
  }
}

export const usageQuotaHelper = new UsageQuotaHelper();
