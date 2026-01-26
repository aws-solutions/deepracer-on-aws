// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { JobStatus, ModelStatus } from '@deepracer-indy/typescript-client';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';

import { mockModel } from '#constants/testConstants';
import { store } from '#store';

import TrainingDetails from '../TrainingDetails';

const renderWithProvider = (ui: React.ReactElement) => {
  return render(<Provider store={store}>{ui}</Provider>);
};

describe('<TrainingDetails />', () => {
  describe('auto-expand behavior', () => {
    it('should be expanded when model status is TRAINING', () => {
      const trainingModel = {
        ...mockModel,
        status: ModelStatus.TRAINING,
        trainingStatus: JobStatus.IN_PROGRESS,
      };

      renderWithProvider(<TrainingDetails model={trainingModel} />);

      const expandButton = screen.getByRole('button', { name: /training/i, expanded: true });
      expect(expandButton).toBeInTheDocument();
    });

    it('should be collapsed when model status is not TRAINING', () => {
      const queuedModel = {
        ...mockModel,
        status: ModelStatus.QUEUED,
        trainingStatus: JobStatus.QUEUED,
      };

      renderWithProvider(<TrainingDetails model={queuedModel} />);

      const expandButton = screen.getByRole('button', { name: /training/i, expanded: false });
      expect(expandButton).toBeInTheDocument();
    });

    it('should auto-expand when model status changes to TRAINING', () => {
      const queuedModel = {
        ...mockModel,
        status: ModelStatus.QUEUED,
        trainingStatus: JobStatus.QUEUED,
      };

      const { rerender } = renderWithProvider(<TrainingDetails model={queuedModel} />);

      expect(screen.getByRole('button', { name: /training/i, expanded: false })).toBeInTheDocument();

      const trainingModel = {
        ...mockModel,
        status: ModelStatus.TRAINING,
        trainingStatus: JobStatus.IN_PROGRESS,
      };

      rerender(
        <Provider store={store}>
          <TrainingDetails model={trainingModel} />
        </Provider>,
      );

      expect(screen.getByRole('button', { name: /training/i, expanded: true })).toBeInTheDocument();
    });
  });
});
