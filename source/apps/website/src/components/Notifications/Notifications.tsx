// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Flashbar from '@cloudscape-design/components/flashbar';

import { useAppDispatch } from '#hooks/useAppDispatch.js';
import { useAppSelector } from '#hooks/useAppSelector.js';
import { getNotifications, Notification, removeNotification } from '#store/notifications';

const Notifications = () => {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector(getNotifications);

  const items = notifications.map(
    (notification): Notification => ({
      ...notification,
      onDismiss: (event) => {
        dispatch(removeNotification({ id: notification.id as string }));
        notification.onDismiss?.(event);
      },
    }),
  );

  return <Flashbar items={items} />;
};

export default Notifications;
