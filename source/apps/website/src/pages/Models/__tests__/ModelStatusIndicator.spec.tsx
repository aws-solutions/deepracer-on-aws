// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ModelStatus } from '@deepracer-indy/typescript-client';
import { composeStories } from '@storybook/react';
import { fireEvent } from '@testing-library/react';

import i18n from '#i18n';
import ModelStatusIndicator from '#pages/Models/components/ModelStatusIndicator';
import * as stories from '#pages/Models/components/ModelStatusIndicator.stories';
import { render, screen } from '#utils/testUtils';

const { Default } = composeStories(stories);

describe('<ModelStatusIndicator />', () => {
  it('renders without crashing', () => {
    render(<Default />, { isStorybookStory: true });

    expect(screen.getByText(i18n.t('common:modelStatus.READY'))).toBeInTheDocument();
  });

  describe('Status Type Mapping', () => {
    it('renders success status for READY', () => {
      render(<ModelStatusIndicator modelStatus={ModelStatus.READY} />);

      const statusText = screen.getByText(i18n.t('common:modelStatus.READY'));
      expect(statusText).toBeInTheDocument();
    });

    it('renders pending status for QUEUED', () => {
      render(<ModelStatusIndicator modelStatus={ModelStatus.QUEUED} />);

      const statusText = screen.getByText(i18n.t('common:modelStatus.QUEUED'));
      expect(statusText).toBeInTheDocument();
    });

    it('renders in-progress status for TRAINING', () => {
      render(<ModelStatusIndicator modelStatus={ModelStatus.TRAINING} />);

      const statusText = screen.getByText(i18n.t('common:modelStatus.TRAINING'));
      expect(statusText).toBeInTheDocument();
    });

    it('renders in-progress status for STOPPING', () => {
      render(<ModelStatusIndicator modelStatus={ModelStatus.STOPPING} />);

      const statusText = screen.getByText(i18n.t('common:modelStatus.STOPPING'));
      expect(statusText).toBeInTheDocument();
    });

    it('renders in-progress status for EVALUATING', () => {
      render(<ModelStatusIndicator modelStatus={ModelStatus.EVALUATING} />);

      const statusText = screen.getByText(i18n.t('common:modelStatus.EVALUATING'));
      expect(statusText).toBeInTheDocument();
    });

    it('renders in-progress status for IMPORTING', () => {
      render(<ModelStatusIndicator modelStatus={ModelStatus.IMPORTING} />);

      const statusText = screen.getByText(i18n.t('common:modelStatus.IMPORTING'));
      expect(statusText).toBeInTheDocument();
    });

    it('renders in-progress status for DELETING', () => {
      render(<ModelStatusIndicator modelStatus={ModelStatus.DELETING} />);

      const statusText = screen.getByText(i18n.t('common:modelStatus.DELETING'));
      expect(statusText).toBeInTheDocument();
    });

    it('renders error status for ERROR', () => {
      render(<ModelStatusIndicator modelStatus={ModelStatus.ERROR} />);

      const statusText = screen.getByText(i18n.t('common:modelStatus.ERROR'));
      expect(statusText).toBeInTheDocument();
    });
  });

  describe('Error Handling with Import Error Message', () => {
    it('renders popover when ERROR status has importErrorMessage', () => {
      const errorMessage = 'Model Validation Failed: No checkpoint files';
      render(<ModelStatusIndicator modelStatus={ModelStatus.ERROR} importErrorMessage={errorMessage} />);

      const statusText = screen.getByText(i18n.t('common:modelStatus.ERROR'));
      expect(statusText).toBeInTheDocument();

      const popoverTrigger = screen.getByRole('button');
      expect(popoverTrigger).toBeInTheDocument();
    });

    it('shows error message in popover when clicked', () => {
      const errorMessage = 'Model Validation Failed: No checkpoint files';
      render(<ModelStatusIndicator modelStatus={ModelStatus.ERROR} importErrorMessage={errorMessage} />);

      const popoverTrigger = screen.getByRole('button');

      fireEvent.click(popoverTrigger);

      expect(screen.getByText('Import Error')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('renders regular status indicator when ERROR status has no importErrorMessage', () => {
      render(<ModelStatusIndicator modelStatus={ModelStatus.ERROR} />);

      const statusText = screen.getByText(i18n.t('common:modelStatus.ERROR'));
      expect(statusText).toBeInTheDocument();

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Translation', () => {
    it('uses correct translation key for each status', () => {
      const statuses = [
        ModelStatus.READY,
        ModelStatus.QUEUED,
        ModelStatus.TRAINING,
        ModelStatus.STOPPING,
        ModelStatus.EVALUATING,
        ModelStatus.IMPORTING,
        ModelStatus.DELETING,
        ModelStatus.ERROR,
      ];

      statuses.forEach((status) => {
        const { unmount } = render(<ModelStatusIndicator modelStatus={status} />);

        const expectedText = i18n.t(`common:modelStatus.${status}`);
        expect(screen.getByText(expectedText)).toBeInTheDocument();

        unmount();
      });
    });
  });

  describe('Component Structure', () => {
    it('renders component with correct structure', () => {
      render(<ModelStatusIndicator modelStatus={ModelStatus.READY} />);

      const statusText = screen.getByText(i18n.t('common:modelStatus.READY'));
      expect(statusText).toBeInTheDocument();
    });

    it('maintains consistent structure across different statuses', () => {
      const statuses = [ModelStatus.READY, ModelStatus.TRAINING, ModelStatus.ERROR];

      statuses.forEach((status) => {
        const { unmount } = render(<ModelStatusIndicator modelStatus={status} />);

        const statusText = screen.getByText(i18n.t(`common:modelStatus.${status}`));
        expect(statusText).toBeInTheDocument();

        unmount();
      });
    });
  });
});
