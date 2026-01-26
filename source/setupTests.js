// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as awsSdkClientMockMatchers from 'aws-sdk-client-mock-vitest';
import { expect } from 'vitest';

expect.extend({ ...awsSdkClientMockMatchers });
