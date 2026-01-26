// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { t } from 'i18next';

import {
  RESOURCE_DESCRIPTION_MAX_LENGTH,
  RESOURCE_DESCRIPTION_REGEX,
  RESOURCE_NAME_MAX_LENGTH,
  RESOURCE_NAME_REGEX,
} from '#constants/validation.js';
import { ImportModelFormValues } from '#pages/ImportModel/types';

export const validateInputs = (values: ImportModelFormValues): Record<string, { type: string; message: string }> => {
  const errors: Record<string, { type: string; message: string }> = {};

  // Model name
  if (!values.modelName || values.modelName === '') {
    errors.modelName = {
      type: 'required',
      message: t('importModel:validation.modelNameRequired'),
    };
  } else if (!RESOURCE_NAME_REGEX.test(values.modelName) || values.modelName.length >= RESOURCE_NAME_MAX_LENGTH) {
    errors.modelName = {
      type: 'required',
      message: t('importModel:validation.modelNameSpecialCharsAndLength'),
    };
  }

  // Model description
  if (
    values.modelDescription &&
    (!RESOURCE_DESCRIPTION_REGEX.test(values.modelDescription) ||
      values.modelDescription.length >= RESOURCE_DESCRIPTION_MAX_LENGTH)
  ) {
    errors.modelDescription = {
      type: 'required',
      message: t('importModel:validation.modelDescSpecialCharsAndLength'),
    };
  }

  return errors;
};
