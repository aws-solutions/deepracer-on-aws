// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import { BulkInviteEntryStatus, BulkInviteJobStatus } from '@deepracer-indy/typescript-client';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';

import {
  useBulkInviteUserMutation,
  useGetBulkInviteUserJobStatusQuery,
  useGetProfileQuery,
  useListProfilesQuery,
} from '#services/deepRacer/profileApi';

import BulkInviteUsersModal from '../BulkInviteUsersModal';
import { ACTIVE_BULK_INVITE_JOB_STORAGE_KEY } from '../constants';

vi.mock('#services/deepRacer/profileApi');

describe('BulkInviteUsersModal', () => {
  const mockSetIsOpen = vi.fn();
  const mockBulkInviteUser = vi.fn();
  const mockRefetchProfiles = vi.fn();

  const mockUseBulkInviteUserMutation = useBulkInviteUserMutation as unknown as Mock;
  const mockUseGetBulkInviteUserJobStatusQuery = useGetBulkInviteUserJobStatusQuery as unknown as Mock;
  const mockUseGetProfileQuery = useGetProfileQuery as unknown as Mock;
  const mockUseListProfilesQuery = useListProfilesQuery as unknown as Mock;

  const createTestStore = () =>
    configureStore({
      reducer: {
        notifications: (state = {}) => state,
      },
    });

  const renderWithProvider = (component: React.ReactElement) => {
    const store = createTestStore();
    return render(<Provider store={store}>{component}</Provider>);
  };

  const defaultProps = {
    isOpen: true,
    setIsOpen: mockSetIsOpen,
  };

  const createFile = (content: string, name = 'invite.csv') => new File([content], name, { type: 'text/csv' });

  const uploadFile = async (user: ReturnType<typeof userEvent.setup>, content: string) => {
    const fileUpload = createWrapper().findFileUpload('[data-testid="bulk-invite-file-upload"]');
    const input = fileUpload?.findNativeInput().getElement();
    if (!input) throw new Error('FileUpload native input not found');
    await user.upload(input, createFile(content));
  };

  const getEntriesTable = () => {
    const table = createWrapper().findTable('[data-testid="bulk-invite-entries-table"]');
    if (!table) throw new Error('Entries table not found');
    return table;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockUseBulkInviteUserMutation.mockReturnValue([mockBulkInviteUser, { isLoading: false }]);
    mockUseGetBulkInviteUserJobStatusQuery.mockReturnValue({
      data: undefined,
      currentData: undefined,
      error: undefined,
    });
    mockUseGetProfileQuery.mockReturnValue({ data: { profileId: 'admin-1' } });
    mockUseListProfilesQuery.mockReturnValue({ refetch: mockRefetchProfiles.mockResolvedValue(undefined) });
  });

  describe('Rendering', () => {
    it('renders the modal when isOpen is true', () => {
      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Invite multiple users')).toBeInTheDocument();
    });

    it('disables the submit button before a file is uploaded', () => {
      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Invite users' })).toBeDisabled();
    });

    it('does not render the entries table before a file is uploaded', () => {
      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);

      expect(screen.queryByTestId('bulk-invite-entries-table')).not.toBeInTheDocument();
    });
  });

  describe('CSV upload and validation', () => {
    it('populates the entries table with Pending rows after uploading a valid CSV', async () => {
      const user = userEvent.setup();
      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);

      await uploadFile(user, 'alice@example.com,Alice Smith');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Invite users' })).not.toBeDisabled();
      });
      expect(screen.getByTestId('bulk-invite-entries-table')).toBeInTheDocument();
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('shows all validation issues and keeps submit disabled for an invalid CSV', async () => {
      const user = userEvent.setup();
      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);

      await uploadFile(user, 'not-an-email\nalice@example.com,Alice\nalice@example.com,Alice Again');

      await waitFor(() => {
        expect(screen.getByText(/2 issues found/)).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Invite users' })).toBeDisabled();
      expect(mockBulkInviteUser).not.toHaveBeenCalled();
      // Invalid CSVs never populate the table — entries is empty when issues exist.
      expect(screen.queryByTestId('bulk-invite-entries-table')).not.toBeInTheDocument();
    });

    it('shows an error for a file containing no entries', async () => {
      const user = userEvent.setup();
      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);

      await uploadFile(user, 'email,displayName');

      await waitFor(() => {
        expect(screen.getByText('The file contains no entries.')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Invite users' })).toBeDisabled();
    });
  });

  describe('Submission', () => {
    it('submits parsed entries and stores the active job id in localStorage', async () => {
      const user = userEvent.setup();
      const mockUnwrap = vi
        .fn()
        .mockResolvedValue({ jobId: 'job-123', status: BulkInviteJobStatus.PROCESSING, totalEntries: 1 });
      mockBulkInviteUser.mockReturnValue({ unwrap: mockUnwrap });

      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);

      await uploadFile(user, 'alice@example.com,Alice Smith');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Invite users' })).not.toBeDisabled());

      await user.click(screen.getByRole('button', { name: 'Invite users' }));

      await waitFor(() => {
        expect(mockBulkInviteUser).toHaveBeenCalledWith({
          profiles: [{ emailAddress: 'alice@example.com', displayName: 'Alice Smith' }],
        });
      });

      await waitFor(() => {
        const stored = JSON.parse(localStorage.getItem(ACTIVE_BULK_INVITE_JOB_STORAGE_KEY) ?? 'null');
        expect(stored).toEqual({ jobId: 'job-123', adminProfileId: 'admin-1' });
      });
    });

    it('surfaces a submit error inline without clearing the parsed entries', async () => {
      const user = userEvent.setup();
      const mockUnwrap = vi.fn().mockRejectedValue({ error: 'Invalid request body' });
      mockBulkInviteUser.mockReturnValue({ unwrap: mockUnwrap });

      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);

      await uploadFile(user, 'alice@example.com,Alice Smith');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Invite users' })).not.toBeDisabled());

      await user.click(screen.getByRole('button', { name: 'Invite users' }));

      await waitFor(() => {
        expect(screen.getByText('Invalid request body')).toBeInTheDocument();
      });
      // The entries table (and its Pending rows) must still be visible after a failed submit.
      expect(screen.getByTestId('bulk-invite-entries-table')).toBeInTheDocument();
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });
  });

  describe('Progress polling — table stays mounted and updates in place', () => {
    beforeEach(() => {
      localStorage.setItem(ACTIVE_BULK_INVITE_JOB_STORAGE_KEY, JSON.stringify({ jobId: 'job-123' }));
    });

    it('renders the progress bar alongside the entries table while PROCESSING', () => {
      const processingJobStatus = {
        status: BulkInviteJobStatus.PROCESSING,
        totalEntries: 2,
        processedCount: 1,
        createdCount: 1,
        skippedCount: 0,
        failedCount: 0,
        results: [{ emailAddress: 'alice@example.com', status: BulkInviteEntryStatus.CREATED }],
      };
      mockUseGetBulkInviteUserJobStatusQuery.mockReturnValue({
        data: processingJobStatus,
        currentData: processingJobStatus,
        error: undefined,
      });

      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);

      expect(screen.getByText('Importing users…')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-invite-entries-table')).toBeInTheDocument();
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
    });

    it('shows a mix of processed and Pending rows for entries not yet in the poll response', async () => {
      const user = userEvent.setup();
      // Not yet job-active: upload a 2-entry CSV so the table's row source (parseResult.entries)
      // is populated, then simulate the job becoming active with only one entry processed so far.
      localStorage.clear();
      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);
      await uploadFile(user, 'alice@example.com,Alice\nbob@example.com,Bob');
      await screen.findByText('alice@example.com');

      mockUseGetBulkInviteUserJobStatusQuery.mockReturnValue({
        data: {
          status: BulkInviteJobStatus.PROCESSING,
          totalEntries: 2,
          processedCount: 1,
          createdCount: 1,
          skippedCount: 0,
          failedCount: 0,
          results: [{ emailAddress: 'alice@example.com', status: BulkInviteEntryStatus.CREATED }],
        },
        currentData: {
          status: BulkInviteJobStatus.PROCESSING,
          totalEntries: 2,
          processedCount: 1,
          createdCount: 1,
          skippedCount: 0,
          failedCount: 0,
          results: [{ emailAddress: 'alice@example.com', status: BulkInviteEntryStatus.CREATED }],
        },
        error: undefined,
      });

      const mockUnwrap = vi
        .fn()
        .mockResolvedValue({ jobId: 'job-123', status: BulkInviteJobStatus.PROCESSING, totalEntries: 2 });
      mockBulkInviteUser.mockReturnValue({ unwrap: mockUnwrap });
      await user.click(screen.getByRole('button', { name: 'Invite users' }));

      await waitFor(() => {
        expect(screen.getByText('Created')).toBeInTheDocument();
      });
      // bob is still Pending — the row is overwritten in place, not the whole table replaced.
      expect(screen.getByText('bob@example.com')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-invite-entries-table')).toBeInTheDocument();
    });

    it('clears the active job and refreshes the Users table once the job reaches COMPLETED', () => {
      const completedJobStatus = {
        status: BulkInviteJobStatus.COMPLETED,
        totalEntries: 1,
        processedCount: 1,
        createdCount: 1,
        skippedCount: 0,
        failedCount: 0,
        results: [{ emailAddress: 'alice@example.com', status: BulkInviteEntryStatus.CREATED }],
      };
      mockUseGetBulkInviteUserJobStatusQuery.mockReturnValue({
        data: completedJobStatus,
        currentData: completedJobStatus,
        error: undefined,
      });

      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);

      expect(mockRefetchProfiles).toHaveBeenCalledTimes(1);
      // useLocalStorage always calls setItem (never removeItem), so a cleared job is the
      // JSON-serialized `null`, not an absent key.
      expect(JSON.parse(localStorage.getItem(ACTIVE_BULK_INVITE_JOB_STORAGE_KEY) ?? 'undefined')).toBeNull();
      // The table remains visible with the final results even after the job clears.
      expect(screen.getByTestId('bulk-invite-entries-table')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
    });

    it('clears the active job when the status query errors (e.g. stale/expired job)', () => {
      mockUseGetBulkInviteUserJobStatusQuery.mockReturnValue({
        data: undefined,
        currentData: undefined,
        error: { error: 'Not found', name: 'NotFoundError' },
      });

      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);

      expect(mockRefetchProfiles).toHaveBeenCalledTimes(1);
      expect(JSON.parse(localStorage.getItem(ACTIVE_BULK_INVITE_JOB_STORAGE_KEY) ?? 'undefined')).toBeNull();
    });

    it('keeps showing final results after a fast job completes and the query becomes skipped', async () => {
      // Regression test: RTK Query discards `data` for a query once it becomes `skip: true`
      // (redux-toolkit#2871). The job going COMPLETED used to clear `activeJob` immediately,
      // which flipped the query's `skip` argument to true on the very next render — wiping out
      // the just-fetched results and reverting the table to stale Pending rows, even though the
      // job had actually finished successfully (this is exactly what a very fast job, completing
      // within the first poll, would trigger). The fix keeps the query un-skipped (using a
      // separately tracked jobId) once a job has been submitted, so this must no longer happen.
      const user = userEvent.setup();
      localStorage.clear();

      const completedJobStatus = {
        status: BulkInviteJobStatus.COMPLETED,
        totalEntries: 3,
        processedCount: 3,
        createdCount: 1,
        skippedCount: 2,
        failedCount: 0,
        results: [
          { emailAddress: 'alice@example.com', displayName: 'Alice', status: BulkInviteEntryStatus.CREATED },
          { emailAddress: 'bob@example.com', status: BulkInviteEntryStatus.SKIPPED, reason: 'User already exists' },
          { emailAddress: 'carol@example.com', status: BulkInviteEntryStatus.SKIPPED, reason: 'User already exists' },
        ],
      };

      // Mirrors real RTK Query behavior: once `skip: true` is passed, `data`/`currentData`
      // revert to `undefined`, regardless of what was previously fetched.
      mockUseGetBulkInviteUserJobStatusQuery.mockImplementation((_args, options) =>
        options?.skip
          ? { data: undefined, currentData: undefined, error: undefined }
          : { data: completedJobStatus, currentData: completedJobStatus, error: undefined },
      );

      const mockUnwrap = vi
        .fn()
        .mockResolvedValue({ jobId: 'job-123', status: BulkInviteJobStatus.PROCESSING, totalEntries: 3 });
      mockBulkInviteUser.mockReturnValue({ unwrap: mockUnwrap });

      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);

      await uploadFile(user, 'alice@example.com,Alice\nbob@example.com\ncarol@example.com');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Invite users' })).not.toBeDisabled());
      await user.click(screen.getByRole('button', { name: 'Invite users' }));

      // The job clears from localStorage (so a new import could start) ...
      await waitFor(() => {
        expect(JSON.parse(localStorage.getItem(ACTIVE_BULK_INVITE_JOB_STORAGE_KEY) ?? 'undefined')).toBeNull();
      });
      // ... but all three rows must still show their final, real statuses — none should have
      // reverted to Pending because the query got skipped.
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      expect(screen.getByText('bob@example.com')).toBeInTheDocument();
      expect(screen.getByText('carol@example.com')).toBeInTheDocument();
      expect(screen.getAllByText('Skipped')).toHaveLength(2);
      expect(screen.getByText('Created')).toBeInTheDocument();
      expect(screen.queryByText('Pending')).not.toBeInTheDocument();
      // The upload form must not reappear now that a job has been submitted this session.
      expect(screen.queryByTestId('bulk-invite-file-upload')).not.toBeInTheDocument();
    });

    it('does not prematurely clear a newly-submitted second job while its own status is still loading (currentData vs stale data)', async () => {
      // Regression test for the real reported bug: submitting a second job right after a first
      // job COMPLETED silently produced no UI progress even though the backend processed it.
      // Root cause: RTK Query's `data` intentionally keeps the PREVIOUS query's result on
      // screen while a new argument's request is in flight (to avoid UI flicker) — so right
      // after submitting job 2, `data` could still reflect job 1's stale COMPLETED status even
      // though the query's args now point at job 2. If the terminal-state effect used `data`
      // for that check, it would fire immediately using job 1's stale COMPLETED status, clear
      // `activeJob`, and kill polling for job 2 before job 2's own status was ever fetched. The
      // fix reads `currentData` (guaranteed correct for the current args, or undefined while
      // loading) for the terminal check instead of `data`.
      const user = userEvent.setup();
      localStorage.clear();

      const job1Completed = {
        status: BulkInviteJobStatus.COMPLETED,
        totalEntries: 1,
        processedCount: 1,
        createdCount: 1,
        skippedCount: 0,
        failedCount: 0,
        results: [{ emailAddress: 'alice@example.com', status: BulkInviteEntryStatus.CREATED }],
      };

      // Simulates the exact transient state right after submitting job 2: `data` still shows
      // job 1's stale COMPLETED result (RTK Query's documented "keep previous data" behavior),
      // but `currentData` is undefined because job 2's own fetch hasn't resolved yet.
      mockUseGetBulkInviteUserJobStatusQuery.mockReturnValue({
        data: job1Completed,
        currentData: undefined,
        error: undefined,
      });

      const mockUnwrap = vi
        .fn()
        .mockResolvedValue({ jobId: 'job-2', status: BulkInviteJobStatus.PROCESSING, totalEntries: 1 });
      mockBulkInviteUser.mockReturnValue({ unwrap: mockUnwrap });

      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);
      await uploadFile(user, 'bob@example.com');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Invite users' })).not.toBeDisabled());
      await user.click(screen.getByRole('button', { name: 'Invite users' }));

      // job-2 must still be tracked as active — the stale job-1 `data` must not have triggered
      // the terminal-state handling and cleared it.
      await waitFor(() => {
        const stored = JSON.parse(localStorage.getItem(ACTIVE_BULK_INVITE_JOB_STORAGE_KEY) ?? 'null');
        expect(stored).toEqual({ jobId: 'job-2', adminProfileId: 'admin-1' });
      });
      expect(mockRefetchProfiles).not.toHaveBeenCalled();
    });

    it('falls back to jobStatus.results alone when the parsed CSV is not in memory (e.g. modal reopened mid-job)', () => {
      const processingJobStatus = {
        status: BulkInviteJobStatus.PROCESSING,
        totalEntries: 1,
        processedCount: 1,
        createdCount: 0,
        skippedCount: 1,
        failedCount: 0,
        results: [
          { emailAddress: 'carol@example.com', status: BulkInviteEntryStatus.SKIPPED, reason: 'User already exists' },
        ],
      };
      mockUseGetBulkInviteUserJobStatusQuery.mockReturnValue({
        data: processingJobStatus,
        currentData: processingJobStatus,
        error: undefined,
      });

      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);

      expect(screen.getByTestId('bulk-invite-entries-table')).toBeInTheDocument();
      expect(screen.getByText('carol@example.com')).toBeInTheDocument();
      expect(screen.getByText('Skipped')).toBeInTheDocument();
      expect(screen.getByText('User already exists')).toBeInTheDocument();
    });
  });

  describe('Close behavior', () => {
    it('resets upload state and closes the modal on Cancel', async () => {
      const user = userEvent.setup();
      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);

      await uploadFile(user, 'alice@example.com');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Invite users' })).not.toBeDisabled());

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(mockSetIsOpen).toHaveBeenCalledWith(false);
    });

    it('fully clears a finished job so reopening shows a blank upload form', async () => {
      const user = userEvent.setup();
      const completedJobStatus = {
        status: BulkInviteJobStatus.COMPLETED,
        totalEntries: 1,
        processedCount: 1,
        createdCount: 1,
        skippedCount: 0,
        failedCount: 0,
        results: [{ emailAddress: 'alice@example.com', status: BulkInviteEntryStatus.CREATED }],
      };
      // Skip-aware, like real RTK Query: once skipped, `data`/`currentData` revert to
      // undefined (see the "keeps showing final results" regression test above for why this
      // matters).
      mockUseGetBulkInviteUserJobStatusQuery.mockImplementation((_args, options) =>
        options?.skip
          ? { data: undefined, currentData: undefined, error: undefined }
          : { data: completedJobStatus, currentData: completedJobStatus, error: undefined },
      );
      const mockUnwrap = vi
        .fn()
        .mockResolvedValue({ jobId: 'job-123', status: BulkInviteJobStatus.PROCESSING, totalEntries: 1 });
      mockBulkInviteUser.mockReturnValue({ unwrap: mockUnwrap });

      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);
      await uploadFile(user, 'alice@example.com');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Invite users' })).not.toBeDisabled());
      await user.click(screen.getByRole('button', { name: 'Invite users' }));

      // The job goes COMPLETED immediately (per the mock above) — activeJob clears from
      // localStorage, but the completed job's table stays visible until the modal is closed.
      await waitFor(() => {
        expect(JSON.parse(localStorage.getItem(ACTIVE_BULK_INVITE_JOB_STORAGE_KEY) ?? 'undefined')).toBeNull();
      });
      expect(screen.getByTestId('bulk-invite-entries-table')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(mockSetIsOpen).toHaveBeenCalledWith(false);

      // Now that the job is no longer active, closing must have cleared submittedJobId — the
      // next open should show a blank upload form, not the previous job's results.
      expect(screen.queryByTestId('bulk-invite-entries-table')).not.toBeInTheDocument();
      expect(screen.getByTestId('bulk-invite-file-upload')).toBeInTheDocument();
    });

    it('preserves an in-progress job across close/reopen so it keeps showing progress (FR-13 resume)', async () => {
      const user = userEvent.setup();
      const processingJobStatus = {
        status: BulkInviteJobStatus.PROCESSING,
        totalEntries: 2,
        processedCount: 1,
        createdCount: 1,
        skippedCount: 0,
        failedCount: 0,
        results: [{ emailAddress: 'alice@example.com', status: BulkInviteEntryStatus.CREATED }],
      };
      mockUseGetBulkInviteUserJobStatusQuery.mockReturnValue({
        data: processingJobStatus,
        currentData: processingJobStatus,
        error: undefined,
      });

      const mockUnwrap = vi
        .fn()
        .mockResolvedValue({ jobId: 'job-123', status: BulkInviteJobStatus.PROCESSING, totalEntries: 2 });
      mockBulkInviteUser.mockReturnValue({ unwrap: mockUnwrap });

      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);
      await uploadFile(user, 'alice@example.com\nbob@example.com');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Invite users' })).not.toBeDisabled());
      await user.click(screen.getByRole('button', { name: 'Invite users' }));

      await waitFor(() => {
        const stored = JSON.parse(localStorage.getItem(ACTIVE_BULK_INVITE_JOB_STORAGE_KEY) ?? 'null');
        expect(stored).toEqual({ jobId: 'job-123', adminProfileId: 'admin-1' });
      });
      expect(screen.getByText('Importing users…')).toBeInTheDocument();

      // Close while the job is still active — the still-active job's UI state must not clear.
      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(mockSetIsOpen).toHaveBeenCalledWith(false);

      // The job is still in localStorage (still active), and its progress bar/table remain
      // rendered rather than reverting to a blank upload form.
      const stillStored = JSON.parse(localStorage.getItem(ACTIVE_BULK_INVITE_JOB_STORAGE_KEY) ?? 'null');
      expect(stillStored).toEqual({ jobId: 'job-123', adminProfileId: 'admin-1' });
      expect(screen.getByText('Importing users…')).toBeInTheDocument();
      expect(screen.queryByTestId('bulk-invite-file-upload')).not.toBeInTheDocument();
    });
  });

  describe('Entries table pagination', () => {
    const makeCsv = (count: number) =>
      Array.from({ length: count }, (_, i) => `user${i + 1}@example.com,User ${i + 1}`).join('\n');

    it('defaults to a page size of 15 and paginates a large upload', async () => {
      const user = userEvent.setup();
      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);

      await uploadFile(user, makeCsv(30));
      await screen.findByText('30 entries');

      // Default page size is 15, so only the first 15 rows render.
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      expect(screen.getByText('user15@example.com')).toBeInTheDocument();
      expect(screen.queryByText('user16@example.com')).not.toBeInTheDocument();

      const pagination = getEntriesTable().findPagination();
      if (!pagination) throw new Error('Pagination not found');
      const secondPageButton = pagination.findPageNumberByIndex(2);
      if (!secondPageButton) throw new Error('Second page button not found');

      await user.click(secondPageButton.getElement());

      await screen.findByText('user16@example.com');
      expect(screen.queryByText('user1@example.com')).not.toBeInTheDocument();
    });

    it('offers page size options of 5, 10, 15, 25, 50, and 100', async () => {
      const user = userEvent.setup();
      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);

      await uploadFile(user, makeCsv(30));
      await screen.findByText('30 entries');

      const preferences = getEntriesTable().findCollectionPreferences();
      if (!preferences) throw new Error('Collection preferences not found');
      const triggerButton = preferences.findTriggerButton();
      if (!triggerButton) throw new Error('Preferences trigger button not found');

      await user.click(triggerButton.getElement());

      expect(screen.getByText('5 entries')).toBeInTheDocument();
      expect(screen.getByText('10 entries')).toBeInTheDocument();
      expect(screen.getByText('15 entries')).toBeInTheDocument();
      expect(screen.getByText('25 entries')).toBeInTheDocument();
      expect(screen.getByText('50 entries')).toBeInTheDocument();
      expect(screen.getByText('100 entries')).toBeInTheDocument();
    });

    it('shows entries beyond the default page size after switching to a larger page size', async () => {
      const user = userEvent.setup();
      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);

      await uploadFile(user, makeCsv(30));
      await screen.findByText('30 entries');

      const preferences = getEntriesTable().findCollectionPreferences();
      if (!preferences) throw new Error('Collection preferences not found');
      const triggerButton = preferences.findTriggerButton();
      if (!triggerButton) throw new Error('Preferences trigger button not found');

      await user.click(triggerButton.getElement());

      const modal = preferences.findModal();
      if (!modal) throw new Error('Preferences modal not found');
      const pageSizePreference = modal.findPageSizePreference();
      if (!pageSizePreference) throw new Error('Page size preference not found');
      const confirmButton = modal.findConfirmButton();
      if (!confirmButton) throw new Error('Confirm button not found');

      await user.click(pageSizePreference.findOptions()[3].findNativeInput().getElement()); // 25
      await user.click(confirmButton.getElement());

      const entry = await screen.findByText('user25@example.com');
      expect(entry).toBeInTheDocument();
    });

    it('paginates a large in-progress job at the default page size of 15', () => {
      localStorage.setItem(ACTIVE_BULK_INVITE_JOB_STORAGE_KEY, JSON.stringify({ jobId: 'job-123' }));
      const results = Array.from({ length: 20 }, (_, i) => ({
        emailAddress: `user${i + 1}@example.com`,
        status: BulkInviteEntryStatus.CREATED,
      }));
      const jobStatus = {
        status: BulkInviteJobStatus.PROCESSING,
        totalEntries: 20,
        processedCount: 20,
        createdCount: 20,
        skippedCount: 0,
        failedCount: 0,
        results,
      };
      mockUseGetBulkInviteUserJobStatusQuery.mockReturnValue({
        data: jobStatus,
        currentData: jobStatus,
        error: undefined,
      });

      renderWithProvider(<BulkInviteUsersModal {...defaultProps} />);

      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      expect(screen.getByText('user15@example.com')).toBeInTheDocument();
      expect(screen.queryByText('user16@example.com')).not.toBeInTheDocument();
      expect(getEntriesTable().findPagination()).toBeTruthy();
    });
  });
});
