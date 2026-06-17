// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Link from '@cloudscape-design/components/link';
import { useState } from 'react';

interface VersionAlertProps {
  latestVersion?: string;
  isNewestVersion?: boolean;
}

const DISMISSAL_CACHE_KEY = 'version_alert_dismissed';
const DISMISSAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

const checkDismissalStatus = (): boolean => {
  try {
    const cached = localStorage.getItem(DISMISSAL_CACHE_KEY);
    if (!cached) return false;
    const { dismissedAt } = JSON.parse(cached);
    return Date.now() - dismissedAt < DISMISSAL_DURATION_MS;
  } catch (error) {
    console.warn('Failed to parse version alert dismissal cache:', error);
    return false;
  }
};

const VersionAlert = ({ latestVersion, isNewestVersion }: VersionAlertProps) => {
  const [isDismissed, setIsDismissed] = useState(checkDismissalStatus);
  const solutionVersion = window.EnvironmentConfig?.solutionVersion;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISSAL_CACHE_KEY, JSON.stringify({ dismissedAt: Date.now() }));
    } catch (error) {
      console.warn('Failed to cache version alert dismissal:', error);
    }
    setIsDismissed(true);
  };

  return (
    <>
      <Box padding={{ left: 'xl' }}>
        Version: <strong>{solutionVersion}</strong>
      </Box>
      {latestVersion && !isNewestVersion && !isDismissed && (
        <Box padding="s">
          <Alert type="warning" dismissible onDismiss={handleDismiss}>
            A newer version {latestVersion} is available.{' '}
            <Link
              external
              href="https://docs.aws.amazon.com/solutions/latest/deepracer-on-aws/update-the-solution.html"
            >
              View update instructions
            </Link>{' '}
            <Link external href="https://github.com/aws-solutions/deepracer-on-aws/releases">
              View release notes
            </Link>
          </Alert>
        </Box>
      )}
    </>
  );
};

export default VersionAlert;
