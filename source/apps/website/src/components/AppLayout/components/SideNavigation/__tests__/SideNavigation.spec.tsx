// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UserGroups } from '@deepracer-indy/typescript-client';
import { render, screen, waitFor } from '@testing-library/react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import { vi } from 'vitest';

import { PageId } from '../../../../../constants/pages.js';
import { getPath } from '../../../../../utils/pageUtils.js';
import { getAdminNavigationItems, getModelManagementNavigationItems } from '../itemsUtils.js';
import SideNavigation from '../SideNavigation';

// Mock dependencies
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useLocation: vi.fn(),
    useNavigate: vi.fn(),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

describe('SideNavigation', () => {
  const mockNavigate = vi.fn();
  const mockLocation = { pathname: '/' };

  beforeEach(() => {
    vi.clearAllMocks();
    (useLocation as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockLocation);
    (useNavigate as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockNavigate);
    (useTranslation as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      t: (key: string) => key, // Simple translation mock that returns the key
    });
  });

  it('should render base navigation items for non-admin users', async () => {
    // Mock non-admin auth response
    (fetchAuthSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['other-group'],
          },
        },
      },
    });

    render(
      <BrowserRouter>
        <SideNavigation />
      </BrowserRouter>,
    );

    // Wait for race hub section
    await waitFor(() => {
      expect(screen.getByText('sections.raceHub')).toBeInTheDocument();
    });

    // Verify learning and models section is present
    expect(screen.getByText('sections.learningAndModels')).toBeInTheDocument();

    // Verify base navigation links are present
    expect(screen.getByText(`breadcrumbs.${PageId.RACES}`)).toBeInTheDocument();
    expect(screen.getByText(`breadcrumbs.${PageId.GET_STARTED}`)).toBeInTheDocument();
    expect(screen.getByText(`breadcrumbs.${PageId.MODELS}`)).toBeInTheDocument();

    // Verify admin section is not present
    expect(screen.queryByText('sections.admin')).not.toBeInTheDocument();
    expect(screen.queryByText(`breadcrumbs.${PageId.ADMIN_MODEL_DOWNLOAD}`)).not.toBeInTheDocument();
  });

  it('should render admin navigation items for admin users', async () => {
    // Mock admin auth response
    (fetchAuthSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    render(
      <BrowserRouter>
        <SideNavigation />
      </BrowserRouter>,
    );

    // Wait for admin section
    await waitFor(() => {
      expect(screen.getByText('sections.admin')).toBeInTheDocument();
    });

    // Verify manage instance link is present (admin-only)
    expect(screen.getByText(`breadcrumbs.${PageId.MANAGE_INSTANCE}`)).toBeInTheDocument();
    // Verify model download is under Model Management section
    expect(screen.getByText('sections.modelManagement')).toBeInTheDocument();
    expect(screen.getByText(`breadcrumbs.${PageId.ADMIN_MODEL_DOWNLOAD}`)).toBeInTheDocument();
  });

  it('should render model management navigation items for race facilitator users', async () => {
    // Mock facilitator auth response
    (fetchAuthSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-race-facilitators'],
          },
        },
      },
    });

    render(
      <BrowserRouter>
        <SideNavigation />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('sections.modelManagement')).toBeInTheDocument();
    });

    expect(screen.getByText(`breadcrumbs.${PageId.ADMIN_MODEL_DOWNLOAD}`)).toBeInTheDocument();
    // Admin section and MANAGE_INSTANCE are admin-only; facilitators should not see them
    expect(screen.queryByText('sections.admin')).not.toBeInTheDocument();
    expect(screen.queryByText(`breadcrumbs.${PageId.MANAGE_INSTANCE}`)).not.toBeInTheDocument();
  });

  it('should handle navigation when clicking links', async () => {
    (fetchAuthSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': [],
          },
        },
      },
    });

    render(
      <BrowserRouter>
        <SideNavigation />
      </BrowserRouter>,
    );

    // Find and click a navigation link
    const racesLink = await screen.findByText(`breadcrumbs.${PageId.RACES}`);
    racesLink.click();

    // Verify navigation was triggered with correct path
    expect(mockNavigate).toHaveBeenCalledWith(getPath(PageId.RACES));
  });

  it('should handle auth check errors gracefully', async () => {
    (fetchAuthSession as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Auth error'));

    render(
      <BrowserRouter>
        <SideNavigation />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText('sections.admin')).not.toBeInTheDocument();
    });

    expect(screen.queryByText('sections.modelManagement')).not.toBeInTheDocument();
  });

  it('should handle missing auth groups gracefully', async () => {
    // Mock auth response with missing groups
    (fetchAuthSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      tokens: {
        accessToken: {
          payload: {},
        },
      },
    });

    render(
      <BrowserRouter>
        <SideNavigation />
      </BrowserRouter>,
    );

    // Verify only base navigation is shown (no admin items)
    await waitFor(() => {
      expect(screen.queryByText('sections.admin')).not.toBeInTheDocument();
    });
  });
});

const t = ((key: string) => key) as unknown as TFunction;

describe('getAdminNavigationItems()', () => {
  it('returns a section item when groups includes ADMIN', () => {
    const result = getAdminNavigationItems([UserGroups.ADMIN], t);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('section');
  });

  it('returns empty array for RACE_FACILITATORS', () => {
    expect(getAdminNavigationItems([UserGroups.RACE_FACILITATORS], t)).toEqual([]);
  });

  it('returns empty array for empty groups', () => {
    expect(getAdminNavigationItems([], t)).toEqual([]);
  });
});

describe('getModelManagementNavigationItems()', () => {
  it('returns a section item when groups includes ADMIN', () => {
    const result = getModelManagementNavigationItems([UserGroups.ADMIN], t);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('section');
  });

  it('returns a section item when groups includes RACE_FACILITATORS', () => {
    const result = getModelManagementNavigationItems([UserGroups.RACE_FACILITATORS], t);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('section');
  });

  it('returns empty array for non-admin, non-facilitator groups', () => {
    expect(getModelManagementNavigationItems([UserGroups.RACERS], t)).toEqual([]);
  });

  it('returns empty array for empty groups', () => {
    expect(getModelManagementNavigationItems([], t)).toEqual([]);
  });
});
