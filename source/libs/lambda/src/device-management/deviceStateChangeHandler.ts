// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { MetricUnit } from '@aws-lambda-powertools/metrics';
import { GetCommandInvocationCommand, type GetCommandInvocationCommandOutput } from '@aws-sdk/client-ssm';
import { deviceDao } from '@deepracer-indy/database';
import { logger, metrics } from '@deepracer-indy/utils';
import type { EventBridgeHandler } from 'aws-lambda';

import { ssmClient } from '#utils/clients/ssmClient.js';

import { syncInstanceById } from './deviceSync.js';
import { instrumentHandler } from '../utils/instrumentation/instrumentHandler.js';

/** SSM instance registration / association change — used to flip a device to ONLINE fast. */
const CONFIG_CHANGE = 'EC2 Instance-Associated Configuration Change';
/** SSM RunCommand completion — carries the async result for restart/stop/color. */
const COMMAND_STATUS_CHANGE = 'EC2 Command Invocation Status-change Notification';

interface SsmStateChangeDetail {
  'instance-id'?: string;
  'command-id'?: string;
  status?: string;
}

/**
 * Emit SSMCommandCompletionLatency for a **successful** invocation only.
 */
const recordCommandLatency = (
  invocation: GetCommandInvocationCommandOutput,
  commandId: string,
  instanceId: string,
): void => {
  const { Status: status, ExecutionStartDateTime: startTime, ExecutionEndDateTime: endTime } = invocation;
  if (status !== 'Success' || !startTime || !endTime) {
    return;
  }
  const latencyMs = new Date(endTime).getTime() - new Date(startTime).getTime();
  if (!Number.isFinite(latencyMs) || latencyMs < 0) {
    return;
  }
  try {
    metrics.addMetric('SSMCommandCompletionLatency', MetricUnit.Milliseconds, latencyMs);
  } catch (metricError) {
    logger.warn('Failed to publish SSMCommandCompletionLatency metric', { commandId, instanceId, metricError });
  }
};

const handleConfigChange = async (detail: SsmStateChangeDetail): Promise<void> => {
  const instanceId = detail['instance-id'];
  if (!instanceId) {
    logger.warn('Configuration-change event missing instance-id', { detail });
    return;
  }
  await syncInstanceById(instanceId);
};

/**
 * Command completion → authoritative status via GetCommandInvocation, recorded on the device row.
 */
const handleCommandStatusChange = async (detail: SsmStateChangeDetail): Promise<void> => {
  const commandId = detail['command-id'];
  const instanceId = detail['instance-id'];
  if (!commandId || !instanceId) {
    logger.warn('Command status-change event missing command-id or instance-id', { detail });
    return;
  }

  let status = detail.status;
  try {
    const invocation = await ssmClient.send(
      new GetCommandInvocationCommand({ CommandId: commandId, InstanceId: instanceId }),
    );
    status = invocation.Status ?? status;
    recordCommandLatency(invocation, commandId, instanceId);
  } catch (error) {
    logger.warn('GetCommandInvocation failed; using event status', { commandId, instanceId, error });
  }

  try {
    await deviceDao.recordCommand({
      instanceId,
      lastCommandId: commandId,
      lastCommandStatus: status ?? 'Unknown',
      lastCommandAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn('Failed to record command result on device row', { commandId, instanceId, error });
  }
};

export const HandleDeviceStateChange: EventBridgeHandler<string, SsmStateChangeDetail, void> = async (event) => {
  const detailType = event['detail-type'];
  const detail = event.detail ?? {};

  if (detailType === CONFIG_CHANGE) {
    await handleConfigChange(detail);
    return;
  }
  if (detailType === COMMAND_STATUS_CHANGE) {
    await handleCommandStatusChange(detail);
    return;
  }

  logger.info('Ignoring unrelated SSM state-change event', { detailType });
};

export const lambdaHandler = instrumentHandler(HandleDeviceStateChange);
