// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Decorator } from '@storybook/react';
import { Provider } from 'react-redux';

import { getStore, RootState } from '../../src/store/index.js';

declare module '@storybook/react' {
  export interface Parameters {
    store?: {
      initialState?: Partial<RootState>;
    };
  }
}

export const withStore: Decorator = (Story, context) => {
  const store = getStore(context.parameters.store?.initialState);

  return (
    <Provider store={store}>
      <Story />
    </Provider>
  );
};
