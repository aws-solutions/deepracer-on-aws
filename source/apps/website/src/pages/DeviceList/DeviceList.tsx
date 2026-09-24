// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import Select, { SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { DeviceStatus, DeviceType, UserGroups } from '@deepracer-indy/typescript-client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { PageId } from '#constants/pages';
import { useAppDispatch } from '#hooks/useAppDispatch';
import { useDeviceMqtt } from '#hooks/useDeviceMqtt.js';
import { useBatchUpdateDeviceMutation, useListDevicesQuery } from '#services/deepRacer/devicesApi';
import { useListFleetsQuery } from '#services/deepRacer/fleetsApi';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { getPath } from '#utils/pageUtils.js';

import MoveToFleetModal from './components/MoveToFleetModal';
import { useDevicesTableConfig } from './components/useDevicesTableConfig';

const ALL_VALUE = 'ALL';

const DeviceList = () => {
  const { t } = useTranslation('devices');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [isAdmin, setIsAdmin] = useState(false);
  const [typeFilter, setTypeFilter] = useState<DeviceType | typeof ALL_VALUE>(ALL_VALUE);
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | typeof ALL_VALUE>(ALL_VALUE);
  const [showMoveModal, setShowMoveModal] = useState(false);

  const { data: allDevices = [], isLoading, isFetching, refetch } = useListDevicesQuery({});
  // ListFleets is gated to admin-or-facilitator — the same audience as this page's route guard —
  // so load it for every viewer (not just admins) to resolve fleet names in the table.
  const { data: fleets = [] } = useListFleetsQuery({});
  const fleetNamesById = useMemo(() => new Map(fleets.map((fleet) => [fleet.fleetId, fleet.name])), [fleets]);
  const [batchUpdateDevice, { isLoading: isMoving }] = useBatchUpdateDeviceMutation();

  // Page-level access is enforced by the RequiresAdminOrFacilitator route guard; this only
  // resolves admin status to gate the admin-only "Move to fleet" action.
  useEffect(() => {
    checkUserGroupMembership([UserGroups.ADMIN])
      .then(setIsAdmin)
      .catch((err: unknown) => {
        console.error('Failed to load permissions', err);
      });
  }, []);

  // Live list updates: '+' subscribes to every device topic (deepracer/{ns}/device/+); any
  // status change or command result refetches the table so it stays current without polling.
  const handleDeviceEvent = useCallback(() => {
    refetch().catch(() => {
      /** no-op: background refresh, errors surface via the query hook */
    });
  }, [refetch]);

  useDeviceMqtt('+', { onEvent: handleDeviceEvent });

  const filteredDevices = allDevices.filter((d) => {
    if (typeFilter !== ALL_VALUE && d.deviceType !== typeFilter) return false;
    if (statusFilter !== ALL_VALUE && d.status !== statusFilter) return false;
    return true;
  });

  const {
    collectionProps,
    columnDefinitions,
    columnDisplay,
    items,
    paginationProps,
    selectedItems,
    filterProps,
    filteredItemsCount,
    emptyState,
  } = useDevicesTableConfig(filteredDevices, fleetNamesById);

  const typeOptions: SelectProps.Option[] = [
    { value: ALL_VALUE, label: t('list.filters.allTypes') },
    ...Object.values(DeviceType).map((type) => ({
      value: type,
      label: t(`deviceType.${type}`),
    })),
  ];

  const statusOptions: SelectProps.Option[] = [
    { value: ALL_VALUE, label: t('list.filters.allStatuses') },
    // PENDING is not surfaced in the GUI for now (the backend never emits it), so it is excluded
    // from the status filter options.
    ...Object.values(DeviceStatus)
      .filter((status) => status !== DeviceStatus.PENDING)
      .map((status) => ({
        value: status,
        label: t(`status.${status}`),
      })),
  ];

  const selectedDevice = selectedItems?.[0];
  const selectedCount = selectedItems?.length ?? 0;

  const handleMoveToFleet = async (fleetId?: string) => {
    const instanceIds = (selectedItems ?? []).map((d) => d.instanceId);
    if (instanceIds.length === 0) return;
    try {
      const result = await batchUpdateDevice({ instanceIds, fleetId }).unwrap();
      dispatch(
        displaySuccessNotification({
          content: t('list.moveToFleet.success', {
            assigned: result.assignedInstanceIds?.length ?? 0,
            failed: result.errors?.length ?? 0,
          }),
        }),
      );
    } catch {
      dispatch(displayErrorNotification({ content: t('list.moveToFleet.error') }));
    } finally {
      setShowMoveModal(false);
    }
  };

  // filteredItemsCount is set by useCollection when a text filter is active;
  // fall back to filteredDevices.length when no text filter is applied.
  const visibleCount = filteredItemsCount ?? filteredDevices.length;

  return (
    <>
      <Table
        {...collectionProps}
        variant="full-page"
        items={items}
        columnDefinitions={columnDefinitions}
        columnDisplay={columnDisplay}
        selectionType="multi"
        loading={isLoading}
        loadingText={t('list.loadingText')}
        trackBy="instanceId"
        empty={emptyState}
        header={
          <Header
            counter={selectedCount ? `(${selectedCount}/${visibleCount})` : `(${visibleCount})`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  ariaLabel={t('list.refreshButtonLabel')}
                  loading={isFetching}
                  onClick={() => refetch()}
                />
                <Button
                  disabled={selectedCount !== 1}
                  onClick={() =>
                    navigate(getPath(PageId.DEVICE_DETAIL, { instanceId: selectedDevice?.instanceId ?? '' }))
                  }
                >
                  {t('list.viewDetailsButton')}
                </Button>
                {isAdmin && (
                  <Button disabled={selectedCount === 0} onClick={() => setShowMoveModal(true)}>
                    {t('list.moveToFleet.button')}
                  </Button>
                )}
                {isAdmin && (
                  <Button variant="primary" onClick={() => navigate(getPath(PageId.ACTIVATE_DEVICE))}>
                    {t('list.activateButton')}
                  </Button>
                )}
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
          <SpaceBetween direction="horizontal" size="xs">
            <TextFilter
              {...filterProps}
              filteringAriaLabel={t('list.filters.filteringAriaLabel')}
              filteringPlaceholder={t('list.filters.searchFilterPlaceholder')}
              countText={
                filterProps.filteringText ? t('list.filters.matchCount', { count: filteredItemsCount ?? 0 }) : undefined
              }
            />
            <Select
              selectedOption={typeOptions.find((o) => o.value === typeFilter) ?? typeOptions[0]}
              onChange={({ detail }) => {
                setTypeFilter((detail.selectedOption.value as DeviceType | typeof ALL_VALUE) ?? ALL_VALUE);
              }}
              options={typeOptions}
              ariaLabel={t('list.filters.typeFilterLabel')}
            />
            <Select
              selectedOption={statusOptions.find((o) => o.value === statusFilter) ?? statusOptions[0]}
              onChange={({ detail }) => {
                setStatusFilter((detail.selectedOption.value as DeviceStatus | typeof ALL_VALUE) ?? ALL_VALUE);
              }}
              options={statusOptions}
              ariaLabel={t('list.filters.statusFilterLabel')}
            />
          </SpaceBetween>
        }
      />
      {showMoveModal && (
        <MoveToFleetModal
          fleets={fleets}
          deviceCount={selectedCount}
          isMoving={isMoving}
          isVisible
          onMove={handleMoveToFleet}
          onDismiss={() => setShowMoveModal(false)}
        />
      )}
    </>
  );
};

export default DeviceList;
