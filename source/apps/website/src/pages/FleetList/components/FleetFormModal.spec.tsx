// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Fleet } from '@deepracer-indy/typescript-client';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { render, screen, waitFor } from '#utils/testUtils';

import FleetFormModal from './FleetFormModal';

vi.mock('#hooks/useAppDispatch.js', () => ({
  useAppDispatch: () => vi.fn(),
}));

vi.mock('#store/notifications/notificationsSlice.js', () => ({
  displaySuccessNotification: vi.fn((args) => args),
  displayErrorNotification: vi.fn((args) => args),
}));

const mockCreateFleet = vi.fn();
const mockUpdateFleet = vi.fn();

vi.mock('#services/deepRacer/fleetsApi', () => ({
  useCreateFleetMutation: vi.fn(() => [mockCreateFleet, { isLoading: false }]),
  useUpdateFleetMutation: vi.fn(() => [mockUpdateFleet, { isLoading: false }]),
}));

const existingFleet: Fleet = {
  fleetId: 'FLEET0000000001',
  name: 'London',
  createdAt: new Date('2026-01-01'),
};

describe('<FleetFormModal />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateFleet.mockReturnValue({ unwrap: () => Promise.resolve('FLEET0000000002') });
    mockUpdateFleet.mockReturnValue({ unwrap: () => Promise.resolve({}) });
  });

  it('disables save until a name is provided', () => {
    render(<FleetFormModal isVisible onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: i18n.t('fleets:form.saveButton') })).toBeDisabled();
  });

  it('creates a fleet from the entered name', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<FleetFormModal isVisible onDismiss={onDismiss} />);

    await user.type(screen.getByLabelText(i18n.t('fleets:form.nameLabel')), 'Paris');
    await user.click(screen.getByRole('button', { name: i18n.t('fleets:form.saveButton') }));

    await waitFor(() => {
      expect(mockCreateFleet).toHaveBeenCalledWith({ fleetDefinition: { name: 'Paris' } });
    });
    expect(onDismiss).toHaveBeenCalled();
  });

  it('updates an existing fleet in edit mode', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<FleetFormModal fleet={existingFleet} isVisible onDismiss={onDismiss} />);

    // Edit mode pre-fills the name, so Save is enabled immediately.
    await user.click(screen.getByRole('button', { name: i18n.t('fleets:form.saveButton') }));

    await waitFor(() => {
      expect(mockUpdateFleet).toHaveBeenCalledWith({
        fleetId: existingFleet.fleetId,
        name: existingFleet.name,
      });
    });
    expect(onDismiss).toHaveBeenCalled();
  });

  it('keeps the modal open and does not dismiss when create fails', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    mockCreateFleet.mockReturnValue({ unwrap: () => Promise.reject(new Error('boom')) });
    render(<FleetFormModal isVisible onDismiss={onDismiss} />);

    await user.type(screen.getByLabelText(i18n.t('fleets:form.nameLabel')), 'Paris');
    await user.click(screen.getByRole('button', { name: i18n.t('fleets:form.saveButton') }));

    await waitFor(() => {
      expect(mockCreateFleet).toHaveBeenCalled();
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
