// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * For typing Object.entries when typed return value is needed
 */
export type Entries<T> = [keyof T, T[keyof T]][];
