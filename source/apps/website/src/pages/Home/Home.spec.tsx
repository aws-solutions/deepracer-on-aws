// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Model, Profile, UserGroups } from '@deepracer-indy/typescript-client';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import { describe, expect, it, Mock, vi } from 'vitest';

import { PageId } from '#constants/pages';
import { useListModelsQuery } from '#services/deepRacer/modelsApi';
import { useGetProfileQuery } from '#services/deepRacer/profileApi';
import { checkUserGroupMembership } from '#utils/authUtils';
import { getPath } from '#utils/pageUtils';
import { render } from '#utils/testUtils';

import Home from './Home';

vi.mock('#services/deepRacer/profileApi', () => ({
  useGetProfileQuery: vi.fn(),
}));

vi.mock('#services/deepRacer/modelsApi', () => ({
  useListModelsQuery: vi.fn(),
}));

vi.mock('#components/HoursPieChart/HoursPieChart', () => ({
  default: () => <div data-testid="hours-pie-chart">HoursPieChart</div>,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('#utils/pageUtils', () => ({
  getPath: vi.fn(),
}));

vi.mock('#utils/authUtils', () => ({
  checkUserGroupMembership: vi.fn(),
}));

describe('Home Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getPath as Mock).mockImplementation((pageId: PageId) => `/${pageId}`);
    (checkUserGroupMembership as Mock).mockResolvedValue(true);
  });

  describe('Component Rendering', () => {
    it('should render main sections (fundamentals and models always, community races conditionally)', async () => {
      (checkUserGroupMembership as Mock).mockResolvedValue(true);
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined, isLoading: false });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: i18n.t('home:fundamentals.header') })).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: i18n.t('home:models.header') })).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: i18n.t('home:communityRaces.header') })).toBeInTheDocument();
      });
    });

    it('should render loading message when profile data is loading', async () => {
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined, isLoading: true });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('home:models.loadingChart'))).toBeInTheDocument();
      });
      expect(screen.queryByTestId('hours-pie-chart')).not.toBeInTheDocument();
    });

    it('should render HoursPieChart component when profile data is available', async () => {
      const mockProfile: Profile = {
        maxModelCount: 10,
      } as Profile;
      (useGetProfileQuery as Mock).mockReturnValue({ data: mockProfile, isLoading: false });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByTestId('hours-pie-chart')).toBeInTheDocument();
      });
      expect(screen.queryByText(i18n.t('home:models.loadingChart'))).not.toBeInTheDocument();
    });

    it('should not render HoursPieChart component when profile data is unavailable', async () => {
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined, isLoading: false });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: i18n.t('home:models.header') })).toBeInTheDocument();
      });
      expect(screen.queryByTestId('hours-pie-chart')).not.toBeInTheDocument();
      expect(screen.queryByText(i18n.t('home:models.loadingChart'))).not.toBeInTheDocument();
    });

    it('should render fundamentals and models navigation buttons always', async () => {
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      expect(screen.getByRole('button', { name: i18n.t('home:fundamentals.button') })).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('home:models.button') })).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Functionality', () => {
    it('should navigate to get started page when fundamentals button is clicked', async () => {
      const user = userEvent.setup();
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      const fundamentalsButton = screen.getByRole('button', { name: i18n.t('home:fundamentals.button') });
      await user.click(fundamentalsButton);

      expect(getPath).toHaveBeenCalledWith(PageId.GET_STARTED);
      expect(mockNavigate).toHaveBeenCalledWith(`/${PageId.GET_STARTED}`);
    });

    it('should navigate to races page when community races button is clicked (for authorized users)', async () => {
      const user = userEvent.setup();
      (checkUserGroupMembership as Mock).mockResolvedValue(true);
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('home:communityRaces.button') })).toBeInTheDocument();
      });

      const racesButton = screen.getByRole('button', { name: i18n.t('home:communityRaces.button') });
      await user.click(racesButton);

      expect(getPath).toHaveBeenCalledWith(PageId.RACES);
      expect(mockNavigate).toHaveBeenCalledWith(`/${PageId.RACES}`);
    });

    it('should navigate to models page when models button is clicked', async () => {
      const user = userEvent.setup();
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      const modelsButton = await screen.findByRole('button', { name: i18n.t('home:models.button') });
      await user.click(modelsButton);

      expect(getPath).toHaveBeenCalledWith(PageId.MODELS);
      expect(mockNavigate).toHaveBeenCalledWith(`/${PageId.MODELS}`);
    });
  });

  describe('Model Count Display', () => {
    it('should display model count with limited models', async () => {
      const mockProfile: Profile = {
        maxModelCount: 10,
      } as Profile;
      const mockModels: Model[] = [
        { modelName: 'model1' } as unknown as Model,
        { modelName: 'model2' } as unknown as Model,
        { modelName: 'model3' } as unknown as Model,
      ];

      (useGetProfileQuery as Mock).mockReturnValue({ data: mockProfile });
      (useListModelsQuery as Mock).mockReturnValue({ data: mockModels });

      render(<Home />);

      expect(
        await screen.findByText(i18n.t('home:models.modelCount', { trainedCount: 3, allowedCount: 10 })),
      ).toBeInTheDocument();
    });

    it('should display model count with unlimited models (plural)', async () => {
      const mockProfile: Profile = {
        maxModelCount: -1,
      } as Profile;
      const mockModels: Model[] = [
        { modelName: 'model1' } as unknown as Model,
        { modelName: 'model2' } as unknown as Model,
      ];

      (useGetProfileQuery as Mock).mockReturnValue({ data: mockProfile });
      (useListModelsQuery as Mock).mockReturnValue({ data: mockModels });

      render(<Home />);

      expect(await screen.findByText('2 models')).toBeInTheDocument();
    });

    it('should display model count with unlimited models (singular)', async () => {
      const mockProfile: Profile = {
        maxModelCount: -1,
      } as Profile;
      const mockModels: Model[] = [{ modelName: 'model1' } as unknown as Model];

      (useGetProfileQuery as Mock).mockReturnValue({ data: mockProfile });
      (useListModelsQuery as Mock).mockReturnValue({ data: mockModels });

      render(<Home />);

      expect(await screen.findByText('1 model')).toBeInTheDocument();
    });

    it('should handle zero models', async () => {
      const mockProfile: Profile = {
        maxModelCount: 5,
      } as Profile;

      (useGetProfileQuery as Mock).mockReturnValue({ data: mockProfile });
      (useListModelsQuery as Mock).mockReturnValue({ data: [] });

      render(<Home />);

      expect(
        await screen.findByText(i18n.t('home:models.modelCount', { trainedCount: 0, allowedCount: 5 })),
      ).toBeInTheDocument();
    });

    it('should handle missing profile data', async () => {
      const mockModels: Model[] = [{ modelName: 'model1' } as unknown as Model];

      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: mockModels });

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: i18n.t('home:models.header') })).toBeInTheDocument();
      });
      expect(
        screen.queryByText(i18n.t('home:models.modelCount', { trainedCount: 1, allowedCount: 0 })),
      ).not.toBeInTheDocument();
    });

    it('should handle missing models data', async () => {
      const mockProfile: Profile = {
        maxModelCount: 10,
      } as Profile;

      (useGetProfileQuery as Mock).mockReturnValue({ data: mockProfile });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      expect(
        await screen.findByText(i18n.t('home:models.modelCount', { trainedCount: 0, allowedCount: 10 })),
      ).toBeInTheDocument();
    });

    it('should handle null maxModelCount', async () => {
      const mockProfile: Profile = {
        maxModelCount: null as unknown as number,
      } as Profile;
      const mockModels: Model[] = [{ modelName: 'model1' } as unknown as Model];

      (useGetProfileQuery as Mock).mockReturnValue({ data: mockProfile });
      (useListModelsQuery as Mock).mockReturnValue({ data: mockModels });

      render(<Home />);

      expect(
        await screen.findByText(i18n.t('home:models.modelCount', { trainedCount: 1, allowedCount: 0 })),
      ).toBeInTheDocument();
    });
  });

  describe('API Integration', () => {
    it('should call useGetProfileQuery hook', () => {
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      expect(useGetProfileQuery).toHaveBeenCalled();
    });

    it('should call useListModelsQuery hook', () => {
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      expect(useListModelsQuery).toHaveBeenCalled();
    });
  });

  describe('Content Display', () => {
    it('should display model count header', async () => {
      const mockProfile: Profile = {
        maxModelCount: 10,
      } as Profile;
      (useGetProfileQuery as Mock).mockReturnValue({ data: mockProfile });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      expect(await screen.findByText(i18n.t('home:models.modelCountHeader'))).toBeInTheDocument();
    });

    it('should display fundamentals and models section descriptions always', async () => {
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      expect(screen.getByText(i18n.t('home:fundamentals.description'))).toBeInTheDocument();
      expect(await screen.findByText(i18n.t('home:models.description'))).toBeInTheDocument();
    });
  });

  describe('Community Races Conditional Rendering', () => {
    it('should render Community Races section when user is a race facilitator or admin', async () => {
      (checkUserGroupMembership as Mock).mockResolvedValue(true);
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: i18n.t('home:communityRaces.header') })).toBeInTheDocument();
      });

      expect(screen.getByText(i18n.t('home:communityRaces.description'))).toBeInTheDocument();
      expect(screen.getByRole('button', { name: i18n.t('home:communityRaces.button') })).toBeInTheDocument();
    });

    it('should not render Community Races section when user is not a race facilitator or admin', async () => {
      (checkUserGroupMembership as Mock).mockResolvedValue(false);
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: i18n.t('home:communityRaces.header') })).not.toBeInTheDocument();
      });

      expect(screen.queryByText(i18n.t('home:communityRaces.description'))).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: i18n.t('home:communityRaces.button') })).not.toBeInTheDocument();
    });

    it('should call checkUserGroupMembership with correct user groups', async () => {
      (checkUserGroupMembership as Mock).mockResolvedValue(true);
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      await waitFor(() => {
        expect(checkUserGroupMembership).toHaveBeenCalledWith([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]);
      });
    });
  });

  describe('Models Conditional Rendering', () => {
    it('should render the Models section for Admin, Race Facilitators, and Racers', async () => {
      (checkUserGroupMembership as Mock).mockResolvedValue(true);
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: i18n.t('home:models.header') })).toBeInTheDocument();
      });
    });

    it('should not render the Models section for a Commentator or Registration Manager', async () => {
      (checkUserGroupMembership as Mock).mockResolvedValue(false);
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      // canViewModels/isPermissionLoading default to false/true, so Models is already absent on
      // the pre-effect render regardless of what checkUserGroupMembership resolves to. Wait for
      // the resolved single-column layout — the same post-resolution signal the sibling
      // "stay single-column" test below uses — to prove the false-path actually ran, not just
      // that the check was called.
      await waitFor(() => {
        // Cloudscape's Grid doesn't expose its column span through any role/attribute Testing
        // Library can query; asserting the actual class name is the only way to verify the false
        // path actually resolved and re-rendered, not just that the check was called.
        /* eslint-disable testing-library/no-node-access */
        const gridColumnClassName = screen
          .getByRole('heading', { name: i18n.t('home:fundamentals.header') })
          .closest('[class*="awsui_grid-column"]')?.className;
        /* eslint-enable testing-library/no-node-access */
        expect(gridColumnClassName).toMatch(/colspan-12/);
      });

      expect(screen.queryByRole('heading', { name: i18n.t('home:models.header') })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: i18n.t('home:models.button') })).not.toBeInTheDocument();
    });

    it('should skip useGetProfileQuery and useListModelsQuery when the user cannot view models', async () => {
      (checkUserGroupMembership as Mock).mockResolvedValue(false);
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      await waitFor(() => {
        expect(useGetProfileQuery).toHaveBeenCalledWith(undefined, { skip: true });
      });
      expect(useListModelsQuery).toHaveBeenCalledWith(undefined, { skip: true });
    });

    it('should call checkUserGroupMembership with Admin, Race Facilitators, and Racers for model visibility', async () => {
      (checkUserGroupMembership as Mock).mockResolvedValue(true);
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      await waitFor(() => {
        expect(checkUserGroupMembership).toHaveBeenCalledWith(expect.arrayContaining([UserGroups.RACERS]));
      });
    });

    it('should render Models but not Community Races for a Racer (model access without race-management access)', async () => {
      (checkUserGroupMembership as Mock).mockImplementation((groups: UserGroups[]) =>
        Promise.resolve(groups.includes(UserGroups.RACERS)),
      );
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: i18n.t('home:models.header') })).toBeInTheDocument();
      });
      expect(screen.queryByRole('heading', { name: i18n.t('home:communityRaces.header') })).not.toBeInTheDocument();
    });

    it('should hide the Models section and stay single-column while the permission check is pending', async () => {
      // Regression guard for the layout-flash bug: canViewModels defaults to false and only flips
      // once checkUserGroupMembership resolves, so without the isPermissionLoading gate every
      // role — including ones that will end up with model access — would briefly render the
      // 1-column, no-Models layout on first load. Assert this holds for the synchronous first
      // render, before the permission promise has had any chance to resolve.
      (checkUserGroupMembership as Mock).mockReturnValue(new Promise<boolean>(() => undefined));
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      expect(screen.queryByRole('heading', { name: i18n.t('home:models.header') })).not.toBeInTheDocument();

      // Cloudscape's Grid doesn't expose its column span through any role/attribute Testing
      // Library can query; asserting the actual class name is the only way to verify the layout
      // stayed single-column, not just that Models was absent (a split-condition regression could
      // hide Models but still reserve its column).
      /* eslint-disable testing-library/no-node-access */
      const gridColumnClassName = screen
        .getByRole('heading', { name: i18n.t('home:fundamentals.header') })
        .closest('[class*="awsui_grid-column"]')?.className;
      /* eslint-enable testing-library/no-node-access */
      expect(gridColumnClassName).toMatch(/colspan-12/);
    });

    it('should switch to the 2-column layout with Models visible once the permission check resolves true', async () => {
      let resolveMembership: (value: boolean) => void = () => undefined;
      (checkUserGroupMembership as Mock).mockReturnValue(
        new Promise<boolean>((resolve) => {
          resolveMembership = resolve;
        }),
      );
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);
      resolveMembership(true);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: i18n.t('home:models.header') })).toBeInTheDocument();
      });

      // See the rationale in the sibling "stay single-column" test above; no accessible query
      // exposes Cloudscape's column span.
      /* eslint-disable testing-library/no-node-access */
      const gridColumnClassName = screen
        .getByRole('heading', { name: i18n.t('home:fundamentals.header') })
        .closest('[class*="awsui_grid-column"]')?.className;
      /* eslint-enable testing-library/no-node-access */
      expect(gridColumnClassName).toMatch(/colspan-6/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle large model counts', async () => {
      const mockProfile: Profile = {
        maxModelCount: 1000,
      } as Profile;
      const mockModels: Model[] = Array.from(
        { length: 500 },
        (_, i) => ({ modelName: `model${i}` }) as unknown as Model,
      );

      (useGetProfileQuery as Mock).mockReturnValue({ data: mockProfile });
      (useListModelsQuery as Mock).mockReturnValue({ data: mockModels });

      render(<Home />);

      expect(
        await screen.findByText(i18n.t('home:models.modelCount', { trainedCount: 500, allowedCount: 1000 })),
      ).toBeInTheDocument();
    });

    it('should handle unlimited models with zero trained models', async () => {
      const mockProfile: Profile = {
        maxModelCount: -1,
      } as Profile;

      (useGetProfileQuery as Mock).mockReturnValue({ data: mockProfile });
      (useListModelsQuery as Mock).mockReturnValue({ data: [] });

      render(<Home />);

      expect(await screen.findByText('0 models')).toBeInTheDocument();
    });
  });
});
