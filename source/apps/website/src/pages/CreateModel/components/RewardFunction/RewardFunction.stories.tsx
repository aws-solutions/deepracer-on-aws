// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { yupResolver } from '@hookform/resolvers/yup';
import type { Meta, StoryObj } from '@storybook/react';
import { useForm } from 'react-hook-form';

import RewardFunction from '#pages/CreateModel/components/RewardFunction';
import { initialFormValues } from '#pages/CreateModel/constants';
import { CreateModelFormValues } from '#pages/CreateModel/types';
import { createModelValidationSchema } from '#pages/CreateModel/validation';
import { renderHook } from '#utils/testUtils';

const meta = {
  component: RewardFunction,
  title: 'pages/CreateModel/RewardFunction',
} satisfies Meta<typeof RewardFunction>;

export default meta;

type Story = StoryObj<typeof RewardFunction>;

const { result: useFormResult } = renderHook(() =>
  useForm<CreateModelFormValues>({
    mode: 'onTouched',
    defaultValues: initialFormValues,
    resolver: yupResolver(createModelValidationSchema),
  }),
);

export const Default: Story = {
  args: {
    control: useFormResult.current.control,
    setValue: useFormResult.current.setValue,
  },
};
