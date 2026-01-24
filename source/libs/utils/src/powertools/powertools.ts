// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';

import { DeepRacerIndyLogFormatter } from './logFormatter.js';
import { MetricsLogger } from '../metrics/metricsLogger.js';

const logger = new Logger({ logFormatter: new DeepRacerIndyLogFormatter() });

const metricsLogger = new MetricsLogger(logger);

const metrics = new Metrics();

const tracer = new Tracer();
tracer.provider.setLogger(logger);

export { logger, metricsLogger, metrics, tracer };
