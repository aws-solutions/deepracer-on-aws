// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Cards from '@cloudscape-design/components/cards';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import SpaceBetween from '@cloudscape-design/components/space-between';
import TextFilter from '@cloudscape-design/components/text-filter';
import { Leaderboard, UserGroups } from '@deepracer-indy/typescript-client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { PageId } from '#constants/pages.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { getPath } from '#utils/pageUtils.js';

import useRacesDisplayConfig from './RacesDisplayConfig';

interface RacesDisplayProps {
  leaderboards: Leaderboard[];
  isClosed: boolean;
  isLoading: boolean;
}
const RacesDisplay = (props: RacesDisplayProps) => {
  const { leaderboards, isClosed, isLoading } = props;
  const { t } = useTranslation('races');
  const navigate = useNavigate();
  const [canManageRaces, setCanManageRaces] = useState(false);

  useEffect(() => {
    const checkRaceManagementPermissions = async () => {
      setCanManageRaces(await checkUserGroupMembership([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]));
    };

    void checkRaceManagementPermissions();
  }, []);

  const {
    collectionProps,
    cardDefinitions,
    visibleContent,
    items,
    paginationProps,
    TrackDisplayPreferences,
    filteredItemsCount,
    filterProps,
  } = useRacesDisplayConfig(leaderboards, isClosed, canManageRaces);
  return (
    <ExpandableSection
      defaultExpanded
      variant="container"
      header={
        <Header
          variant="h2"
          actions={
            isClosed || !canManageRaces ? null : (
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => navigate(getPath(PageId.MANAGE_RACES))}>{t('manageRace')}</Button>
                <Button onClick={() => navigate(getPath(PageId.CREATE_RACE))}>{t('createRace')}</Button>
              </SpaceBetween>
            )
          }
          counter={`(${leaderboards.length})`}
        >
          {isClosed ? t('completedRaces') : t('communityRaces')}
        </Header>
      }
    >
      <Cards
        {...collectionProps}
        variant="full-page"
        selectedItems={collectionProps.selectedItems}
        cardDefinition={cardDefinitions}
        cardsPerRow={[{ cards: 1 }, { minWidth: 500, cards: 2 }, { minWidth: 800, cards: 3 }]}
        entireCardClickable={true}
        items={items}
        trackBy="leaderboardId"
        visibleSections={visibleContent}
        loading={isLoading}
        filter={
          <TextFilter
            {...filterProps}
            filteringAriaLabel={t('filters.filteringAriaLabel')}
            filteringPlaceholder={t('filters.searchFilterPlaceholder')}
            countText={filterProps.filteringText && t('filters.matchCount', { count: filteredItemsCount ?? 0 })}
          />
        }
        pagination={
          <Pagination
            {...paginationProps}
            ariaLabels={{
              nextPageLabel: t('pagination.nextPageLabel'),
              previousPageLabel: t('pagination.previousPageLabel'),
              pageLabel: (pageNumber: number) => t('pagination.pageLabel', { pageNumber }),
            }}
          />
        }
        preferences={TrackDisplayPreferences}
      />
    </ExpandableSection>
  );
};

export default RacesDisplay;
