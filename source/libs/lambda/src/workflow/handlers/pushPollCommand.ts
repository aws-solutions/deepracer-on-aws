// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetCommandInvocationCommand } from '@aws-sdk/client-ssm';
import { logger } from '@deepracer-indy/utils';

import type { PushSendCommandOutput } from './pushSendCommand.js';
import { ssmClient } from '../../utils/clients/ssmClient.js';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

export interface PushPollCommandOutput extends PushSendCommandOutput {
  commandStatus: string;
  commandError?: string;
  pollCount: number;
}

/**
 * Poll SSM GetCommandInvocation for terminal status.
 * Called in a Wait+Loop by the Step Function until commandStatus is terminal.
 */
const handler = async (input: PushSendCommandOutput & { pollCount?: number }): Promise<PushPollCommandOutput> => {
  const { commandId, carInstanceId, deploymentId } = input;
  logger.info('Polling SSM command', { commandId, carInstanceId, deploymentId });

  const response = await ssmClient.send(
    new GetCommandInvocationCommand({
      CommandId: commandId,
      InstanceId: carInstanceId,
    }),
  );

  return {
    ...input,
    commandStatus: response.Status ?? 'Unknown',
    commandError: response.StandardErrorContent,
    pollCount: (input.pollCount ?? 0) + 1,
  };
};

export const lambdaHandler = instrumentHandler(handler);
