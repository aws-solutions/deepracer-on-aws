// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import i18n from 'i18next';
import intervalPlural from 'i18next-intervalplural-postprocessor';
import { initReactI18next } from 'react-i18next';

import account from '#i18n/en/account.json';
import auth from '#i18n/en/auth.json';
import avatar from '#i18n/en/avatar.json';
import breadcrumbs from '#i18n/en/breadcrumbs.json';
import common from '#i18n/en/common.json';
import createEvaluation from '#i18n/en/createEvaluation.json';
import createModel from '#i18n/en/createModel.json';
import createRace from '#i18n/en/createRace.json';
import enterRace from '#i18n/en/enterRace.json';
import getStarted from '#i18n/en/getStarted.json';
import home from '#i18n/en/home.json';
import importModel from '#i18n/en/importModel.json';
import leaderboards from '#i18n/en/leaderboards.json';
import modelDetails from '#i18n/en/modelDetails.json';
import models from '#i18n/en/models.json';
import navigation from '#i18n/en/navigation.json';
import raceDetails from '#i18n/en/raceDetails.json';
import racerProfile from '#i18n/en/racerProfile.json';
import races from '#i18n/en/races.json';
import submitModelToRace from '#i18n/en/submitModelToRace.json';
import trackSelection from '#i18n/en/trackSelection.json';
import validation from '#i18n/en/validation.json';

const defaultNS = 'common';
const resources = {
  en: {
    account,
    auth,
    avatar,
    breadcrumbs,
    common,
    createEvaluation,
    createModel,
    createRace,
    enterRace,
    getStarted,
    home,
    leaderboards,
    modelDetails,
    models,
    navigation,
    raceDetails,
    racerProfile,
    races,
    submitModelToRace,
    trackSelection,
    validation,
    importModel,
  },
} as const;
export type DefaultNS = typeof defaultNS;
export type Resources = typeof resources;

i18n
  .use(initReactI18next)
  .use(intervalPlural)
  .init({
    defaultNS,
    resources,
    lng: 'en',
    ns: [defaultNS],
    interpolation: {
      escapeValue: false, // React already escapes by default
      format: (value, format) => {
        if (format === 'lowercase') {
          return value?.toLowerCase();
        }
        return value;
      },
    },
    returnObjects: true,
    returnNull: true,
    react: {
      transKeepBasicHtmlNodesFor: ['b', 'br', 'strong', 'i', 'p', 'span', 'li', 'ol', 'ul', 'code'],
    },
  })
  .catch(console.error);

export default i18n;
