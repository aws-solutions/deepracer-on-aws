// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logger } from '@deepracer-indy/utils';
import { ElectroEvent } from 'electrodb';

export const electroDBEventLogger = (event: ElectroEvent) => {
  logger.info(`ElectroDB ${event.method} event`, { event });
};
