// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { OptimizationStatus } from '@deepracer-indy/typescript-client';

import i18n from '#i18n';
import OptimizationStatusIndicator from '#pages/Models/components/OptimizationStatusIndicator';
import { render, screen } from '#utils/testUtils';

describe('<OptimizationStatusIndicator />', () => {
  it('renders success indicator for OPTIMIZED', () => {
    render(<OptimizationStatusIndicator optimizationStatus={OptimizationStatus.OPTIMIZED} />);
    expect(screen.getByText(i18n.t('models:table.carOptimized.complete'))).toBeInTheDocument();
  });

  it('renders in-progress indicator for IN_PROGRESS', () => {
    render(<OptimizationStatusIndicator optimizationStatus={OptimizationStatus.IN_PROGRESS} />);
    expect(screen.getByText(i18n.t('models:table.carOptimized.inProgress'))).toBeInTheDocument();
  });

  it('renders error indicator for FAILED', () => {
    render(<OptimizationStatusIndicator optimizationStatus={OptimizationStatus.FAILED} />);
    expect(screen.getByText(i18n.t('models:table.carOptimized.failed'))).toBeInTheDocument();
  });

  it('renders not-optimized indicator for undefined status', () => {
    render(<OptimizationStatusIndicator optimizationStatus={undefined} />);
    expect(screen.getByText(i18n.t('models:table.carOptimized.notOptimized'))).toBeInTheDocument();
  });
});
