// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Max `execute-api` resource ARNs to place in a single `execute-api:Invoke` statement.
 *
 * An IAM managed policy is capped at 6144 bytes, and CDK cannot split one PolicyStatement across
 * policies — a lone statement whose rendered size exceeds the cap fails to deploy with
 * `Cannot exceed quota for PolicySize: 6144`. Chunking a large allowlist into several statements
 * lets CDK's role-policy overflow distribute them across the default policy and overflow managed
 * policies, each staying under the cap. 25 ARNs (~2.5 KB rendered) leaves comfortable headroom.
 */
export const EXECUTE_API_RESOURCES_PER_STATEMENT = 25;
