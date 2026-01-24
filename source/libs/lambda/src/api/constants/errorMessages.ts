// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export enum ErrorMessage {
  INTERNAL_SERVICE_ERROR = 'The service ran into an error.',
  PRE_TRAINED_MODEL_NOT_FOUND = 'The pre-trained model was not found.',
  PRE_TRAINED_MODEL_NOT_READY = 'The pre-trained model is not ready.',
  CLONE_ACTION_SPACE_TYPE_MISMATCH = 'The action space is invalid: action space type must match the pre-trained model.',
  CLONE_DISCRETE_ACTION_SPACE_COUNT_MISMATCH = 'The action space is invalid: discrete action count must match the pre-trained model.',
  CLONE_SENSORS_MISMATCH = 'The sensors are invalid: sensors must match the pre-trained model.',
}
