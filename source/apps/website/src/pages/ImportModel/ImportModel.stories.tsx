// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { configureStore } from '@reduxjs/toolkit';
import type { Meta, StoryObj } from '@storybook/react';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

import { modelsApi } from '#services/deepRacer/modelsApi';
import notificationsSlice from '#store/notifications/notificationsSlice';

import ImportModel from './ImportModel';

const store = configureStore({
  reducer: {
    notifications: notificationsSlice.reducer,
    [modelsApi.reducerPath]: modelsApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(modelsApi.middleware),
});

const meta = {
  title: 'Pages/ImportModel',
  component: ImportModel,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <Provider store={store}>
        <MemoryRouter>
          <Story />
        </MemoryRouter>
      </Provider>
    ),
  ],
} satisfies Meta<typeof ImportModel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithUploadProgress: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post('/api/models/import', async ({ request }) => {
          const formData = await request.formData();
          formData.getAll('files');

          setTimeout(() => {
            request.signal.dispatchEvent(
              new ProgressEvent('progress', { loaded: 50, total: 100, lengthComputable: true }),
            );
          }, 500);

          setTimeout(() => {
            request.signal.dispatchEvent(
              new ProgressEvent('progress', { loaded: 100, total: 100, lengthComputable: true }),
            );
          }, 1000);

          return HttpResponse.json({ success: true });
        }),
      ],
    },
  },
};

export const WithError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post('/api/models/import', () => {
          return new HttpResponse(null, {
            status: 500,
            statusText: 'Upload failed',
          });
        }),
      ],
    },
  },
};

export const WithValidationError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post('/api/models/import', () => {
          return HttpResponse.json({ message: 'Missing required files: model_metadata.json' }, { status: 400 });
        }),
      ],
    },
  },
};
