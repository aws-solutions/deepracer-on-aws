// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ModelStatus, Model } from '@deepracer-indy/typescript-client';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import { mockModel, mockModel3 } from '#constants/testConstants.js';
import { useModelsTableConfig } from '#pages/Models/components/ModelsTableConfig';

vi.mock('#pages/Models/components/ModelStatusIndicator', () => ({
  default: ({ modelStatus, importErrorMessage }: { modelStatus: ModelStatus; importErrorMessage?: string }) => (
    <div data-testid="model-status-indicator">
      <span data-testid="status">{modelStatus}</span>
      {importErrorMessage && <span data-testid="import-error">{importErrorMessage}</span>}
    </div>
  ),
}));

const TestComponent = ({ models }: { models: Model[] }) => {
  const { columnDefinitions } = useModelsTableConfig(models);

  const statusColumn = columnDefinitions.find((col) => col.id === 'Status');

  return (
    <div>
      {models.map((model, index) => (
        <div key={index} data-testid={`model-${index}`}>
          {statusColumn?.cell?.(model)}
        </div>
      ))}
    </div>
  );
};

const TestWrapper = ({ models }: { models: Model[] }) => (
  <BrowserRouter>
    <TestComponent models={models} />
  </BrowserRouter>
);

describe('useModelsTableConfig', () => {
  describe('STATUS column', () => {
    it('renders ModelStatusIndicator with correct props for model without import error', () => {
      const models = [mockModel];

      render(<TestWrapper models={models} />);

      const statusIndicator = screen.getByTestId('model-status-indicator');
      expect(statusIndicator).toBeInTheDocument();

      const status = screen.getByTestId('status');
      expect(status).toHaveTextContent(ModelStatus.READY);

      const importError = screen.queryByTestId('import-error');
      expect(importError).not.toBeInTheDocument();
    });

    it('renders ModelStatusIndicator with import error message for ERROR status', () => {
      const models = [mockModel3];

      render(<TestWrapper models={models} />);

      const statusIndicator = screen.getByTestId('model-status-indicator');
      expect(statusIndicator).toBeInTheDocument();

      const status = screen.getByTestId('status');
      expect(status).toHaveTextContent(ModelStatus.ERROR);

      const importError = screen.getByTestId('import-error');
      expect(importError).toBeInTheDocument();
      expect(importError).toHaveTextContent('Model Validation Failed: No checkpoint files');
    });
  });
});
