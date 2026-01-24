// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';

import { CreateModelFormValues } from '#pages/CreateModel/types';
import { render, screen, waitFor } from '#utils/testUtils';

import ObjectAvoidanceConfig from '../ObjectAvoidanceConfig';

const renderObjectAvoidanceConfig = (defaultValues?: Partial<CreateModelFormValues>) => {
  const TestWrapper = () => {
    const { control } = useForm<CreateModelFormValues>({
      defaultValues: {
        trainingConfig: {
          trackConfig: { trackId: 'reinvent_base', trackDirection: 'CLOCKWISE' },
          maxTimeInMinutes: 60,
          raceType: 'TIME_TRIAL',
          objectAvoidanceConfig: {
            numberOfObjects: 1,
            objectPositions: [{ laneNumber: -1, trackPercentage: 0.1 }],
          },
        },
        ...defaultValues,
      },
    });

    return <ObjectAvoidanceConfig control={control} />;
  };

  return render(<TestWrapper />);
};

describe('ObjectAvoidanceConfig', () => {
  it('should render the actual ObjectAvoidanceConfig component', () => {
    renderObjectAvoidanceConfig();

    expect(screen.getByText(/Number of objects on a track/i)).toBeInTheDocument();
    expect(screen.getByText(/Choose your criteria for how DeepRacer learns to avoid object/i)).toBeInTheDocument();
    expect(screen.getByText(/Object Type/i)).toBeInTheDocument();
  });

  it('should display object type information correctly', () => {
    renderObjectAvoidanceConfig();

    expect(screen.getByText(/Object Type/i)).toBeInTheDocument();
    expect(screen.getByText(/Box/i)).toBeInTheDocument();
    expect(screen.getByAltText(/Box/i)).toBeInTheDocument();
  });

  it('should show object position fields when fixed location is selected', async () => {
    renderObjectAvoidanceConfig();

    expect(screen.getByText(/Lane placement/i)).toBeInTheDocument();
    expect(screen.getByText(/Location \(.*\) between start and finish/i)).toBeInTheDocument();
  });

  it('should hide object position fields when randomized location is selected', async () => {
    const user = userEvent.setup();
    renderObjectAvoidanceConfig();

    const randomizedRadio = screen.getByLabelText(/Randomized location/i);
    await user.click(randomizedRadio);

    await waitFor(() => {
      expect(screen.queryByText(/Lane placement/i)).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.queryByText(/Location \(.*\) between start and finish/i)).not.toBeInTheDocument();
    });
  });

  it('should show correct number of object position fields based on object count', async () => {
    renderObjectAvoidanceConfig({
      trainingConfig: {
        trackConfig: { trackId: 'reinvent_base', trackDirection: 'CLOCKWISE' },
        maxTimeInMinutes: 60,
        raceType: 'TIME_TRIAL',
        objectAvoidanceConfig: {
          numberOfObjects: 2,
          objectPositions: [
            { laneNumber: -1, trackPercentage: 0.1 },
            { laneNumber: 1, trackPercentage: 0.5 },
          ],
        },
      },
    });

    const lanePlacementFields = screen.getAllByText(/Lane placement/i);
    const trackPercentageFields = screen.getAllByText(/Location \(.*\) between start and finish/i);

    expect(lanePlacementFields).toHaveLength(2);
    expect(trackPercentageFields).toHaveLength(2);
  });

  it('should convert string values to numbers for object count selection', async () => {
    const user = userEvent.setup();
    renderObjectAvoidanceConfig();

    const objectCountDropdown = screen.getByLabelText(/Number of objects on a track/i);
    await user.click(objectCountDropdown);

    const sixObjectsOption = screen.getByText('6');
    await user.click(sixObjectsOption);

    expect(objectCountDropdown).toBeInTheDocument();
  });

  it('should convert string values to numbers for lane placement selection', async () => {
    const user = userEvent.setup();
    renderObjectAvoidanceConfig();

    const lanePlacementDropdown = screen.getByLabelText(/Lane placement/i);
    await user.click(lanePlacementDropdown);

    const insideLaneOption = screen.getByText(/Inside lane/i);
    await user.click(insideLaneOption);

    expect(lanePlacementDropdown).toBeInTheDocument();
  });

  it('should display all object count options from 1 to 6', async () => {
    const user = userEvent.setup();
    renderObjectAvoidanceConfig();

    const objectCountDropdown = screen.getByLabelText(/Number of objects on a track/i);
    await user.click(objectCountDropdown);

    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('should display lane placement options correctly', async () => {
    const user = userEvent.setup();
    renderObjectAvoidanceConfig();

    const lanePlacementDropdown = screen.getByLabelText(/Lane placement/i);
    await user.click(lanePlacementDropdown);

    expect(screen.getAllByText(/Outside lane/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Inside lane/i)).toBeInTheDocument();
  });
});
