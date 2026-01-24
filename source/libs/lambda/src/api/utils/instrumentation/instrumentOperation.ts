// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Operation, ServiceException } from '@aws-smithy/server-common';
import { logger, tracer } from '@deepracer-indy/utils';

import type { HandlerContext } from '../../types/apiGatewayHandlerContext.js';

/**
 * Wraps API operations to add logging and (metrics TBD).
 */
export function instrumentOperation<I, O, C extends HandlerContext>(operation: Operation<I, O, C>): Operation<I, O, C> {
  return async (input, context) => {
    const { operationName, profileId } = context;
    tracer.putAnnotation('Operation', operationName);
    tracer.putAnnotation('ProfileId', profileId);
    tracer.putMetadata('Input', input, operationName);
    try {
      logger.info(`START ${operationName} operation`, { input });
      const output = await operation(input, context);
      tracer.putMetadata('Output', output, operationName);
      logger.info(`END ${operationName} operation`, { output });
      return output;
    } catch (e) {
      const error = e as Error | ServiceException;
      const exceptionType: 'client' | 'server' = e instanceof ServiceException ? e.$fault : 'server';
      tracer.addErrorAsMetadata(error);
      logger.error(`EXCEPTION ${operationName} operation`, {
        errorDetails: {
          exceptionType,
          error,
        },
      });
      throw e;
    }
  };
}
