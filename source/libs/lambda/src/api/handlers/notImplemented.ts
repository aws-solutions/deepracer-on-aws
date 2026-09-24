// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Placeholder handler for operations whose API contract is defined in the Smithy model
 * but whose implementation lands in a later CR.
 *
 * The API construct requires an existing entry file for every service operation (each is
 * bundled by a NodejsFunction at synth time), so newly-modeled operations point here
 * until their real handler is added. Returns 501.
 */
export const lambdaHandler = (): Promise<{ statusCode: number; body: string }> =>
  Promise.resolve({
    statusCode: 501,
    body: JSON.stringify({ message: 'Not implemented' }),
  });
