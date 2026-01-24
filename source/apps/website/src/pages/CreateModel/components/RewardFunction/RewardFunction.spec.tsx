// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';
import { act, cleanup } from '@testing-library/react';
import { vi, afterEach, beforeAll } from 'vitest';

import i18n from '#i18n';
import { screen } from '#utils/testUtils';

import * as RewardFunctionStories from './RewardFunction.stories';

// Mock Ace Editor to prevent window access issues
vi.mock('ace-builds/src-noconflict/ace', () => ({
  edit: vi.fn(() => ({
    setTheme: vi.fn(),
    session: {
      setMode: vi.fn(),
      setValue: vi.fn(),
      on: vi.fn(),
    },
    setValue: vi.fn(),
    getValue: vi.fn(() => ''),
    on: vi.fn(),
    destroy: vi.fn(),
  })),
}));

// Mock window object comprehensively
beforeAll(() => {
  Object.defineProperty(window, 'location', {
    value: { href: 'http://localhost' },
    writable: true,
  });

  Object.defineProperty(window, 'getSelection', {
    value: () => null,
    writable: true,
  });

  // Mock document methods that React DOM might use
  Object.defineProperty(document, 'activeElement', {
    value: null,
    writable: true,
  });

  // Ensure window is available globally
  global.window = window;
  vi.stubGlobal('window', window);
});

const { Default } = composeStories(RewardFunctionStories);

describe('<RewardFunction />', () => {
  afterEach(async () => {
    // Clear any pending timers
    vi.clearAllTimers();
    // Ensure React cleanup is complete
    cleanup();
    // Wait for any pending async operations
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it.skip('renders without crashing', async () => {
    await act(async () => {
      await Default.run();
    });

    expect(await screen.findByText(i18n.t('createModel:testRewardFunction.rewardFunctionHeader'))).toBeInTheDocument();
    expect(await screen.findByText(i18n.t('createModel:stopCondition.title'))).toBeInTheDocument();
  });
});
