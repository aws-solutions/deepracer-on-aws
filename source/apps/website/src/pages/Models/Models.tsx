// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import Header from '@cloudscape-design/components/header';
import Modal from '@cloudscape-design/components/modal';
import Pagination from '@cloudscape-design/components/pagination';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { Model, ModelStatus } from '@deepracer-indy/typescript-client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { PageId } from '#constants/pages';
import { useAppDispatch } from '#hooks/useAppDispatch';
import { LIST_MODELS_POLLING_INTERVAL_TIME } from '#pages/ModelDetails/constants.js';
import { useDeleteModelMutation, useListModelsQuery } from '#services/deepRacer/modelsApi.js';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice';
import { getPath } from '#utils/pageUtils.js';

import { useModelsTableConfig } from './components/ModelsTableConfig';
import { createCloneModelFormValues } from './utils';

const Models = () => {
  const { t } = useTranslation('models');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const modelIdStatusMapRef = useRef<Map<string, ModelStatus>>(new Map());
  const [pollingInterval, setPollingInterval] = useState(0);

  const {
    data: models = [],
    isLoading,
    refetch,
  } = useListModelsQuery(undefined, {
    pollingInterval,
    skipPollingIfUnfocused: true,
    refetchOnMountOrArgChange: true,
  });

  const hasImportingModels = models.some((model) => model.status === ModelStatus.IMPORTING);

  const [deleteModel] = useDeleteModelMutation();
  const {
    collectionProps,
    columnDefinitions,
    columnDisplay,
    filteredItemsCount,
    filterProps,
    items,
    ModelsTablePreferences,
    paginationProps,
    selectedItems,
  } = useModelsTableConfig(models);
  const [showModal, setShowModal] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<Model>();

  const handleStatusTransition = useCallback(
    (model: Model, previousStatus: ModelStatus, currentStatus: ModelStatus) => {
      if (currentStatus === ModelStatus.READY) {
        const successKey = `notifications.statusTransitions.${previousStatus}.toReady`;
        const tFunction = t as (translationKey: string, options?: { modelName: string }) => string;
        const message = tFunction(successKey, { modelName: model.name });
        if (message !== successKey) {
          dispatch(displaySuccessNotification({ content: message }));
        }
      } else if (currentStatus === ModelStatus.ERROR) {
        const errorKey = `notifications.statusTransitions.${previousStatus}.toError`;
        const tFunction = t as (translationKey: string, options?: { modelName: string }) => string;
        const message = tFunction(errorKey, { modelName: model.name });
        if (message !== errorKey) {
          dispatch(displayErrorNotification({ content: message }));
        }
      }
    },
    [dispatch, t],
  );

  // Track model statuses and update polling condition
  useEffect(() => {
    setPollingInterval(hasImportingModels ? LIST_MODELS_POLLING_INTERVAL_TIME : 0);

    models.forEach((model) => {
      const previousStatus = modelIdStatusMapRef.current.get(model.modelId);
      const currentStatus = model.status;

      if (previousStatus && previousStatus !== currentStatus) {
        handleStatusTransition(model, previousStatus, currentStatus);
      }

      modelIdStatusMapRef.current.set(model.modelId, currentStatus);
    });
  }, [models, hasImportingModels, handleStatusTransition]);

  const getDisableState = (e: Model) => {
    switch (e.status) {
      case ModelStatus.QUEUED:
      case ModelStatus.STOPPING:
      case ModelStatus.DELETING:
        return true;
      default:
        return false;
    }
  };

  return (
    <>
      <Table
        {...collectionProps}
        variant="full-page"
        data-testid="modelsListRoot"
        isItemDisabled={getDisableState}
        items={items}
        columnDefinitions={columnDefinitions}
        columnDisplay={columnDisplay}
        selectionType="single"
        resizableColumns
        header={
          <Header
            counter={selectedItems?.length ? `(${selectedItems.length}/${models.length})` : `(${models.length})`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" loading={isLoading} onClick={() => refetch()} />
                <Button
                  data-testid="importModelButton"
                  variant="normal"
                  onClick={() => navigate(getPath(PageId.IMPORT_MODEL))}
                >
                  {t('table.importModelButton')}
                </Button>
                <ButtonDropdown
                  items={[
                    {
                      text: t('table.cloneButton'),
                      id: 'CLONE',
                      disabled: !selectedItems?.length || selectedItems?.[0].status !== ModelStatus.READY,
                    },
                    {
                      text: t('table.deleteButton'),
                      id: 'DELETE',
                      disabled: !selectedItems?.length || selectedItems?.[0].status === ModelStatus.TRAINING,
                    },
                  ]}
                  onItemClick={(e) => {
                    switch (e.detail.id) {
                      case 'DELETE': {
                        setModelToDelete(selectedItems?.[0]);
                        setShowModal(true);
                        break;
                      }
                      case 'CLONE': {
                        if (selectedItems?.length) {
                          navigate(getPath(PageId.CREATE_MODEL), {
                            state: {
                              clonedModelFormValues: createCloneModelFormValues(selectedItems[0]),
                            },
                          });
                        }
                        break;
                      }
                      default:
                        break;
                    }
                  }}
                >
                  {t('table.buttonDropdownLabel')}
                </ButtonDropdown>
                <Button variant="primary" onClick={() => navigate(getPath(PageId.CREATE_MODEL))}>
                  {t('table.createModelButton')}
                </Button>
              </SpaceBetween>
            }
          >
            {t('table.header')}
          </Header>
        }
        loading={isLoading}
        loadingText={t('table.loadingText')}
        filter={
          <TextFilter
            {...filterProps}
            filteringAriaLabel={t('table.filters.filteringAriaLabel')}
            filteringPlaceholder={t('table.filters.searchFilterPlaceholder')}
            countText={filterProps.filteringText && t('table.filters.matchCount', { count: filteredItemsCount ?? 0 })}
          />
        }
        trackBy="modelId"
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
        preferences={<ModelsTablePreferences />}
      />
      <Modal
        onDismiss={() => setShowModal(false)}
        visible={showModal}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowModal(false)}>
                {t('table.deleteModal.cancelButton')}
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  setShowModal(false);
                  await deleteModel({ modelId: modelToDelete?.modelId ?? '' });
                }}
              >
                {t('table.deleteModal.deleteButton')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('table.deleteModal.header')}
      >
        {t('table.deleteModal.content', { modelName: modelToDelete?.name })}
      </Modal>
    </>
  );
};

export default Models;
