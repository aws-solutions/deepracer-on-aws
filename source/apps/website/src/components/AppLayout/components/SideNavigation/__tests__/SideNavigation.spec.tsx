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
import {
  getAdminNavigationItems,
  getLearningAndModelsNavigationItems,
  getModelManagementNavigationItems,
  getRaceManagementNavigationItems,
} from '../itemsUtils.js';
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

// Sections render in a fixed order, so an item belongs to the section whose heading is the closest one before it.
const comesAfter = (item: string, heading: string) =>
  screen.getByText(item).compareDocumentPosition(screen.getByText(heading)) === Node.DOCUMENT_POSITION_PRECEDING;

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

  it('should render base navigation items for a racer', async () => {
    // Mock racer auth response — Racers can view Races and Models
    (fetchAuthSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-racers'],
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
      expect(screen.getByText('sections.raceManagement')).toBeInTheDocument();
    });

    // Verify learning and models section is present
    expect(screen.getByText('sections.learningAndModels')).toBeInTheDocument();

    // Verify base navigation links are present
    expect(screen.getByText(`breadcrumbs.${PageId.RACES}`)).toBeInTheDocument();
    expect(screen.getByText(`breadcrumbs.${PageId.GET_STARTED}`)).toBeInTheDocument();
    expect(comesAfter(`breadcrumbs.${PageId.CAR_LOGS}`, 'sections.learningAndModels')).toBe(true);
    expect(comesAfter(`breadcrumbs.${PageId.CAR_LOGS}`, 'sections.raceManagement')).toBe(false);
    expect(screen.getByText(`breadcrumbs.${PageId.MODELS}`)).toBeInTheDocument();

    // Verify admin section is not present
    expect(screen.queryByText('sections.admin')).not.toBeInTheDocument();
    expect(screen.queryByText(`breadcrumbs.${PageId.ADMIN_MODELS}`)).not.toBeInTheDocument();
  });

  it('should not render Races or the model links for a Commentator', async () => {
    // Commentators have no defined use for the general race list or model training/management.
    (fetchAuthSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-commentators'],
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
      expect(screen.getByText('sections.raceManagement')).toBeInTheDocument();
    });

    expect(screen.queryByText(`breadcrumbs.${PageId.RACES}`)).not.toBeInTheDocument();
    expect(screen.queryByText(`breadcrumbs.${PageId.GET_STARTED}`)).not.toBeInTheDocument();
    expect(screen.queryByText(`breadcrumbs.${PageId.MODELS}`)).not.toBeInTheDocument();

    // Every role finds their car logs under Learning & Models, even without the model links.
    expect(screen.getByText('sections.learningAndModels')).toBeInTheDocument();
    expect(comesAfter(`breadcrumbs.${PageId.CAR_LOGS}`, 'sections.learningAndModels')).toBe(true);
    expect(comesAfter(`breadcrumbs.${PageId.CAR_LOGS}`, 'sections.raceManagement')).toBe(false);
    expect(screen.getByText(`breadcrumbs.${PageId.COMMENTATOR_VIEW}`)).toBeInTheDocument();
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
    expect(screen.getByText(`breadcrumbs.${PageId.ADMIN_MODELS}`)).toBeInTheDocument();
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

    expect(screen.getByText(`breadcrumbs.${PageId.ADMIN_MODELS}`)).toBeInTheDocument();
    // Facilitators get their own logs under Learning & Models and everyone's with the model administration.
    expect(screen.getByText(`breadcrumbs.${PageId.CAR_LOGS}`)).toBeInTheDocument();
    expect(screen.getByText(`breadcrumbs.${PageId.ADMIN_CAR_LOGS}`)).toBeInTheDocument();
    // Admin section and MANAGE_INSTANCE are admin-only; facilitators should not see them
    expect(screen.queryByText('sections.admin')).not.toBeInTheDocument();
    expect(screen.queryByText(`breadcrumbs.${PageId.MANAGE_INSTANCE}`)).not.toBeInTheDocument();
  });

  it('should handle navigation when clicking links', async () => {
    (fetchAuthSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-racers'],
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

describe('getRaceManagementNavigationItems()', () => {
  it('returns no section for groups without any race-management access', () => {
    const result = getRaceManagementNavigationItems([], t);
    expect(result).toHaveLength(0);
  });

  it('includes Races for ADMIN, RACE_FACILITATORS, and RACERS', () => {
    expect(JSON.stringify(getRaceManagementNavigationItems([UserGroups.ADMIN], t))).toContain(getPath(PageId.RACES));
    expect(JSON.stringify(getRaceManagementNavigationItems([UserGroups.RACE_FACILITATORS], t))).toContain(
      getPath(PageId.RACES),
    );
    expect(JSON.stringify(getRaceManagementNavigationItems([UserGroups.RACERS], t))).toContain(getPath(PageId.RACES));
  });

  it('excludes Races for COMMENTATORS and REGISTRATION_MANAGERS', () => {
    expect(JSON.stringify(getRaceManagementNavigationItems([UserGroups.COMMENTATORS], t))).not.toContain(
      getPath(PageId.RACES),
    );
    expect(JSON.stringify(getRaceManagementNavigationItems([UserGroups.REGISTRATION_MANAGERS], t))).not.toContain(
      getPath(PageId.RACES),
    );
  });

  it('includes Events and Timekeeping for ADMIN', () => {
    const result = getRaceManagementNavigationItems([UserGroups.ADMIN], t);
    expect(JSON.stringify(result)).toContain(getPath(PageId.EVENTS));
    expect(JSON.stringify(result)).toContain(getPath(PageId.TIMEKEEPING));
  });

  it('includes Events and Timekeeping for RACE_FACILITATORS', () => {
    const result = getRaceManagementNavigationItems([UserGroups.RACE_FACILITATORS], t);
    expect(JSON.stringify(result)).toContain(getPath(PageId.EVENTS));
    expect(JSON.stringify(result)).toContain(getPath(PageId.TIMEKEEPING));
  });

  it('includes Events for RACERS', () => {
    const result = getRaceManagementNavigationItems([UserGroups.RACERS], t);
    expect(JSON.stringify(result)).toContain(getPath(PageId.EVENTS));
  });

  it('excludes Events and Timekeeping for COMMENTATORS', () => {
    const result = getRaceManagementNavigationItems([UserGroups.COMMENTATORS], t);
    expect(JSON.stringify(result)).not.toContain(getPath(PageId.EVENTS));
    expect(JSON.stringify(result)).not.toContain(getPath(PageId.TIMEKEEPING));
  });

  it('includes Commentator View for COMMENTATORS, RACE_FACILITATORS, and ADMIN', () => {
    expect(JSON.stringify(getRaceManagementNavigationItems([UserGroups.COMMENTATORS], t))).toContain(
      getPath(PageId.COMMENTATOR_VIEW),
    );
    expect(JSON.stringify(getRaceManagementNavigationItems([UserGroups.RACE_FACILITATORS], t))).toContain(
      getPath(PageId.COMMENTATOR_VIEW),
    );
    expect(JSON.stringify(getRaceManagementNavigationItems([UserGroups.ADMIN], t))).toContain(
      getPath(PageId.COMMENTATOR_VIEW),
    );
  });

  it('excludes Timekeeping and Commentator View for RACERS only', () => {
    const result = getRaceManagementNavigationItems([UserGroups.RACERS], t);
    expect(JSON.stringify(result)).not.toContain(getPath(PageId.COMMENTATOR_VIEW));
    expect(JSON.stringify(result)).not.toContain(getPath(PageId.TIMEKEEPING));
  });

  it('includes Register User for REGISTRATION_MANAGERS, RACE_FACILITATORS, and ADMIN', () => {
    expect(JSON.stringify(getRaceManagementNavigationItems([UserGroups.REGISTRATION_MANAGERS], t))).toContain(
      getPath(PageId.REGISTER_RACER),
    );
    expect(JSON.stringify(getRaceManagementNavigationItems([UserGroups.RACE_FACILITATORS], t))).toContain(
      getPath(PageId.REGISTER_RACER),
    );
    expect(JSON.stringify(getRaceManagementNavigationItems([UserGroups.ADMIN], t))).toContain(
      getPath(PageId.REGISTER_RACER),
    );
  });

  it('includes Race statistics for ADMIN only', () => {
    expect(JSON.stringify(getRaceManagementNavigationItems([UserGroups.ADMIN], t))).toContain(
      getPath(PageId.RACE_STATS),
    );
    expect(JSON.stringify(getRaceManagementNavigationItems([UserGroups.RACE_FACILITATORS], t))).not.toContain(
      getPath(PageId.RACE_STATS),
    );
  });
});

describe('Car logs navigation placement', () => {
  const hasPath = (items: unknown, pageId: PageId.CAR_LOGS | PageId.ADMIN_CAR_LOGS) =>
    JSON.stringify(items).includes(`"${getPath(pageId)}"`);
  const hasCarLogs = (items: unknown) => hasPath(items, PageId.CAR_LOGS);
  const hasAdminCarLogs = (items: unknown) => hasPath(items, PageId.ADMIN_CAR_LOGS);
  const everyRole = [
    UserGroups.ADMIN,
    UserGroups.RACE_FACILITATORS,
    UserGroups.RACERS,
    UserGroups.COMMENTATORS,
    UserGroups.REGISTRATION_MANAGERS,
  ];

  it.each(everyRole)('lists the own-logs link under Learning & Models for %s', (group) => {
    const items = getLearningAndModelsNavigationItems([group], t);
    expect(hasCarLogs(items)).toBe(true);
    expect(hasAdminCarLogs(items)).toBe(false);
  });

  it('shows Get started and Models only to roles that train models', () => {
    [UserGroups.ADMIN, UserGroups.RACE_FACILITATORS, UserGroups.RACERS].forEach((group) => {
      const items = JSON.stringify(getLearningAndModelsNavigationItems([group], t));
      expect(items).toContain(getPath(PageId.GET_STARTED));
      expect(items).toContain(getPath(PageId.MODELS));
    });
    [UserGroups.COMMENTATORS, UserGroups.REGISTRATION_MANAGERS].forEach((group) => {
      const items = JSON.stringify(getLearningAndModelsNavigationItems([group], t));
      expect(items).not.toContain(getPath(PageId.GET_STARTED));
      expect(items).not.toContain(getPath(PageId.MODELS));
    });
  });

  it('returns no section without a role that can open car logs', () => {
    expect(getLearningAndModelsNavigationItems([], t)).toEqual([]);
  });

  it('lists the everyone-logs link under Model Management for ADMIN and RACE_FACILITATORS only', () => {
    [UserGroups.ADMIN, UserGroups.RACE_FACILITATORS].forEach((group) => {
      const items = getModelManagementNavigationItems([group], t);
      expect(hasAdminCarLogs(items)).toBe(true);
      expect(hasCarLogs(items)).toBe(false);
    });
    expect(hasAdminCarLogs(getModelManagementNavigationItems([UserGroups.RACERS], t))).toBe(false);
  });

  it('no longer lists the link under Race Management', () => {
    everyRole.forEach((group) => {
      expect(hasCarLogs(getRaceManagementNavigationItems([group], t))).toBe(false);
    });
  });
});
