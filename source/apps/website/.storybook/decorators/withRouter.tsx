// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Decorator } from '@storybook/react';
import { MemoryRouter, Routes, Route, MemoryRouterProps } from 'react-router-dom';

declare module '@storybook/react' {
  export interface Parameters {
    routing?: {
      initialRouteEntries?: MemoryRouterProps['initialEntries'];
      componentRoute?: string;
    };
  }
}

export const withRouter: Decorator = (Story, { parameters }) => {
  const componentRoute = parameters.routing?.componentRoute || '/';

  return (
    <MemoryRouter initialEntries={parameters.routing?.initialRouteEntries || [componentRoute]}>
      <Routes>
        <Route path={componentRoute} element={<Story />} />
      </Routes>
    </MemoryRouter>
  );
};
