// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import 'i18next';
import type { DefaultNS, Resources } from '../i18n/index.js';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: DefaultNS;
    resources: Resources['en'];
    returnNull: true;
    returnObjects: true;
  }
}
