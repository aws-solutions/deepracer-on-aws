// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { REQUIRED_FILES_FOR_IMPORT } from '#pages/ImportModel/constants';
import ImportModel from '#pages/ImportModel/ImportModel';
import { modelsApi } from '#services/deepRacer/modelsApi';
import notificationsSlice from '#store/notifications/notificationsSlice';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { files?: string }) => {
      const translations: Record<string, string> = {
        'validation.filesRequired': 'Missing required files: model_metadata.json',
        'validation.modelNameRequired': 'Model name is required',
        'validation.folderSizeExceeds': 'Folder size exceeds max 1GB limit',
        'validation.missingRequiredFiles': `Missing required files: ${options?.files || ''}`,
        'buttons.import': 'Import',
        'buttons.cancel': 'Cancel',
        title: 'Import Model',
        'details.modelName.label': 'Model name',
        'details.modelDescription.label': 'Model description',
        description: 'Upload your model folder',
      };
      return translations[key] || key;
    },
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('#utils/pageUtils.js', () => ({
  getPath: vi.fn().mockReturnValue('/models'),
}));

vi.useFakeTimers();

const mockImportModel = vi.fn();
const mockDispatch = vi.fn();

vi.mock('react-redux', async () => {
  const actual = await vi.importActual('react-redux');
  return {
    ...actual,
    useDispatch: () => mockDispatch,
  };
});

vi.mock('#services/deepRacer/modelsApi', async () => {
  const actual = await vi.importActual('#services/deepRacer/modelsApi');
  return {
    ...actual,
    useImportModelMutation: () => [mockImportModel, { isLoading: false }],
  };
});

vi.mock('#store/notifications/notificationsSlice', async () => {
  const actual = await vi.importActual('#store/notifications/notificationsSlice');
  return {
    ...actual,
    displayErrorNotification: vi.fn((payload) => ({ type: 'notifications/displayErrorNotification', payload })),
  };
});

const createMockStore = () =>
  configureStore({
    reducer: {
      notifications: notificationsSlice.reducer,
      [modelsApi.reducerPath]: modelsApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(modelsApi.middleware),
  });

describe('ImportModel', () => {
  let store: ReturnType<typeof createMockStore>;

  const renderComponent = () => {
    store = createMockStore();
    return render(
      <Provider store={store}>
        <MemoryRouter>
          <ImportModel />
        </MemoryRouter>
      </Provider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockImportModel.mockImplementation(({ onProgress }) => {
      return {
        unwrap: () => {
          onProgress(25);
          onProgress(50, 'file1.txt');
          onProgress(75, 'file2.txt');
          onProgress(100, 'model_metadata.json');
          return Promise.resolve({ success: true });
        },
      };
    });
  });
  it('should render the import model page', () => {
    renderComponent();
    expect(screen.getByText('Import Model')).toBeInTheDocument();
    expect(screen.getByText('Upload your model folder')).toBeInTheDocument();
  });

  it('should show selected folder name', async () => {
    renderComponent();
    const files = [
      new File(['{}'], 'model_metadata.json', { type: 'application/json' }),
      new File(['def reward_function():\n    pass'], 'reward_function.py', { type: 'text/plain' }),
      new File(['training_params'], 'training_params.yaml', { type: 'text/plain' }),
      new File(['{}'], 'hyperparameters.json', { type: 'application/json' }),
    ];
    files.forEach((file, index) => {
      Object.defineProperty(file, 'webkitRelativePath', {
        value: `test-folder/${REQUIRED_FILES_FOR_IMPORT[index]}`,
      });
    });

    const fileInput = screen.getByTestId('file-input');
    await fireEvent.change(fileInput, { target: { files } });
    vi.runAllTimers();

    expect(screen.getByText('Selected folder: test-folder')).toBeInTheDocument();
  }, 5000);

  it('should clear selected folder on validation error', async () => {
    renderComponent();
    const files = [new File(['content'], 'other_file.txt', { type: 'text/plain' })];
    Object.defineProperty(files[0], 'webkitRelativePath', {
      value: 'test-folder/other_file.txt',
    });

    const fileInput = screen.getByTestId('file-input');
    await fireEvent.change(fileInput, { target: { files } });
    vi.runAllTimers();

    expect(screen.queryByText('Selected folder: test-folder')).not.toBeInTheDocument();
  }, 5000);

  it('should navigate back on cancel', async () => {
    renderComponent();
    const cancelButton = screen.getByTestId('cancel-button');
    await fireEvent.click(cancelButton);
    vi.runAllTimers();
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  }, 5000);

  it('should handle empty files in onSubmit', async () => {
    renderComponent();

    const modelNameInput = screen.getByTestId('model-name-input');
    await fireEvent.change(modelNameInput, { detail: { value: 'Test Model' } });
    vi.runAllTimers();

    const importButton = screen.getByTestId('import-button');
    await fireEvent.click(importButton);
    vi.runAllTimers();
    expect(mockImportModel).not.toHaveBeenCalled();
  }, 5000);

  it('should handle cancel button click', async () => {
    renderComponent();

    const cancelButton = screen.getByTestId('cancel-button');
    await fireEvent.click(cancelButton);
    vi.runAllTimers();

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  }, 5000);
  it('should handle folder upload input change', async () => {
    renderComponent();

    const files = [
      new File(['{}'], 'model_metadata.json', { type: 'application/json' }),
      new File(['def reward_function():\n    pass'], 'reward_function.py', { type: 'text/plain' }),
      new File(['training_params'], 'training_params.yaml', { type: 'text/plain' }),
      new File(['{}'], 'hyperparameters.json', { type: 'application/json' }),
    ];
    files.forEach((file, index) => {
      Object.defineProperty(file, 'webkitRelativePath', {
        value: `test-folder/${REQUIRED_FILES_FOR_IMPORT[index]}`,
      });
    });

    const fileInput = screen.getByTestId('file-input');
    await fireEvent.change(fileInput, { target: { files } });
    vi.runAllTimers();

    expect(screen.getByText('Selected folder: test-folder')).toBeInTheDocument();
  }, 5000);

  it('should show error for missing required files', async () => {
    renderComponent();
    const files = [
      new File(['{}'], 'model_metadata.json', { type: 'application/json' }),
      new File(['training_params'], 'training_params.yaml', { type: 'text/plain' }),
    ];
    const fileNames = [REQUIRED_FILES_FOR_IMPORT[0], REQUIRED_FILES_FOR_IMPORT[2]];
    files.forEach((file, index) => {
      Object.defineProperty(file, 'webkitRelativePath', {
        value: `test-folder/${fileNames[index]}`,
      });
    });

    const fileInput = screen.getByTestId('file-input');
    await fireEvent.change(fileInput, { target: { files } });
    vi.runAllTimers();

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'notifications/displayErrorNotification',
      payload: {
        content: 'Missing required files: reward_function.py, hyperparameters.json',
      },
    });
  }, 5000);

  it('should show error for folder size exceeding 1GB', async () => {
    renderComponent();
    const files = [
      new File(['{}'], 'model_metadata.json', { type: 'application/json' }),
      new File(['def reward_function():\n    pass'], 'reward_function.py', { type: 'text/plain' }),
      new File(['training_params'], 'training_params.yaml', { type: 'text/plain' }),
      new File(['{}'], 'hyperparameters.json', { type: 'application/json' }),
    ];
    files.forEach((file, index) => {
      Object.defineProperty(file, 'webkitRelativePath', {
        value: `test-folder/${REQUIRED_FILES_FOR_IMPORT[index]}`,
      });

      Object.defineProperty(file, 'size', {
        value: 300 * 1024 * 1024, // Mock folder size of 1.2GB total
      });
    });

    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files } });
    vi.runAllTimers();

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'notifications/displayErrorNotification',
      payload: {
        content: 'Folder size exceeds max 1GB limit',
      },
    });
  }, 5000);

  it('should accept folder size under 1GB limit', async () => {
    renderComponent();
    const files = [
      new File(['{}'], 'model_metadata.json', { type: 'application/json' }),
      new File(['def reward_function():\n    pass'], 'reward_function.py', { type: 'text/plain' }),
      new File(['training_params'], 'training_params.yaml', { type: 'text/plain' }),
      new File(['{}'], 'hyperparameters.json', { type: 'application/json' }),
    ];
    files.forEach((file, index) => {
      Object.defineProperty(file, 'webkitRelativePath', {
        value: `test-folder/${REQUIRED_FILES_FOR_IMPORT[index]}`,
      });

      Object.defineProperty(file, 'size', {
        value: 125 * 1024 * 1024,
      });
    });

    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files } });
    vi.runAllTimers();

    expect(screen.getByText('Selected folder: test-folder')).toBeInTheDocument();
    expect(mockDispatch).not.toHaveBeenCalledWith({
      type: 'notifications/displayErrorNotification',
      payload: {
        content: 'Folder size exceeds max 1GB limit',
      },
    });
  }, 5000);
});
