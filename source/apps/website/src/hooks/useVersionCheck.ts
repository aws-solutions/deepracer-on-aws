// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';

interface VersionCheckResult {
  latestVersion: string;
  isNewestVersion: boolean;
}

interface UseVersionCheckOptions {
  enabled?: boolean;
}

const CACHE_KEY = 'github_latest_version';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 1 day
const GITHUB_API = 'https://api.github.com/repos/aws-solutions/deepracer-on-aws/releases/latest';

const checkLatestVersion = async (): Promise<VersionCheckResult> => {
  const currentVersion = window.EnvironmentConfig?.solutionVersion;
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const { data, timeStamp } = JSON.parse(cached);
      if (Date.now() - timeStamp < CACHE_DURATION_MS) {
        return {
          latestVersion: data.tag_name,
          isNewestVersion: currentVersion === data.tag_name,
        };
      }
    } catch (error) {
      console.warn('Failed to parse cached version data:', error);
    }
  }

  const response = await fetch(GITHUB_API);
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const { tag_name } = await response.json();

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: { tag_name }, timeStamp: Date.now() }));
  } catch (error) {
    console.warn('Failed to cache version data:', error);
  }

  return {
    latestVersion: tag_name,
    isNewestVersion: currentVersion === tag_name,
  };
};

export const useVersionCheck = ({ enabled = false }: UseVersionCheckOptions = {}) => {
  const [data, setData] = useState<VersionCheckResult | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;

    checkLatestVersion()
      .then(setData)
      .catch((error) => console.warn('Version check failed:', error));
  }, [enabled]);

  return { data };
};
