// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { withConsole } from '@storybook/addon-console';
import type { Preview } from '@storybook/react';

import { withRouter } from './decorators/withRouter';
import { withStore } from './decorators/withStore';
import { deepRacerApiLoader } from './loaders/deepRacerApiLoader';
import { mswLoader } from './loaders/mswLoader';

import '../src/i18n/index.js';
import '@cloudscape-design/global-styles/index.css';

const preview: Preview = {
  decorators: [withStore, withRouter, (storyFn, context) => withConsole()(storyFn)(context)],
  loaders: [deepRacerApiLoader, mswLoader],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
