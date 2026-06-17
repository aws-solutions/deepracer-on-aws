// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Icon from '@cloudscape-design/components/icon';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator, { StatusIndicatorProps } from '@cloudscape-design/components/status-indicator';
import Table, { TableProps } from '@cloudscape-design/components/table';
import Toggle from '@cloudscape-design/components/toggle';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type QueueItemStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface QueueItem {
  submissionId: string;
  profileId?: string;
  participantName: string;
  modelName: string;
  queuePosition: string;
  status: QueueItemStatus;
  submittedAt: string;
  avatar?: import('@deepracer-indy/typescript-client').AvatarConfig;
}

interface QueueManagementPanelProps {
  items: QueueItem[];
  onReorder: (submissionId: string, afterSubmissionId: string | null) => void;
  onRemove: (submissionId: string) => void;
  onReset: (submissionId: string) => void;
  isRaceCompleted: boolean;
  readOnly?: boolean;
  autolaunchEnabled?: boolean;
  submissionPeriodOpen?: boolean;
  onToggleAutolaunch?: (enabled: boolean) => void;
  onToggleSubmissions?: (open: boolean) => void;
}

const STATUS_TYPE_MAP: Record<QueueItemStatus, StatusIndicatorProps.Type> = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'success',
  FAILED: 'error',
};

/**
 * Queue management panel for race facilitators.
 * Uses row selection for Delete/Reset actions in header, inline up/down for reorder.
 */
const QueueManagementPanel = ({
  items,
  onReorder,
  onRemove,
  onReset,
  isRaceCompleted,
  readOnly,
  autolaunchEnabled,
  submissionPeriodOpen,
  onToggleAutolaunch,
  onToggleSubmissions,
}: QueueManagementPanelProps) => {
  const { t } = useTranslation('liveRace');
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<QueueItem[]>([]);

  const sortedItems = useMemo(() => {
    const byPosition = (a: QueueItem, b: QueueItem) =>
      a.queuePosition < b.queuePosition ? -1 : +(a.queuePosition > b.queuePosition);
    const statusOrder: Record<QueueItemStatus, number> = { COMPLETED: 0, FAILED: 1, IN_PROGRESS: 2, PENDING: 3 };
    return [...items].sort((a, b) => {
      const groupDiff = statusOrder[a.status] - statusOrder[b.status];
      if (groupDiff !== 0) return groupDiff;
      return byPosition(a, b);
    });
  }, [items]);

  const canModify = (status: QueueItemStatus) => status === 'PENDING';
  const canRemove = (status: QueueItemStatus) => status === 'PENDING' || status === 'FAILED';
  const canReset = (status: QueueItemStatus) => status === 'IN_PROGRESS' || status === 'FAILED';

  const pendingItems = useMemo(() => sortedItems.filter((i) => canModify(i.status)), [sortedItems]);

  const selected = selectedItems[0] ?? null;
  const currentSelected = selected
    ? (sortedItems.find((i) => i.submissionId === selected.submissionId) ?? selected)
    : null;
  const showRemove = currentSelected && canRemove(currentSelected.status) && !isRaceCompleted;
  const showReset = currentSelected && canReset(currentSelected.status) && !isRaceCompleted;

  const handleMoveUp = useCallback(
    (submissionId: string) => {
      const index = pendingItems.findIndex((item) => item.submissionId === submissionId);
      if (index <= 0) return;
      const afterSubmissionId = index >= 2 ? pendingItems[index - 2].submissionId : null;
      onReorder(submissionId, afterSubmissionId);
    },
    [pendingItems, onReorder],
  );

  const handleMoveDown = useCallback(
    (submissionId: string) => {
      const index = pendingItems.findIndex((item) => item.submissionId === submissionId);
      if (index < 0 || index >= pendingItems.length - 1) return;
      onReorder(submissionId, pendingItems[index + 1].submissionId);
    },
    [pendingItems, onReorder],
  );

  return (
    <>
      <Container
        header={
          <Header
            counter={`(${items.length})`}
            actions={
              readOnly ? null : (
                <SpaceBetween size="xs" direction="horizontal">
                  {onToggleAutolaunch && (
                    <Toggle
                      onChange={({ detail }) => onToggleAutolaunch(detail.checked)}
                      checked={autolaunchEnabled ?? false}
                      disabled={isRaceCompleted}
                      data-testid="autolaunch-toggle"
                    >
                      {t('facilitatorPanel.autolaunch')}
                    </Toggle>
                  )}
                  {onToggleSubmissions && (
                    <Toggle
                      onChange={({ detail }) => onToggleSubmissions(detail.checked)}
                      checked={submissionPeriodOpen ?? false}
                      disabled={isRaceCompleted}
                      data-testid="submissions-toggle"
                    >
                      {t('facilitatorPanel.submissions')}
                    </Toggle>
                  )}
                  {showRemove && (
                    <Button onClick={() => setRemoveTarget(selected.submissionId)} data-testid="header-remove-button">
                      {t('queuePanel.remove')}
                    </Button>
                  )}
                  {showReset && (
                    <Button
                      onClick={() => {
                        onReset(selected.submissionId);
                        setSelectedItems([]);
                      }}
                      data-testid="header-reset-button"
                    >
                      {t('queuePanel.reset')}
                    </Button>
                  )}
                </SpaceBetween>
              )
            }
          >
            {t('queuePanel.header')}
          </Header>
        }
        data-testid="queue-management-panel"
      >
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <Table
            items={sortedItems}
            selectionType={readOnly ? undefined : 'single'}
            selectedItems={readOnly ? undefined : selectedItems}
            onSelectionChange={readOnly ? undefined : ({ detail }) => setSelectedItems(detail.selectedItems)}
            stickyHeader={true}
            columnDefinitions={(
              [
                {
                  id: 'participant',
                  header: t('queuePanel.participant'),
                  cell: (e: QueueItem) => (
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontWeight: 'bold',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {e.participantName}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--color-text-status-inactive)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {e.modelName}
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'status',
                  header: t('queuePanel.status'),
                  cell: (e: QueueItem) => (
                    <StatusIndicator type={STATUS_TYPE_MAP[e.status]}>
                      {t(`queuePanel.statusLabels.${e.status}` as const)}
                    </StatusIndicator>
                  ),
                  width: 110,
                },
                {
                  id: 'reorder',
                  header: t('queuePanel.order'),
                  cell: (e: QueueItem) => {
                    const index = pendingItems.findIndex((item) => item.submissionId === e.submissionId);
                    if (!canModify(e.status) || isRaceCompleted)
                      return (
                        <div
                          style={{
                            minHeight: '56px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon name="lock-private" size="small" variant="disabled" />
                        </div>
                      );
                    return (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0px',
                          minHeight: '56px',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <Button
                          variant="icon"
                          iconName="angle-up"
                          disabled={index === 0}
                          onClick={() => handleMoveUp(e.submissionId)}
                          ariaLabel={t('queuePanel.moveUp')}
                          data-testid={`move-up-${e.submissionId}`}
                        />
                        <Button
                          variant="icon"
                          iconName="angle-down"
                          disabled={index === pendingItems.length - 1}
                          onClick={() => handleMoveDown(e.submissionId)}
                          ariaLabel={t('queuePanel.moveDown')}
                          data-testid={`move-down-${e.submissionId}`}
                        />
                      </div>
                    );
                  },
                  width: 45,
                },
              ] as TableProps.ColumnDefinition<QueueItem>[]
            ).filter((col) => !(readOnly && col.id === 'reorder'))}
            trackBy="submissionId"
            variant="embedded"
            empty={
              <Box textAlign="center" padding="l">
                {t('queuePanel.empty')}
              </Box>
            }
          />
        </div>
      </Container>

      <Modal
        visible={removeTarget !== null}
        onDismiss={() => setRemoveTarget(null)}
        header={t('queuePanel.removeConfirmTitle')}
        footer={
          <Box float="right">
            <SpaceBetween size="xs" direction="horizontal">
              <Button variant="link" onClick={() => setRemoveTarget(null)}>
                {t('facilitatorPanel.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (removeTarget) onRemove(removeTarget);
                  setRemoveTarget(null);
                  setSelectedItems([]);
                }}
                data-testid="confirm-remove-button"
              >
                {t('queuePanel.confirmRemove')}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        {t('queuePanel.removeConfirmMessage')}
      </Modal>
    </>
  );
};

export default QueueManagementPanel;
