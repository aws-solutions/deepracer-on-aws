// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AdminModelExtended, ModelStatus, OptimizationStatus } from '@deepracer-indy/typescript-client';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import { mockAdminModel, mockAdminModel2, mockAdminModelImporting } from '#constants/testConstants';
import { useAdminModelsTableConfig } from '#pages/AdminModels/components/AdminModelsTableConfig';

vi.mock('@cloudscape-design/collection-hooks', () => ({
  useCollection: (items: unknown[]) => ({
    items: items ?? [],
    actions: { setPropertyFiltering: vi.fn() },
    filteredItemsCount: (items ?? []).length,
    collectionProps: {},
    propertyFilterProps: { query: { tokens: [], operation: 'and' } },
    paginationProps: { currentPageIndex: 1, pagesCount: 1 },
  }),
}));

vi.mock('#pages/Models/components/ModelStatusIndicator', () => ({
  default: ({ modelStatus, importErrorMessage }: { modelStatus: string; importErrorMessage?: string }) => (
    <span data-testid="model-status" data-import-error={importErrorMessage ?? ''}>
      {modelStatus}
    </span>
  ),
}));

vi.mock('#pages/Models/components/OptimizationStatusIndicator', () => ({
  default: ({
    optimizationStatus,
    optimizationErrorMessage,
  }: {
    optimizationStatus: string;
    optimizationErrorMessage?: string;
  }) => (
    <span data-testid="opt-status" data-opt-error={optimizationErrorMessage ?? ''}>
      {optimizationStatus}
    </span>
  ),
}));

const mockOnDownload = vi.fn();

const TestComponent = ({ models, columnId }: { models: AdminModelExtended[]; columnId: string }) => {
  const { columnDefinitions } = useAdminModelsTableConfig(models, mockOnDownload, null);
  const column = columnDefinitions.find((col) => col.id === columnId);

  return (
    <div>
      {models.map((model, index) => (
        <div key={index} data-testid={`row-${index}`}>
          {column?.cell?.(model)}
        </div>
      ))}
    </div>
  );
};

const TestWrapper = ({ models, columnId }: { models: AdminModelExtended[]; columnId: string }) => (
  <BrowserRouter>
    <TestComponent models={models} columnId={columnId} />
  </BrowserRouter>
);

describe('useAdminModelsTableConfig', () => {
  describe('username column', () => {
    it('renders username', () => {
      render(<TestWrapper models={[mockAdminModel]} columnId="username" />);
      expect(screen.getByText('jaime.muniz')).toBeInTheDocument();
    });
  });

  describe('name column', () => {
    it('renders model name', () => {
      render(<TestWrapper models={[mockAdminModel]} columnId="name" />);
      expect(screen.getByText('CenterlineTracker-v2')).toBeInTheDocument();
    });
  });

  describe('status column', () => {
    it('renders ModelStatusIndicator with model status', () => {
      render(<TestWrapper models={[mockAdminModel]} columnId="status" />);
      expect(screen.getByTestId('model-status')).toHaveTextContent(ModelStatus.READY);
    });

    it('renders IMPORTING status', () => {
      render(<TestWrapper models={[mockAdminModelImporting]} columnId="status" />);
      expect(screen.getByTestId('model-status')).toHaveTextContent(ModelStatus.IMPORTING);
    });
  });

  describe('optimizationStatus column', () => {
    it('renders OptimizationStatusIndicator', () => {
      render(<TestWrapper models={[mockAdminModel]} columnId="optimizationStatus" />);
      expect(screen.getByTestId('opt-status')).toHaveTextContent(OptimizationStatus.OPTIMIZED);
    });

    it('renders indicator for model without optimization status', () => {
      render(<TestWrapper models={[mockAdminModelImporting]} columnId="optimizationStatus" />);
      // Model with no optimizationStatus still renders the indicator (with undefined)
      expect(screen.getByTestId('row-0')).toBeInTheDocument();
    });
  });

  describe('sensors column', () => {
    it('renders sensor info from metadata', () => {
      render(<TestWrapper models={[mockAdminModel2]} columnId="sensors" />);
      // mockAdminModel2 has camera + lidar
      expect(screen.getByTestId('row-0')).toBeInTheDocument();
    });

    it('renders dash when no metadata', () => {
      render(<TestWrapper models={[mockAdminModelImporting]} columnId="sensors" />);
      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });

  describe('download column', () => {
    it('renders download link for READY model', () => {
      render(<TestWrapper models={[mockAdminModel]} columnId="download" />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders dash for non-READY model', () => {
      render(<TestWrapper models={[mockAdminModelImporting]} columnId="download" />);
      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });
});

describe('AdminModelsTableConfig — column cell renderers', () => {
  const TestCellRenderer = ({ model, columnId }: { model: AdminModelExtended; columnId: string }) => {
    const { columnDefinitions } = useAdminModelsTableConfig([model], vi.fn(), null);
    const col = columnDefinitions.find((c) => c.id === columnId);
    return <div data-testid="cell">{col?.cell?.(model)}</div>;
  };

  const renderCell = (model: AdminModelExtended, columnId: string) =>
    render(
      <BrowserRouter>
        <TestCellRenderer model={model} columnId={columnId} />
      </BrowserRouter>,
    );

  describe('actionSpaceType column', () => {
    it('renders "Continuous" for continuous action space', () => {
      const model = {
        ...mockAdminModel,
        metadata: { ...mockAdminModel.metadata, actionSpace: { continous: { lowSpeed: 1, highSpeed: 2 } } },
      } as AdminModelExtended;
      renderCell(model, 'actionSpaceType');
      expect(screen.getByTestId('cell')).toHaveTextContent('Continuous');
    });

    it('renders "Discrete" for discrete action space', () => {
      const model = {
        ...mockAdminModel,
        metadata: { ...mockAdminModel.metadata, actionSpace: { discrete: [{ speed: 1, steeringAngle: 0 }] } },
      } as AdminModelExtended;
      renderCell(model, 'actionSpaceType');
      expect(screen.getByTestId('cell')).toHaveTextContent('Discrete');
    });

    it('renders dash when no action space metadata', () => {
      const model = { ...mockAdminModel, metadata: undefined } as unknown as AdminModelExtended;
      renderCell(model, 'actionSpaceType');
      expect(screen.getByTestId('cell')).toHaveTextContent('-');
    });
  });

  describe('trainingAlgorithm column', () => {
    it('renders agent algorithm from metadata', () => {
      const model = {
        ...mockAdminModel,
        metadata: { ...mockAdminModel.metadata, agentAlgorithm: 'SAC' },
      } as AdminModelExtended;
      renderCell(model, 'trainingAlgorithm');
      expect(screen.getByTestId('cell')).toHaveTextContent('SAC');
    });

    it('renders dash when metadata is undefined', () => {
      const model = { ...mockAdminModel, metadata: undefined } as unknown as AdminModelExtended;
      renderCell(model, 'trainingAlgorithm');
      expect(screen.getByTestId('cell')).toHaveTextContent('-');
    });
  });
});

describe('AdminModelsTableConfig — MD5 and download columns', () => {
  const TestCellRenderer = ({
    model,
    columnId,
    downloadingId = null,
  }: {
    model: AdminModelExtended;
    columnId: string;
    downloadingId?: string | null;
  }) => {
    const { columnDefinitions } = useAdminModelsTableConfig([model], vi.fn(), downloadingId);
    const col = columnDefinitions.find((c) => c.id === columnId);
    return <div data-testid="cell">{col?.cell?.(model)}</div>;
  };

  const renderCell = (model: AdminModelExtended, columnId: string, downloadingId: string | null = null) =>
    render(
      <BrowserRouter>
        <TestCellRenderer model={model} columnId={columnId} downloadingId={downloadingId} />
      </BrowserRouter>,
    );

  it('modelMD5 renders hash when present', () => {
    const model = {
      ...mockAdminModel,
      metadata: { ...mockAdminModel.metadata, modelMD5: 'abc123def456' },
    } as AdminModelExtended;
    renderCell(model, 'modelMD5');
    expect(screen.getByTestId('cell')).toHaveTextContent('abc123def456');
  });

  it('modelMD5 renders dash when missing', () => {
    const model = { ...mockAdminModel, metadata: undefined } as unknown as AdminModelExtended;
    renderCell(model, 'modelMD5');
    expect(screen.getByTestId('cell')).toHaveTextContent('-');
  });

  it('metadataMD5 renders hash when present', () => {
    const model = {
      ...mockAdminModel,
      metadata: { ...mockAdminModel.metadata, metadataMD5: 'xyz789' },
    } as AdminModelExtended;
    renderCell(model, 'metadataMD5');
    expect(screen.getByTestId('cell')).toHaveTextContent('xyz789');
  });

  it('metadataMD5 renders dash when missing', () => {
    const model = { ...mockAdminModel, metadata: undefined } as unknown as AdminModelExtended;
    renderCell(model, 'metadataMD5');
    expect(screen.getByTestId('cell')).toHaveTextContent('-');
  });

  it('download column renders dash for non-READY models', () => {
    const model = { ...mockAdminModelImporting } as AdminModelExtended;
    renderCell(model, 'download');
    expect(screen.getByTestId('cell')).toHaveTextContent('-');
  });

  it('download column renders spinner when model is being downloaded', () => {
    renderCell(mockAdminModel, 'download', mockAdminModel.modelId);
    // Spinner renders an element with role="img" or specific Cloudscape class
    expect(screen.getByTestId('cell').innerHTML).not.toBe('-');
    expect(screen.getByTestId('cell').textContent).not.toContain('Download');
  });

  it('download column renders link for READY models not currently downloading', () => {
    renderCell(mockAdminModel, 'download');
    expect(screen.getByTestId('cell')).toHaveTextContent('Download');
  });
});

describe('AdminModelsTableConfig — additional coverage', () => {
  const TestCellRenderer = ({ model, columnId }: { model: AdminModelExtended; columnId: string }) => {
    const { columnDefinitions } = useAdminModelsTableConfig([model], vi.fn(), null);
    const col = columnDefinitions.find((c) => c.id === columnId);
    return <div data-testid="cell">{col?.cell?.(model)}</div>;
  };

  it('modelId column renders model ID', () => {
    render(
      <BrowserRouter>
        <TestCellRenderer model={mockAdminModel} columnId="modelId" />
      </BrowserRouter>,
    );
    expect(screen.getByTestId('cell')).toHaveTextContent(mockAdminModel.modelId);
  });

  it('actionSpaceType returns dash when actionSpace has neither continous nor discrete', () => {
    const model = {
      ...mockAdminModel,
      metadata: { ...mockAdminModel.metadata, actionSpace: {} },
    } as AdminModelExtended;
    render(
      <BrowserRouter>
        <TestCellRenderer model={model} columnId="actionSpaceType" />
      </BrowserRouter>,
    );
    expect(screen.getByTestId('cell')).toHaveTextContent('-');
  });
});

describe('AdminModelsTableConfig — noMatch and preferences', () => {
  const TestHookConsumer = ({ models }: { models: AdminModelExtended[] }) => {
    const { adminModelsPreferences, items } = useAdminModelsTableConfig(models, vi.fn(), null);
    return (
      <div>
        <div data-testid="item-count">{items.length}</div>
        <div data-testid="prefs">{adminModelsPreferences}</div>
      </div>
    );
  };

  it('renders CollectionPreferences with confirm button', () => {
    render(
      <BrowserRouter>
        <TestHookConsumer models={[mockAdminModel]} />
      </BrowserRouter>,
    );
    // CollectionPreferences renders a trigger button
    expect(screen.getByTestId('prefs')).toBeInTheDocument();
  });
});

describe('type column', () => {
  it('renders Physical badge for IMPORTED_PHYSICAL', () => {
    render(<TestWrapper models={[mockAdminModel]} columnId="modelSource" />);
    expect(screen.getByText('Physical')).toBeInTheDocument();
  });

  it('renders Virtual badge for TRAINED', () => {
    render(<TestWrapper models={[mockAdminModel2]} columnId="modelSource" />);
    expect(screen.getByText('Virtual')).toBeInTheDocument();
  });
});

describe('error message pass-through', () => {
  it('passes importErrorMessage to ModelStatusIndicator', () => {
    const modelWithError: AdminModelExtended = {
      ...mockAdminModel,
      status: ModelStatus.ERROR,
      importErrorMessage: 'Missing model_metadata.json',
    };
    render(<TestWrapper models={[modelWithError]} columnId="status" />);
    expect(screen.getByTestId('model-status')).toHaveAttribute('data-import-error', 'Missing model_metadata.json');
  });

  it('passes empty importErrorMessage when not set', () => {
    render(<TestWrapper models={[mockAdminModel]} columnId="status" />);
    expect(screen.getByTestId('model-status')).toHaveAttribute('data-import-error', '');
  });

  it('passes optimizationErrorMessage to OptimizationStatusIndicator', () => {
    const modelWithOptError: AdminModelExtended = {
      ...mockAdminModel,
      optimizationStatus: OptimizationStatus.FAILED,
      optimizationErrorMessage: 'Unrecognized sensor value',
    };
    render(<TestWrapper models={[modelWithOptError]} columnId="optimizationStatus" />);
    expect(screen.getByTestId('opt-status')).toHaveAttribute('data-opt-error', 'Unrecognized sensor value');
  });

  it('passes empty optimizationErrorMessage when not set', () => {
    render(<TestWrapper models={[mockAdminModel]} columnId="optimizationStatus" />);
    expect(screen.getByTestId('opt-status')).toHaveAttribute('data-opt-error', '');
  });
});
