// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * True when an error is a DynamoDB conditional-check failure, surfaced either directly or wrapped
 * by ElectroDB.
 *
 * Callers use this to distinguish "another writer won the race" (an expected outcome for the
 * conditional status transitions used by the training-capacity flow) from a real failure.
 */
export function isConditionalCheckFailure(error: unknown): boolean {
  const err = error as { name?: string; message?: string; cause?: { name?: string } };
  return (
    err?.name === 'ConditionalCheckFailedException' ||
    err?.cause?.name === 'ConditionalCheckFailedException' ||
    (err?.message?.includes('conditional request failed') ?? false)
  );
}
