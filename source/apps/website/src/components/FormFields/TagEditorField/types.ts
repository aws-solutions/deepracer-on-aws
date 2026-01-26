// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { TagEditorProps } from '@cloudscape-design/components/tag-editor';
import type { FieldPath, FieldValues } from 'react-hook-form';

import type { CommonFormFieldProps } from '#components/FormFields/types';

export interface TagEditorFieldProps<FormValues extends FieldValues, FieldName extends FieldPath<FormValues>>
  extends CommonFormFieldProps<FormValues, FieldName>,
    TagEditorProps {}
