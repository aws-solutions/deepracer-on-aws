// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DeviceType } from '@deepracer-indy/typescript-client';
import * as Yup from 'yup';

import i18n from '#i18n/index.js';

export interface ActivateDeviceFormValues {
  deviceType: DeviceType | '';
  fleetId: string;
  name: string;
  ssid: string;
  wifiPassword: string;
  consolePassword: string;
  communityConsole: boolean;
}

export const ACTIVATE_DEVICE_DEFAULTS: ActivateDeviceFormValues = {
  deviceType: '',
  fleetId: '',
  name: '',
  ssid: '',
  wifiPassword: '',
  consolePassword: '',
  communityConsole: false,
};

export const activateDeviceValidationSchema = Yup.object({
  name: Yup.string()
    .required(() => i18n.t('devices:wizard.validation.nameRequired'))
    .min(1, () => i18n.t('devices:wizard.validation.nameRequired'))
    .max(64, () => i18n.t('devices:wizard.validation.nameMaxLength')),
  deviceType: Yup.string().required(() => i18n.t('devices:wizard.validation.deviceTypeRequired')),
  fleetId: Yup.string().optional(),
  ssid: Yup.string().optional(),
  wifiPassword: Yup.string().optional(),
  consolePassword: Yup.string().optional(),
  communityConsole: Yup.boolean().optional(),
});
