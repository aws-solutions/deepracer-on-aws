// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider as StoreProvider } from 'react-redux';
import { createBrowserRouter, Navigate, Route, RouterProvider, createRoutesFromElements } from 'react-router-dom';

import '#i18n';
import '@cloudscape-design/global-styles/index.css';

import AppLayout from '#components/AppLayout';
import RequiresAdmin from '#components/RequiresAdmin';
import RequiresAdminOrFacilitator from '#components/RequiresAdminOrFacilitator';
import RequiresAuth from '#components/RequiresAuth';
import RequiresCommentator from '#components/RequiresCommentator';
import RequiresRegistrationManager from '#components/RequiresRegistrationManager';
import { AuthState } from '#constants/auth.js';
import { PageId, pages } from '#constants/pages';
import Account from '#pages/Account';
import ActivateDevice from '#pages/ActivateDevice';
import AdminModels from '#pages/AdminModels';
import Auth from '#pages/Auth';
import CarLogs from '#pages/CarLogs';
import CloneRace from '#pages/CloneRace';
import CommentatorView from '#pages/CommentatorView';
import CreateEvaluation from '#pages/CreateEvaluation';
import CreateEvent, { EditEvent } from '#pages/CreateEvent';
import CreateModel from '#pages/CreateModel';
import CreateRace from '#pages/CreateRace';
import DeviceDetail from '#pages/DeviceDetail';
import DeviceList from '#pages/DeviceList';
import EditRace from '#pages/EditRace';
import EnterRace from '#pages/EnterRace';
import EventDetail from '#pages/EventDetail';
import EventList from '#pages/EventList';
import FleetList from '#pages/FleetList';
import GetStarted from '#pages/GetStarted';
import Home from '#pages/Home';
import ImportModel from '#pages/ImportModel';
import ImportPhysicalModel from '#pages/ImportPhysicalModel';
import LiveRace from '#pages/LiveRace';
import ManageInstance from '#pages/ManageInstance/ManageInstance.js';
import ManageRaces from '#pages/ManageRaces';
import ModelDetails from '#pages/ModelDetails';
import Models from '#pages/Models';
import PublicLeaderboard from '#pages/PublicLeaderboard';
import RaceDetails from '#pages/RaceDetails';
import RacerProfile from '#pages/RacerProfile';
import Races from '#pages/Races';
import RaceStats from '#pages/RaceStats';
import RegisterRacer from '#pages/RegisterRacer';
import StreamingOverlay from '#pages/StreamingOverlay';
import SubmitModelToRace from '#pages/SubmitModelToRace';
import { Timekeeping } from '#pages/Timekeeping';
import UploadStatus from '#pages/UploadStatus';
import { store } from '#store';
import { configureAuth } from '#utils/authUtils';

configureAuth();

const router = createBrowserRouter([
  // ── Authenticated app shell ────────────────────────────────────────────────
  ...createRoutesFromElements(
    <Route element={<AppLayout />}>
      <Route element={<RequiresAuth />}>
        <Route path={pages[PageId.ACCOUNT].path} element={<Account />} />
        <Route element={<RequiresAdminOrFacilitator />}>
          <Route path={pages[PageId.ADMIN_MODELS].path} element={<AdminModels />} />
          <Route path={pages[PageId.UPLOAD_STATUS].path} element={<UploadStatus />} />
          <Route path={pages[PageId.DEVICES].path} element={<DeviceList />} />
          <Route path={pages[PageId.DEVICE_DETAIL].path} element={<DeviceDetail />} />
          <Route path={pages[PageId.TIMEKEEPING].path} element={<Timekeeping />} />
          <Route path={pages[PageId.TIMEKEEPING_TRACK].path} element={<Timekeeping />} />
        </Route>
        <Route element={<RequiresAdmin />}>
          <Route path={pages[PageId.ACTIVATE_DEVICE].path} element={<ActivateDevice />} />
          <Route path={pages[PageId.FLEETS].path} element={<FleetList />} />
        </Route>
        <Route path={pages[PageId.CLONE_RACE].path} element={<CloneRace />} />
        <Route path={pages[PageId.CREATE_EVALUATION].path} element={<CreateEvaluation />} />
        <Route path={pages[PageId.CAR_LOGS].path} element={<CarLogs scope="mine" />} />
        <Route path={pages[PageId.ADMIN_CAR_LOGS].path} element={<CarLogs scope="all" />} />
        <Route element={<RequiresAdmin />}>
          <Route path={pages[PageId.CREATE_EVENT].path} element={<CreateEvent />} />
          <Route path={pages[PageId.EDIT_EVENT].path} element={<EditEvent />} />
        </Route>
        <Route path={pages[PageId.CREATE_MODEL].path} element={<CreateModel />} />
        <Route path={pages[PageId.CREATE_RACE].path} element={<CreateRace />} />
        <Route path={pages[PageId.EDIT_RACE].path} element={<EditRace />} />
        <Route path={pages[PageId.ENTER_RACE].path} element={<EnterRace />} />
        <Route path={pages[PageId.EVENT_DETAIL].path} element={<EventDetail />} />
        <Route path={pages[PageId.EVENTS].path} element={<EventList />} />

        <Route path={pages[PageId.GET_STARTED].path} element={<GetStarted />} />
        <Route path={pages[PageId.HOME].path} element={<Home />} />
        <Route path={pages[PageId.IMPORT_MODEL].path} element={<ImportModel />} />
        <Route path={pages[PageId.IMPORT_PHYSICAL_MODEL].path} element={<ImportPhysicalModel />} />
        <Route path={pages[PageId.LIVE_RACE].path} element={<LiveRace />} />
        <Route path={pages[PageId.MANAGE_INSTANCE].path} element={<ManageInstance />} />
        <Route path={pages[PageId.MANAGE_RACES].path} element={<ManageRaces />} />
        <Route path={pages[PageId.MODEL_DETAILS].path} element={<ModelDetails />} />
        <Route path={pages[PageId.MODELS].path} element={<Models />} />
        <Route path={pages[PageId.RACE_DETAILS].path} element={<RaceDetails />} />
        <Route path={pages[PageId.RACER_PROFILE].path} element={<RacerProfile />} />
        <Route path={pages[PageId.RACES].path} element={<Races />} />
        <Route path={pages[PageId.SUBMIT_MODEL_TO_RACE].path} element={<SubmitModelToRace />} />

        {/* Race Management — role-gated pages */}
        <Route element={<RequiresAdmin />}>
          <Route path={pages[PageId.RACE_STATS].path} element={<RaceStats />} />
        </Route>
        <Route element={<RequiresCommentator />}>
          <Route path={pages[PageId.COMMENTATOR_VIEW].path} element={<CommentatorView />} />
        </Route>
        <Route element={<RequiresRegistrationManager />}>
          <Route path={pages[PageId.REGISTER_RACER].path} element={<RegisterRacer />} />
        </Route>
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
      <Route path={pages[PageId.SIGN_UP].path} element={<Auth initialAuthState={AuthState.SIGN_UP} />} />
      <Route path={pages[PageId.VERIFY_EMAIL].path} element={<Auth initialAuthState={AuthState.VERIFY_EMAIL} />} />
      <Route path="*" element={<Navigate to={pages[PageId.HOME].path} replace />} />
    </Route>,
  ),
  // ── Chrome-less public pages (no AppLayout, no auth required) ─────────────
  // PublicLeaderboard and StreamingOverlay are venue/anonymous pages.
  // StreamingOverlay is a bare page for OBS browser source compositing — no nav bar.
  { path: pages[PageId.STREAMING_OVERLAY].path, element: <StreamingOverlay /> },
  { path: pages[PageId.PUBLIC_LEADERBOARD].path, element: <PublicLeaderboard /> },
]);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <StoreProvider store={store}>
      <RouterProvider future={{ v7_startTransition: true }} router={router} />
    </StoreProvider>
  </StrictMode>,
);
