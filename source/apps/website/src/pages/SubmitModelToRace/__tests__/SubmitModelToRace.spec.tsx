// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';
import { userEvent } from '@storybook/test';

import i18n from '#i18n';
import { checkUserGroupMembership } from '#utils/authUtils';
import { screen } from '#utils/testUtils';

import * as SubmitModelToRaceStories from '../SubmitModelToRace.stories';

const { Default, ModelNotFound, ModelNotReady, NoOpenRaces, ModelError, ModelImporting } =
  composeStories(SubmitModelToRaceStories);

const mockDispatch = vi.fn();
const mockNavigate = vi.fn();
const mockCreateSubmission = vi.fn();
const mockCheckUserGroupMembership = vi.mocked(checkUserGroupMembership);

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ modelId: 'test-model-id' }),
  };
});

vi.mock('#services/deepRacer/submissionsApi', () => ({
  useCreateSubmissionMutation: () => [mockCreateSubmission, { isLoading: false }],
}));

vi.mock('#utils/authUtils', () => ({
  checkUserGroupMembership: vi.fn(),
}));

describe('<SubmitModelToRace />', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    mockNavigate.mockClear();
    mockCreateSubmission.mockClear();
    mockCheckUserGroupMembership.mockClear();

    mockCreateSubmission.mockReturnValue({
      unwrap: () => Promise.resolve('submission-id-123'),
    });

    // Default to no race management permissions
    mockCheckUserGroupMembership.mockResolvedValue(false);

    vi.clearAllMocks();
    vi.mock('#hooks/useAppDispatch', () => ({
      useAppDispatch: () => mockDispatch,
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render the submit model to race page without crashing', async () => {
    await Default.run();

    expect(await screen.findByText(i18n.t('submitModelToRace:submitModelToRace'))).toBeInTheDocument();

    expect(await screen.findByText(i18n.t('submitModelToRace:modelDetails'))).toBeInTheDocument();
    expect(await screen.findByText('testModel')).toBeInTheDocument();

    expect(await screen.findByText(i18n.t('submitModelToRace:chooseRace'))).toBeInTheDocument();

    expect(await screen.findByText(i18n.t('submitModelToRace:cancel'))).toBeInTheDocument();
    expect(await screen.findByText(i18n.t('submitModelToRace:submitToRace'))).toBeInTheDocument();
  });

  it('should render model not found message for missing model', async () => {
    await ModelNotFound.run();

    expect(await screen.findByText(i18n.t('submitModelToRace:modelDoesNotExist'))).toBeInTheDocument();
  });

  it('should render model not ready message for non-ready model', async () => {
    await ModelNotReady.run();

    expect(await screen.findByText(i18n.t('submitModelToRace:modelNotReady'))).toBeInTheDocument();
  });

  it('should show no open races message when no races are available', async () => {
    await NoOpenRaces.run();

    const selectButton = await screen.findByText(i18n.t('submitModelToRace:chooseARace'));
    await userEvent.click(selectButton);

    expect(await screen.findByText(/Currently there are no open races available/)).toBeInTheDocument();
  });

  it('should show race selection components', async () => {
    await Default.run();

    expect(await screen.findByText(i18n.t('submitModelToRace:raceSelection'))).toBeInTheDocument();
    expect(await screen.findByText(i18n.t('submitModelToRace:chooseARace'))).toBeInTheDocument();
  });

  it('should disable submit button when no race is selected', async () => {
    await Default.run();

    const submitButton = await screen.findByRole('button', { name: i18n.t('submitModelToRace:submitToRace') });
    expect(submitButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('should enable submit button when race is selected', async () => {
    await Default.run();

    const selectButton = await screen.findByText(i18n.t('submitModelToRace:chooseARace'));
    await userEvent.click(selectButton);

    const raceOption = await screen.findByText('Test-OA-Leaderboard');
    await userEvent.click(raceOption);

    const submitButton = await screen.findByRole('button', { name: i18n.t('submitModelToRace:submitToRace') });
    expect(submitButton).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('should call createSubmission API when submit button is clicked', async () => {
    await Default.run();

    const selectButton = await screen.findByText(i18n.t('submitModelToRace:chooseARace'));
    await userEvent.click(selectButton);

    const raceOption = await screen.findByText('Test-OA-Leaderboard');
    await userEvent.click(raceOption);

    const submitButton = await screen.findByRole('button', { name: i18n.t('submitModelToRace:submitToRace') });
    await userEvent.click(submitButton);

    expect(mockCreateSubmission).toHaveBeenCalledWith({
      leaderboardId: 'mockOALeaderboard',
      modelId: 'test-model-id',
    });

    await vi.waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('displaySuccessNotification'),
        }),
      );

      expect(mockNavigate).toHaveBeenCalledWith('/models/test-model-id');
    });
  });

  it('should prevent submission when model has ERROR status', async () => {
    await ModelError.run();

    expect(await screen.findByText(i18n.t('submitModelToRace:modelNotReady'))).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: i18n.t('submitModelToRace:submitToRace') })).not.toBeInTheDocument();
  });

  it('should prevent submission when model has IMPORTING status', async () => {
    await ModelImporting.run();

    expect(await screen.findByText(i18n.t('submitModelToRace:modelNotReady'))).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: i18n.t('submitModelToRace:submitToRace') })).not.toBeInTheDocument();
  });

  it('should prevent submission when model has TRAINING status', async () => {
    await ModelNotReady.run();

    expect(await screen.findByText(i18n.t('submitModelToRace:modelNotReady'))).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: i18n.t('submitModelToRace:submitToRace') })).not.toBeInTheDocument();
  });

  describe('Create Race Button Permissions', () => {
    it('should show create race button when user has race management permissions', async () => {
      mockCheckUserGroupMembership.mockResolvedValue(true);

      await NoOpenRaces.run();

      const selectButton = await screen.findByText(i18n.t('submitModelToRace:chooseARace'));
      await userEvent.click(selectButton);

      expect(await screen.findByText(/Currently there are no open races available/)).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: i18n.t('submitModelToRace:createRace') })).toBeInTheDocument();
    });

    it('should hide create race button when user does not have race management permissions', async () => {
      mockCheckUserGroupMembership.mockResolvedValue(false);

      await NoOpenRaces.run();

      const selectButton = await screen.findByText(i18n.t('submitModelToRace:chooseARace'));
      await userEvent.click(selectButton);

      expect(await screen.findByText(/Currently there are no open races available/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: i18n.t('submitModelToRace:createRace') })).not.toBeInTheDocument();
    });

    it('should navigate to create race page when create race button is clicked', async () => {
      mockCheckUserGroupMembership.mockResolvedValue(true);

      await NoOpenRaces.run();

      const selectButton = await screen.findByText(i18n.t('submitModelToRace:chooseARace'));
      await userEvent.click(selectButton);

      const createRaceButton = await screen.findByRole('button', { name: i18n.t('submitModelToRace:createRace') });
      await userEvent.click(createRaceButton);

      expect(mockNavigate).toHaveBeenCalledWith('/races/create');
    });

    it('should check user group membership on component mount', async () => {
      await Default.run();

      expect(mockCheckUserGroupMembership).toHaveBeenCalledWith([
        expect.stringContaining('dr-race-facilitators'),
        expect.stringContaining('dr-admins'),
      ]);
    });
  });
});
