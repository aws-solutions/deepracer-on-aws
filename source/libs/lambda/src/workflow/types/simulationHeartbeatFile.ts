// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { SimulationJobStatus } from '../constants/simulation.js';

export interface SimulationHeartbeatFile {
  jobStatus: SimulationJobStatus;
  message: string;
}
