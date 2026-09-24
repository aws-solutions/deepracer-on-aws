// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { Device, DeviceColor, DeviceStatus, DeviceType, UserGroups } from '@deepracer-indy/typescript-client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { PageId } from '#constants/pages';
import { useAppDispatch } from '#hooks/useAppDispatch';
import { useDeviceMqtt, type DeviceMqttEvent } from '#hooks/useDeviceMqtt.js';
import {
  useChangeDeviceColorMutation,
  useDeleteDeviceMutation,
  useListDevicesQuery,
  useRestartDeviceMutation,
  useStopDeviceMutation,
  useUpdateDeviceMutation,
} from '#services/deepRacer/devicesApi';
import { useListFleetsQuery } from '#services/deepRacer/fleetsApi';
import {
  displayErrorNotification,
  displayInfoNotification,
  displaySuccessNotification,
} from '#store/notifications/notificationsSlice.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { getPath } from '#utils/pageUtils.js';

import ChangeColorModal from './components/ChangeColorModal';
import ChangeFleetModal from './components/ChangeFleetModal';
import DeleteDeviceModal from './components/DeleteDeviceModal';
import StopDeviceModal from './components/StopDeviceModal';

// A device that is still coming online (PENDING) shows the blue 'in-progress' indicator; a
// missing/unknown status falls back to 'error' (defensive default).
const STATUS_TYPE_MAP: Partial<Record<DeviceStatus, 'success' | 'error' | 'in-progress'>> = {
  [DeviceStatus.ONLINE]: 'success',
  [DeviceStatus.OFFLINE]: 'error',
  [DeviceStatus.PENDING]: 'in-progress',
};

const DeviceDetail = () => {
  const { t } = useTranslation('devices');
  const navigate = useNavigate();
  const { instanceId } = useParams<{ instanceId: string }>();
  const dispatch = useAppDispatch();

  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminOrFacilitator, setIsAdminOrFacilitator] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [showFleetModal, setShowFleetModal] = useState(false);

  const { data: devices, isLoading, refetch } = useListDevicesQuery({});
  const device: Device | undefined = useMemo(
    () => devices?.find((d) => d.instanceId === instanceId),
    [devices, instanceId],
  );

  const [restartDevice, { isLoading: isRestarting }] = useRestartDeviceMutation();
  const [stopDevice, { isLoading: isStopping }] = useStopDeviceMutation();
  const [changeDeviceColor, { isLoading: isChangingColor }] = useChangeDeviceColorMutation();
  const [deleteDevice, { isLoading: isDeleting }] = useDeleteDeviceMutation();
  const [updateDevice, { isLoading: isChangingFleet }] = useUpdateDeviceMutation();

  // Fleets resolve the device's fleet name in Details (and populate the reassignment modal for
  // admins). ListFleets is authorized for admins and facilitators — the same groups gated into
  // this page — so load it for both.
  const { data: fleets = [] } = useListFleetsQuery({}, { skip: !isAdminOrFacilitator });

  useEffect(() => {
    const loadPermissions = async () => {
      const [admin, adminOrFacilitator] = await Promise.all([
        checkUserGroupMembership([UserGroups.ADMIN]),
        checkUserGroupMembership([UserGroups.ADMIN, UserGroups.RACE_FACILITATORS]),
      ]);
      setIsAdmin(admin);
      setIsAdminOrFacilitator(adminOrFacilitator);
    };

    loadPermissions().catch((err: unknown) => {
      console.error('Failed to load permissions', err);
    });
  }, []);

  const handleRestart = useCallback(async () => {
    if (!instanceId || !device) return;
    try {
      await restartDevice({ instanceId }).unwrap();
      dispatch(displayInfoNotification({ content: t('detail.restartDispatched', { name: device.name }) }));
    } catch {
      dispatch(displayErrorNotification({ content: t('detail.restartError') }));
    }
  }, [instanceId, device, restartDevice, dispatch, t]);

  const handleStop = useCallback(async () => {
    if (!instanceId || !device) return;
    try {
      await stopDevice({ instanceId }).unwrap();
      dispatch(displayInfoNotification({ content: t('detail.stopDispatched', { name: device.name }) }));
    } catch {
      dispatch(displayErrorNotification({ content: t('detail.stopError') }));
    } finally {
      setShowStopModal(false);
    }
  }, [instanceId, device, stopDevice, dispatch, t]);

  const handleChangeColor = useCallback(
    async (color: DeviceColor) => {
      if (!instanceId || !device) return;
      try {
        await changeDeviceColor({ instanceId, color }).unwrap();
        dispatch(displayInfoNotification({ content: t('detail.colorDispatched', { name: device.name }) }));
      } catch {
        dispatch(displayErrorNotification({ content: t('detail.colorError') }));
      } finally {
        setShowColorModal(false);
      }
    },
    [instanceId, device, changeDeviceColor, dispatch, t],
  );

  const handleDelete = useCallback(async () => {
    if (!instanceId || !device) return;
    try {
      await deleteDevice({ instanceId }).unwrap();
      dispatch(displaySuccessNotification({ content: t('detail.deleteSuccess', { name: device.name }) }));
      navigate(getPath(PageId.DEVICES));
    } catch {
      dispatch(displayErrorNotification({ content: t('detail.deleteError') }));
    } finally {
      setShowDeleteModal(false);
    }
  }, [instanceId, device, deleteDevice, dispatch, t, navigate]);

  const handleChangeFleet = useCallback(
    async (fleetId?: string) => {
      if (!instanceId || !device) return;
      try {
        await updateDevice({ instanceId, fleetId }).unwrap();
        dispatch(displaySuccessNotification({ content: t('detail.fleetChangeSuccess', { name: device.name }) }));
      } catch {
        dispatch(displayErrorNotification({ content: t('detail.fleetChangeError') }));
      } finally {
        setShowFleetModal(false);
      }
    },
    [instanceId, device, updateDevice, dispatch, t],
  );

  // Live device updates: the BroadcastHandler pushes DEVICE_STATUS_CHANGED / DEVICE_COMMAND_RESULT
  // to deepracer/{ns}/device/{instanceId} (SSM command completion tracked via EventBridge →
  // deviceStateChangeHandler → DDB stream). Refetch on any event; surface command outcomes.
  const handleDeviceEvent = useCallback(
    (event: DeviceMqttEvent) => {
      if (event.eventType === 'DEVICE_COMMAND_RESULT') {
        const { commandStatus } = event;
        // Only a Failed command is an error (red). Success is green; every other status
        // (Pending, InProgress, Cancelled, TimedOut, …) is surfaced as INFO (blue).
        if (commandStatus === 'Success') {
          dispatch(
            displaySuccessNotification({ content: t('detail.commandResultSuccess', { status: commandStatus }) }),
          );
        } else if (commandStatus === 'Failed') {
          dispatch(displayErrorNotification({ content: t('detail.commandResultStatus', { status: commandStatus }) }));
        } else {
          dispatch(displayInfoNotification({ content: t('detail.commandResultStatus', { status: commandStatus }) }));
        }
      }
      refetch().catch(() => {
        /** no-op: background refresh, errors surface via the query hook */
      });
    },
    [dispatch, refetch, t],
  );

  useDeviceMqtt(instanceId ?? '', { onEvent: handleDeviceEvent });

  const getStopDisabledReason = (): string | undefined => {
    if (!device) return undefined;
    if (device.deviceType !== DeviceType.CAR) return t('detail.stopCarsOnlyTooltip');
    if (device.status !== DeviceStatus.ONLINE) return t('detail.stopOfflineTooltip');
    return undefined;
  };

  if (isLoading) {
    return (
      <ContentLayout header={<Header variant="h1">{t('detail.loadingText')}</Header>}>
        <Spinner />
      </ContentLayout>
    );
  }

  if (!device) {
    return (
      <ContentLayout header={<Header variant="h1">{t('list.header')}</Header>}>
        <Box>{t('detail.notFound')}</Box>
      </ContentLayout>
    );
  }

  const stopDisabledReason = getStopDisabledReason();

  // Show the fleet's human-readable name; fall back to the id while fleets load (or if it is not
  // found), and to "Unassigned" when the device has no fleet.
  const fleetName = device.fleetId
    ? (fleets.find((fleet) => fleet.fleetId === device.fleetId)?.name ?? device.fleetId)
    : t('unassignedFleet');

  const headerActions = (
    <SpaceBetween direction="horizontal" size="xs">
      {isAdminOrFacilitator && (
        <Button onClick={() => handleRestart()} loading={isRestarting}>
          {t('detail.restartButton')}
        </Button>
      )}
      {isAdminOrFacilitator && (
        <Button
          onClick={() => setShowStopModal(true)}
          disabled={!!stopDisabledReason}
          disabledReason={stopDisabledReason}
        >
          {t('detail.stopButton')}
        </Button>
      )}
      {isAdminOrFacilitator && <Button onClick={() => setShowColorModal(true)}>{t('detail.colorButton')}</Button>}
      {isAdmin && <Button onClick={() => setShowFleetModal(true)}>{t('detail.changeFleetButton')}</Button>}
      {isAdmin && <Button onClick={() => setShowDeleteModal(true)}>{t('detail.deleteButton')}</Button>}
    </SpaceBetween>
  );

  return (
    <>
      <ContentLayout
        header={
          <Header
            variant="h1"
            actions={headerActions}
            description={
              <StatusIndicator type={STATUS_TYPE_MAP[device.status] ?? 'error'}>
                {t(`status.${device.status}`)}
              </StatusIndicator>
            }
          >
            {device.name}
          </Header>
        }
      >
        <SpaceBetween size="l">
          <Container header={<Header variant="h2">{t('detail.detailsHeader')}</Header>}>
            <ColumnLayout columns={3} variant="text-grid">
              <KeyValuePairs
                items={[
                  { label: t('list.columnHeaders.deviceType'), value: t(`deviceType.${device.deviceType}`) },
                  { label: t('list.columnHeaders.status'), value: t(`status.${device.status}`) },
                  { label: t('list.columnHeaders.fleetId'), value: fleetName },
                  { label: t('list.columnHeaders.ipAddress'), value: device.ipAddress ?? '—' },
                ]}
              />
            </ColumnLayout>
          </Container>
        </SpaceBetween>
      </ContentLayout>

      {showDeleteModal && (
        <DeleteDeviceModal
          device={device}
          isDeleting={isDeleting}
          isVisible
          onDelete={handleDelete}
          onDismiss={() => setShowDeleteModal(false)}
        />
      )}

      {showStopModal && (
        <StopDeviceModal
          device={device}
          isStopping={isStopping}
          isVisible
          onStop={handleStop}
          onDismiss={() => setShowStopModal(false)}
        />
      )}

      {showColorModal && (
        <ChangeColorModal
          isChanging={isChangingColor}
          isVisible
          onChangeColor={handleChangeColor}
          onDismiss={() => setShowColorModal(false)}
        />
      )}

      {showFleetModal && (
        <ChangeFleetModal
          fleets={fleets}
          currentFleetId={device.fleetId}
          isChanging={isChangingFleet}
          isVisible
          onChangeFleet={handleChangeFleet}
          onDismiss={() => setShowFleetModal(false)}
        />
      )}
    </>
  );
};

export default DeviceDetail;
