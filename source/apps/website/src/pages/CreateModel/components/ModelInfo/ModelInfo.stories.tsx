// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetModelCommand } from '@deepracer-indy/typescript-client';
import { yupResolver } from '@hookform/resolvers/yup';
import type { Meta, StoryObj } from '@storybook/react';
import { useForm } from 'react-hook-form';

import { mockModel, mockModelCheckpoints } from '#constants/testConstants';
import { initialFormValues } from '#pages/CreateModel/constants';
import { CreateModelFormValues } from '#pages/CreateModel/types';
import { createModelValidationSchema } from '#pages/CreateModel/validation';
import { createCloneModelFormValues } from '#pages/Models/utils';
import { renderHook } from '#utils/testUtils';

import ModelInfo from './ModelInfo';

const meta = {
  component: ModelInfo,
  title: 'pages/CreateModel/ModelInfo',
} satisfies Meta<typeof ModelInfo>;

export default meta;

type Story = StoryObj<typeof ModelInfo>;

const { result: defaultUseForm } = renderHook(() =>
  useForm<CreateModelFormValues>({
    mode: 'onTouched',
    defaultValues: initialFormValues,
    resolver: yupResolver(createModelValidationSchema),
  }),
);

export const Default: Story = {
  render: () => {
    return (
      <ModelInfo
        control={defaultUseForm.current.control}
        setValue={defaultUseForm.current.setValue}
        resetField={defaultUseForm.current.resetField}
      />
    );
  },
};

const { result: cloneUseForm } = renderHook(() =>
  useForm<CreateModelFormValues>({
    mode: 'onTouched',
    defaultValues: createCloneModelFormValues(mockModel),
    resolver: yupResolver(createModelValidationSchema),
  }),
);

/** Cloning a model, which offers the source model's checkpoints to start from. */
export const Clone: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(GetModelCommand).resolves({ model: mockModel, checkpoints: mockModelCheckpoints });
    },
  },
  render: () => {
    return (
      <ModelInfo
        control={cloneUseForm.current.control}
        setValue={cloneUseForm.current.setValue}
        resetField={cloneUseForm.current.resetField}
      />
    );
  },
};
