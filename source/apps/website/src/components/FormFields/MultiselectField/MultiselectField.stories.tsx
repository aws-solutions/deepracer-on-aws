// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';
import { object } from 'yup';

import MultiselectField from './MultiselectField';
import { withReactHookForm } from '../../../../.storybook/decorators/withReactHookForm';

const fieldName = 'mutliselect';

const schema = object({
  [fieldName]: object().required(),
});

const meta = {
  component: MultiselectField,
  title: 'MultiselectField',
  decorators: [withReactHookForm],
  parameters: {
    reactHookForm: {
      schema,
      defaultValues: {
        [fieldName]: {},
      },
    },
  },
} satisfies Meta<typeof MultiselectField>;

export default meta;

type Story = StoryObj<typeof MultiselectField>;

export const Default: Story = {
  args: {
    name: fieldName,
    label: 'M form field',
    options: [
      { value: '1', label: 'Option 1' },
      { value: '2', label: 'Option 2' },
      { value: '3', label: 'Option 3' },
    ],
  },
};
