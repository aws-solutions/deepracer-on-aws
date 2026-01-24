// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export type * from './jobItem.js';
export type * from './jobName.js';
export type * from './resource.js';

/**
 * For typing Object.entries when typed return value is needed
 */
export type Entries<T> = [keyof T, T[keyof T]][];
