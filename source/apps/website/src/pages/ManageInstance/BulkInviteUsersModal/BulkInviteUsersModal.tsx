// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Button from '@cloudscape-design/components/button';
import FileUpload from '@cloudscape-design/components/file-upload';
import FormField from '@cloudscape-design/components/form-field';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { BulkInviteJobStatus } from '@deepracer-indy/typescript-client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useLocalStorage } from '#hooks/useLocalStorage.js';
import {
  useBulkInviteUserMutation,
  useGetBulkInviteUserJobStatusQuery,
  useGetProfileQuery,
  useListProfilesQuery,
} from '#services/deepRacer/profileApi.js';

import BulkInviteEntriesTable, { BulkInviteRow } from './BulkInviteEntriesTable.js';
import BulkInviteJobProgress from './BulkInviteJobProgress.js';
import { ACTIVE_BULK_INVITE_JOB_STORAGE_KEY, BULK_INVITE_JOB_POLLING_INTERVAL_MS } from './constants.js';
import { CsvParseResult, parseBulkInviteCsv, MAX_BULK_INVITE_ENTRIES } from './csvParser.js';

interface BulkInviteUsersModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

interface ActiveBulkInviteJob {
  jobId: string;
  adminProfileId?: string;
}

const EMPTY_PARSE_RESULT: CsvParseResult = { entries: [], issues: [] };

const BulkInviteUsersModal = ({ isOpen, setIsOpen }: BulkInviteUsersModalProps) => {
  const { t } = useTranslation('manageInstance');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [parseResult, setParseResult] = useState<CsvParseResult>(EMPTY_PARSE_RESULT);
  const [fileReadError, setFileReadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [activeJob, setActiveJob] = useLocalStorage<ActiveBulkInviteJob | null>(
    ACTIVE_BULK_INVITE_JOB_STORAGE_KEY,
    null,
  );

  const [submittedJobId, setSubmittedJobId] = useState<string | null>(activeJob?.jobId ?? null);

  const [bulkInviteUser, { isLoading: isSubmitting }] = useBulkInviteUserMutation();
  const { refetch: refetchProfiles } = useListProfilesQuery();
  const { data: currentUserProfile } = useGetProfileQuery();

  const isJobActive = activeJob !== null;
  const hasSubmittedJob = submittedJobId !== null;
  const {
    data: jobStatus,
    currentData: currentJobStatus,
    error: jobStatusError,
  } = useGetBulkInviteUserJobStatusQuery(
    { jobId: submittedJobId ?? '' },
    {
      skip: !hasSubmittedJob,
      pollingInterval: isJobActive ? BULK_INVITE_JOB_POLLING_INTERVAL_MS : 0,
    },
  );

  const isJobTerminal = new Set<BulkInviteJobStatus | undefined>([
    BulkInviteJobStatus.COMPLETED,
    BulkInviteJobStatus.FAILED,
  ]).has(currentJobStatus?.status);

  useEffect(() => {
    if (isJobActive && (isJobTerminal || jobStatusError)) {
      setActiveJob(null);
      refetchProfiles().catch(() => {
        /** no-op: background refresh, errors surface via the query hook */
      });
    }
  }, [isJobActive, isJobTerminal, jobStatusError, setActiveJob, refetchProfiles]);

  const resetUploadState = () => {
    setSelectedFiles([]);
    setParseResult(EMPTY_PARSE_RESULT);
    setFileReadError(null);
    setSubmitError(null);
    if (!isJobActive) {
      setSubmittedJobId(null);
    }
  };

  const handleClose = () => {
    resetUploadState();
    setIsOpen(false);
  };

  const handleFileChange = (files: File[]) => {
    setFileReadError(null);
    setSubmitError(null);
    setParseResult(EMPTY_PARSE_RESULT);
    setSelectedFiles(files);

    const file = files[0];
    if (!file) return;

    file
      .text()
      .then((content) => {
        const result = parseBulkInviteCsv(content);
        if (result.entries.length === 0 && result.issues.length === 0) {
          setFileReadError(t('bulkInviteUsersModal.errors.emptyFile'));
          return;
        }
        setParseResult(result);
      })
      .catch(() => {
        setFileReadError(t('bulkInviteUsersModal.errors.readFailed'));
      });
  };

  const handleSubmit = async () => {
    if (parseResult.entries.length === 0 || parseResult.issues.length > 0) return;

    setSubmitError(null);
    try {
      const response = await bulkInviteUser({ profiles: parseResult.entries }).unwrap();
      setActiveJob({ jobId: response.jobId, adminProfileId: currentUserProfile?.profileId });
      setSubmittedJobId(response.jobId);
    } catch (error) {
      const message = (error as { error?: string })?.error || t('bulkInviteUsersModal.errors.submitFailed');
      setSubmitError(message);
    }
  };

  const canSubmit = !hasSubmittedJob && parseResult.entries.length > 0 && parseResult.issues.length === 0;

  const rows: BulkInviteRow[] = useMemo(() => {
    const resultsByEmail = new Map((jobStatus?.results ?? []).map((result) => [result.emailAddress, result]));

    if (parseResult.entries.length === 0 && resultsByEmail.size > 0) {
      return Array.from(resultsByEmail.values()).map((result) => ({
        emailAddress: result.emailAddress,
        displayName: result.displayName,
        status: result.status,
        reason: result.reason,
      }));
    }

    return parseResult.entries.map((entry) => {
      const result = resultsByEmail.get(entry.emailAddress);
      return result
        ? {
            emailAddress: result.emailAddress,
            displayName: result.displayName,
            status: result.status,
            reason: result.reason,
          }
        : { emailAddress: entry.emailAddress, displayName: entry.displayName, status: 'PENDING' as const };
    });
  }, [parseResult.entries, jobStatus?.results]);

  return (
    <Modal
      onDismiss={handleClose}
      visible={isOpen}
      closeAriaLabel="Close modal"
      size="large"
      header={t('bulkInviteUsersModal.header')}
    >
      <SpaceBetween size="l">
        {!hasSubmittedJob && (
          <FormField
            label={t('bulkInviteUsersModal.csvFile.label')}
            description={t('bulkInviteUsersModal.csvFile.description', { maxEntries: MAX_BULK_INVITE_ENTRIES })}
            stretch
          >
            <SpaceBetween size="s">
              <FileUpload
                data-testid="bulk-invite-file-upload"
                value={selectedFiles}
                onChange={({ detail }) => handleFileChange(detail.value)}
                accept=".csv,text/csv"
                showFileSize
                i18nStrings={{
                  uploadButtonText: () => t('bulkInviteUsersModal.fileUpload.uploadButtonText'),
                  dropzoneText: () => t('bulkInviteUsersModal.fileUpload.dropzoneText'),
                  removeFileAriaLabel: () => t('bulkInviteUsersModal.fileUpload.removeFileAriaLabel'),
                  limitShowFewer: t('bulkInviteUsersModal.fileUpload.limitShowFewer'),
                  limitShowMore: t('bulkInviteUsersModal.fileUpload.limitShowMore'),
                  errorIconAriaLabel: t('bulkInviteUsersModal.fileUpload.errorIconAriaLabel'),
                  warningIconAriaLabel: t('bulkInviteUsersModal.fileUpload.warningIconAriaLabel'),
                }}
                constraintText={t('bulkInviteUsersModal.csvFile.constraintText')}
              />
              {fileReadError && <Alert type="error">{fileReadError}</Alert>}
              {submitError && <Alert type="error">{submitError}</Alert>}
              {parseResult.issues.length > 0 && (
                <Alert
                  type="error"
                  header={t('bulkInviteUsersModal.issuesFound', { count: parseResult.issues.length })}
                >
                  <ul>
                    {parseResult.issues.map((issue) => (
                      <li key={`${issue.line}-${issue.message}`}>
                        {t('bulkInviteUsersModal.issueLine', { line: issue.line, message: issue.message })}
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}
            </SpaceBetween>
          </FormField>
        )}

        {hasSubmittedJob && <BulkInviteJobProgress jobStatus={jobStatus} isJobTerminal={isJobTerminal} />}

        <BulkInviteEntriesTable rows={rows} />

        <SpaceBetween size="xs" direction="horizontal">
          <Button onClick={handleClose}>
            {hasSubmittedJob ? t('bulkInviteUsersModal.buttons.close') : t('bulkInviteUsersModal.buttons.cancel')}
          </Button>
          {!hasSubmittedJob && (
            <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit} loading={isSubmitting}>
              {t('bulkInviteUsersModal.buttons.inviteUsers')}
            </Button>
          )}
        </SpaceBetween>
      </SpaceBetween>
    </Modal>
  );
};

export default BulkInviteUsersModal;
