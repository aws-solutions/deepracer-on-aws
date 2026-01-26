// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { initialize, mswLoader, MswParameters } from 'msw-storybook-addon';

declare module '@storybook/react' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface Parameters extends MswParameters {}
}

initialize({ onUnhandledRequest: 'bypass', quiet: true });

export { mswLoader };
