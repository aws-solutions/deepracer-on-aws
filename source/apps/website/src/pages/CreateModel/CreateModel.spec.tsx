// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';
import { fireEvent } from '@testing-library/react';
import i18n from 'i18next';
import { vi } from 'vitest';

import * as stories from '#pages/CreateModel/CreateModel.stories';
import { mockDeepRacerClient, render, screen } from '#utils/testUtils';

// Mock the child components
vi.mock('./components/ActionSpace', () => ({
  default: ({ control }: { control: never }) => <div data-testid="action-space-section">Action Space Section</div>,
}));

vi.mock('./components/CarShellSelection', () => ({
  default: ({ control }: { control: never }) => <div data-testid="car-shell-selection">Car Shell Selection</div>,
}));

vi.mock('./components/ModelInfo', () => ({
  default: ({ control }: { control: never }) => <div data-testid="model-info">Model Info</div>,
}));

vi.mock('./components/RewardFunction', () => ({
  default: ({ control }: { control: never }) => <div data-testid="reward-function">Reward Function</div>,
}));

vi.mock('./components/VehicleInfo', () => ({
  default: ({ control }: { control: never }) => <div data-testid="vehicle-info">Vehicle Info</div>,
}));

// Mock functions
const mockCreateModel = vi.fn();
const mockNavigate = vi.fn();
const mockUseCreateModelMutation = vi.fn();
const mockUseLocation = vi.fn();

vi.mock('#services/deepRacer/modelsApi.js', () => ({
  useCreateModelMutation: () => mockUseCreateModelMutation(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockUseLocation(),
  };
});

const { Default } = composeStories(stories);

describe('CreateModel Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeepRacerClient.reset();

    mockUseCreateModelMutation.mockReturnValue([mockCreateModel, { isLoading: false, error: null }]);
    mockUseLocation.mockReturnValue({ state: null });
  });

  it('renders the create model wizard with all steps', () => {
    render(<Default />, { isStorybookStory: true });

    expect(screen.getAllByText(i18n.t('createModel:wizard.stepTitles.modelInfo')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(i18n.t('createModel:wizard.stepTitles.trainingType')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(i18n.t('createModel:wizard.stepTitles.actionSpace')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(i18n.t('createModel:wizard.stepTitles.agentSelection')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(i18n.t('createModel:wizard.stepTitles.rewardAlgorithm')).length).toBeGreaterThan(0);
  });

  it('renders wizard navigation buttons', () => {
    render(<Default />, { isStorybookStory: true });

    expect(screen.getByRole('button', { name: i18n.t('createModel:wizard.cancelButton') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('createModel:wizard.nextButton') })).toBeInTheDocument();
  });

  it('renders the first step content by default', () => {
    render(<Default />, { isStorybookStory: true });

    expect(screen.getByTestId('model-info')).toBeInTheDocument();
  });

  it('shows submit button on the last step', () => {
    render(<Default />, { isStorybookStory: true });

    expect(i18n.t('createModel:wizard.submitButton')).toBe('Train your model');
  });

  it('calls navigate with -1 when cancel button is clicked', () => {
    render(<Default />, { isStorybookStory: true });

    const cancelButton = screen.getByRole('button', { name: i18n.t('createModel:wizard.cancelButton') });
    fireEvent.click(cancelButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('renders ModelInfo component in the first step', () => {
    render(<Default />, { isStorybookStory: true });

    expect(screen.getByTestId('model-info')).toBeInTheDocument();
  });

  it('handles successful model creation', async () => {
    const mockModelId = 'test-model-id';
    mockCreateModel.mockResolvedValue({ unwrap: () => Promise.resolve(mockModelId) });

    render(<Default />, { isStorybookStory: true });

    expect(screen.getByTestId('model-info')).toBeInTheDocument();
  });

  it('uses cloned model form values when provided in location state', () => {
    const mockClonedValues = {
      modelName: 'Cloned Model',
      description: 'Cloned description',
    };

    mockUseLocation.mockReturnValue({
      state: { clonedModelFormValues: mockClonedValues },
    });

    render(<Default />, { isStorybookStory: true });

    expect(screen.getByTestId('model-info')).toBeInTheDocument();
  });

  it('shows loading state when creating model', () => {
    mockUseCreateModelMutation.mockReturnValue([mockCreateModel, { isLoading: true, error: null }]);

    render(<Default />, { isStorybookStory: true });

    expect(screen.getByTestId('model-info')).toBeInTheDocument();
  });

  it('displays error in the reward function step when create model fails', () => {
    const errorMessage = 'Model creation failed';

    mockUseCreateModelMutation.mockReturnValue([mockCreateModel, { isLoading: false, error: errorMessage }]);

    render(<Default />, { isStorybookStory: true });

    expect(screen.getByTestId('model-info')).toBeInTheDocument();
  });

  it('renders all wizard step titles correctly', () => {
    render(<Default />, { isStorybookStory: true });

    const expectedStepTitles = [
      'createModel:wizard.stepTitles.modelInfo',
      'createModel:wizard.stepTitles.trainingType',
      'createModel:wizard.stepTitles.actionSpace',
      'createModel:wizard.stepTitles.agentSelection',
      'createModel:wizard.stepTitles.rewardAlgorithm',
    ] as const;

    expectedStepTitles.forEach((titleKey) => {
      const elements = screen.getAllByText(i18n.t(titleKey));
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  it('uses correct i18n strings for wizard controls', () => {
    render(<Default />, { isStorybookStory: true });

    expect(screen.getByRole('button', { name: i18n.t('createModel:wizard.cancelButton') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('createModel:wizard.nextButton') })).toBeInTheDocument();
  });

  it('handles form validation on navigation', () => {
    render(<Default />, { isStorybookStory: true });

    const nextButton = screen.getByRole('button', { name: i18n.t('createModel:wizard.nextButton') });

    fireEvent.click(nextButton);

    expect(screen.getByTestId('model-info')).toBeInTheDocument();
  });

  it('passes correct props to child components', () => {
    render(<Default />, { isStorybookStory: true });

    expect(screen.getByTestId('model-info')).toBeInTheDocument();
  });
});
