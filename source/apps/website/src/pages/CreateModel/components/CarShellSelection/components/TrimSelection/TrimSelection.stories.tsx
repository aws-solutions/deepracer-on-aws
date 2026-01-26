// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarShell } from '@deepracer-indy/typescript-client';
import { yupResolver } from '@hookform/resolvers/yup';
import type { Meta, StoryObj } from '@storybook/react';
import { useForm } from 'react-hook-form';

import { initialFormValues } from '#pages/CreateModel/constants';
import { CreateModelFormValues } from '#pages/CreateModel/types';
import { createModelValidationSchema } from '#pages/CreateModel/validation';
import { renderHook } from '#utils/testUtils';

import TrimSelection from './TrimSelection';

const meta = {
  component: TrimSelection,
  title: 'pages/CreateModel/CarShellSelection/TrimSelection',
} satisfies Meta<typeof TrimSelection>;

export default meta;

type Story = StoryObj<typeof TrimSelection>;

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
      <TrimSelection
        control={defaultUseForm.current.control}
        selectedShell={CarShell.DEEPRACER}
        setValue={defaultUseForm.current.setValue}
      />
    );
  },
};
