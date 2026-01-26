// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { yupResolver } from '@hookform/resolvers/yup';
import type { Meta, StoryObj } from '@storybook/react';
import { useForm } from 'react-hook-form';

import { initialFormValues } from '#pages/CreateModel/constants';
import { CreateModelFormValues } from '#pages/CreateModel/types';
import { createModelValidationSchema } from '#pages/CreateModel/validation';
import { renderHook } from '#utils/testUtils';

import StopCondition from './StopCondition';

const meta = {
  component: StopCondition,
  title: 'pages/CreateModel/StopCondition',
} satisfies Meta<typeof StopCondition>;

export default meta;

type Story = StoryObj<typeof StopCondition>;

const { result: defaultUseForm } = renderHook(() =>
  useForm<CreateModelFormValues>({
    mode: 'onTouched',
    defaultValues: initialFormValues,
    resolver: yupResolver(createModelValidationSchema),
  }),
);

export const Default: Story = {
  render: () => {
    return <StopCondition control={defaultUseForm.current.control} />;
  },
};
