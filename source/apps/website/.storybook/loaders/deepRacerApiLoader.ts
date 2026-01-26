// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Loader } from '@storybook/react';

import { mockDeepRacerClient } from '../../src/utils/testUtils.js';

declare module '@storybook/react' {
  export interface Parameters {
    deepRacerApiMocks?: (mockClient: typeof mockDeepRacerClient) => void;
  }
}

export const deepRacerApiLoader: Loader = (context) => {
  const {
    parameters: { deepRacerApiMocks },
  } = context;

  mockDeepRacerClient.reset();
  deepRacerApiMocks?.(mockDeepRacerClient);

  return {};
};
