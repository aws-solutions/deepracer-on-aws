// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';
import { boolean, object } from 'yup';

import ToggleField from './ToggleField';
import { withReactHookForm } from '../../../../.storybook/decorators/withReactHookForm';

const fieldName = 'toggle';

const schema = object({
  [fieldName]: boolean().required(),
});

const meta = {
  component: ToggleField,
  title: 'ToggleField',
  decorators: [withReactHookForm],
  parameters: {
    reactHookForm: {
      schema,
      defaultValues: {
        [fieldName]: false,
      },
    },
  },
} satisfies Meta<typeof ToggleField>;

export default meta;

type Story = StoryObj<typeof ToggleField>;

export const Default: Story = {
  args: {
    name: fieldName,
    label: 'Toggle form field',
    children: 'Toggle value label',
  },
};
