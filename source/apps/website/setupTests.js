// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { setProjectAnnotations } from '@storybook/react';

import projectAnnotations from './.storybook/preview';

import '@testing-library/jest-dom/vitest';

// Polyfill global event listener methods for jsdom compatibility
// Required by @juggle/resize-observer which uses global.removeEventListener
global.addEventListener = window.addEventListener.bind(window);
global.removeEventListener = window.removeEventListener.bind(window);

setProjectAnnotations(projectAnnotations);
