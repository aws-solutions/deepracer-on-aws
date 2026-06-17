// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockLeaderboards } from '#constants/testConstants.js';
import i18n from '#i18n/index.js';
import { render, screen, waitFor } from '#utils/testUtils';

import RacesDisplay from '../RacesDisplay';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('<RacesDisplay />', () => {
  const defaultProps = {
    leaderboards: mockLeaderboards,
    isClosed: false,
    isLoading: false,
    canManageRaces: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when canManageRaces is true', () => {
    it('renders management buttons for open races', async () => {
      render(<RacesDisplay {...defaultProps} canManageRaces={true} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: new RegExp(i18n.t('races:communityRaces')) })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: i18n.t('races:manageRace') })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: i18n.t('races:createRace') })).toBeInTheDocument();
    });

    it('does not render management buttons for closed races', async () => {
      render(<RacesDisplay {...defaultProps} canManageRaces={true} isClosed={true} />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('races:completedRaces'))).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: i18n.t('races:manageRace') })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: i18n.t('races:createRace') })).not.toBeInTheDocument();
    });

    it('renders the correct header for open races', async () => {
      render(<RacesDisplay {...defaultProps} canManageRaces={true} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: new RegExp(i18n.t('races:communityRaces')) })).toBeInTheDocument();
      });

      expect(screen.getByText(`(${mockLeaderboards.length})`)).toBeInTheDocument();
    });

    it('renders the correct header for closed races', async () => {
      render(<RacesDisplay {...defaultProps} canManageRaces={true} isClosed={true} />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('races:completedRaces'))).toBeInTheDocument();
      });

      expect(screen.getByText(`(${mockLeaderboards.length})`)).toBeInTheDocument();
    });
  });

  describe('when canManageRaces is false', () => {
    it('does not render management buttons for open races', async () => {
      render(<RacesDisplay {...defaultProps} canManageRaces={false} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: new RegExp(i18n.t('races:communityRaces')) })).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: i18n.t('races:manageRace') })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: i18n.t('races:createRace') })).not.toBeInTheDocument();
    });

    it('does not render management buttons for closed races', async () => {
      render(<RacesDisplay {...defaultProps} canManageRaces={false} isClosed={true} />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('races:completedRaces'))).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: i18n.t('races:manageRace') })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: i18n.t('races:createRace') })).not.toBeInTheDocument();
    });

    it('still renders the races display content', async () => {
      render(<RacesDisplay {...defaultProps} canManageRaces={false} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: new RegExp(i18n.t('races:communityRaces')) })).toBeInTheDocument();
      });

      expect(screen.getByText(`(${mockLeaderboards.length})`)).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('renders loading state correctly', async () => {
      render(<RacesDisplay {...defaultProps} isLoading={true} canManageRaces={true} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: new RegExp(i18n.t('races:communityRaces')) })).toBeInTheDocument();
      });

      expect(screen.getByText(`(${mockLeaderboards.length})`)).toBeInTheDocument();
    });
  });

  describe('empty leaderboards', () => {
    it('renders correctly with empty leaderboards array', async () => {
      render(<RacesDisplay {...defaultProps} leaderboards={[]} canManageRaces={true} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: new RegExp(i18n.t('races:communityRaces')) })).toBeInTheDocument();
      });

      expect(screen.getByText('(0)')).toBeInTheDocument();
    });
  });

  describe('navigation functionality', () => {
    it('navigates to manage races when manage race button is clicked', async () => {
      render(<RacesDisplay {...defaultProps} canManageRaces={true} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('races:manageRace') })).toBeInTheDocument();
      });

      const manageButton = screen.getByRole('button', { name: i18n.t('races:manageRace') });
      manageButton.click();

      expect(mockNavigate).toHaveBeenCalledWith('/races/manage');
    });

    it('navigates to create race when create race button is clicked', async () => {
      render(<RacesDisplay {...defaultProps} canManageRaces={true} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('races:createRace') })).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: i18n.t('races:createRace') });
      createButton.click();

      expect(mockNavigate).toHaveBeenCalledWith('/races/create');
    });
  });

  describe('legacy test compatibility', () => {
    it('renders without crashing', async () => {
      render(<RacesDisplay {...defaultProps} canManageRaces={true} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: new RegExp(i18n.t('races:communityRaces')) })).toBeInTheDocument();
      });

      expect(screen.getByText(`(${mockLeaderboards.length})`)).toBeInTheDocument();
    });
  });
});
