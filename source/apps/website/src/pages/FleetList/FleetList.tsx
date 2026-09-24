// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { Fleet } from '@deepracer-indy/typescript-client';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '#hooks/useAppDispatch';
import { useDeleteFleetMutation, useListFleetsQuery } from '#services/deepRacer/fleetsApi';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice.js';

import DeleteFleetModal from './components/DeleteFleetModal';
import FleetFormModal from './components/FleetFormModal';
import { useFleetsTableConfig } from './components/useFleetsTableConfig';

const FleetList = () => {
  const { t } = useTranslation('fleets');
  const dispatch = useAppDispatch();

  const [fleetToDelete, setFleetToDelete] = useState<Fleet | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [fleetToEdit, setFleetToEdit] = useState<Fleet | undefined>(undefined);

  const { data: fleets = [], isLoading, isFetching, refetch } = useListFleetsQuery({});
  const [deleteFleet, { isLoading: isDeleting }] = useDeleteFleetMutation();

  const {
    collectionProps,
    columnDefinitions,
    items,
    paginationProps,
    selectedItems,
    filterProps,
    filteredItemsCount,
    emptyState,
  } = useFleetsTableConfig(fleets);

  const handleDelete = useCallback(async () => {
    if (!fleetToDelete) return;
    try {
      await deleteFleet({ fleetId: fleetToDelete.fleetId }).unwrap();
      dispatch(
        displaySuccessNotification({
          content: t('list.deleteSuccessMessage', { name: fleetToDelete.name }),
          persistForPageChanges: 1,
        }),
      );
      setFleetToDelete(null);
    } catch {
      dispatch(displayErrorNotification({ content: t('list.deleteErrorMessage', { name: fleetToDelete.name }) }));
    }
  }, [deleteFleet, dispatch, fleetToDelete, t]);

  const selectedFleet = selectedItems?.[0];
  const visibleCount = filteredItemsCount ?? fleets.length;

  return (
    <>
      <Table
        {...collectionProps}
        variant="full-page"
        items={items}
        columnDefinitions={columnDefinitions}
        selectionType="single"
        loading={isLoading}
        loadingText={t('list.loadingText')}
        trackBy="fleetId"
        empty={emptyState}
        header={
          <Header
            counter={selectedItems?.length ? `(${selectedItems.length}/${visibleCount})` : `(${visibleCount})`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  ariaLabel={t('list.refreshButtonLabel')}
                  loading={isFetching}
                  onClick={() => refetch()}
                />
                <Button
                  disabled={!selectedFleet}
                  onClick={() => {
                    setFleetToEdit(selectedFleet);
                    setShowFormModal(true);
                  }}
                >
                  {t('list.editButton')}
                </Button>
                <Button disabled={!selectedFleet} onClick={() => setFleetToDelete(selectedFleet ?? null)}>
                  {t('list.deleteButton')}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setFleetToEdit(undefined);
                    setShowFormModal(true);
                  }}
                >
                  {t('list.createButton')}
                </Button>
              </SpaceBetween>
            }
          >
            {t('list.header')}
          </Header>
        }
        pagination={
          <Pagination
            {...paginationProps}
            ariaLabels={{
              nextPageLabel: t('list.pagination.nextPageLabel'),
              previousPageLabel: t('list.pagination.previousPageLabel'),
              pageLabel: (pageNumber) => t('list.pagination.pageLabel', { pageNumber }),
            }}
          />
        }
        filter={
          <TextFilter
            {...filterProps}
            filteringAriaLabel={t('list.filters.filteringAriaLabel')}
            filteringPlaceholder={t('list.filters.searchFilterPlaceholder')}
            countText={
              filterProps.filteringText ? t('list.filters.matchCount', { count: filteredItemsCount ?? 0 }) : undefined
            }
          />
        }
      />
      {fleetToDelete && (
        <DeleteFleetModal
          fleet={fleetToDelete}
          isDeleting={isDeleting}
          isVisible
          onDelete={handleDelete}
          onDismiss={() => setFleetToDelete(null)}
        />
      )}
      {showFormModal && (
        <FleetFormModal
          fleet={fleetToEdit}
          isVisible
          onDismiss={() => {
            setShowFormModal(false);
            setFleetToEdit(undefined);
          }}
        />
      )}
    </>
  );
};

export default FleetList;
