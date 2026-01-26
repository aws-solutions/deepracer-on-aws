// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Profile } from '@deepracer-indy/typescript-client';
import { screen } from '@testing-library/react';
import { Mock, vi } from 'vitest';

import { useGetGlobalSettingQuery } from '#services/deepRacer/settingsApi.js';
import { render } from '#utils/testUtils';

import UsageSummary from '../UsageSummary';

vi.mock('#services/deepRacer/settingsApi.js', () => ({
  useGetGlobalSettingQuery: vi.fn(),
}));

const mockData = {
  'usageQuotas.global.globalComputeMinutesLimit': '60',
  'usageQuotas.global.globalModelCountLimit': '100',
  'usageQuotas.newUser.newUserComputeMinutesLimit': '30',
  'usageQuotas.newUser.newUserModelCountLimit': '10',
};

beforeEach(() => {
  vi.clearAllMocks();

  (useGetGlobalSettingQuery as Mock).mockImplementation(({ key }: { key: string }) => ({
    data: mockData[key as keyof typeof mockData] || '60',
    isLoading: false,
    error: null,
  }));
});

describe('UsageSummary', () => {
  it('renders the usage summary section with correct header', () => {
    render(<UsageSummary profiles={[]} />);
    expect(screen.getByText('Usage summary')).toBeInTheDocument();
  });

  it('renders all labels in the first column', () => {
    render(<UsageSummary profiles={[]} />);
    expect(screen.getByText('Training and evaluation hours used')).toBeInTheDocument();
    expect(screen.getByText('Models stored')).toBeInTheDocument();
    expect(screen.getByText('Storage used')).toBeInTheDocument();
  });

  it('renders all labels in the second column', () => {
    render(<UsageSummary profiles={[]} />);
    expect(screen.getByText('Number of users')).toBeInTheDocument();
    expect(screen.getByText('Registration mode')).toBeInTheDocument();
  });

  it('renders all labels in the third column', () => {
    render(<UsageSummary profiles={[]} />);
    expect(screen.getByText('New user compute usage limit')).toBeInTheDocument();
    expect(screen.getByText('New user model count limit')).toBeInTheDocument();
    expect(screen.getByText('Global compute usage limit')).toBeInTheDocument();
    expect(screen.getByText('Global model count limit')).toBeInTheDocument();
  });

  it('uses correct Cloudscape components for layout', () => {
    render(<UsageSummary profiles={[]} />);

    expect(screen.getByTestId('usage-summary')).toBeInTheDocument();

    const firstColumnLabel = screen.getByText('Training and evaluation hours used');
    const secondColumnLabel = screen.getByText('Number of users');
    const thirdColumnLabel = screen.getByText('New user compute usage limit');

    expect(firstColumnLabel).toBeInTheDocument();
    expect(secondColumnLabel).toBeInTheDocument();
    expect(thirdColumnLabel).toBeInTheDocument();

    const allLabels = [
      'Training and evaluation hours used',
      'Models stored',
      'Storage used',
      'Number of users',
      'Registration mode',
      'New user compute usage limit',
      'New user model count limit',
      'Global compute usage limit',
      'Global model count limit',
    ];

    allLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('displays the number of users correctly', () => {
    const profileA = { alias: 'aliasA', avatar: 'avatarA', profileId: '1' } as Profile;
    const profileB = { alias: 'aliasB', avatar: 'avatarB', profileId: '2' } as Profile;
    const mockProfiles = [profileA, profileB];
    render(<UsageSummary profiles={mockProfiles} />);

    const numberOfUsers = screen.getByTestId('number-of-users');
    expect(numberOfUsers).toHaveTextContent('2 users');
  });

  it('displays "-/-" for training hours when no profiles have compute minutes', () => {
    const mockProfiles = [{ computeMinutesUsed: 0 } as Profile, { computeMinutesUsed: 0 } as Profile];
    render(<UsageSummary profiles={mockProfiles} />);
    expect(screen.getByTestId('training-eval-hrs-used')).toHaveTextContent('-/-');
  });

  it('displays correct training hours when profiles have compute minutes', () => {
    const mockProfiles = [{ computeMinutesUsed: 60 } as Profile, { computeMinutesUsed: 30 } as Profile];
    render(<UsageSummary profiles={mockProfiles} />);
    expect(screen.getByText('1.50 hours')).toBeInTheDocument();
  });

  it('displays "-/-" for models stored when no profiles have model count', () => {
    const mockProfiles = [{ modelCount: 0 } as Profile, { modelCount: 0 } as Profile];
    render(<UsageSummary profiles={mockProfiles} />);

    const modelsStoredLabel = screen.getByText('Models stored');
    expect(modelsStoredLabel).toBeInTheDocument();
    expect(screen.getAllByText('-/-').length).toBeGreaterThan(0);
  });

  it('displays correct models stored when profiles have model count', () => {
    const mockProfiles = [{ modelCount: 3 } as Profile, { modelCount: 5 } as Profile];
    render(<UsageSummary profiles={mockProfiles} />);
    expect(screen.getByText('8 models')).toBeInTheDocument();
  });

  it('displays "-/-" for storage used when no profiles have storage usage', () => {
    const mockProfiles = [{ modelStorageUsage: 0 } as Profile, { modelStorageUsage: 0 } as Profile];
    render(<UsageSummary profiles={mockProfiles} />);

    const storageUsedLabel = screen.getByText('Storage used');
    expect(storageUsedLabel).toBeInTheDocument();
    expect(screen.getAllByText('-/-').length).toBeGreaterThan(0);
  });

  it('displays correct storage used when profiles have storage usage', () => {
    const oneGB = 1024 * 1024 * 1024;
    const mockProfiles = [{ modelStorageUsage: oneGB } as Profile, { modelStorageUsage: oneGB * 2 } as Profile];
    render(<UsageSummary profiles={mockProfiles} />);
    expect(screen.getByText('3.00 GB')).toBeInTheDocument();
  });

  it('displays "Invite only" for registration mode', () => {
    render(<UsageSummary profiles={[]} />);
    expect(screen.getByText('Invite only')).toBeInTheDocument();
  });

  it('displays correct new user compute usage limit', () => {
    render(<UsageSummary profiles={[]} />);
    expect(screen.getByTestId('new-user-compute-usage-limit')).toBeInTheDocument();
  });

  it('displays correct new user model count limit', () => {
    render(<UsageSummary profiles={[]} />);
    expect(screen.getByText('10 models')).toBeInTheDocument();
  });

  it('displays correct global compute usage limit', () => {
    render(<UsageSummary profiles={[]} />);
    expect(screen.getByText('1 hours')).toBeInTheDocument();
  });

  it('displays correct global model count limit', () => {
    render(<UsageSummary profiles={[]} />);
    expect(screen.getByText('100 models')).toBeInTheDocument();
  });

  it('handles profiles with mixed defined and undefined values', () => {
    const oneGB = 1024 * 1024 * 1024;
    const mockProfiles = [
      { computeMinutesUsed: 60, modelCount: 3, modelStorageUsage: oneGB } as Profile,
      { computeMinutesUsed: undefined, modelCount: undefined, modelStorageUsage: undefined } as Profile,
    ];
    render(<UsageSummary profiles={mockProfiles} />);
    expect(screen.getByText('1.00 hours')).toBeInTheDocument();
    expect(screen.getByText('3 models')).toBeInTheDocument();
    expect(screen.getByText('1.00 GB')).toBeInTheDocument();
  });

  it('displays "-/-" when no profiles are provided', () => {
    render(<UsageSummary profiles={[]} />);
    const dashElements = screen.getAllByText('-/-');
    expect(dashElements.length).toBeGreaterThan(0);
  });

  it('displays "Unlimited" when a limit is set to -1', () => {
    (useGetGlobalSettingQuery as Mock).mockImplementation(({ key }: { key: string }) => {
      if (key === 'usageQuotas.global.globalModelCountLimit') {
        return {
          data: '-1',
          isLoading: false,
          error: null,
        };
      }

      return {
        data: mockData[key as keyof typeof mockData] || '60',
        isLoading: false,
        error: null,
      };
    });

    render(<UsageSummary profiles={[]} />);
    expect(screen.getByText('Unlimited')).toBeInTheDocument();
  });
});
