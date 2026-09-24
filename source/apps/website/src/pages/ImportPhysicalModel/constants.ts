// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ModelStatus } from '@deepracer-indy/typescript-client';

export const MAX_ARCHIVE_SIZE = 500 * 1024 * 1024; // 500 MB

export const TERMINAL_IMPORT_STATUSES: ModelStatus[] = [ModelStatus.READY, ModelStatus.ERROR];
