// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { AppLayoutProps } from '@cloudscape-design/components/app-layout';

export enum PageId {
  ACCOUNT = 'account',
  ADMIN_CAR_LOGS = 'adminCarLogs',
  ADMIN_MODELS = 'adminModels',
  CREATE_EVALUATION = 'createEvaluation',
  CREATE_EVENT = 'createEvent',
  CREATE_MODEL = 'createModel',
  CREATE_RACE = 'createRace',
  CLONE_RACE = 'cloneRace',
  CAR_LOGS = 'carLogs',
  DEVICES = 'devices',
  DEVICE_DETAIL = 'deviceDetail',
  ACTIVATE_DEVICE = 'activateDevice',
  FLEETS = 'fleets',
  EDIT_EVENT = 'editEvent',
  EDIT_RACE = 'editRace',
  ENTER_RACE = 'enterRace',
  EVENT_DETAIL = 'eventDetail',
  EVENTS = 'events',
  FORGOT_PASSWORD_REQUEST = 'forgotPasswordRequest',
  FORGOT_PASSWORD_RESET = 'forgotPasswordReset',
  GET_STARTED = 'getStarted',
  HOME = 'home',
  IMPORT_MODEL = 'importModel',
  IMPORT_PHYSICAL_MODEL = 'importPhysicalModel',
  LIVE_RACE = 'liveRace',
  MANAGE_INSTANCE = 'manageInstance',
  MANAGE_RACES = 'manageRaces',
  MODEL_DETAILS = 'modelDetails',
  MODELS = 'models',
  RACE_DETAILS = 'raceDetails',
  RACER_PROFILE = 'racerProfile',
  RACES = 'races',
  SIGN_IN = 'signIn',
  SIGN_UP = 'signUp',
  SUBMIT_MODEL_TO_RACE = 'submitModelToRace',
  UPLOAD_STATUS = 'uploadStatus',
  TIMEKEEPING = 'timekeeping',
  TIMEKEEPING_TRACK = 'timekeepingTrack',
  VERIFY_EMAIL = 'verifyEmail',
  // Race Management — Epics 4+5
  PUBLIC_LEADERBOARD = 'publicLeaderboard',
  STREAMING_OVERLAY = 'streamingOverlay',
  COMMENTATOR_VIEW = 'commentatorView',
  RACE_STATS = 'raceStats',
  REGISTER_RACER = 'registerRacer',
}

export const AUTH_PAGE_IDS = [
  PageId.FORGOT_PASSWORD_REQUEST,
  PageId.FORGOT_PASSWORD_RESET,
  PageId.SIGN_IN,
  PageId.SIGN_UP,
  PageId.VERIFY_EMAIL,
];

export interface PageDetails {
  /**
   * The react-router path pattern to the page.
   */
  path: string;
  contentType?: AppLayoutProps['contentType'];
}

export const pages = {
  [PageId.ACCOUNT]: {
    path: '/account',
    contentType: 'form',
  },
  [PageId.ADMIN_MODELS]: {
    path: '/admin/models',
    contentType: 'table',
  },
  [PageId.CLONE_RACE]: {
    path: '/races/:leaderboardId/cloneRace',
    contentType: 'wizard',
  },
  [PageId.CREATE_EVALUATION]: {
    path: '/models/:modelId/evaluate',
    contentType: 'form',
  },
  [PageId.CREATE_EVENT]: {
    path: '/events/create',
    contentType: 'form',
  },
  [PageId.CREATE_MODEL]: {
    path: '/models/create',
    contentType: 'wizard',
  },
  [PageId.CREATE_RACE]: {
    path: '/races/create',
    contentType: 'wizard',
  },
  [PageId.ADMIN_CAR_LOGS]: {
    path: '/admin/car-logs',
    contentType: 'table',
  },
  [PageId.CAR_LOGS]: {
    path: '/car-logs',
    contentType: 'table',
  },
  [PageId.DEVICES]: {
    path: '/devices',
    contentType: 'table',
  },
  [PageId.ACTIVATE_DEVICE]: {
    path: '/devices/activate',
    contentType: 'wizard',
  },
  [PageId.DEVICE_DETAIL]: {
    path: '/devices/:instanceId',
  },
  [PageId.FLEETS]: {
    path: '/fleets',
    contentType: 'table',
  },
  [PageId.EDIT_RACE]: {
    path: '/races/:leaderboardId/editRace',
  },
  [PageId.EDIT_EVENT]: {
    path: '/events/:eventId/edit',
    contentType: 'form',
  },
  [PageId.ENTER_RACE]: {
    path: '/races/:leaderboardId/enter',
  },
  [PageId.EVENT_DETAIL]: {
    path: '/events/:eventId',
  },
  [PageId.EVENTS]: {
    path: '/events',
    contentType: 'table',
  },
  [PageId.FORGOT_PASSWORD_REQUEST]: {
    path: '/forgotPasswordRequest',
    contentType: 'form',
  },
  [PageId.FORGOT_PASSWORD_RESET]: {
    path: '/forgotPasswordReset',
    contentType: 'form',
  },
  [PageId.GET_STARTED]: {
    path: '/getStarted',
  },
  [PageId.HOME]: {
    path: '/home',
  },
  [PageId.IMPORT_MODEL]: {
    path: '/models/import',
  },
  [PageId.IMPORT_PHYSICAL_MODEL]: {
    path: '/models/import-physical',
  },
  [PageId.LIVE_RACE]: {
    path: '/races/:leaderboardId/live',
    contentType: 'default',
  },
  [PageId.MANAGE_RACES]: {
    path: '/races/manage',
    contentType: 'table',
  },
  [PageId.MANAGE_INSTANCE]: {
    path: '/manageInstance',
  },
  [PageId.MODEL_DETAILS]: {
    path: '/models/:modelId',
  },
  [PageId.MODELS]: {
    path: '/models',
    contentType: 'table',
  },
  [PageId.RACE_DETAILS]: {
    path: '/races/:leaderboardId',
  },
  [PageId.RACER_PROFILE]: {
    path: '/racerProfile',
  },
  [PageId.RACES]: {
    path: '/races',
  },
  [PageId.SIGN_IN]: {
    path: '/signIn',
  },
  [PageId.SIGN_UP]: {
    path: '/signUp',
  },
  [PageId.SUBMIT_MODEL_TO_RACE]: {
    path: '/models/:modelId/submit',
  },
  [PageId.UPLOAD_STATUS]: {
    path: '/admin/upload-status',
    contentType: 'table',
  },
  [PageId.TIMEKEEPING]: {
    path: '/timekeep',
    contentType: 'default',
  },
  [PageId.TIMEKEEPING_TRACK]: {
    path: '/events/:eventId/tracks/:leaderboardId/timekeep',
    contentType: 'default',
  },
  [PageId.VERIFY_EMAIL]: {
    path: '/verifyEmail',
  },
  // Race Management — Epics 4+5
  [PageId.PUBLIC_LEADERBOARD]: {
    path: '/race-management/events/:eventId/leaderboard',
  },
  [PageId.STREAMING_OVERLAY]: {
    path: '/race-management/overlay',
  },
  [PageId.COMMENTATOR_VIEW]: {
    path: '/race-management/commentator',
    contentType: 'table',
  },
  [PageId.RACE_STATS]: {
    path: '/race-management/stats',
  },
  [PageId.REGISTER_RACER]: {
    path: '/race-management/register',
    contentType: 'form',
  },
} as const satisfies { [Page in PageId]: PageDetails };
