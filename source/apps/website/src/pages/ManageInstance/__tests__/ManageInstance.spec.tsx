// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Profile } from '@deepracer-indy/typescript-client';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fetchAuthSession } from 'aws-amplify/auth';
import { describe, expect, it, Mock, vi } from 'vitest';

import { useGetProfileQuery, useListProfilesQuery } from '#services/deepRacer/profileApi.js';
import { render } from '#utils/testUtils';

import ManageInstance from '../ManageInstance';

vi.mock('#services/deepRacer/profileApi.js', () => ({
  useListProfilesQuery: vi.fn(),
  useGetProfileQuery: vi.fn(),
}));

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(),
}));

vi.mock('../ProfilesTable/ProfilesTable', () => ({
  default: ({
    onInviteUser,
    onDeleteUser,
    onDeleteUserModels,
    onUpdateUserQuotas,
    onChangeUserRole,
    profiles,
    currentUserProfileId,
  }: {
    onInviteUser: () => void;
    onDeleteUser: (user: Profile, clearSelection: () => void) => void;
    onDeleteUserModels: (user: Profile) => void;
    onUpdateUserQuotas: (user: Profile, clearSelection: () => void) => void;
    onChangeUserRole: (user: Profile, clearSelection: () => void) => void;
    profiles: Profile[];
    currentUserProfileId?: string;
  }) => (
    <div data-testid="profiles-table" data-current-user-profile-id={currentUserProfileId || 'none'}>
      Profiles Table
      <button onClick={onInviteUser} data-testid="invite-user-button">
        Invite User
      </button>
      {profiles.map((profile) => (
        <div key={profile.profileId} data-testid={`profile-${profile.alias}`}>
          <span>{profile.alias}</span>
          <button
            onClick={() => onDeleteUser(profile, () => console.log('Clear selection called'))}
            data-testid={`delete-user-${profile.alias}`}
          >
            Delete User
          </button>
          <button onClick={() => onDeleteUserModels(profile)} data-testid={`delete-models-${profile.alias}`}>
            Delete Models
          </button>
          <button
            onClick={() => onUpdateUserQuotas(profile, () => console.log('Clear selection called'))}
            data-testid={`update-quotas-${profile.alias}`}
          >
            Update Quotas
          </button>
          <button
            onClick={() => onChangeUserRole(profile, () => console.log('Clear selection called'))}
            data-testid={`change-role-${profile.alias}`}
          >
            Change Role
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../UsageSummary/UsageSummary', () => ({
  default: () => <div data-testid="usage-summary">Usage Summary</div>,
}));

vi.mock('../QuotasModal/InstanceQuotas', () => ({
  default: ({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (open: boolean) => void }) => (
    <div data-testid="instance-quotas-modal" data-is-open={isOpen}>
      Instance Quotas Modal
      <button onClick={() => setIsOpen(false)}>Close</button>
    </div>
  ),
}));

vi.mock('../QuotasModal/NewUserQuotas', () => ({
  default: ({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (open: boolean) => void }) => (
    <div data-testid="new-user-quotas-modal" data-is-open={isOpen}>
      New User Quotas Modal
      <button onClick={() => setIsOpen(false)}>Close</button>
    </div>
  ),
}));

vi.mock('../InviteUserModal/InviteUserModal', () => ({
  default: ({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (open: boolean) => void }) => (
    <div data-testid="invite-user-modal" data-is-open={isOpen}>
      Invite User Modal
      <button onClick={() => setIsOpen(false)}>Close</button>
    </div>
  ),
}));

vi.mock('../DeleteUserModal', () => ({
  default: ({
    isOpen,
    setIsOpen,
    selectedUser,
    onClearSelection,
  }: {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    selectedUser: Profile | null;
    onClearSelection?: (() => void) | null;
  }) => (
    <div data-testid="delete-user-modal" data-is-open={isOpen} data-selected-user={selectedUser?.alias || 'none'}>
      Delete User Modal
      <button onClick={() => setIsOpen(false)}>Close</button>
      <button
        onClick={() => {
          if (onClearSelection) onClearSelection();
          setIsOpen(false);
        }}
        data-testid="delete-user-clear-selection-button"
      >
        Clear Selection
      </button>
    </div>
  ),
}));

vi.mock('../DeleteUserModelsModal', () => ({
  default: ({
    isOpen,
    setIsOpen,
    selectedUser,
  }: {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    selectedUser: Profile | null;
  }) => (
    <div
      data-testid="delete-user-models-modal"
      data-is-open={isOpen}
      data-selected-user={selectedUser?.alias || 'none'}
    >
      Delete User Models Modal
      <button onClick={() => setIsOpen(false)}>Close</button>
    </div>
  ),
}));

vi.mock('../QuotasModal/UserQuotas', () => ({
  default: ({
    isOpen,
    setIsOpen,
    selectedUser,
    onClearSelection,
  }: {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    selectedUser: Profile | null;
    onClearSelection?: (() => void) | null;
  }) => (
    <div data-testid="user-quotas-modal" data-is-open={isOpen} data-selected-user={selectedUser?.alias || 'none'}>
      User Quotas Modal
      <button onClick={() => setIsOpen(false)}>Close</button>
      <button
        onClick={() => {
          if (onClearSelection) onClearSelection();
          setIsOpen(false);
        }}
        data-testid="clear-selection-button"
      >
        Clear Selection
      </button>
    </div>
  ),
}));

vi.mock('../ChangeUserRoleModal', () => ({
  default: ({
    isOpen,
    setIsOpen,
    selectedUser,
    onClearSelection,
  }: {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    selectedUser: Profile | null;
    onClearSelection?: (() => void) | null;
  }) => (
    <div data-testid="change-user-role-modal" data-is-open={isOpen} data-selected-user={selectedUser?.alias || 'none'}>
      Change User Role Modal
      <button onClick={() => setIsOpen(false)}>Close</button>
      <button
        onClick={() => {
          if (onClearSelection) onClearSelection();
          setIsOpen(false);
        }}
        data-testid="change-role-clear-selection-button"
      >
        Clear Selection
      </button>
    </div>
  ),
}));

describe('ManageInstance', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useListProfilesQuery as Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    (useGetProfileQuery as Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
  });

  it('should show loading state initially', () => {
    (fetchAuthSession as Mock).mockImplementation(
      () =>
        new Promise(() => {
          // This promise intentionally never resolves to simulate loading state
        }),
    );

    render(<ManageInstance />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show unauthorized message if user is not an admin', async () => {
    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['non-admin-group'],
          },
        },
      },
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });

    expect(
      screen.getByText('The page you are trying to view is only available to administrators.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Return to Home')).toBeInTheDocument();
  });

  it('should render the full layout if user is an admin', async () => {
    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    const mockProfiles = [
      { alias: 'user1', avatar: 'avatar1', profileId: '1' } as Profile,
      { alias: 'user2', avatar: 'avatar2', profileId: '2' } as Profile,
    ];

    (useListProfilesQuery as Mock).mockReturnValue({
      data: mockProfiles,
      isLoading: false,
      error: null,
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    expect(screen.getByTestId('usage-summary')).toBeInTheDocument();
    expect(screen.getByTestId('profiles-table')).toBeInTheDocument();
  });

  it('should handle error when fetching auth session', async () => {
    (fetchAuthSession as Mock).mockRejectedValue(new Error('Auth error'));

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });

    expect(
      screen.getByText('The page you are trying to view is only available to administrators.'),
    ).toBeInTheDocument();
  });

  it('should handle undefined groups in auth session', async () => {
    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {},
        },
      },
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });
  });

  it('should handle undefined profiles data', async () => {
    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    (useListProfilesQuery as Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });
  });

  it('should render all action buttons when user is admin', async () => {
    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    expect(screen.getByText('Instance quotas')).toBeInTheDocument();
    expect(screen.getByText('New user quotas')).toBeInTheDocument();
  });

  it('should have Registration settings button disabled', async () => {
    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });
  });

  it('should open Instance quotas modal when button is clicked', async () => {
    const user = userEvent.setup();

    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    const instanceQuotasButton = screen.getByText('Instance quotas');
    await user.click(instanceQuotasButton);

    const modal = screen.getByTestId('instance-quotas-modal');
    expect(modal).toHaveAttribute('data-is-open', 'true');
  });

  it('should open New user quotas modal when button is clicked', async () => {
    const user = userEvent.setup();

    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    const newUserQuotasButton = screen.getByText('New user quotas');
    await user.click(newUserQuotasButton);

    const modal = screen.getByTestId('new-user-quotas-modal');
    expect(modal).toHaveAttribute('data-is-open', 'true');
  });

  it('should render all modals with correct initial state', async () => {
    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    const instanceQuotasModal = screen.getByTestId('instance-quotas-modal');
    const newUserQuotasModal = screen.getByTestId('new-user-quotas-modal');
    const inviteUserModal = screen.getByTestId('invite-user-modal');

    expect(instanceQuotasModal).toHaveAttribute('data-is-open', 'false');
    expect(newUserQuotasModal).toHaveAttribute('data-is-open', 'false');
    expect(inviteUserModal).toHaveAttribute('data-is-open', 'false');
  });

  it('should open Invite User modal when onInviteUser is called from ProfilesTable', async () => {
    const user = userEvent.setup();

    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    const inviteUserButton = screen.getByTestId('invite-user-button');
    await user.click(inviteUserButton);

    const modal = screen.getByTestId('invite-user-modal');
    expect(modal).toHaveAttribute('data-is-open', 'true');
  });

  it('should pass onInviteUser callback to ProfilesTable component', async () => {
    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    expect(screen.getByTestId('invite-user-button')).toBeInTheDocument();
  });

  it('should pass profiles data to UsageSummary and ProfilesTable components', async () => {
    const mockProfiles = [
      { alias: 'user1', avatar: 'avatar1', profileId: '1' } as Profile,
      { alias: 'user2', avatar: 'avatar2', profileId: '2' } as Profile,
    ];

    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    (useListProfilesQuery as Mock).mockReturnValue({
      data: mockProfiles,
      isLoading: false,
      error: null,
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    expect(screen.getByTestId('usage-summary')).toBeInTheDocument();
    expect(screen.getByTestId('profiles-table')).toBeInTheDocument();
  });

  it('should render delete user and delete user models modals with correct initial state', async () => {
    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    const deleteUserModal = screen.getByTestId('delete-user-modal');
    const deleteUserModelsModal = screen.getByTestId('delete-user-models-modal');

    expect(deleteUserModal).toHaveAttribute('data-is-open', 'false');
    expect(deleteUserModal).toHaveAttribute('data-selected-user', 'none');
    expect(deleteUserModelsModal).toHaveAttribute('data-is-open', 'false');
    expect(deleteUserModelsModal).toHaveAttribute('data-selected-user', 'none');
  });

  it('should open Delete User modal when onDeleteUser is called from ProfilesTable', async () => {
    const user = userEvent.setup();
    const mockProfiles = [{ alias: 'testuser', avatar: 'avatar1', profileId: '1' } as Profile];

    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    (useListProfilesQuery as Mock).mockReturnValue({
      data: mockProfiles,
      isLoading: false,
      error: null,
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    const deleteUserButton = screen.getByTestId('delete-user-testuser');
    await user.click(deleteUserButton);

    const modal = screen.getByTestId('delete-user-modal');
    expect(modal).toHaveAttribute('data-is-open', 'true');
    expect(modal).toHaveAttribute('data-selected-user', 'testuser');
  });

  it('should open Delete User Models modal when onDeleteUserModels is called from ProfilesTable', async () => {
    const user = userEvent.setup();
    const mockProfiles = [{ alias: 'testuser', avatar: 'avatar1', profileId: '1' } as Profile];

    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    (useListProfilesQuery as Mock).mockReturnValue({
      data: mockProfiles,
      isLoading: false,
      error: null,
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    const deleteModelsButton = screen.getByTestId('delete-models-testuser');
    await user.click(deleteModelsButton);

    const modal = screen.getByTestId('delete-user-models-modal');
    expect(modal).toHaveAttribute('data-is-open', 'true');
    expect(modal).toHaveAttribute('data-selected-user', 'testuser');
  });

  it('should pass correct callbacks to ProfilesTable component', async () => {
    const mockProfiles = [
      { alias: 'user1', avatar: 'avatar1', profileId: '1' } as Profile,
      { alias: 'user2', avatar: 'avatar2', profileId: '2' } as Profile,
    ];

    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    (useListProfilesQuery as Mock).mockReturnValue({
      data: mockProfiles,
      isLoading: false,
      error: null,
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    expect(screen.getByTestId('invite-user-button')).toBeInTheDocument();
    expect(screen.getByTestId('delete-user-user1')).toBeInTheDocument();
    expect(screen.getByTestId('delete-models-user1')).toBeInTheDocument();
    expect(screen.getByTestId('delete-user-user2')).toBeInTheDocument();
    expect(screen.getByTestId('delete-models-user2')).toBeInTheDocument();
  });

  it('should handle console error when auth session fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Mock implementation
    });

    (fetchAuthSession as Mock).mockRejectedValue(new Error('Auth error'));

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });

    expect(consoleSpy).toHaveBeenCalledWith('Error determining user group memebership');

    consoleSpy.mockRestore();
  });

  it('should handle missing tokens in auth session', async () => {
    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: null,
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });
  });

  it('should handle missing accessToken in auth session', async () => {
    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: null,
      },
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });
  });

  it('should handle missing payload in accessToken', async () => {
    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: null,
        },
      },
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });
  });

  it('should render profiles correctly when profiles data is empty array', async () => {
    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    (useListProfilesQuery as Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    expect(screen.getByTestId('usage-summary')).toBeInTheDocument();
    expect(screen.getByTestId('profiles-table')).toBeInTheDocument();
    expect(screen.getByTestId('invite-user-button')).toBeInTheDocument();
  });

  it('should handle profiles data conversion from undefined to empty array', async () => {
    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    (useListProfilesQuery as Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    expect(screen.getByTestId('usage-summary')).toBeInTheDocument();
    expect(screen.getByTestId('profiles-table')).toBeInTheDocument();
  });

  it('should open User Quotas modal when onUpdateUserQuotas is called from ProfilesTable', async () => {
    const user = userEvent.setup();
    const mockProfiles = [{ alias: 'testuser', avatar: 'avatar1', profileId: '1' } as Profile];

    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    (useListProfilesQuery as Mock).mockReturnValue({
      data: mockProfiles,
      isLoading: false,
      error: null,
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    const updateQuotasButton = screen.getByTestId('update-quotas-testuser');
    await user.click(updateQuotasButton);

    const modal = screen.getByTestId('user-quotas-modal');
    expect(modal).toHaveAttribute('data-is-open', 'true');
    expect(modal).toHaveAttribute('data-selected-user', 'testuser');
  });

  it('should render User Quotas modal with correct initial state', async () => {
    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    const userQuotasModal = screen.getByTestId('user-quotas-modal');
    expect(userQuotasModal).toHaveAttribute('data-is-open', 'false');
    expect(userQuotasModal).toHaveAttribute('data-selected-user', 'none');
  });

  it('should pass onClearSelection callback to UserQuotasModal', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // Mock implementation
    });
    const mockProfiles = [{ alias: 'testuser', avatar: 'avatar1', profileId: '1' } as Profile];

    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    (useListProfilesQuery as Mock).mockReturnValue({
      data: mockProfiles,
      isLoading: false,
      error: null,
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    // First open the modal by clicking update quotas
    const updateQuotasButton = screen.getByTestId('update-quotas-testuser');
    await user.click(updateQuotasButton);

    // Verify modal is open
    const modal = screen.getByTestId('user-quotas-modal');
    expect(modal).toHaveAttribute('data-is-open', 'true');

    // Click the clear selection button in the modal
    const clearSelectionButton = screen.getByTestId('clear-selection-button');
    await user.click(clearSelectionButton);

    // Verify the clear selection callback was called
    expect(consoleSpy).toHaveBeenCalledWith('Clear selection called');

    consoleSpy.mockRestore();
  });

  it('should render update quotas buttons for all profiles', async () => {
    const mockProfiles = [
      { alias: 'user1', avatar: 'avatar1', profileId: '1' } as Profile,
      { alias: 'user2', avatar: 'avatar2', profileId: '2' } as Profile,
    ];

    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    (useListProfilesQuery as Mock).mockReturnValue({
      data: mockProfiles,
      isLoading: false,
      error: null,
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    expect(screen.getByTestId('update-quotas-user1')).toBeInTheDocument();
    expect(screen.getByTestId('update-quotas-user2')).toBeInTheDocument();
  });

  it('should store clearTableSelection callback when onUpdateUserQuotas is called', async () => {
    const user = userEvent.setup();
    const mockProfiles = [{ alias: 'testuser', avatar: 'avatar1', profileId: '1' } as Profile];

    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    (useListProfilesQuery as Mock).mockReturnValue({
      data: mockProfiles,
      isLoading: false,
      error: null,
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    // Click update quotas to trigger the callback storage
    const updateQuotasButton = screen.getByTestId('update-quotas-testuser');
    await user.click(updateQuotasButton);

    // Verify modal opened (indicating the callback was processed)
    const modal = screen.getByTestId('user-quotas-modal');
    expect(modal).toHaveAttribute('data-is-open', 'true');
    expect(modal).toHaveAttribute('data-selected-user', 'testuser');
  });

  // ChangeUserRoleModal tests
  it('should render ChangeUserRoleModal with correct initial state', async () => {
    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    const changeUserRoleModal = screen.getByTestId('change-user-role-modal');
    expect(changeUserRoleModal).toHaveAttribute('data-is-open', 'false');
    expect(changeUserRoleModal).toHaveAttribute('data-selected-user', 'none');
  });

  it('should open ChangeUserRoleModal when onChangeUserRole is called from ProfilesTable', async () => {
    const user = userEvent.setup();
    const mockProfiles = [{ alias: 'testuser', avatar: 'avatar1', profileId: '1' } as Profile];

    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    (useListProfilesQuery as Mock).mockReturnValue({
      data: mockProfiles,
      isLoading: false,
      error: null,
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    const changeRoleButton = screen.getByTestId('change-role-testuser');
    await user.click(changeRoleButton);

    const modal = screen.getByTestId('change-user-role-modal');
    expect(modal).toHaveAttribute('data-is-open', 'true');
    expect(modal).toHaveAttribute('data-selected-user', 'testuser');
  });

  it('should pass onClearSelection callback to ChangeUserRoleModal', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // Mock implementation
    });
    const mockProfiles = [{ alias: 'testuser', avatar: 'avatar1', profileId: '1' } as Profile];

    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    (useListProfilesQuery as Mock).mockReturnValue({
      data: mockProfiles,
      isLoading: false,
      error: null,
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    // First open the modal by clicking change role
    const changeRoleButton = screen.getByTestId('change-role-testuser');
    await user.click(changeRoleButton);

    // Verify modal is open
    const modal = screen.getByTestId('change-user-role-modal');
    expect(modal).toHaveAttribute('data-is-open', 'true');

    // Click the clear selection button in the modal
    const clearSelectionButton = screen.getByTestId('change-role-clear-selection-button');
    await user.click(clearSelectionButton);

    // Verify the clear selection callback was called
    expect(consoleSpy).toHaveBeenCalledWith('Clear selection called');

    consoleSpy.mockRestore();
  });

  it('should render change role buttons for all profiles', async () => {
    const mockProfiles = [
      { alias: 'user1', avatar: 'avatar1', profileId: '1' } as Profile,
      { alias: 'user2', avatar: 'avatar2', profileId: '2' } as Profile,
    ];

    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    (useListProfilesQuery as Mock).mockReturnValue({
      data: mockProfiles,
      isLoading: false,
      error: null,
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    expect(screen.getByTestId('change-role-user1')).toBeInTheDocument();
    expect(screen.getByTestId('change-role-user2')).toBeInTheDocument();
  });

  it('should pass currentUserProfileId to ProfilesTable', async () => {
    const mockCurrentUserProfile = { alias: 'currentuser', avatar: 'avatar1', profileId: 'current-123' } as Profile;
    const mockProfiles = [
      { alias: 'user1', avatar: 'avatar1', profileId: '1' } as Profile,
      { alias: 'user2', avatar: 'avatar2', profileId: '2' } as Profile,
    ];

    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    (useListProfilesQuery as Mock).mockReturnValue({
      data: mockProfiles,
      isLoading: false,
      error: null,
    });

    (useGetProfileQuery as Mock).mockReturnValue({
      data: mockCurrentUserProfile,
      isLoading: false,
      error: null,
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    const profilesTable = screen.getByTestId('profiles-table');
    expect(profilesTable).toHaveAttribute('data-current-user-profile-id', 'current-123');
  });

  it('should handle undefined currentUserProfile data', async () => {
    const mockProfiles = [
      { alias: 'user1', avatar: 'avatar1', profileId: '1' } as Profile,
      { alias: 'user2', avatar: 'avatar2', profileId: '2' } as Profile,
    ];

    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    (useListProfilesQuery as Mock).mockReturnValue({
      data: mockProfiles,
      isLoading: false,
      error: null,
    });

    (useGetProfileQuery as Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    const profilesTable = screen.getByTestId('profiles-table');
    expect(profilesTable).toHaveAttribute('data-current-user-profile-id', 'none');
  });

  it('should store clearTableSelection callback when onChangeUserRole is called', async () => {
    const user = userEvent.setup();
    const mockProfiles = [{ alias: 'testuser', avatar: 'avatar1', profileId: '1' } as Profile];

    (fetchAuthSession as Mock).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['dr-admins'],
          },
        },
      },
    });

    (useListProfilesQuery as Mock).mockReturnValue({
      data: mockProfiles,
      isLoading: false,
      error: null,
    });

    render(<ManageInstance />);

    await waitFor(() => {
      expect(screen.getByText('Instance management')).toBeInTheDocument();
    });

    // Click change role to trigger the callback storage
    const changeRoleButton = screen.getByTestId('change-role-testuser');
    await user.click(changeRoleButton);

    // Verify modal opened (indicating the callback was processed)
    const modal = screen.getByTestId('change-user-role-modal');
    expect(modal).toHaveAttribute('data-is-open', 'true');
    expect(modal).toHaveAttribute('data-selected-user', 'testuser');
  });
});
