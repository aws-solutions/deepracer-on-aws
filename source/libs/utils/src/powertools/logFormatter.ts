// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { LogFormatter, LogItem } from '@aws-lambda-powertools/logger';
import { UnformattedAttributes, LogAttributes } from '@aws-lambda-powertools/logger/types';

export class DeepRacerIndyLogFormatter extends LogFormatter {
  formatAttributes(
    logAttributes: UnformattedAttributes,
    {
      apiGatewayRequestId,
      apiGatewayExtendedRequestId,
      awsRequestId,
      operationName,
      profileId,
      ...additionalLogAttributes
    }: LogAttributes,
  ) {
    const attributes: LogAttributes = {
      level: logAttributes.logLevel,
      message: logAttributes.message,
      ...additionalLogAttributes,
      profileId,
      correlationIds: {
        apiGatewayRequestId,
        apiGatewayExtendedRequestId,
        awsRequestId: logAttributes.lambdaContext?.awsRequestId,
        xRayTraceId: logAttributes.xRayTraceId,
      },
      lambdaFunction: {
        name: logAttributes.lambdaContext?.functionName,
        arn: logAttributes.lambdaContext?.invokedFunctionArn,
        memoryLimitInMB: logAttributes.lambdaContext?.memoryLimitInMB,
        version: logAttributes.lambdaContext?.functionVersion,
        coldStart: logAttributes.lambdaContext?.coldStart,
      },
      operationName,
      service: logAttributes.serviceName,
      timestamp: this.formatTimestamp(logAttributes.timestamp),
    };

    return new LogItem({ attributes });
  }
}
