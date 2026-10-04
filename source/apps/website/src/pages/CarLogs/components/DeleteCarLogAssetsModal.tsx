// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import { CarLogAsset } from '@deepracer-indy/typescript-client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '#hooks/useAppDispatch.js';
import { useDeleteCarLogAssetMutation } from '#services/deepRacer/carLogsApi.js';
import {
  displayErrorNotification,
  displaySuccessNotification,
  displayWarningNotification,
} from '#store/notifications/notificationsSlice.js';

interface AssetActionResult {
  assetId: string;
  filename: string;
  message?: string;
  success: boolean;
}

interface DeleteCarLogAssetsModalProps {
  assets: CarLogAsset[];
  isVisible: boolean;
  onDismiss: () => void;
}

const DeleteCarLogAssetsModal = ({ assets, isVisible, onDismiss }: DeleteCarLogAssetsModalProps) => {
  const { t } = useTranslation('carLogs');
  const dispatch = useAppDispatch();
  const [deleteCarLogAsset, { isLoading }] = useDeleteCarLogAssetMutation();
  const [results, setResults] = useState<AssetActionResult[] | null>(null);

  const handleClose = () => {
    setResults(null);
    onDismiss();
  };

  const handleDelete = async () => {
    const deleteResults: AssetActionResult[] = [];

    for (const asset of assets) {
      try {
        await deleteCarLogAsset({ profileId: asset.profileId, assetId: asset.assetId }).unwrap();
        deleteResults.push({ assetId: asset.assetId, filename: asset.filename, success: true });
      } catch (error) {
        deleteResults.push({
          assetId: asset.assetId,
          filename: asset.filename,
          message: (error as { error?: string })?.error ?? t('delete.results.failedDelete'),
          success: false,
        });
      }
    }

    const successCount = deleteResults.filter((result) => result.success).length;
    const failureCount = deleteResults.length - successCount;

    if (failureCount === 0) {
      dispatch(displaySuccessNotification({ content: t('delete.notifications.success', { count: successCount }) }));
    } else if (successCount === 0) {
      dispatch(displayErrorNotification({ content: t('delete.notifications.error', { count: failureCount }) }));
    } else {
      dispatch(
        displayWarningNotification({
          content: t('delete.notifications.partial', { successCount, failureCount }),
        }),
      );
    }

    setResults(deleteResults);
  };

  const summaryAlert = useMemo(() => {
    if (!results) return null;
    const successCount = results.filter((result) => result.success).length;
    const failureCount = results.length - successCount;

    if (failureCount === 0) {
      return <Alert type="success">{t('delete.results.success', { count: successCount })}</Alert>;
    }
    if (successCount === 0) {
      return <Alert type="error">{t('delete.results.error', { count: failureCount })}</Alert>;
    }
    return <Alert type="warning">{t('delete.results.partial', { successCount, failureCount })}</Alert>;
  }, [results, t]);

  return (
    <Modal
      visible={isVisible}
      onDismiss={handleClose}
      header={t('delete.header')}
      closeAriaLabel={t('delete.closeAriaLabel')}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleClose} disabled={isLoading}>
              {results ? t('common.close') : t('common.cancel')}
            </Button>
            {!results && (
              <Button variant="primary" onClick={() => void handleDelete()} loading={isLoading}>
                {t('delete.confirmButton')}
              </Button>
            )}
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {!results && <Box>{t('delete.description')}</Box>}
        {isLoading && (
          <SpaceBetween direction="horizontal" size="xs">
            <Spinner />
            <Box>{t('delete.inProgress')}</Box>
          </SpaceBetween>
        )}
        {summaryAlert}
        <ul>
          {(
            results ?? assets.map((asset) => ({ assetId: asset.assetId, filename: asset.filename, success: true }))
          ).map((asset) => (
            <li key={asset.assetId}>
              {asset.filename}
              {results && !asset.success && asset.message ? ` — ${asset.message}` : ''}
            </li>
          ))}
        </ul>
      </SpaceBetween>
    </Modal>
  );
};

export default DeleteCarLogAssetsModal;
