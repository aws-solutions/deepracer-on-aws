// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { FlashbarProps } from '@cloudscape-design/components/flashbar';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Notification extends FlashbarProps.MessageDefinition {
  // Number to determine if the notification should persist across a certain number of page changes.
  persistForPageChanges?: number;
}

export interface NotificationState {
  items: Notification[];
}

export const initialState: NotificationState = {
  items: [],
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    displaySuccessNotification: (state, action: PayloadAction<Notification>) => {
      state.items.push({ type: 'success', dismissible: true, id: crypto.randomUUID(), ...action.payload });
    },
    displayErrorNotification: (state, action: PayloadAction<Notification>) => {
      if (!action?.payload?.content) return state;
      state.items.push({ type: 'error', dismissible: true, id: crypto.randomUUID(), ...action.payload });
      return state;
    },
    displayInfoNotification: (state, action: PayloadAction<Notification>) => {
      state.items.push({ type: 'info', dismissible: true, id: crypto.randomUUID(), ...action.payload });
    },
    displayWarningNotification: (state, action: PayloadAction<Notification>) => {
      state.items.push({ type: 'warning', dismissible: true, id: crypto.randomUUID(), ...action.payload });
    },
    removeNotification: (state, action: PayloadAction<{ id: string }>) => {
      state.items = state.items.filter((item: FlashbarProps.MessageDefinition) => item.id !== action.payload.id);
    },
    clearAllNotifications: (state) => {
      const updatedNotificatons = state.items
        .filter((item: Notification) => {
          return item?.persistForPageChanges ? item.persistForPageChanges > 0 : false;
        })
        .map((item: Notification) => {
          return {
            ...item,
            persistForPageChanges: item?.persistForPageChanges ? item.persistForPageChanges - 1 : 0,
          };
        });
      state.items = updatedNotificatons;
    },
  },
});

export const {
  clearAllNotifications,
  displayErrorNotification,
  displayInfoNotification,
  displaySuccessNotification,
  displayWarningNotification,
  removeNotification,
} = notificationsSlice.actions;

export default notificationsSlice;
