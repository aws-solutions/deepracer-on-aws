// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { AppLayoutProps } from '@cloudscape-design/components/app-layout';

export enum PageId {
  ACCOUNT = 'account',
  CREATE_EVALUATION = 'createEvaluation',
  CREATE_MODEL = 'createModel',
  CREATE_RACE = 'createRace',
  CLONE_RACE = 'cloneRace',
  EDIT_RACE = 'editRace',
  ENTER_RACE = 'enterRace',
  FORGOT_PASSWORD_REQUEST = 'forgotPasswordRequest',
  FORGOT_PASSWORD_RESET = 'forgotPasswordReset',
  GET_STARTED = 'getStarted',
  HOME = 'home',
  IMPORT_MODEL = 'importModel',
  MANAGE_INSTANCE = 'manageInstance',
  MANAGE_RACES = 'manageRaces',
  MODEL_DETAILS = 'modelDetails',
  MODELS = 'models',
  RACE_DETAILS = 'raceDetails',
  RACER_PROFILE = 'racerProfile',
  RACES = 'races',
  SIGN_IN = 'signIn',
  SUBMIT_MODEL_TO_RACE = 'submitModelToRace',
  VERIFY_EMAIL = 'verifyEmail',
}

export const AUTH_PAGE_IDS = [
  PageId.FORGOT_PASSWORD_REQUEST,
  PageId.FORGOT_PASSWORD_RESET,
  PageId.SIGN_IN,
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
  [PageId.CLONE_RACE]: {
    path: '/races/:leaderboardId/cloneRace',
    contentType: 'wizard',
  },
  [PageId.CREATE_EVALUATION]: {
    path: '/models/:modelId/evaluate',
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
  [PageId.EDIT_RACE]: {
    path: '/races/:leaderboardId/editRace',
  },
  [PageId.ENTER_RACE]: {
    path: '/races/:leaderboardId/enter',
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
  [PageId.SUBMIT_MODEL_TO_RACE]: {
    path: '/models/:modelId/submit',
  },
  [PageId.VERIFY_EMAIL]: {
    path: '/verifyEmail',
  },
} as const satisfies { [Page in PageId]: PageDetails };
