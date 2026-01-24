// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import Home from './index.js';

const storyMeta: Meta = {
  component: Home,
  title: 'pages/Home',
};

export default storyMeta;

export const HomePage: StoryObj<typeof Home> = {
  args: {},
};
