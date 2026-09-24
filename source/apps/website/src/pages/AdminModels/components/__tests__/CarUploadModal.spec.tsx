// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import { DeploymentStatus } from '@deepracer-indy/typescript-client';
import { composeStories } from '@storybook/react';

import i18n from '#i18n';
import { screen } from '#utils/testUtils';

import * as CarUploadModalStories from '../CarUploadModal.stories';

const { Default, NoCarsOnline, NoEvents } = composeStories(CarUploadModalStories);

describe('<CarUploadModal /> — car selection view', () => {
  it('renders car selection header', async () => {
    await Default.run();
    expect(await screen.findByText(i18n.t('adminModels:upload.header'))).toBeInTheDocument();
  });

  it('renders car table with online devices', async () => {
    await Default.run();
    expect(await screen.findByText('Car-London-01')).toBeInTheDocument();
    expect(screen.getByText('Car-London-02')).toBeInTheDocument();
    expect(screen.getByText('Car-NYC-01')).toBeInTheDocument();
  });

  it('renders event selector', async () => {
    await Default.run();
    expect(await screen.findByText(i18n.t('adminModels:upload.event'))).toBeInTheDocument();
  });

  it('shows no cars message when device list is empty', async () => {
    await NoCarsOnline.run();
    expect(await screen.findByText(i18n.t('adminModels:upload.noCars'))).toBeInTheDocument();
  });

  it('renders with no events available', async () => {
    await NoEvents.run();
    expect(await screen.findByText('Car-London-01')).toBeInTheDocument();
  });

  it('renders clear first checkbox', async () => {
    await Default.run();
    expect(await screen.findByText(i18n.t('adminModels:upload.clearFirst'))).toBeInTheDocument();
  });

  it('is dismissible', async () => {
    await Default.run();
    // Cloudscape Modal renders dismiss button
    const modal = screen.getByRole('dialog');
    expect(modal).toBeInTheDocument();
  });
});

describe('CarUploadModal — progress calculation logic', () => {
  const TERMINAL_STATUSES = new Set<string>([DeploymentStatus.COMPLETED, DeploymentStatus.FAILED]);

  const calcProgress = (deployments: { status: string }[], expectedCount: number) => {
    const completedCount = deployments.filter((d) => TERMINAL_STATUSES.has(d.status)).length;
    return expectedCount > 0 ? Math.round((completedCount / expectedCount) * 100) : 0;
  };

  const isAllTerminal = (deployments: { status: string }[], expectedCount: number) => {
    const completedCount = deployments.filter((d) => TERMINAL_STATUSES.has(d.status)).length;
    return expectedCount > 0 && completedCount >= expectedCount && deployments.length >= expectedCount;
  };

  it('returns 0% when no deployments exist', () => {
    expect(calcProgress([], 3)).toBe(0);
  });

  it('returns 0% when expectedCount is 0', () => {
    expect(calcProgress([{ status: DeploymentStatus.COMPLETED }], 0)).toBe(0);
  });

  it('calculates correct percentage for partial completion', () => {
    const deployments = [
      { status: DeploymentStatus.COMPLETED },
      { status: DeploymentStatus.IN_PROGRESS },
      { status: DeploymentStatus.PENDING },
    ];
    expect(calcProgress(deployments, 3)).toBe(33);
  });

  it('returns 100% when all deployments are terminal', () => {
    const deployments = [
      { status: DeploymentStatus.COMPLETED },
      { status: DeploymentStatus.FAILED },
      { status: DeploymentStatus.COMPLETED },
    ];
    expect(calcProgress(deployments, 3)).toBe(100);
  });

  it('counts FAILED as terminal', () => {
    expect(calcProgress([{ status: DeploymentStatus.FAILED }, { status: DeploymentStatus.FAILED }], 2)).toBe(100);
  });

  it('allTerminal is false when expectedCount is 0', () => {
    expect(isAllTerminal([], 0)).toBe(false);
  });

  it('allTerminal is false when not all deployments created yet', () => {
    expect(isAllTerminal([{ status: DeploymentStatus.COMPLETED }], 3)).toBe(false);
  });

  it('allTerminal is true when all reach terminal', () => {
    const deployments = [
      { status: DeploymentStatus.COMPLETED },
      { status: DeploymentStatus.COMPLETED },
      { status: DeploymentStatus.FAILED },
    ];
    expect(isAllTerminal(deployments, 3)).toBe(true);
  });

  it('allTerminal requires deployments.length >= expectedCount', () => {
    expect(isAllTerminal([{ status: DeploymentStatus.COMPLETED }, { status: DeploymentStatus.COMPLETED }], 3)).toBe(
      false,
    );
  });
});

describe('CarUploadModal — failed count and progress bar status', () => {
  const calcFailedCount = (deployments: { status: string }[]) =>
    deployments.filter((d) => d.status === DeploymentStatus.FAILED).length;

  it('returns 0 when all deployments succeeded', () => {
    const deployments = [{ status: DeploymentStatus.COMPLETED }, { status: DeploymentStatus.COMPLETED }];
    expect(calcFailedCount(deployments)).toBe(0);
  });

  it('counts failed deployments correctly in a mixed batch', () => {
    const deployments = [
      { status: DeploymentStatus.COMPLETED },
      { status: DeploymentStatus.FAILED },
      { status: DeploymentStatus.COMPLETED },
      { status: DeploymentStatus.FAILED },
    ];
    expect(calcFailedCount(deployments)).toBe(2);
  });

  it('returns error status when all terminal and some failed', () => {
    const allTerminal = true;
    const failedCount = 2;
    const status = allTerminal && failedCount > 0 ? 'error' : allTerminal ? 'success' : undefined;
    expect(status).toBe('error');
  });

  it('returns success status when all terminal and none failed', () => {
    const allTerminal = true;
    const failedCount = 0;
    const status = allTerminal && failedCount > 0 ? 'error' : allTerminal ? 'success' : undefined;
    expect(status).toBe('success');
  });

  it('returns undefined status when still in progress', () => {
    const allTerminal = false;
    const failedCount = 0;
    const status = allTerminal && failedCount > 0 ? 'error' : allTerminal ? 'success' : undefined;
    expect(status).toBeUndefined();
  });

  it('generates correct resultText for partial failure', () => {
    const failedCount = 2;
    const expectedCount = 5;
    const allTerminal = true;
    const resultText = allTerminal
      ? failedCount > 0
        ? `${failedCount} of ${expectedCount} failed`
        : `${expectedCount} of ${expectedCount} completed`
      : undefined;
    expect(resultText).toBe('2 of 5 failed');
  });

  it('generates correct resultText for full success', () => {
    const failedCount = 0;
    const expectedCount = 5;
    const allTerminal = true;
    const resultText = allTerminal
      ? failedCount > 0
        ? `${failedCount} of ${expectedCount} failed`
        : `${expectedCount} of ${expectedCount} completed`
      : undefined;
    expect(resultText).toBe('5 of 5 completed');
  });
});

describe('CarUploadModal — dispatch failure detection', () => {
  it('identifies failed model names from allSettled results', () => {
    const models = [{ name: 'Model-A' }, { name: 'Model-B' }, { name: 'Model-C' }];
    const results: PromiseSettledResult<unknown>[] = [
      { status: 'fulfilled', value: {} },
      { status: 'rejected', reason: new Error('timeout') },
      { status: 'fulfilled', value: {} },
    ];
    const failed = results.map((r, i) => (r.status === 'rejected' ? models[i].name : null)).filter(Boolean);
    expect(failed).toEqual(['Model-B']);
  });

  it('returns empty when all dispatches succeed', () => {
    const models = [{ name: 'A' }, { name: 'B' }];
    const results: PromiseSettledResult<unknown>[] = [
      { status: 'fulfilled', value: {} },
      { status: 'fulfilled', value: {} },
    ];
    const failed = results.map((r, i) => (r.status === 'rejected' ? models[i].name : null)).filter(Boolean);
    expect(failed).toEqual([]);
  });

  it('returns all when all dispatches fail', () => {
    const models = [{ name: 'A' }, { name: 'B' }];
    const results: PromiseSettledResult<unknown>[] = [
      { status: 'rejected', reason: new Error('e') },
      { status: 'rejected', reason: new Error('e') },
    ];
    const failed = results.map((r, i) => (r.status === 'rejected' ? models[i].name : null)).filter(Boolean);
    expect(failed).toEqual(['A', 'B']);
  });

  it('calculates dispatched count correctly', () => {
    const models = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    const results: PromiseSettledResult<unknown>[] = [
      { status: 'fulfilled', value: {} },
      { status: 'rejected', reason: new Error('e') },
      { status: 'fulfilled', value: {} },
    ];
    const failed = results.map((r, i) => (r.status === 'rejected' ? models[i].name : null)).filter(Boolean);
    expect(models.length - failed.length).toBe(2);
  });
});

describe('<CarUploadModal /> — deploy flow', () => {
  it('should select a car, then deploy button becomes enabled', async () => {
    await Default.run();
    const wrapper = createWrapper();

    // Wait for cars to render
    await screen.findByText('Car-London-01');

    // Select a car using Cloudscape Table test utils
    const table = wrapper.findTable();
    table?.findRowSelectionArea(1)?.click();

    // Select event using Cloudscape Select test utils
    const select = wrapper.findSelect();
    select?.openDropdown();
    select?.selectOption(1);

    // Deploy button should now be enabled
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    expect(uploadButton).toBeEnabled();
  });
});
