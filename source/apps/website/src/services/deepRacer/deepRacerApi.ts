// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BadRequestError,
  DeepRacerIndyClientResolvedConfig,
  DeepRacerIndyPaginationConfiguration,
  InternalFailureError,
  NotAuthorizedError,
  NotFoundError,
  ServiceInputTypes,
  ServiceOutputTypes,
  ValidationException,
} from '@deepracer-indy/typescript-client';
import { ThunkDispatch } from '@reduxjs/toolkit';
import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import type { Command, Paginator } from '@smithy/types';

import { DeepRacerApiQueryTagType } from './constants.js';
import { deepRacerClient } from './deepRacerClient.js';
import { displayErrorNotification } from '../../store/notifications/notificationsSlice.js';

/**
 * Sanitizes error messages to avoid exposing sensitive internal details to users
 */
export const sanitizeErrorMessage = (error: unknown): string => {
  // Use the following pattern to detect uncaught promise rejections containing not authorized responses
  const strError = String(error);
  if (strError.includes('execute-api:Invoke') && strError.includes('not authorized to perform')) {
    return "You don't have permission to perform this action";
  }
  return (error as { message?: string }).message || 'An error occurred';
};

export const baseQuery: BaseQueryFn<{
  command: Command<ServiceInputTypes, any, ServiceOutputTypes, any, DeepRacerIndyClientResolvedConfig>;
  displayNotificationOnError?: boolean;
}> = async ({ command, displayNotificationOnError = true }, { dispatch }) => {
  try {
    const response = await deepRacerClient.send(command);
    return { data: response };
  } catch (e) {
    const error = e as DeepRacerServiceException;

    if (displayNotificationOnError) {
      const sanitizedMessage = sanitizeErrorMessage(error);
      dispatch(displayErrorNotification({ content: sanitizedMessage, id: error.message }));
    }

    return { error: error.message, fault: error.$fault, metadata: error.$metadata, name: error.name };
  }
};

export const paginatedQuery = async <
  Input,
  Output,
  OutputType extends OutputPath extends string ? Output[OutputPath] : Output,
  OutputPath extends keyof Output | undefined = undefined,
>(
  input: Input,
  paginator: (config: DeepRacerIndyPaginationConfiguration, input: Input) => Paginator<Output>,
  dispatch: ThunkDispatch<any, any, any>,
  outputPath?: OutputPath,
) => {
  try {
    const results = [];
    for await (const page of paginator({ client: deepRacerClient }, { ...input })) {
      if (outputPath) {
        const newResults = Array.isArray(page[outputPath]) ? page[outputPath] : [page[outputPath]];
        results.push(...newResults);
      } else {
        results.push(page);
      }
    }
    return { data: results as OutputType };
  } catch (e) {
    const error = e as DeepRacerServiceException;

    const sanitizedMessage = sanitizeErrorMessage(error);
    dispatch(displayErrorNotification({ content: sanitizedMessage, id: error.message }));

    return { error: error.message, fault: error.$fault, metadata: error.$metadata, name: error.name };
  }
};

export const deepRacerApi = createApi({
  baseQuery,
  tagTypes: Object.values(DeepRacerApiQueryTagType),
  endpoints: () => ({}),
});

export type DeepRacerServiceException =
  | BadRequestError
  | InternalFailureError
  | NotAuthorizedError
  | NotFoundError
  | ValidationException;
