// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { checkUserGroupMembership } from '#utils/authUtils';

import RequiresCommentator from './RequiresCommentator';

vi.mock('#utils/authUtils', () => ({
  checkUserGroupMembership: vi.fn(),
}));

const mockCheckUserGroupMembership = vi.mocked(checkUserGroupMembership);

const renderGuard = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<RequiresCommentator />}>
          <Route index element={<div>protected content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe('<RequiresCommentator />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the protected outlet when the user is authorized', async () => {
    mockCheckUserGroupMembership.mockResolvedValue(true);

    renderGuard();

    await waitFor(() => {
      expect(screen.getByText('protected content')).toBeInTheDocument();
    });
  });

  it('renders the unauthorized alert when the user is not authorized', async () => {
    mockCheckUserGroupMembership.mockResolvedValue(false);

    renderGuard();

    await waitFor(() => {
      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });
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
