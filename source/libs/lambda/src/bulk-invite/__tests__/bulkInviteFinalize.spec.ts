// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { bulkInviteJobDao } from '@deepracer-indy/database';
import { BulkInviteJobStatus } from '@deepracer-indy/typescript-server-client';

import { lambdaHandler } from '../bulkInviteFinalize.js';

describe('bulkInviteFinalize', () => {
  let markTerminalSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    markTerminalSpy = vi.spyOn(bulkInviteJobDao, 'markTerminal').mockResolvedValue({} as never);
  });

  const invoke = (input: Record<string, unknown>) => lambdaHandler(input as never, {} as never, vi.fn() as never);

  it('marks the job COMPLETED on the success path', async () => {
    await invoke({ jobId: 'job-1', adminProfileId: 'admin-1', outcome: 'COMPLETED' });

    expect(markTerminalSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        bulkInviteJobId: 'job-1',
        adminProfileId: 'admin-1',
        status: BulkInviteJobStatus.COMPLETED,
      }),
    );
  });

  it('marks the job FAILED with the error message on the catch path', async () => {
    await invoke({ jobId: 'job-1', adminProfileId: 'admin-1', outcome: 'FAILED', errorMessage: 'IAM denied' });

    expect(markTerminalSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: BulkInviteJobStatus.FAILED, errorMessage: 'IAM denied' }),
    );
  });
});
