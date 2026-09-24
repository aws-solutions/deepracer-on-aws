// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CollectionPreferencesProps } from '@cloudscape-design/components/collection-preferences';

export enum DevicesTableColumn {
  NAME = 'Name',
  TYPE = 'Type',
  STATUS = 'Status',
  FLEET = 'Fleet',
  LAST_SEEN = 'LastSeen',
  IP_ADDRESS = 'IpAddress',
}

export const PAGE_SIZE_OPTIONS = [10, 25, 50];
export const DEFAULT_PAGE_SIZE = 10;

export const DEFAULT_COLUMN_DISPLAY: CollectionPreferencesProps.ContentDisplayItem[] = [
  { id: DevicesTableColumn.NAME, visible: true },
  { id: DevicesTableColumn.TYPE, visible: true },
  { id: DevicesTableColumn.STATUS, visible: true },
  { id: DevicesTableColumn.FLEET, visible: true },
  { id: DevicesTableColumn.LAST_SEEN, visible: true },
  { id: DevicesTableColumn.IP_ADDRESS, visible: true },
];
