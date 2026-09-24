// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import CollectionPreferences, {
  CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences';
import { TableProps } from '@cloudscape-design/components/table';
import { Event } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

import { EventsTableColumn, PAGE_SIZE_OPTIONS } from './eventsTableConstants.js';

export interface EventsTablePreferencesProps {
  preferences: CollectionPreferencesProps.Preferences;
  onConfirm: (preferences: CollectionPreferencesProps.Preferences) => void;
  columnDefinitions: TableProps.ColumnDefinition<Event>[];
}

export const EventsTablePreferences = ({ preferences, onConfirm, columnDefinitions }: EventsTablePreferencesProps) => {
  const { t } = useTranslation('events');
  return (
    <CollectionPreferences
      title={t('list.preferences.title')}
      confirmLabel={t('list.preferences.confirmLabel')}
      cancelLabel={t('list.preferences.cancelLabel')}
      preferences={preferences}
      onConfirm={({ detail }) => onConfirm(detail)}
      pageSizePreference={{
        title: t('list.preferences.pageSizeTitle'),
        options: PAGE_SIZE_OPTIONS.map((size) => ({
          value: size,
          label: t('list.preferences.pageSizeOptions', { count: size }),
        })),
      }}
      contentDisplayPreference={{
        title: t('list.preferences.contentDisplayTitle'),
        description: t('list.preferences.contentDisplayDescription'),
        options: columnDefinitions.map((col) => ({
          id: col.id ?? '',
          label: typeof col.header === 'string' ? col.header : (col.id ?? ''),
          alwaysVisible: col.id === EventsTableColumn.NAME,
        })),
      }}
    />
  );
};
