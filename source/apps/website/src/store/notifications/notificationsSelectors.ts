// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Notification } from './notificationsSlice';
import { RootState } from '../index.js';

export const getNotifications = (state: RootState): Notification[] => state.notifications.items;
