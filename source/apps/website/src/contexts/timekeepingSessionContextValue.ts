// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { SelectProps } from '@cloudscape-design/components/select';
import type { Lap, Run } from '@deepracer-indy/typescript-client';
import { createContext } from 'react';

export interface TimekeepingRunSetup {
  selectedRacer: SelectProps.Option;
  racedByProxy: boolean;
}

export interface TimekeepingSessionActionsValue {
  registerActiveRun: (run: Run | undefined, setup?: TimekeepingRunSetup) => void;
  registerCreatedRun: (run: Run, setup: TimekeepingRunSetup) => void;
  addOptimisticLap: (lap: Lap) => void;
  removeOptimisticLap: (lap: Lap) => void;
  clearSession: () => void;
}

export interface TimekeepingRunValue {
  activeRun: Run | undefined;
  runSetup: TimekeepingRunSetup | undefined;
}

export interface TimekeepingLapsValue {
  laps: Lap[];
  isHydrating: boolean;
}

export const TimekeepingSessionActionsContext = createContext<TimekeepingSessionActionsValue | undefined>(undefined);
export const TimekeepingRunContext = createContext<TimekeepingRunValue | undefined>(undefined);
export const TimekeepingLapsContext = createContext<TimekeepingLapsValue | undefined>(undefined);
