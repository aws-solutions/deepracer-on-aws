// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CollectionPreferencesProps } from '@cloudscape-design/components/collection-preferences';

export enum EventsTableColumn {
  NAME = 'Name',
  EVENT_TYPE = 'EventType',
  EVENT_DATE = 'EventDate',
  COUNTRY = 'Country',
  CREATED_AT = 'CreatedAt',
  CREATED_BY = 'CreatedBy',
  RACE_FORMAT = 'RaceFormat',
  RACE_TIME = 'RaceTime',
  MAXIMUM_RESETS = 'MaximumResets',
  STATUS = 'Status',
  SPONSOR = 'Sponsor',
}

export const PAGE_SIZE_OPTIONS = [10, 25, 50];
export const DEFAULT_PAGE_SIZE = 10;

export const DEFAULT_COLUMN_DISPLAY: CollectionPreferencesProps.ContentDisplayItem[] = [
  { id: EventsTableColumn.NAME, visible: true },
  { id: EventsTableColumn.STATUS, visible: true },
  { id: EventsTableColumn.EVENT_DATE, visible: true },
  { id: EventsTableColumn.EVENT_TYPE, visible: true },
  { id: EventsTableColumn.RACE_FORMAT, visible: false },
  { id: EventsTableColumn.RACE_TIME, visible: false },
  { id: EventsTableColumn.MAXIMUM_RESETS, visible: false },
  { id: EventsTableColumn.COUNTRY, visible: false },
  { id: EventsTableColumn.CREATED_AT, visible: true },
  { id: EventsTableColumn.CREATED_BY, visible: false },
  { id: EventsTableColumn.SPONSOR, visible: false },
];
