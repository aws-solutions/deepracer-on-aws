// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table from '@cloudscape-design/components/table';
import { Profile } from '@deepracer-indy/typescript-client';
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useResendInviteMutation } from '#services/deepRacer/profileApi.js';

interface ResendInviteModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  selectedUsers: Profile[];
  onClearSelection?: (() => void) | null;
}

interface ResendResult {
  profileId: string;
  emailAddress?: string;
  alias?: string;
  outcome: 'sent' | 'skipped' | 'error';
  message: string;
}

interface ResultStatusLabels {
  sent: string;
  skipped: string;
  error: string;
}

/**
 * Renders the result cell for a resend-invite row. Kept as a plain function (not a nested
 * component) taking its translated labels as data — SonarQube's S6478 flags inline
 * `cell: (item) => <Jsx/>` callbacks in Cloudscape's `columnDefinitions` as if they were React
 * component definitions, even though this is a render-prop callback invoked per-row by
 * `<Table>`, never mounted as its own component. `labels` is resolved by the caller (via
 * `useTranslation`) since this function can't call hooks itself.
 */
const renderResultCell = (item: ResendResult, labels: ResultStatusLabels) => {
  if (item.outcome === 'sent') {
    return <StatusIndicator type="success">{labels.sent}</StatusIndicator>;
  }
  if (item.outcome === 'skipped') {
    return <StatusIndicator type="warning">{labels.skipped}</StatusIndicator>;
  }
  return <StatusIndicator type="error">{labels.error}</StatusIndicator>;
};

/**
 * Sequentially calls ResendInvite for each selected user and shows inline per-user results.
 * Unlike bulk import, there is no backend job tracking for resend — if the admin
 * navigates away mid-resend, remaining users are simply not processed (accepted for v1 given
 * typical resend batch sizes of 5-20 users).
 */
const ResendInviteModal = ({ isOpen, setIsOpen, selectedUsers, onClearSelection }: ResendInviteModalProps) => {
  const { t } = useTranslation('manageInstance');
  const [resendInvite] = useResendInviteMutation();
  const [isSending, setIsSending] = useState(false);
  const [results, setResults] = useState<ResendResult[]>([]);
  // Guards the in-flight sequential send loop against updates after the modal has been closed
  // mid-send: handleClose flips this before clearing `results`, and the loop checks it before
  // each `setResults` call so a stale response arriving after close cannot repopulate the
  // results the admin already dismissed (which would otherwise show stale/partial results and
  // skip the confirm prompt, since `hasRun` would become truthy again, on the next open).
  const isActiveRef = useRef(true);

  const hasRun = results.length > 0;

  const handleClose = () => {
    isActiveRef.current = false;
    setIsSending(false);
    setResults([]);
    setIsOpen(false);
  };

  const processUser = async (user: Profile): Promise<boolean> => {
    if (!user.profileId) return true;

    try {
      const message = await resendInvite({ profileId: user.profileId }).unwrap();
      if (!isActiveRef.current) return false;
      setResults((prev) => [
        ...prev,
        { profileId: user.profileId, emailAddress: user.emailAddress, alias: user.alias, outcome: 'sent', message },
      ]);
    } catch (error) {
      if (!isActiveRef.current) return false;
      const errorName = (error as { name?: string })?.name;
      const outcome = errorName === 'ConflictError' ? 'skipped' : 'error';
      const message =
        outcome === 'skipped'
          ? t('resendInviteModal.results.skippedMessage')
          : (error as { error?: string })?.error || t('resendInviteModal.results.errorMessage');
      setResults((prev) => [
        ...prev,
        { profileId: user.profileId, emailAddress: user.emailAddress, alias: user.alias, outcome, message },
      ]);
    }

    return true;
  };

  const handleResend = async () => {
    isActiveRef.current = true;
    setIsSending(true);
    setResults([]);

    // Sequential, not Promise.all, to keep results ordered by the selected users.
    for (const user of selectedUsers) {
      const shouldContinue = await processUser(user);
      if (!shouldContinue) return;
    }

    if (isActiveRef.current) {
      setIsSending(false);
    }
  };

  const handleDone = () => {
    onClearSelection?.();
    handleClose();
  };

  return (
    <Modal
      onDismiss={handleClose}
      visible={isOpen}
      closeAriaLabel="Close modal"
      size="large"
      header={t('resendInviteModal.header')}
    >
      <SpaceBetween size="l">
        {!hasRun && selectedUsers.length > 0 && (
          <Box>{t('resendInviteModal.confirmMessage', { count: selectedUsers.length })}</Box>
        )}

        {hasRun && (
          <Table
            data-testid="resend-invite-results-table"
            columnDefinitions={[
              {
                id: 'email',
                header: t('resendInviteModal.results.columns.email'),
                cell: (item) => item.emailAddress || item.alias || item.profileId,
              },
              {
                id: 'result',
                header: t('resendInviteModal.results.columns.result'),
                cell: (item) =>
                  renderResultCell(item, {
                    sent: t('resendInviteModal.results.status.sent'),
                    skipped: t('resendInviteModal.results.status.skipped'),
                    error: t('resendInviteModal.results.status.error'),
                  }),
              },
              {
                id: 'message',
                header: t('resendInviteModal.results.columns.details'),
                cell: (item) => item.message,
              },
            ]}
            items={results}
            variant="embedded"
          />
        )}

        {!hasRun && selectedUsers.length === 0 && (
          <Alert type="warning">{t('resendInviteModal.noUsersSelected')}</Alert>
        )}

        <SpaceBetween size="xs" direction="horizontal">
          {!hasRun && (
            <>
              <Button onClick={handleClose}>{t('resendInviteModal.buttons.cancel')}</Button>
              <Button
                variant="primary"
                onClick={handleResend}
                disabled={selectedUsers.length === 0}
                loading={isSending}
              >
                {t('resendInviteModal.buttons.resendInvitation')}
              </Button>
            </>
          )}
          {hasRun && (
            <Button variant="primary" onClick={handleDone} disabled={isSending}>
              {t('resendInviteModal.buttons.done')}
            </Button>
          )}
        </SpaceBetween>
      </SpaceBetween>
    </Modal>
  );
};

export default ResendInviteModal;
