// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { render, screen } from '#utils/testUtils.js';

import VersionAlert from './VersionAlert.js';

const DISMISSAL_CACHE_KEY = 'version_alert_dismissed';

beforeEach(() => {
  localStorage.clear();
  window.EnvironmentConfig = {
    apiEndpointUrl: '',
    userPoolId: '',
    userPoolClientId: '',
    identityPoolId: '',
    region: '',
    uploadBucketName: '',
    solutionVersion: 'v1.0.0',
  };
});

afterEach(() => {
  localStorage.clear();
});

describe('<VersionAlert />', () => {
  it('always shows the current version string', () => {
    render(<VersionAlert />);
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
  });

  it('shows update alert when a newer version is available', () => {
    render(<VersionAlert latestVersion="v2.0.0" isNewestVersion={false} />);
    expect(screen.getByText(/A newer version v2\.0\.0 is available/)).toBeInTheDocument();
  });

  it('does not show update alert when on latest version', () => {
    render(<VersionAlert latestVersion="v1.0.0" isNewestVersion={true} />);
    expect(screen.queryByText(/A newer version/)).not.toBeInTheDocument();
  });

  it('does not show update alert when latestVersion is undefined', () => {
    render(<VersionAlert isNewestVersion={false} />);
    expect(screen.queryByText(/A newer version/)).not.toBeInTheDocument();
  });

  it('does not show update alert when previously dismissed', () => {
    localStorage.setItem(DISMISSAL_CACHE_KEY, JSON.stringify({ dismissedAt: Date.now() }));
    render(<VersionAlert latestVersion="v2.0.0" isNewestVersion={false} />);
    expect(screen.queryByText(/A newer version/)).not.toBeInTheDocument();
  });

  it('shows update alert again after dismissal has expired', () => {
    const expiredTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
    localStorage.setItem(DISMISSAL_CACHE_KEY, JSON.stringify({ dismissedAt: expiredTimestamp }));
    render(<VersionAlert latestVersion="v2.0.0" isNewestVersion={false} />);
    expect(screen.getByText(/A newer version v2\.0\.0 is available/)).toBeInTheDocument();
  });
});
