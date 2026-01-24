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
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

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
  });

  describe('Component Rendering', () => {
    it('should render main sections (fundamentals and models always, community races conditionally)', async () => {
      (checkUserGroupMembership as Mock).mockResolvedValue(true);
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined, isLoading: false });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: i18n.t('home:fundamentals.header') })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: i18n.t('home:models.header') })).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: i18n.t('home:communityRaces.header') })).toBeInTheDocument();
      });
    });

    it('should render loading message when profile data is loading', () => {
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined, isLoading: true });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      expect(screen.getByText(i18n.t('home:models.loadingChart'))).toBeInTheDocument();
      expect(screen.queryByTestId('hours-pie-chart')).not.toBeInTheDocument();
    });

    it('should render HoursPieChart component when profile data is available', () => {
      const mockProfile: Profile = {
        maxModelCount: 10,
      } as Profile;
      (useGetProfileQuery as Mock).mockReturnValue({ data: mockProfile, isLoading: false });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      expect(screen.getByTestId('hours-pie-chart')).toBeInTheDocument();
      expect(screen.queryByText(i18n.t('home:models.loadingChart'))).not.toBeInTheDocument();
    });

    it('should not render HoursPieChart component when profile data is unavailable', () => {
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined, isLoading: false });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      expect(screen.queryByTestId('hours-pie-chart')).not.toBeInTheDocument();
      expect(screen.queryByText(i18n.t('home:models.loadingChart'))).not.toBeInTheDocument();
    });

    it('should render fundamentals and models navigation buttons always', () => {
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      expect(screen.getByRole('button', { name: i18n.t('home:fundamentals.button') })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: i18n.t('home:models.button') })).toBeInTheDocument();
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

      const modelsButton = screen.getByRole('button', { name: i18n.t('home:models.button') });
      await user.click(modelsButton);

      expect(getPath).toHaveBeenCalledWith(PageId.MODELS);
      expect(mockNavigate).toHaveBeenCalledWith(`/${PageId.MODELS}`);
    });
  });

  describe('Model Count Display', () => {
    it('should display model count with limited models', () => {
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
        screen.getByText(i18n.t('home:models.modelCount', { trainedCount: 3, allowedCount: 10 })),
      ).toBeInTheDocument();
    });

    it('should display model count with unlimited models (plural)', () => {
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

      expect(screen.getByText('2 models')).toBeInTheDocument();
    });

    it('should display model count with unlimited models (singular)', () => {
      const mockProfile: Profile = {
        maxModelCount: -1,
      } as Profile;
      const mockModels: Model[] = [{ modelName: 'model1' } as unknown as Model];

      (useGetProfileQuery as Mock).mockReturnValue({ data: mockProfile });
      (useListModelsQuery as Mock).mockReturnValue({ data: mockModels });

      render(<Home />);

      expect(screen.getByText('1 model')).toBeInTheDocument();
    });

    it('should handle zero models', () => {
      const mockProfile: Profile = {
        maxModelCount: 5,
      } as Profile;

      (useGetProfileQuery as Mock).mockReturnValue({ data: mockProfile });
      (useListModelsQuery as Mock).mockReturnValue({ data: [] });

      render(<Home />);

      expect(
        screen.getByText(i18n.t('home:models.modelCount', { trainedCount: 0, allowedCount: 5 })),
      ).toBeInTheDocument();
    });

    it('should handle missing profile data', () => {
      const mockModels: Model[] = [{ modelName: 'model1' } as unknown as Model];

      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: mockModels });

      render(<Home />);

      expect(
        screen.queryByText(i18n.t('home:models.modelCount', { trainedCount: 1, allowedCount: 0 })),
      ).not.toBeInTheDocument();
    });

    it('should handle missing models data', () => {
      const mockProfile: Profile = {
        maxModelCount: 10,
      } as Profile;

      (useGetProfileQuery as Mock).mockReturnValue({ data: mockProfile });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      expect(
        screen.getByText(i18n.t('home:models.modelCount', { trainedCount: 0, allowedCount: 10 })),
      ).toBeInTheDocument();
    });

    it('should handle null maxModelCount', () => {
      const mockProfile: Profile = {
        maxModelCount: null as unknown as number,
      } as Profile;
      const mockModels: Model[] = [{ modelName: 'model1' } as unknown as Model];

      (useGetProfileQuery as Mock).mockReturnValue({ data: mockProfile });
      (useListModelsQuery as Mock).mockReturnValue({ data: mockModels });

      render(<Home />);

      expect(
        screen.getByText(i18n.t('home:models.modelCount', { trainedCount: 1, allowedCount: 0 })),
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
    it('should display model count header', () => {
      const mockProfile: Profile = {
        maxModelCount: 10,
      } as Profile;
      (useGetProfileQuery as Mock).mockReturnValue({ data: mockProfile });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      expect(screen.getByText(i18n.t('home:models.modelCountHeader'))).toBeInTheDocument();
    });

    it('should display fundamentals and models section descriptions always', () => {
      (useGetProfileQuery as Mock).mockReturnValue({ data: undefined });
      (useListModelsQuery as Mock).mockReturnValue({ data: undefined });

      render(<Home />);

      expect(screen.getByText(i18n.t('home:fundamentals.description'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('home:models.description'))).toBeInTheDocument();
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

  describe('Edge Cases', () => {
    it('should handle large model counts', () => {
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
        screen.getByText(i18n.t('home:models.modelCount', { trainedCount: 500, allowedCount: 1000 })),
      ).toBeInTheDocument();
    });

    it('should handle unlimited models with zero trained models', () => {
      const mockProfile: Profile = {
        maxModelCount: -1,
      } as Profile;

      (useGetProfileQuery as Mock).mockReturnValue({ data: mockProfile });
      (useListModelsQuery as Mock).mockReturnValue({ data: [] });

      render(<Home />);

      expect(screen.getByText('0 models')).toBeInTheDocument();
    });
  });
});
