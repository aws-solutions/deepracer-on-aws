// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';

import {
  TimekeepingLapsContext,
  TimekeepingRunContext,
  TimekeepingSessionActionsContext,
  type TimekeepingLapsValue,
  type TimekeepingRunValue,
  type TimekeepingSessionActionsValue,
} from '#contexts/timekeepingSessionContextValue.js';

const requireContext = <T>(context: T | undefined, hookName: string): T => {
  if (!context) {
    throw new Error(`${hookName} must be used within TimekeepingSessionProvider`);
  }

  return context;
};

export const useTimekeepingSessionActions = (): TimekeepingSessionActionsValue =>
  requireContext(useContext(TimekeepingSessionActionsContext), 'useTimekeepingSessionActions');

export const useTimekeepingRun = (): TimekeepingRunValue =>
  requireContext(useContext(TimekeepingRunContext), 'useTimekeepingRun');

export const useTimekeepingLaps = (): TimekeepingLapsValue =>
  requireContext(useContext(TimekeepingLapsContext), 'useTimekeepingLaps');
