// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider as StoreProvider } from 'react-redux';
import { createBrowserRouter, createRoutesFromElements, Navigate, Route, RouterProvider } from 'react-router-dom';

import '#i18n';
import '@cloudscape-design/global-styles/index.css';

import AppLayout from '#components/AppLayout';
import RequiresAuth from '#components/RequiresAuth';
import { AuthState } from '#constants/auth.js';
import { PageId, pages } from '#constants/pages';
import Account from '#pages/Account';
import Auth from '#pages/Auth';
import CloneRace from '#pages/CloneRace';
import CreateEvaluation from '#pages/CreateEvaluation';
import CreateModel from '#pages/CreateModel';
import CreateRace from '#pages/CreateRace';
import EditRace from '#pages/EditRace';
import EnterRace from '#pages/EnterRace';
import GetStarted from '#pages/GetStarted';
import Home from '#pages/Home';
import ImportModel from '#pages/ImportModel';
import ManageInstance from '#pages/ManageInstance/ManageInstance.js';
import ManageRaces from '#pages/ManageRaces';
import ModelDetails from '#pages/ModelDetails';
import Models from '#pages/Models';
import RaceDetails from '#pages/RaceDetails';
import RacerProfile from '#pages/RacerProfile';
import Races from '#pages/Races';
import SubmitModelToRace from '#pages/SubmitModelToRace';
import { store } from '#store';
import { configureAuth } from '#utils/authUtils';

configureAuth();

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<AppLayout />}>
      <Route element={<RequiresAuth />}>
        <Route path={pages[PageId.ACCOUNT].path} element={<Account />} />
        <Route path={pages[PageId.CLONE_RACE].path} element={<CloneRace />} />
        <Route path={pages[PageId.CREATE_EVALUATION].path} element={<CreateEvaluation />} />
        <Route path={pages[PageId.CREATE_MODEL].path} element={<CreateModel />} />
        <Route path={pages[PageId.CREATE_RACE].path} element={<CreateRace />} />
        <Route path={pages[PageId.EDIT_RACE].path} element={<EditRace />} />
        <Route path={pages[PageId.ENTER_RACE].path} element={<EnterRace />} />

        <Route path={pages[PageId.GET_STARTED].path} element={<GetStarted />} />
        <Route path={pages[PageId.HOME].path} element={<Home />} />
        <Route path={pages[PageId.IMPORT_MODEL].path} element={<ImportModel />} />
        <Route path={pages[PageId.MANAGE_INSTANCE].path} element={<ManageInstance />} />
        <Route path={pages[PageId.MANAGE_RACES].path} element={<ManageRaces />} />
        <Route path={pages[PageId.MODEL_DETAILS].path} element={<ModelDetails />} />
        <Route path={pages[PageId.MODELS].path} element={<Models />} />
        <Route path={pages[PageId.RACE_DETAILS].path} element={<RaceDetails />} />
        <Route path={pages[PageId.RACER_PROFILE].path} element={<RacerProfile />} />
        <Route path={pages[PageId.RACES].path} element={<Races />} />
        <Route path={pages[PageId.SUBMIT_MODEL_TO_RACE].path} element={<SubmitModelToRace />} />
      </Route>
      <Route
        path={pages[PageId.FORGOT_PASSWORD_REQUEST].path}
        element={<Auth initialAuthState={AuthState.FORGOT_PASSWORD_REQUEST} />}
      />
      <Route
        path={pages[PageId.FORGOT_PASSWORD_RESET].path}
        element={<Auth initialAuthState={AuthState.FORGOT_PASSWORD_RESET} />}
      />

      <Route path={pages[PageId.SIGN_IN].path} element={<Auth initialAuthState={AuthState.SIGNIN} />} />
      <Route path={pages[PageId.VERIFY_EMAIL].path} element={<Auth initialAuthState={AuthState.VERIFY_EMAIL} />} />
      <Route path="*" element={<Navigate to={pages[PageId.HOME].path} replace />} />
    </Route>,
  ),
);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <StoreProvider store={store}>
      <RouterProvider future={{ v7_startTransition: true }} router={router} />
    </StoreProvider>
  </StrictMode>,
);
