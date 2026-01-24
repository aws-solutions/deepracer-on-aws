// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

declare const resourceIdSymbol: unique symbol;
/**
 * A string that represents a resource ID.
 *
 * This allows us to restrict inputs to strings given
 * this type where only resource IDs should be accepted.
 */
export type ResourceId = string & { [resourceIdSymbol]: never };
