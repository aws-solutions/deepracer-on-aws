// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';
import { boolean, object } from 'yup';

import CheckboxField from './CheckboxField';
import { withReactHookForm } from '../../../../.storybook/decorators/withReactHookForm';

const fieldName = 'checkbox';

const schema = object({
  [fieldName]: boolean().required(),
});

const meta = {
  component: CheckboxField,
  title: 'CheckboxField',
  decorators: [withReactHookForm],
  parameters: {
    reactHookForm: {
      schema,
      defaultValues: {
        [fieldName]: false,
      },
    },
  },
} satisfies Meta<typeof CheckboxField>;

export default meta;

type Story = StoryObj<typeof CheckboxField>;

export const Default: Story = {
  args: {
    name: fieldName,
    label: 'Checkbox form field',
    children: 'Checkbox value label',
  },
};
