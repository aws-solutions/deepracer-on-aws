// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AgentAlgorithm } from '@deepracer-indy/typescript-client';
import { yupResolver } from '@hookform/resolvers/yup';
import type { Meta, StoryObj } from '@storybook/react';
import { useForm } from 'react-hook-form';

import ActionSpace from '#pages/CreateModel/components/ActionSpace';
import { initialFormValues } from '#pages/CreateModel/constants';
import { CreateModelFormValues } from '#pages/CreateModel/types';
import { createModelValidationSchema } from '#pages/CreateModel/validation';
import { renderHook } from '#utils/testUtils';

const meta = {
  component: ActionSpace,
  title: 'pages/CreateModel/ActionSpace',
} satisfies Meta<typeof ActionSpace>;

export default meta;

type Story = StoryObj<typeof ActionSpace>;

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
      <ActionSpace
        control={defaultUseForm.current.control}
        setValue={defaultUseForm.current.setValue}
        resetField={defaultUseForm.current.resetField}
      />
    );
  },
};

const { result: clonedContinousModelUseForm } = renderHook(() =>
  useForm<CreateModelFormValues>({
    mode: 'onTouched',
    defaultValues: {
      ...initialFormValues,
      preTrainedModelId: 'mock-pretrained-model-id',
    },
    resolver: yupResolver(createModelValidationSchema),
  }),
);

export const ClonedContinuousModel: Story = {
  render: () => {
    return (
      <ActionSpace
        control={clonedContinousModelUseForm.current.control}
        setValue={clonedContinousModelUseForm.current.setValue}
        resetField={clonedContinousModelUseForm.current.resetField}
      />
    );
  },
};

const { result: sacUseForm } = renderHook(() =>
  useForm<CreateModelFormValues>({
    mode: 'onTouched',
    defaultValues: {
      ...initialFormValues,
      metadata: { ...initialFormValues.metadata, agentAlgorithm: AgentAlgorithm.SAC },
    },
    resolver: yupResolver(createModelValidationSchema),
  }),
);

export const SacAgentAlgorithmModel: Story = {
  render: () => {
    return (
      <ActionSpace
        control={sacUseForm.current.control}
        setValue={sacUseForm.current.setValue}
        resetField={sacUseForm.current.resetField}
      />
    );
  },
};
