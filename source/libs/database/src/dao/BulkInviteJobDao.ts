// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  BulkInviteEntryStatus,
  BulkInviteJobStatus,
  ConflictError,
  InternalFailureError,
} from '@deepracer-indy/typescript-server-client';
import { logger, logMethod } from '@deepracer-indy/utils';
import { Service } from 'electrodb';

import { BaseDao } from './BaseDao.js';
import { DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import { BulkInviteJobEntity, type BulkInviteJobItem } from '../entities/BulkInviteJobEntity.js';
import { BulkInviteJobTokenEntity } from '../entities/BulkInviteJobTokenEntity.js';
import type { ResourceId } from '../types/resource.js';
import { generateUlid } from '../utils/resourceUtils.js';

/**
 * A PROCESSING job older than this is treated as inactive for the one-active-job check — an
 * escape hatch so a state-machine failure that never updated the record cannot lock an admin
 * out permanently (timeout reconciliation, 30-minute horizon).
 */
export const ACTIVE_JOB_STALE_MS = 30 * 60 * 1000;

/** Job records self-expire via DynamoDB TTL 90 days after creation. */
const JOB_TTL_SECONDS = 90 * 24 * 60 * 60;

/**
 * How long a BulkInviteUser idempotency-token guard item lives before DynamoDB TTL reclaims it.
 * Retries happen within seconds; 24h is a generous upper bound that comfortably covers any
 * in-flight retry while keeping token items from accumulating indefinitely. TTL is best-effort
 * and does not affect correctness — the conditional write is the dedup fence.
 */
const BULK_INVITE_JOB_TOKEN_TTL_SECONDS = 24 * 60 * 60;

/**
 * `createJob`'s transaction writes the job (index 0) then the token guard (index 1) — see the
 * `TransactItems` order in `createJob`. Used to inspect the per-item cancellation result and
 * confirm a canceled transaction was actually rejected on the token guard's own
 * attribute_not_exists condition (a genuine replay), rather than some unrelated cause such as a
 * TransactionConflictException or throttling on the job item.
 */
const BULK_INVITE_JOB_TOKEN_TRANSACT_ITEM_INDEX = 1;

/** Which counter to increment for a given per-entry outcome. */
const COUNT_ATTRIBUTE_BY_STATUS: Record<BulkInviteEntryStatus, DynamoDBItemAttribute> = {
  [BulkInviteEntryStatus.CREATED]: DynamoDBItemAttribute.CREATED_COUNT,
  [BulkInviteEntryStatus.SKIPPED]: DynamoDBItemAttribute.SKIPPED_COUNT,
  [BulkInviteEntryStatus.FAILED]: DynamoDBItemAttribute.FAILED_COUNT,
};

/** A single per-entry outcome appended to the job's `results` list. */
export interface BulkInviteEntryResult {
  emailAddress: string;
  displayName?: string;
  status: BulkInviteEntryStatus;
  reason?: string;
}

/**
 * Data access for {@link BulkInviteJobEntity}. Jobs live under the initiating admin's profile
 * partition, so every operation is keyed by `(adminProfileId, bulkInviteJobId)`.
 */
export class BulkInviteJobDao extends BaseDao<BulkInviteJobEntity> {
  private readonly service: Service<{
    bulkInviteJobs: BulkInviteJobEntity;
    bulkInviteJobTokens: BulkInviteJobTokenEntity;
  }>;

  constructor(bulkInviteJobEntity: BulkInviteJobEntity, bulkInviteJobTokenEntity: BulkInviteJobTokenEntity) {
    super(bulkInviteJobEntity);
    this.service = new Service({
      bulkInviteJobs: bulkInviteJobEntity,
      bulkInviteJobTokens: bulkInviteJobTokenEntity,
    });
  }

  /**
   * Create the initial PROCESSING record; returns it. The job id (`bulkInviteJobId`) is always a
   * freshly generated ULID (Crockford base32, 26 chars — matching the `BulkInviteJobId` model
   * pattern used by the `GetBulkInviteUserJobStatus` path label). Its timestamp prefix makes the
   * `bulkinvitejob_${id}` sort key time-ordered. It is generated here explicitly
   * rather than left to the entity's attribute default so it is known upfront and can be stamped
   * onto the token guard item below.
   *
   * It is intentionally NOT derived from the caller-supplied idempotency token: Smithy's
   * `@idempotencyToken` codegen auto-populates that field with a UUID v4, which does not fit the
   * ULID format and would make the resulting job unreachable via
   * `GET /profiles/bulkInvite/{jobId}`.
   *
   * When `clientToken` is supplied (Idempotency standard), a same-token retry is detected and
   * resolved to the ORIGINAL job instead of creating a duplicate: a token guard item
   * (BulkInviteJobTokenEntity) is created in the same transaction as the job, conditioned on that
   * token's SK not already existing. If the transaction is canceled because the token already
   * exists, the guard item is fetched to recover and return the original job unchanged — a
   * semantically equivalent response with no side effects, per the Idempotency standard. Mirrors
   * {@link LapDao.createNextLap}'s token-guard pattern.
   */
  @logMethod
  async createJob(params: {
    adminProfileId: ResourceId;
    totalEntries: number;
    clientToken?: string;
  }): Promise<BulkInviteJobItem> {
    const { adminProfileId, totalEntries, clientToken } = params;

    if (clientToken === undefined) {
      return this.create({
        adminProfileId,
        totalEntries,
        status: BulkInviteJobStatus.PROCESSING,
        [DynamoDBItemAttribute.TTL]: Math.floor(Date.now() / 1000) + JOB_TTL_SECONDS,
      });
    }

    const bulkInviteJobId = generateUlid() as ResourceId;

    const transaction = this.service.transaction.write(({ bulkInviteJobs, bulkInviteJobTokens }) => [
      bulkInviteJobs
        .create({
          adminProfileId,
          bulkInviteJobId,
          totalEntries,
          status: BulkInviteJobStatus.PROCESSING,
          [DynamoDBItemAttribute.TTL]: Math.floor(Date.now() / 1000) + JOB_TTL_SECONDS,
        })
        .commit(),
      // Idempotency guard. ElectroDB `create` adds an attribute_not_exists condition on the
      // token SK, so a replayed request cancels the whole transaction (the job above is never
      // persisted) rather than creating a second job.
      bulkInviteJobTokens
        .create({
          adminProfileId,
          clientToken,
          bulkInviteJobId,
          [DynamoDBItemAttribute.TTL]: Math.floor(Date.now() / 1000) + BULK_INVITE_JOB_TOKEN_TTL_SECONDS,
        })
        .commit(),
    ]);

    const transactionResult = await transaction.go();

    if (!transactionResult.canceled) {
      const jobPutParams = (transaction.params().TransactItems[0] as { Put: { [param: string]: unknown } }).Put;
      return this.entity.parse(jobPutParams).data as BulkInviteJobItem;
    }

    // A canceled transaction isn't necessarily a replayed clientToken — it can also be a
    // TransactionConflictException, throttling, or (in principle) a conditional failure on the
    // job item itself. Only the token-guard item (transact item index 1) failing its
    // attribute_not_exists condition actually means "this token was already used"; anything else
    // is an unrelated/transient failure that should surface as such rather than being silently
    // reinterpreted as an idempotent replay.
    const tokenGuardResult = transactionResult.data?.[BULK_INVITE_JOB_TOKEN_TRANSACT_ITEM_INDEX];
    if (tokenGuardResult?.code !== 'ConditionalCheckFailed') {
      logger.error('Bulk invite job creation transaction canceled for a reason other than a replayed token', {
        action: 'BULK_INVITE_TRANSACTION_CANCELED',
        adminProfileId,
        transactionResult,
      });
      throw new InternalFailureError({ message: 'Failed to create the bulk invite. Please try again.' });
    }

    logger.info('Bulk invite job creation canceled — replayed clientToken detected, resolving original job', {
      action: 'BULK_INVITE_IDEMPOTENT_REPLAY',
      adminProfileId,
    });
    const guard = await this.getTokenGuard({ adminProfileId, clientToken });
    if (guard) {
      const existing = await this.getById({ adminProfileId, bulkInviteJobId: guard.bulkInviteJobId });
      if (existing) {
        return existing;
      }
    }
    // The guard existed but its job could not be found (should not normally happen) — surface a
    // conflict rather than silently creating an ambiguous duplicate.
    throw new ConflictError({ message: 'A bulk invite with this idempotency token is already being processed.' });
  }

  /** Fetch the idempotency-token guard item for a given token, if any. */
  @logMethod
  getTokenGuard(params: { adminProfileId: ResourceId; clientToken: string }) {
    return this.service.entities.bulkInviteJobTokens
      .get({ adminProfileId: params.adminProfileId, clientToken: params.clientToken })
      .go()
      .then(({ data }) => data);
  }

  /** Fetch a job by composite key (single GetItem). Returns null if absent. */
  @logMethod
  getById(params: { adminProfileId: ResourceId; bulkInviteJobId: ResourceId }): Promise<BulkInviteJobItem | null> {
    return this.get({ adminProfileId: params.adminProfileId, bulkInviteJobId: params.bulkInviteJobId });
  }

  /**
   * Append one entry's outcome and bump the counters atomically (list_append + ADD), guarded by
   * a conditional so a retried write (SDK network retry after a lost response) cannot
   * double-append or double-count. `entryIndex` is the entry's 0-based position: the append is
   * only applied while `size(results) < entryIndex + 1`, so a replay whose result is already
   * recorded is rejected by DynamoDB and silently treated as a no-op (idempotent).
   */
  @logMethod
  async appendEntryResult(params: {
    adminProfileId: ResourceId;
    bulkInviteJobId: ResourceId;
    entryIndex: number;
    result: BulkInviteEntryResult;
  }): Promise<void> {
    const { adminProfileId, bulkInviteJobId, entryIndex, result } = params;
    const countAttribute = COUNT_ATTRIBUTE_BY_STATUS[result.status];
    try {
      await this.entity
        .patch({ adminProfileId, bulkInviteJobId })
        .append({ [DynamoDBItemAttribute.RESULTS]: [result] })
        .add({ [DynamoDBItemAttribute.PROCESSED_COUNT]: 1, [countAttribute]: 1 })
        .where((attr, op) => `${op.size(attr.results)} < ${op.value(attr.processedCount, entryIndex + 1)}`)
        .go();
    } catch (error) {
      // Conditional failure ⇒ this entry's result was already recorded by a prior (successful)
      // attempt whose response was lost. Idempotent no-op.
      if (isConditionalCheckFailure(error)) {
        return;
      }
      throw error;
    }
  }

  /** Move the job to a terminal state (COMPLETED / FAILED), stamping completedAt (+ errorMessage). */
  @logMethod
  markTerminal(params: {
    adminProfileId: ResourceId;
    bulkInviteJobId: ResourceId;
    status: BulkInviteJobStatus;
    errorMessage?: string;
  }): Promise<BulkInviteJobItem> {
    const { adminProfileId, bulkInviteJobId, status, errorMessage } = params;
    return this.partialUpdate(
      { adminProfileId, bulkInviteJobId },
      {
        [DynamoDBItemAttribute.STATUS]: status,
        [DynamoDBItemAttribute.COMPLETED_AT]: new Date().toISOString(),
        ...(errorMessage === undefined ? {} : { [DynamoDBItemAttribute.ERROR_MESSAGE]: errorMessage }),
      },
    );
  }

  /**
   * True if the admin has a bulk invite job still PROCESSING and updated within the staleness
   * horizon. A PROCESSING job that has not been touched for {@link ACTIVE_JOB_STALE_MS} is
   * treated as inactive (escape hatch), so a stuck record cannot permanently block new imports.
   */
  @logMethod
  async hasActiveJob(adminProfileId: ResourceId): Promise<boolean> {
    // The admin's job partition is small (one import at a time), so read it and evaluate the
    // active-and-fresh predicate in code — avoids a filter expression and keeps the staleness
    // escape hatch in one place.
    const { data } = await this.entity.query.byAdminProfileId({ adminProfileId }).go({ pages: 'all' });
    const now = Date.now();
    const processing = data.filter((job) => job.status === BulkInviteJobStatus.PROCESSING);
    const stale = processing.filter((job) => now - Date.parse(job.createdAt) >= ACTIVE_JOB_STALE_MS);

    // Transition stale PROCESSING records to EXPIRED so the persisted state matches what the GET
    // status handler derives at read time and they no longer block new jobs. Best-effort
    // and non-fatal — a failed transition simply means the record stays PROCESSING and is treated
    // as stale (inactive) again on the next check.
    await Promise.all(
      stale.map((job) =>
        this.markTerminal({
          adminProfileId,
          bulkInviteJobId: job.bulkInviteJobId,
          status: BulkInviteJobStatus.EXPIRED,
          errorMessage: 'Job expired after exceeding the 30-minute staleness horizon.',
        }).catch(() => undefined),
      ),
    );

    // Only a fresh (non-stale) PROCESSING job counts as active.
    return processing.length > stale.length;
  }

  /**
   * The requesting admin's recent jobs, most recent first (by createdAt). Backs the frontend's
   * active-job-detection fallback. The admin's job partition is small (one active import at
   * a time), so read it all and sort/cap in code — no secondary index or filter expression needed.
   */
  @logMethod
  async listRecentByAdmin(adminProfileId: ResourceId, limit = 20): Promise<BulkInviteJobItem[]> {
    const { data } = await this.entity.query.byAdminProfileId({ adminProfileId }).go({ pages: 'all' });
    return [...data].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, limit);
  }
}

/**
 * ElectroDB surfaces a ConditionalCheckFailedException (or a `conditional request failed`
 * message) when the append guard rejects a replayed write.
 */
function isConditionalCheckFailure(error: unknown): boolean {
  const err = error as { name?: string; message?: string; cause?: { name?: string } };
  return (
    err?.name === 'ConditionalCheckFailedException' ||
    err?.cause?.name === 'ConditionalCheckFailedException' ||
    (err?.message?.includes('conditional request failed') ?? false)
  );
}

export const bulkInviteJobDao = new BulkInviteJobDao(BulkInviteJobEntity, BulkInviteJobTokenEntity);
