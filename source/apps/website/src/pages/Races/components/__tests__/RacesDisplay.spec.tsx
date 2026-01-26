// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UserGroups } from '@deepracer-indy/typescript-client';

import { mockLeaderboards } from '#constants/testConstants.js';
import i18n from '#i18n/index.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { render, screen, waitFor } from '#utils/testUtils';

import RacesDisplay from '../RacesDisplay';

vi.mock('#utils/authUtils.js', () => ({
  checkUserGroupMembership: vi.fn(),
}));

const mockCheckUserGroupMembership = vi.mocked(checkUserGroupMembership);

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
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when user has race management permissions', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders the races display with management buttons for authorized users on open races', async () => {
      render(<RacesDisplay {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('races:communityRaces'))).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('races:manageRace') })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: i18n.t('races:createRace') })).toBeInTheDocument();

      expect(mockCheckUserGroupMembership).toHaveBeenCalledWith([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]);
    });

    it('does not render management buttons for authorized users on closed races', async () => {
      render(<RacesDisplay {...defaultProps} isClosed={true} />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('races:completedRaces'))).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: i18n.t('races:manageRace') })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: i18n.t('races:createRace') })).not.toBeInTheDocument();

      expect(mockCheckUserGroupMembership).toHaveBeenCalledWith([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]);
    });

    it('renders the correct header for open races', async () => {
      render(<RacesDisplay {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('races:communityRaces'))).toBeInTheDocument();
      });

      expect(screen.getByText(`(${mockLeaderboards.length})`)).toBeInTheDocument();
    });

    it('renders the correct header for closed races', async () => {
      render(<RacesDisplay {...defaultProps} isClosed={true} />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('races:completedRaces'))).toBeInTheDocument();
      });

      expect(screen.getByText(`(${mockLeaderboards.length})`)).toBeInTheDocument();
    });

    it('calls checkUserGroupMembership with correct parameters', async () => {
      render(<RacesDisplay {...defaultProps} />);

      await waitFor(() => {
        expect(mockCheckUserGroupMembership).toHaveBeenCalledWith([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]);
      });
    });
  });

  describe('when user does not have race management permissions', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(false);
    });

    it('does not render management buttons for unauthorized users on open races', async () => {
      render(<RacesDisplay {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('races:communityRaces'))).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: i18n.t('races:manageRace') })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: i18n.t('races:createRace') })).not.toBeInTheDocument();

      expect(mockCheckUserGroupMembership).toHaveBeenCalledWith([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]);
    });

    it('does not render management buttons for unauthorized users on closed races', async () => {
      render(<RacesDisplay {...defaultProps} isClosed={true} />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('races:completedRaces'))).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: i18n.t('races:manageRace') })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: i18n.t('races:createRace') })).not.toBeInTheDocument();

      expect(mockCheckUserGroupMembership).toHaveBeenCalledWith([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]);
    });

    it('still renders the races display content for unauthorized users', async () => {
      render(<RacesDisplay {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('races:communityRaces'))).toBeInTheDocument();
      });

      expect(screen.getByText(`(${mockLeaderboards.length})`)).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders loading state correctly', async () => {
      render(<RacesDisplay {...defaultProps} isLoading={true} />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('races:communityRaces'))).toBeInTheDocument();
      });

      expect(screen.getByText(`(${mockLeaderboards.length})`)).toBeInTheDocument();
    });
  });

  describe('empty leaderboards', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders correctly with empty leaderboards array', async () => {
      render(<RacesDisplay {...defaultProps} leaderboards={[]} />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('races:communityRaces'))).toBeInTheDocument();
      });

      expect(screen.getByText('(0)')).toBeInTheDocument();
    });
  });

  describe('navigation functionality', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('navigates to manage races when manage race button is clicked', async () => {
      render(<RacesDisplay {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('races:manageRace') })).toBeInTheDocument();
      });

      const manageButton = screen.getByRole('button', { name: i18n.t('races:manageRace') });
      manageButton.click();

      expect(mockNavigate).toHaveBeenCalledWith('/races/manage');
    });

    it('navigates to create race when create race button is clicked', async () => {
      render(<RacesDisplay {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('races:createRace') })).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: i18n.t('races:createRace') });
      createButton.click();

      expect(mockNavigate).toHaveBeenCalledWith('/races/create');
    });
  });

  describe('legacy test compatibility', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders without crashing (legacy test)', async () => {
      render(<RacesDisplay {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('races:communityRaces'))).toBeInTheDocument();
      });

      expect(screen.getByText(`(${mockLeaderboards.length})`)).toBeInTheDocument();
    });
  });
});
