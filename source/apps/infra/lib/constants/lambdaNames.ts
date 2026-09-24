// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Deterministic function name for the Model Optimizer Docker Lambda.
 *
 * Shared between the construct that creates the function and the root wiring
 * that grants the importModelDispatcher invoke permission.
 *
 * WARNING: This MUST remain a computed literal, not a CDK construct reference.
 * Using modelOptimizerFunction.functionArn (a CDK token) would create a
 * bidirectional CFN dependency between ApiStack and ModelManagementStack.
 */
export const getModelOptimizerFunctionName = (namespace: string): string =>
  `${namespace}-DeepRacerIndy-ModelOptimizerFn`;
