// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logger } from '@deepracer-indy/utils';
import type { PostAuthenticationTriggerHandler } from 'aws-lambda';

import { isFederatedUserName } from './common/constants';
import { ensureDefaultRacerGroupMembership } from './common/groupMembership.js';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

/**
 * PostAuthentication trigger — ensures every successfully authenticated FEDERATED user is a
 * member of the default racer group.
 *
 * PostConfirmation only fires for users who go through Cognito's native sign-up/confirm flow;
 * federated (SAML/SSO) users never hit that step, so without this trigger they would
 * authenticate successfully but never get assigned to dr-racers (and therefore never pick up
 * the racer IAM role via the Identity Pool role mapping). PostAuthentication fires on EVERY
 * successful authentication, for every user — unlike PostConfirmation, which only runs once at
 * signup — so it's scoped to federated usernames only (isFederatedUserName) rather than running
 * these Cognito Admin API calls on the hottest path in the app for every native sign-in too,
 * where they're unnecessary (PostConfirmation already handled it once at signup, and in-app role
 * changes go through updateGroupMembership, not a re-check on every login).
 *
 * Group assignment itself (idempotent, shared with PostConfirmation) lives in
 * ensureDefaultRacerGroupMembership — see that function for the membership-check rationale.
 *
 * Throwing from here fails the entire sign-in (Cognito treats any trigger error as an auth
 * denial) — group membership is therefore treated as best-effort: failures are logged but never
 * block the sign-in itself. NOTE: postAuthenticationErrorAlarm (userIdentity.ts) watches the
 * Lambda's built-in error count, which no longer increments now that this doesn't throw — that
 * alarm needs a log-based metric filter on this error log line to stay meaningful (tracked as a
 * follow-up).
 */
export const PostAuthentication: PostAuthenticationTriggerHandler = async (event) => {
  const { userPoolId, userName } = event;

  if (!isFederatedUserName(userName)) {
    return event;
  }

  try {
    await ensureDefaultRacerGroupMembership(userPoolId, userName);
  } catch (error) {
    logger.error('Failed to ensure user group membership', { error, userName });
  }

  return event;
};

export const lambdaHandler = instrumentHandler(PostAuthentication);
