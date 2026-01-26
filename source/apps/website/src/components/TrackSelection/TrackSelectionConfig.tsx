// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCollection } from '@cloudscape-design/collection-hooks';
import { CardsProps } from '@cloudscape-design/components';
import Box from '@cloudscape-design/components/box';
import CollectionPreferences, {
  CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences';
import { TrackId } from '@deepracer-indy/typescript-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Track, TRACKS } from '#constants/tracks.js';

export const useTrackSelectionConfig = ({ track }: { track: TrackId }) => {
  const { t } = useTranslation('trackSelection');
  const pageSizeOptions: CollectionPreferencesProps.PageSizeOption[] = [
    { value: 3, label: t('collectionPreferences.pageSizeOptionsLabel', { count: 3 }) },
    { value: 6, label: t('collectionPreferences.pageSizeOptionsLabel', { count: 6 }) },
    { value: 9, label: t('collectionPreferences.pageSizeOptionsLabel', { count: 9 }) },
    { value: 15, label: t('collectionPreferences.pageSizeOptionsLabel', { count: 15 }) },
  ];
  const defaultPreferences: CollectionPreferencesProps.Preferences = {
    pageSize: 6,
    visibleContent: ['description', 'length', 'width', 'direction', 'image'],
  };

  const [preferences, setPreferences] = useState(defaultPreferences);

  const {
    items,
    collectionProps,
    paginationProps,
    filteredItemsCount,
    filterProps,
    actions: { setSorting },
  } = useCollection(TRACKS, {
    filtering: {
      empty: (
        <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
          <b>{t('notracks')}</b>
        </Box>
      ),
    },
    pagination: { pageSize: preferences.pageSize },
    sorting: {
      defaultState: {
        sortingColumn: {
          sortingField: 'difficulty',
        },
        isDescending: true,
      },
    },
    selection: {
      defaultSelectedItems: track ? [TRACKS.find((element) => element.trackId === track)] : [],
      keepSelection: true,
    },
  });

  const cardDefinitions: CardsProps.CardDefinition<Track> = {
    header: (item: Track) => item.name,
    sections: [
      {
        id: 'trackId',
        content: (item: Track) => <div>{item.trackId}</div>,
      },
      {
        id: 'difficulty',
        content: (item: Track) => <div>{item.difficulty}</div>,
      },
      {
        id: 'description',
        content: (item: Track) => <Box variant="small">{item.description}</Box>,
      },
      {
        id: 'direction',
        content: (item: Track) => (
          <Box variant="small">
            {t('direction')}
            {': '}
            {item.enabledDirections.map((dir) => t(`${dir}`)).toString()}
          </Box>
        ),
        width: 100,
      },
      {
        id: 'image',
        content: (item: Track) => {
          const trackImg = new URL(`../../assets/images/tracks/${item.trackId}.png`, import.meta.url).href;
          return <img style={{ width: '100%' }} src={trackImg} alt={item.trackId} />;
        },
      },
    ],
  };

  const TrackSelectionPreferences = (
    <CollectionPreferences
      title={t('collectionPreferences.title')}
      confirmLabel={t('collectionPreferences.confirmLabel')}
      cancelLabel={t('collectionPreferences.cancelLabel')}
      onConfirm={({ detail }) => setPreferences(detail)}
      preferences={preferences}
      pageSizePreference={{
        title: t('collectionPreferences.pageSizeTitle'),
        options: pageSizeOptions,
      }}
      visibleContentPreference={{
        title: t('collectionPreferences.visibleContentTitle'),
        options: [
          {
            label: t('collectionPreferences.visibleContentLabel'),
            options: [
              { id: 'length', label: t('length') },
              { id: 'width', label: t('width') },
              { id: 'direction', label: t('direction') },
            ],
          },
        ],
      }}
    />
  );

  return {
    collectionProps,
    cardDefinitions,
    visibleContent: preferences.visibleContent,
    items,
    paginationProps,
    TrackSelectionPreferences,
    filteredItemsCount,
    filterProps,
    setSorting,
  };
};
