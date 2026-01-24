// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DeepRacerIndyClient } from '@deepracer-indy/typescript-client';

import { httpSigningPlugin } from './middleware.js';
import { environmentConfig } from '../../utils/envUtils.js';

const deepRacerClient = new DeepRacerIndyClient({
  endpoint: environmentConfig.apiEndpointUrl,
});

deepRacerClient.middlewareStack.use(httpSigningPlugin);

export { deepRacerClient };
