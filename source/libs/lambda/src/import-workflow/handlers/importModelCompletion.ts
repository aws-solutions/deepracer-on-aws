// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { modelDao, ResourceId } from '@deepracer-indy/database';
import { ModelStatus } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import type { Context, Handler } from 'aws-lambda';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

/**
 * Step Function validation data (only the fields we actually use)
 * @property {Object} parsedRewardValidation - Parsed reward function validation results
 * @property {Object} parsedModelValidation - Parsed model validation results
 * @property {Object} validationResult - Model validation response payload
 */
interface StepFunctionValidationData {
  parsedRewardValidation?: {
    validationErrors?: Array<{
      message?: string;
      type?: string;
    }>;
  };
  parsedModelValidation?: {
    validationBody?: string;
  };
  validationResult?: {
    Payload?: {
      statusCode?: number;
      body?: string;
    };
  };
}

/**
 * Request payload for import model completion handler
 * @property {ResourceId} modelId - Identifier for the model being imported
 * @property {ResourceId} profileId - Identifier for the user's profile
 * @property {StepFunctionValidationData} allValidationData - Validation data from Step Function workflow
 * @property {string} [Error] - Step Functions error message if any
 * @property {string} [Cause] - Step Functions error cause if any
 */
interface ImportCompletionRequest {
  modelId?: ResourceId;
  profileId?: ResourceId;
  allValidationData?: StepFunctionValidationData;
  Error?: string;
  Cause?: string;
}

/**
 * Handles completion of model import validation workflow
 *
 * Processes validation results from Step Functions and updates model status:
 * - Sets model to READY if all validations pass
 * - Sets model to ERROR if any validation fails
 *
 * @param event - Import completion request containing validation results
 * @param context - Lambda execution context
 * @returns Success indicator
 * @throws Error when validation fails or database operations fail
 */
export async function handler(event: ImportCompletionRequest, context: Context): Promise<{ success: boolean }> {
  logger.info(`Event: ${JSON.stringify(event)}`, { requestId: context.awsRequestId });
  const { profileId, modelId, Error: stepError } = event;
  let hasValidationErrors;
  try {
    if (!modelId) {
      throw new Error('Missing Model Identifier');
    }

    if (!profileId) {
      throw new Error('Missing Profile Identifier');
    }

    if (stepError) {
      logger.info(`Error occurred in Step Function Workflow: ${stepError}`);
      throw stepError;
    }

    const validationData = event.allValidationData;

    // Check reward function validation errors
    const hasRewardValidationErrors = (validationData?.parsedRewardValidation?.validationErrors?.length ?? 0) > 0;

    // Check model validation errors
    const modelValidationStatusCode = validationData?.validationResult?.Payload?.statusCode;
    const modelValidationBody = validationData?.parsedModelValidation?.validationBody;
    const hasModelValidationErrors =
      (modelValidationStatusCode !== undefined && modelValidationStatusCode !== 200) ||
      (modelValidationBody !== 'valid' && modelValidationBody !== undefined);

    hasValidationErrors = hasRewardValidationErrors || hasModelValidationErrors;

    logger.info('Validation check details', {
      modelId,
      profileId,
      hasStepError: !!stepError,
      hasRewardValidationErrors,
      hasModelValidationErrors,
      modelValidationStatusCode,
      modelValidationBody,
      requestId: context.awsRequestId,
    });

    // Handle business validation errors
    if (hasValidationErrors) {
      let importErrorMessage = 'Model validation failed';

      if (hasRewardValidationErrors) {
        const rewardError = validationData?.parsedRewardValidation?.validationErrors
          ?.map((error) => error.message)
          .filter((msg) => msg && typeof msg === 'string')
          .join(', ');
        if (rewardError) {
          importErrorMessage = `Reward Function Validation ${rewardError}`;
        }
      } else if (hasModelValidationErrors) {
        const modelValidationErrorBody = validationData?.validationResult?.Payload?.body;
        if (modelValidationErrorBody) {
          // Parse the JSON-encoded error message
          const errorBodyString = JSON.parse(modelValidationErrorBody);

          // Extract clean simapp_exception message
          if (typeof errorBodyString === 'string' && errorBodyString.includes('simapp_exception')) {
            // Extract using regex since it's Python dict format
            const messageMatch = errorBodyString.match(/'message':\s*'([^']+)'/);
            if (messageMatch?.[1]) {
              importErrorMessage += `: ${messageMatch[1]}`;
            }
          } else if (typeof errorBodyString === 'object' && errorBodyString.simapp_exception?.message) {
            importErrorMessage += `: ${errorBodyString.simapp_exception.message}`;
          }
        }
      }

      await modelDao.update(
        { modelId, profileId },
        {
          status: ModelStatus.ERROR,
          importErrorMessage,
        },
      );

      logger.info('Model status updated to ERROR', {
        modelId,
        profileId,
        importErrorMessage,
      });

      throw new Error(importErrorMessage);
    }

    await modelDao.update({ modelId, profileId }, { status: ModelStatus.READY });

    logger.info('Model validation completed successfully', {
      modelId,
      profileId,
      requestId: context.awsRequestId,
    });

    return { success: true };
  } catch (error) {
    // Handle unexpected errors - validation errors were already processed
    if (modelId && profileId) {
      if (!hasValidationErrors) {
        const genericErrorMessage = `Unexpected error occurred while importing a model. Please try again in few minutes or contact support if issue persists with Request ID: ${context.awsRequestId}`;
        await modelDao.update(
          { modelId, profileId },
          {
            status: ModelStatus.ERROR,
            importErrorMessage: genericErrorMessage,
          },
        );
      }
    }
    throw error;
  }
}
export const lambdaHandler: Handler<ImportCompletionRequest, { success: boolean }> = instrumentHandler(handler);
