// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCollection } from '@cloudscape-design/collection-hooks';
import { CollectionPreferencesProps } from '@cloudscape-design/components/collection-preferences';
import Link from '@cloudscape-design/components/link';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { TableProps } from '@cloudscape-design/components/table';
import { Event } from '@deepracer-indy/typescript-client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import TableEmptyState from '#components/TableEmptyState';
import { PageId } from '#constants/pages';
import { countryCodeToFlagEmoji } from '#utils/flagUtil.js';
import { getPath } from '#utils/pageUtils.js';

import { DEFAULT_COLUMN_DISPLAY, DEFAULT_PAGE_SIZE, EventsTableColumn } from './eventsTableConstants.js';
import { EVENT_STATUS_COLOR_OVERRIDE_MAP, EVENT_STATUS_TYPE_MAP } from '../../Events/eventStatusUtils.js';

export const useEventsTableConfig = (events: Event[]) => {
  const { t } = useTranslation('events');
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState<CollectionPreferencesProps.Preferences>({
    pageSize: DEFAULT_PAGE_SIZE,
    contentDisplay: DEFAULT_COLUMN_DISPLAY,
  });

  const columnDefinitions: TableProps.ColumnDefinition<Event>[] = useMemo(
    () => [
      {
        id: EventsTableColumn.NAME,
        header: t('list.columnHeaders.name'),
        cell: (item) => (
          <Link
            href={getPath(PageId.EVENT_DETAIL, { eventId: item.eventId })}
            onFollow={(event) => {
              event.preventDefault();
              navigate(getPath(PageId.EVENT_DETAIL, { eventId: item.eventId }));
            }}
          >
            {item.name}
          </Link>
        ),
        sortingField: 'name',
        isRowHeader: true,
      },
      {
        id: EventsTableColumn.STATUS,
        header: t('list.columnHeaders.eventStatus'),
        cell: (item) => (
          <StatusIndicator
            type={EVENT_STATUS_TYPE_MAP[item.eventStatus]}
            colorOverride={EVENT_STATUS_COLOR_OVERRIDE_MAP[item.eventStatus]}
          >
            {t(`status.${item.eventStatus}`)}
          </StatusIndicator>
        ),
        sortingField: 'eventStatus',
      },
      {
        id: EventsTableColumn.EVENT_DATE,
        header: t('list.columnHeaders.eventDate'),
        cell: (item) => item.eventDate,
        sortingField: 'eventDate',
      },
      {
        id: EventsTableColumn.EVENT_TYPE,
        header: t('list.columnHeaders.eventType'),
        cell: (item) => t(`eventType.${item.eventType}`),
        sortingField: 'eventType',
      },
      {
        id: EventsTableColumn.RACE_FORMAT,
        header: t('list.columnHeaders.raceFormat'),
        cell: (item) => t(`raceFormat.${item.raceFormat}`),
        sortingField: 'raceFormat',
      },
      {
        id: EventsTableColumn.RACE_TIME,
        header: t('list.columnHeaders.raceTime'),
        cell: (item) => `${item.maxTimeInMinutes} min`,
        sortingField: 'maxTimeInMinutes',
      },
      {
        id: EventsTableColumn.MAXIMUM_RESETS,
        header: t('list.columnHeaders.maximumResets'),
        cell: (item) => item.maxResets,
        sortingField: 'maxResets',
      },
      {
        id: EventsTableColumn.CREATED_AT,
        header: t('list.columnHeaders.createdAt'),
        cell: (item) => item.createdAt.toLocaleString(),
        sortingField: 'createdAt',
      },
      {
        id: EventsTableColumn.CREATED_BY,
        header: t('list.columnHeaders.createdBy'),
        cell: (item) => item.createdBy,
        sortingField: 'createdBy',
      },
      {
        id: EventsTableColumn.COUNTRY,
        header: t('list.columnHeaders.countryCode'),
        cell: (item) => `${item.countryCode} ${countryCodeToFlagEmoji(item.countryCode)}`,
        sortingField: 'countryCode',
      },
      {
        id: EventsTableColumn.SPONSOR,
        header: t('list.columnHeaders.sponsor'),
        cell: (item) => item.sponsor ?? '—',
        sortingField: 'sponsor',
      },
    ],
    [navigate, t],
  );

  const columnDisplay = preferences.contentDisplay;

  const { items, collectionProps, filterProps, paginationProps, filteredItemsCount } = useCollection(events, {
    filtering: {
      filteringFunction: (item, filteringText) => {
        const text = filteringText.toLowerCase();
        return [
          item.name,
          t(`status.${item.eventStatus}`),
          t(`eventType.${item.eventType}`),
          item.eventDate,
          item.countryCode,
          t(`raceFormat.${item.raceFormat}`),
          item.sponsor,
        ].some((value) => value?.toLowerCase().includes(text));
      },
    },
    pagination: { pageSize: preferences.pageSize },
    sorting: {},
    selection: {},
  });

  return {
    collectionProps,
    columnDefinitions,
    columnDisplay,
    items,
    preferencesProps: { preferences, onConfirm: setPreferences, columnDefinitions },
    paginationProps,
    selectedItems: collectionProps.selectedItems as Event[],
    filterProps,
    filteredItemsCount,
    emptyState: <TableEmptyState title={t('list.emptyTitle')} subtitle={t('list.emptySubtitle')} />,
  };
};
