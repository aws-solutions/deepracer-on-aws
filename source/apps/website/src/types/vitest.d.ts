// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-interface */
import type { CustomMatcher } from 'aws-sdk-client-mock-vitest';

import 'vitest';
import '@testing-library/jest-dom/vitest';

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatcher<T> {}
  interface AsymmetricMatchersContaining extends CustomMatcher {}
}
