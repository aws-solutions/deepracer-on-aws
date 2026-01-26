// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-interface */
import type { CustomMatcher } from 'aws-sdk-client-mock-vitest';
// eslint-disable-next-line import/no-extraneous-dependencies
import 'vitest';

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatcher<T> {}
  interface AsymmetricMatchersContaining extends CustomMatcher {}
}
