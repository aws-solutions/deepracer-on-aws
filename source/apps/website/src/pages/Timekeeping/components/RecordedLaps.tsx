// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Container from '@cloudscape-design/components/container';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { DeviceType, type Lap } from '@deepracer-indy/typescript-client';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useTimekeepingLaps, useTimekeepingRun } from '#hooks/useTimekeepingSession.js';
import { useListDevicesQuery } from '#services/deepRacer/devicesApi.js';
import { useSetLapValidityMutation } from '#services/deepRacer/lapsApi.js';

import { LapTable } from './LapTable';

export const RecordedLaps = () => {
  const { t } = useTranslation('timekeeping');
  const { activeRun } = useTimekeepingRun();
  const { laps, isHydrating } = useTimekeepingLaps();
  const lapSnapshot = useMemo(() => ({ laps, isHydrating }), [isHydrating, laps]);
  const { laps: deferredLaps, isHydrating: isDeferredHydrating } = useDeferredValue(lapSnapshot);
  const { data: devices = [] } = useListDevicesQuery({ deviceType: DeviceType.CAR }, { skip: !activeRun });
  const instanceIdToDeviceName = useMemo(
    () => Object.fromEntries(devices.map((device) => [device.instanceId, device.name])),
    [devices],
  );
  const [setLapValidity] = useSetLapValidityMutation();
  const [togglingLapNumber, setTogglingLapNumber] = useState<number | undefined>(undefined);
  const [validityError, setValidityError] = useState<string | undefined>(undefined);
  const fastestLap = useMemo(
    () =>
      deferredLaps
        .filter((lap) => lap.isValid)
        .reduce<Lap | undefined>(
          (fastest, lap) => (fastest === undefined || lap.lapTimeMs < fastest.lapTimeMs ? lap : fastest),
          undefined,
        ),
    [deferredLaps],
  );
  const isLoading = Boolean(activeRun) && isDeferredHydrating;

  const handleToggleValidity = useCallback(
    async (lap: Lap, nextIsValid: boolean) => {
      if (!activeRun) return;

      setValidityError(undefined);
      setTogglingLapNumber(lap.lapNumber);
      try {
        await setLapValidity({
          eventId: activeRun.eventId,
          leaderboardId: activeRun.leaderboardId,
          runId: activeRun.runId,
          lapNumber: lap.lapNumber,
          isValid: nextIsValid,
        }).unwrap();
      } catch {
        setValidityError(t('lapTable.toggleValidityError'));
      } finally {
        setTogglingLapNumber((current) => (current === lap.lapNumber ? undefined : current));
      }
    },
    [activeRun, setLapValidity, t],
  );

  return (
    <Container data-id="RecordedLaps" data-testid="recorded-laps" variant="default">
      <SpaceBetween size="s">
        <LapTable
          dataTestId="fastest-lap-table"
          emptySubtitle={t('lapTable.fastestEmptySubtitle')}
          emptyTitle={t('lapTable.fastestEmptyTitle')}
          header={t('lapTable.fastestHeader')}
          isLoading={isLoading}
          instanceIdToDeviceName={instanceIdToDeviceName}
          laps={fastestLap ? [fastestLap] : []}
        />
        <LapTable
          dataTestId="recorded-laps-table"
          emptySubtitle={t('lapTable.emptySubtitle')}
          emptyTitle={t('lapTable.emptyTitle')}
          header={t('lapTable.header')}
          isLoading={isLoading}
          instanceIdToDeviceName={instanceIdToDeviceName}
          laps={deferredLaps}
          onToggleValidity={handleToggleValidity}
          togglingLapNumber={togglingLapNumber}
        />
        {validityError && (
          <Alert dismissible type="error" onDismiss={() => setValidityError(undefined)}>
            {validityError}
          </Alert>
        )}
      </SpaceBetween>
    </Container>
  );
};
