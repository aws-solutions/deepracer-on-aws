// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import GetStarted from '#pages/GetStarted';

const meta: Meta = {
  component: GetStarted,
  title: 'pages/GetStarted',
};

export default meta;

export const Default: StoryObj<typeof GetStarted> = {
  args: {},
};
