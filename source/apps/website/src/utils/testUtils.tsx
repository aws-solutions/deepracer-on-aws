// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
/* eslint-disable import/export */

import {
  renderHook as rtlRenderHook,
  RenderHookOptions,
  RenderOptions,
  render as rtlRender,
} from '@testing-library/react';
import { mockClient } from 'aws-sdk-client-mock';
import { Provider } from 'react-redux';
import { MemoryRouter, MemoryRouterProps, Route, Routes } from 'react-router-dom';

import { deepRacerClient } from '../services/deepRacer/deepRacerClient.js';
import { getStore, RootState } from '../store/index.js';

interface ExtendedRenderOptions extends Omit<RenderOptions, 'queries'> {
  componentRoute?: string;
  initialState?: Partial<RootState>;
  initialRouteEntries?: MemoryRouterProps['initialEntries'];
  /**
   * Whether the component to be rendered is a Storybook story.
   *
   * Set to `true` for Storybook stories to avoid wrapping in duplicate providers.
   */
  isStorybookStory?: boolean;
}

interface ExtendedRenderHookOptions extends RenderHookOptions<any> {
  componentRoute?: string;
  initialState?: Partial<RootState>;
  initialRouteEntries?: MemoryRouterProps['initialEntries'];
}

interface TestWrapperProps {
  children: React.ReactNode;
  componentRoute?: string;
  initialState?: Partial<RootState>;
  initialRouteEntries?: MemoryRouterProps['initialEntries'];
}

const TestWrapper = ({
  children,
  componentRoute = '/',
  initialState,
  initialRouteEntries = [componentRoute],
}: TestWrapperProps) => (
  <Provider store={getStore(initialState)}>
    <MemoryRouter initialEntries={initialRouteEntries}>
      <Routes>
        <Route path={componentRoute} element={children} />
      </Routes>
    </MemoryRouter>
  </Provider>
);

const renderHook = <Result, Props>(
  render: (initialProps: Props) => Result,
  { componentRoute, initialRouteEntries, initialState, ...options }: ExtendedRenderHookOptions = {},
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestWrapper
      children={children}
      componentRoute={componentRoute}
      initialRouteEntries={initialRouteEntries}
      initialState={initialState}
    />
  );

  return rtlRenderHook(render, { ...options, wrapper: Wrapper });
};

const render = (
  ui: React.ReactElement,
  {
    componentRoute,
    initialState,
    initialRouteEntries,
    isStorybookStory = false,
    ...renderOptions
  }: ExtendedRenderOptions = {},
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestWrapper
      children={children}
      componentRoute={componentRoute}
      initialRouteEntries={initialRouteEntries}
      initialState={initialState}
    />
  );

  return rtlRender(ui, { wrapper: isStorybookStory ? undefined : Wrapper, ...renderOptions });
};

export const mockDeepRacerClient = mockClient(deepRacerClient);

export * from '@testing-library/react';
export { render, renderHook };
