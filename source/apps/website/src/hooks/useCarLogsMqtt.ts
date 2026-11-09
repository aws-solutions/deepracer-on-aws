// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarLogAssetType, UserGroups } from '@deepracer-indy/typescript-client';
import { useEffect, useMemo, useState } from 'react';

import { DeepRacerApiQueryTagType, LIST_QUERY_TAG_ID } from '#services/deepRacer/constants.js';
import { deepRacerApi } from '#services/deepRacer/deepRacerApi.js';
import { useGetProfileQuery } from '#services/deepRacer/profileApi.js';
import { getUserGroups } from '#utils/authUtils.js';
import { resolveCarLogsAccess } from '#utils/carLogsAccess.js';

import { useAppDispatch } from './useAppDispatch.js';
import { useMqttSubscription, type UseMqttSubscriptionReturn } from './useMqttSubscription.js';

export { ConnectionStatus } from './useMqttSubscription.js';

export type CarLogJobMqttEvent = {
  eventType: 'CAR_LOG_JOB_UPDATED';
  jobId: string;
  status: string;
  timestamp: string;
};

export type CarLogAssetMqttEvent = {
  eventType: 'CAR_LOG_ASSET_ADDED' | 'CAR_LOG_ASSET_DELETED';
  assetId: string;
  assetType: CarLogAssetType | string;
  timestamp: string;
};

export const buildCarLogJobTopic = (namespace: string): string => `deepracer/${namespace}/carlogs/jobs`;
export const buildCarLogAssetTopic = (namespace: string, profileId: string): string =>
  `deepracer/${namespace}/carlogs/assets/${profileId}`;

/**
 * Subscribes to car-log MQTT notifications and invalidates the matching RTK Query caches.
 * In the `all` scope managers also subscribe to job status changes, and managers/commentators use the
 * single-level wildcard to receive updates for every profile. Everyone else (and the `mine` scope)
 * subscribes to the caller's own asset topic.
 */
export const useCarLogsMqtt = (scope: 'all' | 'mine' = 'all'): UseMqttSubscriptionReturn => {
  const dispatch = useAppDispatch();
  const [groups, setGroups] = useState<UserGroups[] | null>(null);
  const access = useMemo(() => resolveCarLogsAccess(groups ?? []), [groups]);
  const isAllScope = scope === 'all' && (access === 'manager' || access === 'viewer');
  const { data: profile } = useGetProfileQuery(undefined, { skip: groups === null || isAllScope });

  useEffect(() => {
    let isMounted = true;
    getUserGroups()
      .then((resolvedGroups) => {
        if (isMounted) setGroups(resolvedGroups);
      })
      .catch(() => {
        if (isMounted) setGroups([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const invalidateAssetTags = (assetId?: string) => {
    dispatch(
      deepRacerApi.util.invalidateTags([
        { type: DeepRacerApiQueryTagType.CAR_LOG_ASSETS, id: LIST_QUERY_TAG_ID },
        ...(assetId ? [{ type: DeepRacerApiQueryTagType.CAR_LOG_ASSETS, id: assetId }] : []),
      ]),
    );
  };

  const invalidateFetchTags = (jobId?: string) => {
    dispatch(
      deepRacerApi.util.invalidateTags([
        { type: DeepRacerApiQueryTagType.CAR_LOG_FETCHES, id: LIST_QUERY_TAG_ID },
        ...(jobId ? [{ type: DeepRacerApiQueryTagType.CAR_LOG_FETCHES, id: jobId }] : []),
      ]),
    );
  };

  const assetTopicId = groups === null ? '' : isAllScope ? '+' : (profile?.profileId ?? '');

  const assetSubscription = useMqttSubscription<CarLogAssetMqttEvent>(
    assetTopicId,
    buildCarLogAssetTopic,
    {
      onEvent: (event) => invalidateAssetTags(event.assetId),
    },
    { disableWhenIdEmpty: true },
  );

  const jobSubscription = useMqttSubscription<CarLogJobMqttEvent>(
    groups !== null && isAllScope && access === 'manager' ? 'jobs' : '',
    (namespace) => buildCarLogJobTopic(namespace),
    {
      onEvent: (event) => invalidateFetchTags(event.jobId),
    },
    { disableWhenIdEmpty: true },
  );

  return isAllScope && access === 'manager' ? jobSubscription : assetSubscription;
};
