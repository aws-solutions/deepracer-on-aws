// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * An error whose message is safe and useful to show to the user who started the job. Anything
 * else thrown inside the workflow is reported with a generic message.
 */
export class CarLogJobError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CarLogJobError';
  }
}

export const GENERIC_JOB_FAILURE_MESSAGE = 'Processing of the car logs failed.';

/** Chooses the message to store on a failed job from a Step Functions error (`Error` and `Cause`). */
export function failureMessageFromCause(error?: { Error?: string; Cause?: string }): string {
  if (error?.Error !== 'CarLogJobError' || !error.Cause) {
    return GENERIC_JOB_FAILURE_MESSAGE;
  }
  try {
    const { errorMessage } = JSON.parse(error.Cause) as { errorMessage?: string };
    return errorMessage ? errorMessage.slice(0, 500) : GENERIC_JOB_FAILURE_MESSAGE;
  } catch {
    return GENERIC_JOB_FAILURE_MESSAGE;
  }
}
