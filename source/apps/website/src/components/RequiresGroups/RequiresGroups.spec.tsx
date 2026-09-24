// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UserGroups } from '@deepracer-indy/typescript-client';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { checkUserGroupMembership } from '#utils/authUtils';

import RequiresGroups from './RequiresGroups';

vi.mock('#utils/authUtils', () => ({
  checkUserGroupMembership: vi.fn(),
}));

const mockCheckUserGroupMembership = vi.mocked(checkUserGroupMembership);

const GROUPS = [UserGroups.ADMIN, UserGroups.RACE_FACILITATORS];
const MESSAGE = 'This page is only available to administrators and facilitators.';

const renderGuard = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<RequiresGroups groups={GROUPS} message={MESSAGE} />}>
          <Route index element={<div>protected content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe('<RequiresGroups />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the protected outlet when the user is in one of the groups', async () => {
    mockCheckUserGroupMembership.mockResolvedValue(true);

    renderGuard();

    await waitFor(() => {
      expect(screen.getByText('protected content')).toBeInTheDocument();
    });
    expect(mockCheckUserGroupMembership).toHaveBeenCalledWith(GROUPS);
  });

  it('renders the unauthorized alert with the given message when the user is in none of the groups', async () => {
    mockCheckUserGroupMembership.mockResolvedValue(false);

    renderGuard();

    await waitFor(() => {
      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });
    expect(screen.getByText(MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders the unauthorized alert when the permission check throws', async () => {
    mockCheckUserGroupMembership.mockRejectedValue(new Error('Auth failure'));

    renderGuard();

    await waitFor(() => {
      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });
  });
});
