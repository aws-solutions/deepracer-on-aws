// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * This config value represents the maximum number of concurrent BatchWrite requests.
 *
 * DynamoDB BatchWrite has a maximum 25 records per request.
 *
 * 10 concurrent BatchWrite requests is equivalent to 250 (10 * 25) records concurrently.
 * */
export const ELECTRO_DB_MAX_CONCURRENCY = 10;
