// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCollection } from '@cloudscape-design/collection-hooks';
import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import CollectionPreferences from '@cloudscape-design/components/collection-preferences';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import Flashbar, { FlashbarProps } from '@cloudscape-design/components/flashbar';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import Pagination from '@cloudscape-design/components/pagination';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import Table from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { AdminModel, AdminProfile, ModelStatus } from '@deepracer-indy/typescript-client';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useLazyGetAdminAssetUrlQuery,
  useListAdminProfilesQuery,
  useListModelsForProfileQuery,
} from '#services/deepRacer/adminApi.js';

// --- Expandable row ---

interface ModelRowsProps {
  profileId: string;
  onDownloadError: (msg: string) => void;
}

interface DownloadCellProps {
  model: AdminModel;
  downloadingId: string | null;
  onDownload: (modelId: string) => void;
}

const DownloadCell = ({ model, downloadingId, onDownload }: DownloadCellProps) => {
  const { t } = useTranslation('adminModelDownload');
  if (model.status !== ModelStatus.READY) return <Box color="text-status-inactive">{t('models.notReady')}</Box>;
  if (downloadingId === model.modelId) return <Spinner />;
  return <Link onFollow={() => onDownload(model.modelId)}>{t('models.downloadLink')}</Link>;
};

const ModelRows = ({ profileId, onDownloadError }: ModelRowsProps) => {
  const { t } = useTranslation('adminModelDownload');
  const { data: models = [], isLoading, isFetching, isError, refetch } = useListModelsForProfileQuery({ profileId });
  const [triggerGetUrl] = useLazyGetAdminAssetUrlQuery();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(25);

  const { items, collectionProps, filterProps, paginationProps } = useCollection(models, {
    filtering: {
      filteringFunction: (item: AdminModel, filteringText: string) =>
        item.name.toLowerCase().includes(filteringText.toLowerCase()),
      empty: <Box color="text-body-secondary">{t('models.empty')}</Box>,
      noMatch: <Box color="text-body-secondary">{t('models.noMatch')}</Box>,
    },
    pagination: { pageSize },
    sorting: {
      defaultState: {
        sortingColumn: { sortingField: 'createdAt' },
        isDescending: true,
      },
    },
  });

  const handleDownload = useCallback(
    async (modelId: string) => {
      setDownloadingId(modelId);
      try {
        const result = await triggerGetUrl({ modelId, profileId });
        if (result.data) {
          const a = document.createElement('a');
          a.href = result.data.url;
          a.download = result.data.filename;
          a.click();
        } else {
          onDownloadError(t('models.downloadFailed'));
        }
      } catch {
        onDownloadError(t('models.downloadFailed'));
      } finally {
        setDownloadingId(null);
      }
    },
    [triggerGetUrl, profileId, onDownloadError, t],
  );

  if (isLoading)
    return (
      <SpaceBetween size="xs" direction="horizontal">
        <Spinner />
        <Box display="inline">{t('models.loadingText')}</Box>
      </SpaceBetween>
    );
  if (isError)
    return (
      <Alert type="error">
        {t('models.error.message')}{' '}
        <Button variant="link" onClick={() => refetch()}>
          {t('models.error.retry')}
        </Button>
      </Alert>
    );

  return (
    <Table
      variant="embedded"
      loading={isFetching}
      loadingText={t('models.loadingText')}
      items={items}
      {...collectionProps}
      header={
        <Header
          actions={<Button iconName="refresh" loading={isFetching} disabled={isFetching} onClick={() => refetch()} />}
        >
          {t('models.header')}
        </Header>
      }
      filter={<TextFilter {...filterProps} filteringPlaceholder={t('models.filter.placeholder')} />}
      pagination={<Pagination {...paginationProps} />}
      preferences={
        <CollectionPreferences
          title={t('preferences.title')}
          confirmLabel={t('preferences.confirmLabel')}
          cancelLabel={t('preferences.cancelLabel')}
          pageSizePreference={{ title: t('preferences.pageSize.title'), options: PAGE_SIZE_OPTIONS }}
          preferences={{ pageSize }}
          onConfirm={({ detail }) => setPageSize(detail.pageSize ?? 25)}
        />
      }
      columnDefinitions={[
        {
          id: 'name',
          header: t('models.columnHeader.modelName'),
          cell: (m: AdminModel) => m.name,
          sortingField: 'name',
        },
        {
          id: 'status',
          header: t('models.columnHeader.status'),
          cell: (m: AdminModel) => m.status,
          sortingField: 'status',
        },
        {
          id: 'createdAt',
          header: t('models.columnHeader.trainingDate'),
          cell: (m: AdminModel) => m.createdAt.toLocaleDateString(),
          sortingField: 'createdAt',
        },
        {
          id: 'download',
          header: t('models.columnHeader.download'),
          cell: (m: AdminModel) => <DownloadCell model={m} downloadingId={downloadingId} onDownload={handleDownload} />,
        },
      ]}
    />
  );
};

// --- Profile alias cell ---

interface ProfileCellProps {
  profile: AdminProfile;
  expandedIds: Set<string>;
  onToggle: (profileId: string) => void;
  onDownloadError: (msg: string) => void;
}

const ProfileCell = ({ profile, expandedIds, onToggle, onDownloadError }: ProfileCellProps) => {
  const isExpanded = expandedIds.has(profile.profileId);
  return (
    <ExpandableSection
      headerText={profile.alias}
      expanded={isExpanded}
      onChange={() => onToggle(profile.profileId)}
      variant="inline"
    >
      {isExpanded && <ModelRows profileId={profile.profileId} onDownloadError={onDownloadError} />}
    </ExpandableSection>
  );
};

// --- Main page ---

const PAGE_SIZE_OPTIONS = [
  { value: 25, label: '25' },
  { value: 50, label: '50' },
];

const AdminModelDownload = () => {
  const { t } = useTranslation('adminModelDownload');
  const { data: profiles = [], isFetching, isError, refetch } = useListAdminProfilesQuery();
  const [pageSize, setPageSize] = useState(25);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [flashItems, setFlashItems] = useState<FlashbarProps.MessageDefinition[]>([]);

  const { items, collectionProps, filterProps, paginationProps } = useCollection(profiles, {
    filtering: {
      filteringFunction: (item: AdminProfile, filteringText: string) => {
        const lower = filteringText.toLowerCase();
        return item.alias.toLowerCase().includes(lower) || (item.emailAddress?.toLowerCase().includes(lower) ?? false);
      },
      empty: isError ? (
        <Box textAlign="center">
          <Box variant="strong">{t('profiles.error.message')}</Box>
          <Button onClick={() => refetch()}>{t('profiles.error.retry')}</Button>
        </Box>
      ) : (
        <Box textAlign="center">{t('profiles.empty')}</Box>
      ),
      noMatch: <Box textAlign="center">{t('profiles.noMatch')}</Box>,
    },
    pagination: { pageSize },
    sorting: {
      defaultState: {
        sortingColumn: { sortingField: 'alias' },
        isDescending: false,
      },
    },
  });

  const handleDownloadError = useCallback((msg: string) => {
    const id = String(Date.now());
    setFlashItems((prev) => [
      ...prev,
      {
        type: 'error',
        content: msg,
        id,
        dismissible: true,
        onDismiss: () => setFlashItems((f) => f.filter((i) => i.id !== id)),
      },
    ]);
    setTimeout(() => setFlashItems((f) => f.filter((i) => i.id !== id)), 8000);
  }, []);

  const toggleExpand = useCallback((profileId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(profileId) ? next.delete(profileId) : next.add(profileId);
      return next;
    });
  }, []);

  return (
    <SpaceBetween size="m">
      <Flashbar items={flashItems} />
      <Table
        loading={isFetching}
        loadingText={t('profiles.loadingText')}
        items={items}
        {...collectionProps}
        header={
          <Header
            actions={<Button iconName="refresh" loading={isFetching} disabled={isFetching} onClick={() => refetch()} />}
          >
            {t('profiles.header')}
          </Header>
        }
        columnDefinitions={[
          {
            id: 'alias',
            header: t('profiles.columnHeader.racerName'),
            sortingField: 'alias',
            cell: (p: AdminProfile) => (
              <ProfileCell
                profile={p}
                expandedIds={expandedIds}
                onToggle={toggleExpand}
                onDownloadError={handleDownloadError}
              />
            ),
          },
          {
            id: 'email',
            header: t('profiles.columnHeader.email'),
            cell: (p: AdminProfile) => p.emailAddress ?? '—',
            sortingField: 'emailAddress',
          },
          {
            id: 'modelCount',
            header: t('profiles.columnHeader.models'),
            cell: (p: AdminProfile) => p.totalModelCount ?? 0,
            sortingField: 'totalModelCount',
          },
        ]}
        filter={<TextFilter {...filterProps} filteringPlaceholder={t('profiles.filter.placeholder')} />}
        pagination={<Pagination {...paginationProps} />}
        preferences={
          <CollectionPreferences
            title={t('preferences.title')}
            confirmLabel={t('preferences.confirmLabel')}
            cancelLabel={t('preferences.cancelLabel')}
            pageSizePreference={{ title: t('preferences.pageSize.title'), options: PAGE_SIZE_OPTIONS }}
            preferences={{ pageSize }}
            onConfirm={({ detail }) => {
              setPageSize(detail.pageSize ?? 25);
            }}
          />
        }
      />
    </SpaceBetween>
  );
};

export default AdminModelDownload;
