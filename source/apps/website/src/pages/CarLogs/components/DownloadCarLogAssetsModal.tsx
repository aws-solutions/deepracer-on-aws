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
import { useGetCarLogAssetUrlsMutation } from '#services/deepRacer/carLogsApi.js';
import {
  displayErrorNotification,
  displaySuccessNotification,
  displayWarningNotification,
} from '#store/notifications/notificationsSlice.js';

import { downloadPresignedAsset } from '../utils.js';

interface AssetActionResult {
  assetId: string;
  filename: string;
  message?: string;
  success: boolean;
}

interface DownloadCarLogAssetsModalProps {
  assets: CarLogAsset[];
  isVisible: boolean;
  onDismiss: () => void;
}

const DownloadCarLogAssetsModal = ({ assets, isVisible, onDismiss }: DownloadCarLogAssetsModalProps) => {
  const { t } = useTranslation('carLogs');
  const dispatch = useAppDispatch();
  const [getCarLogAssetUrls, { isLoading }] = useGetCarLogAssetUrlsMutation();
  const [results, setResults] = useState<AssetActionResult[] | null>(null);

  const handleClose = () => {
    setResults(null);
    onDismiss();
  };

  const handleDownload = async () => {
    const response = await getCarLogAssetUrls({
      assets: assets.map((asset) => ({ profileId: asset.profileId, assetId: asset.assetId })),
    }).unwrap();

    const urlByAssetId = new Map(response.urls.map((url) => [url.assetId, url]));
    const errorByAssetId = new Map(response.errors.map((error) => [error.assetId, error]));
    const downloadResults: AssetActionResult[] = [];

    for (const asset of assets) {
      const assetError = errorByAssetId.get(asset.assetId);
      if (assetError) {
        downloadResults.push({
          assetId: asset.assetId,
          filename: asset.filename,
          message: assetError.message,
          success: false,
        });
        continue;
      }

      const assetUrl = urlByAssetId.get(asset.assetId);
      if (!assetUrl) {
        downloadResults.push({
          assetId: asset.assetId,
          filename: asset.filename,
          message: t('download.results.missingUrl'),
          success: false,
        });
        continue;
      }

      try {
        await downloadPresignedAsset(assetUrl.url, assetUrl.filename);
        downloadResults.push({ assetId: asset.assetId, filename: assetUrl.filename, success: true });
      } catch {
        downloadResults.push({
          assetId: asset.assetId,
          filename: assetUrl.filename,
          message: t('download.results.failedFetch'),
          success: false,
        });
      }
    }

    const successCount = downloadResults.filter((result) => result.success).length;
    const failureCount = downloadResults.length - successCount;

    if (failureCount === 0) {
      dispatch(displaySuccessNotification({ content: t('download.notifications.success', { count: successCount }) }));
    } else if (successCount === 0) {
      dispatch(displayErrorNotification({ content: t('download.notifications.error', { count: failureCount }) }));
    } else {
      dispatch(
        displayWarningNotification({
          content: t('download.notifications.partial', { successCount, failureCount }),
        }),
      );
    }

    setResults(downloadResults);
  };

  const summaryAlert = useMemo(() => {
    if (!results) return null;
    const successCount = results.filter((result) => result.success).length;
    const failureCount = results.length - successCount;

    if (failureCount === 0) {
      return <Alert type="success">{t('download.results.success', { count: successCount })}</Alert>;
    }
    if (successCount === 0) {
      return <Alert type="error">{t('download.results.error', { count: failureCount })}</Alert>;
    }
    return <Alert type="warning">{t('download.results.partial', { successCount, failureCount })}</Alert>;
  }, [results, t]);

  return (
    <Modal
      visible={isVisible}
      onDismiss={handleClose}
      header={t('download.header')}
      closeAriaLabel={t('download.closeAriaLabel')}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleClose} disabled={isLoading}>
              {results ? t('common.close') : t('common.cancel')}
            </Button>
            {!results && (
              <Button variant="primary" onClick={() => void handleDownload()} loading={isLoading}>
                {t('download.confirmButton')}
              </Button>
            )}
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {!results && <Box>{t('download.description')}</Box>}
        {isLoading && (
          <SpaceBetween direction="horizontal" size="xs">
            <Spinner />
            <Box>{t('download.inProgress')}</Box>
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

export default DownloadCarLogAssetsModal;
