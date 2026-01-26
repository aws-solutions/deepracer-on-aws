// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import DeleteAccountModal from '#pages/Account/components/DeleteAccountModal';

const meta = {
  component: DeleteAccountModal,
  title: 'pages/Account/DeleteAccountModal',
} satisfies Meta<typeof DeleteAccountModal>;

export default meta;

type Story = StoryObj<typeof DeleteAccountModal>;

export const Default: Story = {
  args: {
    isOpen: true,
    setIsOpen: undefined,
  },
};
