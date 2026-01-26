// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCollection } from '@cloudscape-design/collection-hooks';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import { CardsProps } from '@cloudscape-design/components/cards';
import CollectionPreferences, {
  CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { Leaderboard } from '@deepracer-indy/typescript-client';
import humanizeDuration from 'humanize-duration';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import emptyRace from '#assets/images/emptyRace.svg';
import { PageId } from '#constants/pages.js';
import { TRACKS } from '#constants/tracks.js';
import i18n from '#i18n/index.js';
import { getPath } from '#utils/pageUtils.js';
import '../styles.css';

const getTimeRemaining = (openTime: number, closeTime: number, currentTime: number) => {
  // if event is in the past
  if (currentTime >= closeTime) {
    return (
      <div className="otherLeaderboard">
        <Box variant="p" color="inherit">
          {i18n.t('races:closed')}
        </Box>
      </div>
    );
  }
  // if event is ongoing
  if (currentTime >= openTime && currentTime < closeTime) {
    return (
      <div className="openLeaderboard">
        <Box variant="strong" color="inherit">
          {humanizeDuration(closeTime - currentTime, { units: ['d', 'h', 'm', 's'], largest: 1, round: true })}{' '}
          {i18n.t('races:remaining')}
        </Box>
      </div>
    );
  }
  return (
    <div className="otherLeaderboard">
      <Box variant="p" color="inherit">
        {humanizeDuration(openTime - currentTime, { units: ['d', 'h', 'm', 's'], largest: 1, round: true })}{' '}
        {i18n.t('races:toRace')}
      </Box>
    </div>
  );
};

const useRacesDisplayConfig = (leaderboards: Leaderboard[], isClosed: boolean, canManageRaces: boolean) => {
  const { t } = useTranslation('races');
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const pageSizeOptions: CollectionPreferencesProps.PageSizeOption[] = [
    { value: 3, label: t('collectionPreferences.pageSizeOptionsLabel', { count: 3 }) },
    { value: 6, label: t('collectionPreferences.pageSizeOptionsLabel', { count: 6 }) },
    { value: 9, label: t('collectionPreferences.pageSizeOptionsLabel', { count: 9 }) },
    { value: 15, label: t('collectionPreferences.pageSizeOptionsLabel', { count: 15 }) },
  ];

  const defaultPreferences: CollectionPreferencesProps.Preferences = {
    pageSize: 6,
    visibleContent: ['leaderboardName', 'raceType', 'raceDates', 'image', 'raceDetails'],
  };

  const [preferences, setPreferences] = useState(defaultPreferences);

  const canManageRaceContent = <Button onClick={() => navigate(getPath(PageId.CREATE_RACE))}>{t('createRace')}</Button>;
  const cannotManageRaceContent = <span>No community races open to join at this time. Check back again soon.</span>;

  const { items, collectionProps, paginationProps, filteredItemsCount, filterProps } = useCollection(leaderboards, {
    filtering: {
      empty: isClosed ? (
        <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
          <b>{t('noraces')}</b>
        </Box>
      ) : (
        <Box textAlign="center">
          <SpaceBetween size={'m'}>
            <img style={{ width: '20%' }} src={emptyRace} alt="Race" />
            {canManageRaces ? canManageRaceContent : cannotManageRaceContent}
          </SpaceBetween>
        </Box>
      ),
    },
    pagination: { pageSize: preferences.pageSize },
    sorting: {
      defaultState: {
        sortingColumn: {
          sortingField: 'openTime',
        },
        isDescending: true,
      },
    },
  });
  const cardDefinitions: CardsProps.CardDefinition<Leaderboard> = {
    header: (item) => {
      return getTimeRemaining(item.openTime.getTime(), item.closeTime.getTime(), currentTime);
    },
    sections: [
      {
        id: 'leaderboardId',
        content: (item: Leaderboard) => <div>{item.leaderboardId}</div>,
      },
      {
        id: 'leaderboardName',
        content: (item: Leaderboard) => (
          <Box textAlign="center" variant="h2">
            {item.name}
          </Box>
        ),
      },
      {
        id: 'raceType',
        content: (item: Leaderboard) => {
          const track = TRACKS.find((tr) => tr.trackId === item.trackConfig.trackId)?.name;
          return (
            <Box textAlign="center" variant="p">
              {t(item.raceType)} - {track}
            </Box>
          );
        },
      },
      {
        id: 'raceDates',
        content: (item: Leaderboard) => (
          <Box textAlign="center">
            <Box textAlign="center" variant="small">
              {t('raceDates')}: {t('start', { value: item.openTime })}
              {' - '}
              {t('end', { value: item.closeTime })}
            </Box>
          </Box>
        ),
      },
      {
        id: 'image',
        content: (item: Leaderboard) => {
          const trackImg = new URL(`../../../assets/images/tracks/${item.trackConfig.trackId}.png`, import.meta.url)
            .href;
          return <img style={{ width: '100%' }} src={trackImg} alt={item.trackConfig.trackId} />;
        },
      },
      {
        id: 'raceDetails',
        content: (item: Leaderboard) => (
          <Box textAlign="center">
            <Button
              onClick={() =>
                navigate(
                  getPath(PageId.RACE_DETAILS, {
                    leaderboardId: item.leaderboardId,
                  }),
                )
              }
            >
              {t('seeRaceDetails')}
            </Button>
          </Box>
        ),
      },
    ],
  };
  const TrackDisplayPreferences = (
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
            options: [],
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
    TrackDisplayPreferences,
    filteredItemsCount,
    filterProps,
  };
};
export default useRacesDisplayConfig;
