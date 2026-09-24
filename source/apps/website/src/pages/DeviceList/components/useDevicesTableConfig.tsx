// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCollection } from '@cloudscape-design/collection-hooks';
import { CollectionPreferencesProps } from '@cloudscape-design/components/collection-preferences';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { TableProps } from '@cloudscape-design/components/table';
import { Device, DeviceStatus } from '@deepracer-indy/typescript-client';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import TableEmptyState from '#components/TableEmptyState';

import { DEFAULT_COLUMN_DISPLAY, DEFAULT_PAGE_SIZE, DevicesTableColumn } from './devicesTableConstants.js';

// PENDING is intentionally omitted: the backend never emits it, so it is not surfaced in the GUI
// for now. ONLINE/OFFLINE are the only statuses the device status poller assigns.
const DEVICE_STATUS_TYPE_MAP: Partial<Record<DeviceStatus, 'success' | 'stopped' | 'error'>> = {
  [DeviceStatus.ONLINE]: 'success',
  [DeviceStatus.OFFLINE]: 'stopped',
};

export const useDevicesTableConfig = (devices: Device[], fleetNamesById: Map<string, string>) => {
  const { t } = useTranslation('devices');
  const [preferences, setPreferences] = useState<CollectionPreferencesProps.Preferences>({
    pageSize: DEFAULT_PAGE_SIZE,
    contentDisplay: DEFAULT_COLUMN_DISPLAY,
  });

  // Devices carry only fleetId; resolve it to the fleet name, falling back to the id when the
  // fleet list is unavailable (e.g. not loaded for non-admins) so the column never regresses to blank.
  const resolveFleetName = useCallback(
    (item: Device): string =>
      item.fleetId ? (fleetNamesById.get(item.fleetId) ?? item.fleetId) : t('unassignedFleet'),
    [fleetNamesById, t],
  );

  const columnDefinitions: TableProps.ColumnDefinition<Device>[] = useMemo(
    () => [
      {
        id: DevicesTableColumn.NAME,
        header: t('list.columnHeaders.name'),
        cell: (item) => item.name,
        sortingField: 'name',
        isRowHeader: true,
      },
      {
        id: DevicesTableColumn.TYPE,
        header: t('list.columnHeaders.deviceType'),
        cell: (item) => t(`deviceType.${item.deviceType}`),
        sortingField: 'deviceType',
      },
      {
        id: DevicesTableColumn.STATUS,
        header: t('list.columnHeaders.status'),
        cell: (item) => (
          <StatusIndicator type={DEVICE_STATUS_TYPE_MAP[item.status] ?? 'stopped'}>
            {t(`status.${item.status}`)}
          </StatusIndicator>
        ),
        sortingField: 'status',
      },
      {
        id: DevicesTableColumn.FLEET,
        header: t('list.columnHeaders.fleetId'),
        cell: (item) => resolveFleetName(item),
        sortingComparator: (a, b) => resolveFleetName(a).localeCompare(resolveFleetName(b)),
      },
      {
        id: DevicesTableColumn.LAST_SEEN,
        header: t('list.columnHeaders.lastSeenAt'),
        cell: (item) => (item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleString() : '—'),
        sortingField: 'lastSeenAt',
      },
      {
        id: DevicesTableColumn.IP_ADDRESS,
        header: t('list.columnHeaders.ipAddress'),
        cell: (item) => item.ipAddress ?? '—',
        sortingField: 'ipAddress',
      },
    ],
    [t, resolveFleetName],
  );

  const columnDisplay = preferences.contentDisplay;

  const { items, collectionProps, filterProps, paginationProps, filteredItemsCount } = useCollection(devices, {
    filtering: {
      filteringFunction: (item, filteringText) => {
        const text = filteringText.toLowerCase();
        return [item.name, t(`deviceType.${item.deviceType}`), t(`status.${item.status}`), resolveFleetName(item)].some(
          (value) => value?.toLowerCase().includes(text),
        );
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
    selectedItems: collectionProps.selectedItems as Device[],
    filterProps,
    filteredItemsCount,
    emptyState: <TableEmptyState title={t('list.emptyTitle')} subtitle={t('list.emptySubtitle')} />,
  };
};
