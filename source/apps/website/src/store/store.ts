// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

import notificationsSlice from './notifications/index.js';
import { deepRacerApi } from '../services/deepRacer/deepRacerApi.js';

const rootReducer = combineReducers({
  [deepRacerApi.reducerPath]: deepRacerApi.reducer,
  notifications: notificationsSlice.reducer,
});

const datePaths = [/.createdAt/, /.submittedAt/, /.openTime/, /.closeTime/];

export const getStore = (initialState?: Partial<RootState>) => {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: initialState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActionPaths: datePaths,
          ignoredPaths: datePaths,
        },
      }).concat(deepRacerApi.middleware),
  });

  setupListeners(store.dispatch);

  return store;
};

export const store = getStore();

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof rootReducer>;
