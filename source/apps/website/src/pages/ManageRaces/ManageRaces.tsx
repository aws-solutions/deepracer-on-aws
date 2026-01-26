// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Alert } from '@cloudscape-design/components';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { UserGroups } from '@deepracer-indy/typescript-client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { PageId } from '#constants/pages';
import { useListLeaderboardsQuery } from '#services/deepRacer/leaderboardsApi';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { getPath } from '#utils/pageUtils.js';

import { useManageRacesTableConfig } from './components/ManageRacesTableConfig';

const ManageRaces = () => {
  const { t } = useTranslation('leaderboards');
  const navigate = useNavigate();
  const [canManageRaces, setCanManageRaces] = useState(false);
  const { data: leaderboards = [], isLoading } = useListLeaderboardsQuery();

  const {
    collectionProps,
    columnDefinitions,
    columnDisplay,
    items,
    ManageRacesTablePreferences,
    paginationProps,
    selectedItems,
    filterProps,
    filteredItemsCount,
  } = useManageRacesTableConfig(leaderboards);

  useEffect(() => {
    const checkRaceManagementPermissions = async () => {
      setCanManageRaces(await checkUserGroupMembership([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]));
    };

    void checkRaceManagementPermissions();
  }, []);

  if (!canManageRaces) {
    return (
      <Alert type="error" header="Unauthorized">
        <p>The page you are trying to view is only available to race facilitators or administrators.</p>
        <Link to="/">Return to Home</Link>
      </Alert>
    );
  }

  return (
    <Table
      {...collectionProps}
      variant="full-page"
      items={items}
      columnDefinitions={columnDefinitions}
      columnDisplay={columnDisplay}
      selectionType="single"
      header={
        <Header
          counter={`(${selectedItems?.length ? `${selectedItems.length}/${leaderboards.length}` : `${leaderboards.length}`})`}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="normal"
                disabled={!selectedItems?.length}
                onClick={() =>
                  navigate(
                    getPath(PageId.CLONE_RACE, {
                      leaderboardId: selectedItems?.[0].leaderboardId ?? '',
                    }),
                  )
                }
              >
                {t('table.cloneRaceButton')}
              </Button>
              <Button
                onClick={() =>
                  navigate(
                    getPath(PageId.RACE_DETAILS, {
                      leaderboardId: selectedItems?.[0].leaderboardId ?? '',
                    }),
                  )
                }
                disabled={!selectedItems?.length}
              >
                {t('table.raceDetailButton')}
              </Button>
              <Button variant="primary" onClick={() => navigate(getPath(PageId.CREATE_RACE))}>
                {t('table.createRaceButton')}
              </Button>
            </SpaceBetween>
          }
        >
          {t('table.header')}
        </Header>
      }
      loading={isLoading}
      loadingText={t('table.loadingText')}
      trackBy="leaderboardId"
      pagination={
        <Pagination
          {...paginationProps}
          ariaLabels={{
            nextPageLabel: t('table.pagination.nextPageLabel'),
            previousPageLabel: t('table.pagination.previousPageLabel'),
            pageLabel: (pageNumber: number) => t('table.pagination.pageLabel', { pageNumber }),
          }}
        />
      }
      preferences={<ManageRacesTablePreferences />}
      filter={
        <TextFilter
          {...filterProps}
          filteringAriaLabel={t('table.filters.filteringAriaLabel')}
          filteringPlaceholder={t('table.filters.searchFilterPlaceholder')}
          countText={filterProps.filteringText && t('table.filters.matchCount', { count: filteredItemsCount ?? 0 })}
        />
      }
    />
  );
};

export default ManageRaces;
