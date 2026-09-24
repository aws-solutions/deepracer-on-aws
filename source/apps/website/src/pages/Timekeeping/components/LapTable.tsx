// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table, { TableProps } from '@cloudscape-design/components/table';
import type { Lap } from '@deepracer-indy/typescript-client';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { millisToMinutesAndSeconds } from '#utils/dateTimeUtils.js';

export interface LapTableProps {
  dataTestId: string;
  emptySubtitle: string;
  emptyTitle: string;
  header: string;
  isLoading: boolean;
  laps: Lap[];
  /** Maps SSM instance ID to device display name for the Car column. */
  instanceIdToDeviceName?: Record<string, string>;
  /**
   * When provided, renders a per-lap validity toggle column. Invoked with the lap and its
   * next validity value. Omit for read-only tables (e.g. the fastest-lap summary).
   */
  onToggleValidity?: (lap: Lap, nextIsValid: boolean) => void;
  /** Lap number whose validity toggle is awaiting the SetLapValidity response; its StatusIndicator shows in-progress. */
  togglingLapNumber?: number;
}

const getLapStatusType = (lap: Lap, isToggling: boolean) => {
  if (isToggling) {
    return 'loading';
  }

  return lap.isValid ? 'success' : 'error';
};

const getLapColumnDefinitions = (
  t: TFunction<'timekeeping'>,
  instanceIdToDeviceName: Record<string, string>,
  onToggleValidity?: LapTableProps['onToggleValidity'],
  togglingLapNumber?: number,
): TableProps.ColumnDefinition<Lap>[] => {
  const columns: TableProps.ColumnDefinition<Lap>[] = [
    {
      id: 'lapNumber',
      header: t('lapTable.columnHeaders.lapNumber'),
      cell: (lap) => lap.lapNumber,
    },
    {
      id: 'lapTimeMs',
      header: t('lapTable.columnHeaders.lapTimeMs'),
      // Strikethrough invalid laps so an excluded lap reads as excluded at a glance.
      cell: (lap) =>
        lap.isValid ? (
          millisToMinutesAndSeconds(lap.lapTimeMs)
        ) : (
          <Box variant="span" data-testid={`lap-time-invalid-${lap.lapNumber}`}>
            <s>{millisToMinutesAndSeconds(lap.lapTimeMs)}</s>
          </Box>
        ),
    },
    {
      id: 'isValid',
      header: t('lapTable.columnHeaders.isValid'),
      // No onToggleValidity: read-only StatusIndicator, matching plain informational cells elsewhere.
      // With onToggleValidity: the whole cell is a clickable pill (Button wrapping StatusIndicator)
      // that flips validity directly — this is the single "Valid" column, there is no separate
      // actions column, mirroring DREM's timekeeper lap table.
      cell: (lap) => {
        const isToggling = togglingLapNumber === lap.lapNumber;
        const statusType = getLapStatusType(lap, isToggling);

        if (onToggleValidity) {
          return (
            <Button
              variant="normal"
              disabled={isToggling}
              onClick={() => onToggleValidity(lap, !lap.isValid)}
              ariaLabel={t(lap.isValid ? 'lapTable.markInvalid' : 'lapTable.markValid', { lapNumber: lap.lapNumber })}
            >
              <StatusIndicator
                data-testid={`lap-validity-status-${lap.lapNumber}`}
                data-status-type={statusType}
                type={statusType}
              >
                {t(lap.isValid ? 'lapTable.valid' : 'lapTable.invalid')}
              </StatusIndicator>
            </Button>
          );
        }
        return (
          <StatusIndicator type={lap.isValid ? 'success' : 'error'}>
            {t(lap.isValid ? 'lapTable.valid' : 'lapTable.invalid')}
          </StatusIndicator>
        );
      },
    },
    {
      id: 'resets',
      header: t('lapTable.columnHeaders.resets'),
      cell: (lap) => lap.resets ?? 0,
    },
    {
      id: 'car',
      header: t('lapTable.columnHeaders.car'),
      cell: (lap) => (lap.deviceId ? (instanceIdToDeviceName[lap.deviceId] ?? lap.deviceId) : '—'),
    },
  ];

  return columns;
};

export const LapTable = ({
  dataTestId,
  emptySubtitle,
  emptyTitle,
  header,
  isLoading,
  laps,
  instanceIdToDeviceName = {},
  onToggleValidity,
  togglingLapNumber,
}: LapTableProps) => {
  const { t } = useTranslation('timekeeping');

  const emptyContent = (
    <Box textAlign="center" padding="l">
      <Box variant="strong">{emptyTitle}</Box>
      <Box color="text-body-secondary">{emptySubtitle}</Box>
    </Box>
  );

  return (
    <Table<Lap>
      data-testid={dataTestId}
      items={laps}
      variant="borderless"
      trackBy="lapNumber"
      header={
        <Header variant="h2" counter={`(${laps.length})`}>
          {header}
        </Header>
      }
      loading={isLoading}
      empty={emptyContent}
      columnDefinitions={getLapColumnDefinitions(t, instanceIdToDeviceName, onToggleValidity, togglingLapNumber)}
    />
  );
};

export default LapTable;
