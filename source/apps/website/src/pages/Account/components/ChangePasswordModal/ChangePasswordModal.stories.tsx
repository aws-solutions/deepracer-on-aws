// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import ChangePasswordModal from '#pages/Account/components/ChangePasswordModal';

const meta = {
  component: ChangePasswordModal,
  title: 'pages/Account/ChangePasswordModal',
} satisfies Meta<typeof ChangePasswordModal>;

export default meta;

type Story = StoryObj<typeof ChangePasswordModal>;

export const Default: Story = {
  args: {
    isOpen: true,
    setIsOpen: undefined,
  },
};
