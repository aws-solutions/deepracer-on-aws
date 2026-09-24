# Runbook: Bulk Invite Operations (Epic 6)

Operational guide for the bulk racer-invitation feature. Covers the alarms, their meaning, and
step-by-step response actions.

## Architecture recap

`POST /profiles/bulkInvite` (BulkInviteUser trigger) validates the request, creates a
`BulkInviteJob` record (PROCESSING), and starts a **Standard** Step Functions execution. An inline
`Map` (`MaxConcurrency: 1`) invokes the **iteration** Lambda per entry; each iteration is idempotent
(existing-by-email → SKIPPED) and writes its own result to DynamoDB. On completion a **finalize**
Lambda marks the job COMPLETED; a Map-level `Catch` marks it FAILED. The frontend polls
`GET /profiles/bulkInvite/{jobId}`. **There is no DLQ** — recovery is the Catch block plus the
Standard workflow's execution history.

- State machine: `<namespace>-DeepRacerIndyBulkInviteWorkflow`
- Lambdas: `DeepRacerIndy-BulkInviteIterationFn`, `DeepRacerIndy-BulkInviteFinalizeFn`, and the
  `BulkInviteUser` / `GetBulkInviteUserJobStatus` / `ResendInvite` API handlers.
- Metrics namespace: `DeepRacerIndyBulkInvite` (`BulkInviteUsed`, `BulkInviteSize`,
  `BulkInviteUsersCreated`, `BulkInviteFailedEntries`, `BulkInviteOrphanedUser`).

## Alarms

### BulkInviteExecutionFailedAlarm
**Means:** one or more state-machine executions reached the FAILED state (SFN `ExecutionsFailed`).
Because per-entry failures never bubble up, this fires on state-machine-level errors (IAM,
malformed input, service outage) — the Catch should have marked the job FAILED.

**Respond:**
1. Open the state machine in the Step Functions console; find recent failed executions.
2. Inspect the failed execution's history for the failing state and error `Cause`.
3. If IAM: confirm the iteration role still has `cognito-idp:ListUsers`, `AdminCreateUser`,
   `AdminAddUserToGroup`, `AdminDeleteUser` and DynamoDB write on the table.
4. Confirm the affected job record shows FAILED with an `errorMessage`; if it is still PROCESSING,
   the finalize/Catch path failed — manually mark it terminal (see "Stuck PROCESSING job").
5. Re-run the import once the root cause is fixed; idempotent skip-existing makes re-import safe.

### BulkInviteExecutionDurationAlarm
**Means:** an execution ran longer than 5 minutes (expected ~60s for 200 entries at MaxConcurrency 1)
— the primary hung-job signal.

**Respond:**
1. Check for Cognito throttling on the iteration Lambda (retries/backoff in logs) — the SFN `Retry`
   (3×, backoff 2, 1s) plus MaxConcurrency 1 should keep throughput ~3 TPS.
2. Check the iteration Lambda for timeouts (15-min per-invocation cap) or downstream latency.
3. If the execution is truly stuck, stop it in the console; the Catch will mark the job FAILED. If
   the record remains PROCESSING, mark it terminal manually (below) so the admin is not locked out
   by the one-active-job rule (FR-8).

### BulkInviteOrphanedUserAlarm
**Means:** `BulkInviteOrphanedUser` ≥ 1 — a user was created but the Racer-group assignment failed
**and** the rollback delete also failed, leaving an orphaned, group-less (non-functional) Cognito
user (NFR-5).

**Respond:**
1. Search the iteration log group for `action = BULK_INVITE_ORPHANED_USER` to get the username.
2. In Cognito, either add the user to the `Racers` group (to make the account functional) or delete
   the user (they will be re-created/SKIPPED on the next import).
3. Confirm the entry is reported FAILED in the job results; the admin can safely re-import.

### BulkInviteHighFailureRateAlarm
**Means:** more than 50% of processed entries failed over 15 minutes (`BulkInviteFailedEntries` vs
`BulkInviteUsersCreated`).

**Respond:**
1. Check the iteration logs for the dominant failure reason (`action = BULK_INVITE_ENTRY_FAILED`).
2. **"Email delivery quota exceeded — configure SES"**: the deployment is on default Cognito email
   (50/day). Set the `EmailDeliveryMethod` deployment parameter to `SES` (with a verified
   `SesVerifiedEmail`) and redeploy. The trigger's pre-flight check should normally reject oversized
   batches before they start.
3. Group-assignment failures: check the `Racers` group exists and the iteration role permissions.

### BulkInviteFeatureHealthAlarm
**Means:** jobs were started (`BulkInviteUsed` > 0) but **zero** users were created
(`BulkInviteUsersCreated` < 1) **and** zero were skipped (`BulkInviteUsersSkipped` < 1) over the
window — the onboarding path is likely broken. (Skipped is included so a legitimate all-skipped
re-import, where every entry already exists, does not false-fire.)

**Respond:**
1. Treat as a feature-down signal. Check the iteration Lambda for a systemic error (bad IAM after a
   deploy, missing `USER_POOL_ID`, Cognito outage).
2. Cross-check `BulkInviteExecutionFailedAlarm` / `BulkInviteHighFailureRateAlarm` for the specific
   cause.
3. Once fixed, re-run a small import to confirm `BulkInviteUsersCreated` recovers.

## Common procedures

### Stuck PROCESSING job (admin locked out by FR-8)
A job stuck in PROCESSING blocks the admin from starting new imports. The `hasActiveJob` check has a
30-minute stale escape hatch, so a stale job auto-clears after 30 minutes. To clear sooner:
1. Confirm the execution is no longer running (Step Functions console).
2. Update the job record's `status` to `FAILED` (and set `completedAt`) via the table, keying on
   `profile_<adminProfileId>` / `bulkinvitejob_<jobId>`.

### Re-running a partially failed import
Re-importing the same file is safe: existing users are reported SKIPPED (idempotent, FR-4), so only
the previously-failed entries are retried.

## Notes
- No SQS DLQ exists for this feature by design (NFR-4). Do not look for one.
- `states:DescribeExecution` is intentionally not granted to any Lambda — the status endpoint reads
  DynamoDB, and execution history (which contains all imported emails) is console/operator-only.
