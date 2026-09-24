// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import ChangeColorModal from './ChangeColorModal';

const meta = {
  component: ChangeColorModal,
  title: 'pages/DeviceDetail/ChangeColorModal',
} satisfies Meta<typeof ChangeColorModal>;

export default meta;

type Story = StoryObj<typeof ChangeColorModal>;

export const Default: Story = {
  args: {
    isVisible: true,
    isChanging: false,
    onChangeColor: () => console.log('onChangeColor'),
    onDismiss: () => console.log('onDismiss'),
  },
};

export const Changing: Story = {
  args: {
    ...Default.args,
    isChanging: true,
  },
};
