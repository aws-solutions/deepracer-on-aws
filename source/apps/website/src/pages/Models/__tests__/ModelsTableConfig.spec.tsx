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

describe('useModelsTableConfig — agentAlgorithm column', () => {
  it('renders agent algorithm from metadata', () => {
    const model = { ...mockModel, metadata: { ...mockModel.metadata, agentAlgorithm: 'SAC' } } as Model;
    const TestComp = () => {
      const { columnDefinitions } = useModelsTableConfig([model]);
      const col = columnDefinitions.find((c) => c.id === 'AgentAlgorithm');
      return <div data-testid="cell">{col?.cell?.(model)}</div>;
    };
    render(
      <BrowserRouter>
        <TestComp />
      </BrowserRouter>,
    );
    expect(screen.getByTestId('cell')).toHaveTextContent('SAC');
  });

  it('renders dash when metadata.agentAlgorithm is undefined', () => {
    const model = { ...mockModel, metadata: undefined } as unknown as Model;
    const TestComp = () => {
      const { columnDefinitions } = useModelsTableConfig([model]);
      const col = columnDefinitions.find((c) => c.id === 'AgentAlgorithm');
      return <div data-testid="cell">{col?.cell?.(model)}</div>;
    };
    render(
      <BrowserRouter>
        <TestComp />
      </BrowserRouter>,
    );
    expect(screen.getByTestId('cell')).toHaveTextContent('-');
  });

  it('sorting comparator sorts alphabetically by agentAlgorithm', () => {
    const modelA = { ...mockModel, metadata: { ...mockModel.metadata, agentAlgorithm: 'PPO' } } as Model;
    const modelB = { ...mockModel, metadata: { ...mockModel.metadata, agentAlgorithm: 'SAC' } } as Model;
    const TestComp = () => {
      const { columnDefinitions } = useModelsTableConfig([modelA, modelB]);
      const col = columnDefinitions.find((c) => c.id === 'AgentAlgorithm');
      const result = col?.sortingComparator?.(modelA, modelB);
      return <div data-testid="sort">{result}</div>;
    };
    render(
      <BrowserRouter>
        <TestComp />
      </BrowserRouter>,
    );
    const sortValue = Number(screen.getByTestId('sort').textContent);
    expect(sortValue).toBeLessThan(0);
  });

  it('sorting comparator handles undefined metadata gracefully', () => {
    const modelA = { ...mockModel, metadata: undefined } as unknown as Model;
    const modelB = { ...mockModel, metadata: { ...mockModel.metadata, agentAlgorithm: 'SAC' } } as Model;
    const TestComp = () => {
      const { columnDefinitions } = useModelsTableConfig([modelA, modelB]);
      const col = columnDefinitions.find((c) => c.id === 'AgentAlgorithm');
      const result = col?.sortingComparator?.(modelA, modelB);
      return <div data-testid="sort">{result}</div>;
    };
    render(
      <BrowserRouter>
        <TestComp />
      </BrowserRouter>,
    );
    const sortValue = Number(screen.getByTestId('sort').textContent);
    expect(sortValue).toBeLessThan(0);
  });
});
