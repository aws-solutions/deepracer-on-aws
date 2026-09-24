// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { bulkInviteJobDao } from '@deepracer-indy/database';
import { BulkInviteEntryStatus } from '@deepracer-indy/typescript-server-client';
import { mockClient } from 'aws-sdk-client-mock';

import { lambdaHandler } from '../bulkInviteIteration.js';

const cognitoMock = mockClient(CognitoIdentityProviderClient);

const invoke = (overrides: Record<string, unknown> = {}) =>
  lambdaHandler(
    { jobId: 'job-1', adminProfileId: 'admin-1', entry: { index: 0, emailAddress: 'racer@example.com' }, ...overrides },
    {} as never,
    vi.fn() as never,
  );

describe('bulkInviteIteration', () => {
  let appendSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    cognitoMock.reset();
    process.env.USER_POOL_ID = 'us-east-1_testpool';
    appendSpy = vi.spyOn(bulkInviteJobDao, 'appendEntryResult').mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.USER_POOL_ID;
  });

  it('skips creation for an existing user but (idempotently) re-asserts the racer group', async () => {
    // Crash recovery: a user created by a prior attempt that died before AddToGroup must be
    // grouped on replay, not left ungrouped. AdminAddUserToGroup is a no-op if already a member.
    cognitoMock.on(ListUsersCommand).resolves({ Users: [{ Username: 'u1' }] });
    cognitoMock.on(AdminAddUserToGroupCommand).resolves({});

    const out = await invoke();

    expect(out).toMatchObject({ index: 0, status: BulkInviteEntryStatus.SKIPPED, reason: 'User already exists' });
    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(0);
    expect(cognitoMock.commandCalls(AdminAddUserToGroupCommand)).toHaveLength(1);
    expect(appendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        entryIndex: 0,
        result: expect.objectContaining({ status: BulkInviteEntryStatus.SKIPPED }),
      }),
    );
  });

  it('marks FAILED without deleting when an existing user cannot be assigned the group', async () => {
    // The account may have pre-existed for another reason — a group-add failure must NOT delete it.
    cognitoMock.on(ListUsersCommand).resolves({ Users: [{ Username: 'u1' }] });
    cognitoMock.on(AdminAddUserToGroupCommand).rejects(new Error('no group'));

    const out = await invoke();

    expect(out).toMatchObject({ status: BulkInviteEntryStatus.FAILED });
    expect((out as { reason: string }).reason).toContain('manual cleanup');
    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(0);
    expect(cognitoMock.commandCalls(AdminDeleteUserCommand)).toHaveLength(0);
  });

  it('resolves to FAILED (without throwing) when the existence check errors', async () => {
    cognitoMock.on(ListUsersCommand).rejects(new Error('throttled'));

    const out = await invoke();

    expect(out).toMatchObject({ index: 0, status: BulkInviteEntryStatus.FAILED });
    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(0);
    expect(appendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ result: expect.objectContaining({ status: BulkInviteEntryStatus.FAILED }) }),
    );
  });

  it('creates a new user, sends the invite, assigns the group → CREATED', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    cognitoMock.on(AdminCreateUserCommand).resolves({});
    cognitoMock.on(AdminAddUserToGroupCommand).resolves({});

    const out = await invoke();

    expect(out).toMatchObject({ status: BulkInviteEntryStatus.CREATED });
    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(1);
    expect(cognitoMock.commandCalls(AdminAddUserToGroupCommand)).toHaveLength(1);
    expect(cognitoMock.commandCalls(AdminDeleteUserCommand)).toHaveLength(0);
  });

  it('sanitizes displayName into custom:racerAlias so PreSignUp can use it as the profile alias', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    cognitoMock.on(AdminCreateUserCommand).resolves({});
    cognitoMock.on(AdminAddUserToGroupCommand).resolves({});

    await invoke({ entry: { index: 0, emailAddress: 'racer@example.com', displayName: 'Alice Smith' } });

    const call = cognitoMock.commandCalls(AdminCreateUserCommand)[0];
    expect(call.args[0].input.UserAttributes).toContainEqual({ Name: 'custom:racerAlias', Value: 'AliceSmith' });
  });

  it('omits custom:racerAlias when displayName is absent', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    cognitoMock.on(AdminCreateUserCommand).resolves({});
    cognitoMock.on(AdminAddUserToGroupCommand).resolves({});

    await invoke();

    const call = cognitoMock.commandCalls(AdminCreateUserCommand)[0];
    const attributeNames = call.args[0].input.UserAttributes?.map((attr) => attr.Name);
    expect(attributeNames).not.toContain('custom:racerAlias');
  });

  it('maps a Cognito email-quota error to a FAILED result with an SES hint', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    const quotaError = Object.assign(new Error('daily limit'), { name: 'LimitExceededException' });
    cognitoMock.on(AdminCreateUserCommand).rejects(quotaError);

    const out = await invoke();

    expect(out).toMatchObject({
      status: BulkInviteEntryStatus.FAILED,
      reason: 'Email delivery quota exceeded — configure SES',
    });
  });

  it('marks FAILED with a generic reason on a non-quota creation error', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    cognitoMock.on(AdminCreateUserCommand).rejects(new Error('boom'));

    const out = await invoke();
    expect(out).toMatchObject({ status: BulkInviteEntryStatus.FAILED, reason: 'Failed to create the account' });
  });

  it('treats a concurrent-create AliasExistsException as SKIPPED (idempotent group assignment, no rollback)', async () => {
    // The ListUsers pre-check + AdminCreateUser are not atomic; a concurrent execution can win the
    // race. Cognito's verified-email alias then rejects our create with AliasExistsException — the
    // entry must resolve to SKIPPED (ensuring the racing-created user is grouped), not FAILED, and
    // must NOT delete the other execution's user.
    cognitoMock
      .on(ListUsersCommand)
      .resolvesOnce({ Users: [] }) // pre-check: not found yet
      .resolves({ Users: [{ Username: 'u-racer' }] }); // post-exception lookup finds the racing user
    cognitoMock
      .on(AdminCreateUserCommand)
      .rejects(Object.assign(new Error('alias exists'), { name: 'AliasExistsException' }));
    cognitoMock.on(AdminAddUserToGroupCommand).resolves({});

    const out = await invoke();

    expect(out).toMatchObject({ index: 0, status: BulkInviteEntryStatus.SKIPPED, reason: 'User already exists' });
    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(1);
    expect(cognitoMock.commandCalls(AdminAddUserToGroupCommand)).toHaveLength(1);
    expect(cognitoMock.commandCalls(AdminDeleteUserCommand)).toHaveLength(0);
  });

  it('marks a concurrent-create AliasExistsException FAILED (retryable) when the racing user is not yet visible', async () => {
    // ListUsers is eventually consistent, so the racing-created user may not be visible yet — we
    // cannot verify/ensure its group membership. Report retryable FAILED, not a false SKIPPED, and
    // do not delete the other execution's user.
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] }); // racing user never becomes visible
    cognitoMock
      .on(AdminCreateUserCommand)
      .rejects(Object.assign(new Error('alias exists'), { name: 'AliasExistsException' }));

    const out = await invoke();

    expect(out).toMatchObject({
      status: BulkInviteEntryStatus.FAILED,
      reason: 'Concurrent creation in progress — re-import to complete',
    });
    expect(cognitoMock.commandCalls(AdminAddUserToGroupCommand)).toHaveLength(0);
    expect(cognitoMock.commandCalls(AdminDeleteUserCommand)).toHaveLength(0);
  });

  it('marks retryable FAILED (not orphaned) when the racing user is visible but our redundant group call fails', async () => {
    // AdminCreateUser throws UsernameExistsException for a duplicate verified-email alias (the
    // exception AdminCreateUser actually raises; AliasExistsException is confirm/verify-flow only).
    // The concurrent winner owns grouping, so a transient failure of our redundant group-ensure must
    // NOT raise the orphaned-user alarm or report manual cleanup — it is retryable FAILED.
    cognitoMock
      .on(ListUsersCommand)
      .resolvesOnce({ Users: [] }) // pre-check: not found yet
      .resolves({ Users: [{ Username: 'u-racer' }] }); // post-exception lookup finds the racing user
    cognitoMock
      .on(AdminCreateUserCommand)
      .rejects(Object.assign(new Error('username exists'), { name: 'UsernameExistsException' }));
    cognitoMock.on(AdminAddUserToGroupCommand).rejects(new Error('throttled'));

    const out = await invoke();

    expect(out).toMatchObject({
      status: BulkInviteEntryStatus.FAILED,
      reason: 'Concurrent creation in progress — re-import to complete',
    });
    // The exact retryable reason asserted above (not "…requires manual cleanup") confirms this is
    // NOT the orphaned-user path; and the winner's user is never rolled back.
    expect(cognitoMock.commandCalls(AdminDeleteUserCommand)).toHaveLength(0);
  });

  it('rolls back (deletes) the user and marks FAILED when group assignment fails', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    cognitoMock.on(AdminCreateUserCommand).resolves({});
    cognitoMock.on(AdminAddUserToGroupCommand).rejects(new Error('no group'));
    cognitoMock.on(AdminDeleteUserCommand).resolves({});

    const out = await invoke();

    expect(out).toMatchObject({ status: BulkInviteEntryStatus.FAILED, reason: 'Failed to assign the racer group' });
    expect(cognitoMock.commandCalls(AdminDeleteUserCommand)).toHaveLength(1);
  });

  it('reports an orphaned user when group assignment AND rollback both fail', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    cognitoMock.on(AdminCreateUserCommand).resolves({});
    cognitoMock.on(AdminAddUserToGroupCommand).rejects(new Error('no group'));
    cognitoMock.on(AdminDeleteUserCommand).rejects(new Error('delete failed'));

    const out = await invoke();

    expect(out).toMatchObject({ status: BulkInviteEntryStatus.FAILED });
    expect((out as { reason: string }).reason).toContain('manual cleanup');
  });

  it('throws on a missing USER_POOL_ID (state-machine-level config error)', async () => {
    delete process.env.USER_POOL_ID;
    await expect(invoke()).rejects.toThrow(/USER_POOL_ID/);
  });

  it('still returns the result when persisting to DynamoDB fails', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    cognitoMock.on(AdminCreateUserCommand).resolves({});
    cognitoMock.on(AdminAddUserToGroupCommand).resolves({});
    appendSpy.mockRejectedValue(new Error('DDB throttle'));

    const out = await invoke();
    expect(out).toMatchObject({ status: BulkInviteEntryStatus.CREATED });
  });
});
