// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SendCommandCommand } from '@aws-sdk/client-ssm';
import { logger } from '@deepracer-indy/utils';

import type { PushDeploymentContext } from './pushUpdateDeploymentStatus.js';
import { ssmClient } from '../../utils/clients/ssmClient.js';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

export interface PushSendCommandOutput extends PushDeploymentContext {
  commandId: string;
}

/**
 * Send SSM RunShellScript command to download and extract
 * model artifacts on the car.
 *
 * Target directory: /opt/aws/deepracer/artifacts/{modelName}/ (all car types, follows DREM pattern)
 * Includes md5sum checksum generation for car webserver verification.
 */
const handler = async (input: PushDeploymentContext): Promise<PushSendCommandOutput> => {
  const { deploymentId, modelId, carInstanceId, presignedUrl, carType } = input;
  const modelName = input.modelName ?? 'model';
  logger.info('Sending SSM command', { deploymentId, carInstanceId, carType });

  const artifactDir = '/opt/aws/deepracer/artifacts';
  // Include modelId suffix so same-named models from same/different racers get separate folders on the car.
  const sanitizedModelName = modelName.replace(/[^a-zA-Z0-9_-]/g, '') || 'model';
  const foldername = `${sanitizedModelName}-${modelId}`;

  const script = [
    '#!/bin/bash',
    'set -euo pipefail',
    `rm -rf ${artifactDir}/${foldername}/`,
    `mkdir -p ${artifactDir}/${foldername}/`,
    `curl -sSfL "${presignedUrl}" -o /tmp/${foldername}.tar.gz`,
    `tar -xzf /tmp/${foldername}.tar.gz -C ${artifactDir}/${foldername}/`,
    `rm -f /tmp/${foldername}.tar.gz`,
    `md5sum ${artifactDir}/${foldername}/model.pb | awk '{print $1}' > ${artifactDir}/${foldername}/checksum.txt`,
    'echo "Deployment complete"',
  ];

  const response = await ssmClient.send(
    new SendCommandCommand({
      DocumentName: 'AWS-RunShellScript',
      InstanceIds: [carInstanceId],
      TimeoutSeconds: 300,
      Parameters: { commands: script },
    }),
  );

  const commandId = response.Command?.CommandId;
  if (!commandId) {
    throw new Error('SSM SendCommand did not return a CommandId');
  }

  return { ...input, commandId };
};

export const lambdaHandler = instrumentHandler(handler);
