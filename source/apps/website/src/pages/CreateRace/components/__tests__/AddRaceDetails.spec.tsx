// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RaceType, TimingMethod, TrackDirection, TrackId } from '@deepracer-indy/typescript-client';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import SelectField from '#components/FormFields/SelectField';

import i18n from '../../../../i18n/index.js';
import { render } from '../../../../utils/testUtils.js';
import { CreateRaceFormValues } from '../../CreateRace';
import AddRaceDetails, { AddRaceDetailsProps } from '../AddRaceDetails';

vi.mock('#components/TrackSelection', () => ({
  default: ({ control }: { control: unknown }) => <div data-testid="track-selection">Track Selection Component</div>,
}));

vi.mock('#utils/dateTimeUtils', () => ({
  isDateRangeInvalid: vi.fn(() => false),
  getUTCOffsetTimeZoneText: vi.fn(() => 'UTC-0500 America/New_York'),
}));

const defaultFormValues: CreateRaceFormValues = {
  raceType: RaceType.TIME_TRIAL,
  raceName: '',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  track: {
    trackId: TrackId.A_TO_Z_SPEEDWAY,
    trackDirection: TrackDirection.COUNTER_CLOCKWISE,
  },
  desc: '',
  ranking: TimingMethod.TOTAL_TIME,
  minLap: '3',
  offTrackPenalty: '1',
  collisionPenalty: '1',
  maxSubmissionsPerUser: 99,
  objectAvoidanceConfig: {
    numberOfObjects: 2,
    objectPositions: [
      { laneNumber: -1, trackPercentage: 0.1 },
      { laneNumber: 1, trackPercentage: 0.5 },
    ],
  },
  randomizeObstacles: false,
};

const TestWrapper = ({ initialValues = defaultFormValues }: { initialValues?: CreateRaceFormValues }) => {
  const { control, setValue } = useForm<CreateRaceFormValues>({
    defaultValues: initialValues,
  });
  const nameRef = { current: null };

  const props: AddRaceDetailsProps = {
    setValue,
    nameRef,
    control,
  };

  return <AddRaceDetails {...props} />;
};

describe('AddRaceDetails', () => {
  it('renders without crashing', () => {
    render(<TestWrapper />);

    expect(screen.getByText(i18n.t('createRace:addRaceDetails.raceDetails'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('createRace:addRaceDetails.chooseRaceType'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('createRace:addRaceDetails.nameOfRacingEvent'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('createRace:addRaceDetails.chooseRaceDates'))).toBeInTheDocument();
  });

  it('displays timezone-aware date picker description', () => {
    render(<TestWrapper />);

    expect(
      screen.getByText(/Choose a start and close date in 24-hour format UTC-0500 America\/New_York/),
    ).toBeInTheDocument();
  });

  it('displays race type options', () => {
    render(<TestWrapper />);

    expect(screen.getByText(i18n.t('createRace:addRaceDetails.timeTrial'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('createRace:addRaceDetails.objectAvoidance'))).toBeInTheDocument();
  });

  it('displays track selection component', () => {
    render(<TestWrapper />);

    expect(screen.getByTestId('track-selection')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('createRace:addRaceDetails.competitionTracks'))).toBeInTheDocument();
  });

  it('displays expandable race customization section', () => {
    render(<TestWrapper />);

    expect(screen.getByText(i18n.t('createRace:addRaceDetails.raceCustom'))).toBeInTheDocument();
  });

  it('shows basic form fields in customization section', async () => {
    render(<TestWrapper />);

    const expandButton = screen.getByText(i18n.t('createRace:addRaceDetails.raceCustom'));
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('createRace:addRaceDetails.rankingMethod'))).toBeInTheDocument();
    });
    expect(screen.getByText(i18n.t('createRace:addRaceDetails.minimumLaps'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('createRace:addRaceDetails.offtrackPenalty'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('createRace:addRaceDetails.maxSubmissionsPerUser'))).toBeInTheDocument();
  });

  it('does not show object avoidance fields for time trial race type', async () => {
    render(
      <TestWrapper
        initialValues={{
          ...defaultFormValues,
          raceType: RaceType.TIME_TRIAL,
        }}
      />,
    );

    const expandButton = screen.getByText(i18n.t('createRace:addRaceDetails.raceCustom'));
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.queryByText(i18n.t('createRace:addRaceDetails.collisionPenalty'))).not.toBeInTheDocument();
    });
    expect(screen.queryByText(i18n.t('createRace:addRaceDetails.numObjects'))).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('createRace:addRaceDetails.randomizeObstacles'))).not.toBeInTheDocument();
  });

  it('shows object avoidance fields for object avoidance race type', async () => {
    render(
      <TestWrapper
        initialValues={{
          ...defaultFormValues,
          raceType: RaceType.OBJECT_AVOIDANCE,
        }}
      />,
    );

    const expandButton = screen.getByText(i18n.t('createRace:addRaceDetails.raceCustom'));
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('createRace:addRaceDetails.collisionPenalty'))).toBeInTheDocument();
    });
    expect(screen.getByText(i18n.t('createRace:addRaceDetails.numObjects'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('createRace:addRaceDetails.randomizeObstacles'))).toBeInTheDocument();
  });

  it('shows object position fields when randomize obstacles is false', async () => {
    render(
      <TestWrapper
        initialValues={{
          ...defaultFormValues,
          raceType: RaceType.OBJECT_AVOIDANCE,
          randomizeObstacles: false,
        }}
      />,
    );

    const expandButton = screen.getByText(i18n.t('createRace:addRaceDetails.raceCustom'));
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('createRace:addRaceDetails.obstacle', { number: 1 }))).toBeInTheDocument();
    });
    expect(screen.getByText(i18n.t('createRace:addRaceDetails.obstacle', { number: 2 }))).toBeInTheDocument();
    expect(screen.getAllByText(i18n.t('createRace:addRaceDetails.lanePlacement'))).toHaveLength(2);
    expect(screen.getAllByText(i18n.t('createRace:addRaceDetails.laneLocation'))).toHaveLength(2);
  });

  it('does not show object position fields when randomize obstacles is true', async () => {
    render(
      <TestWrapper
        initialValues={{
          ...defaultFormValues,
          raceType: RaceType.OBJECT_AVOIDANCE,
          randomizeObstacles: true,
        }}
      />,
    );

    const expandButton = screen.getByText(i18n.t('createRace:addRaceDetails.raceCustom'));
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.queryByText(i18n.t('createRace:addRaceDetails.obstacle', { number: 1 }))).not.toBeInTheDocument();
    });
    expect(screen.queryByText(i18n.t('createRace:addRaceDetails.lanePlacement'))).not.toBeInTheDocument();
  });

  it('displays ranking method options', async () => {
    render(<TestWrapper />);

    const expandButton = screen.getByText(i18n.t('createRace:addRaceDetails.raceCustom'));
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('createRace:addRaceDetails.rankingMethod'))).toBeInTheDocument();
    });
  });

  it('displays minimum laps options', async () => {
    render(<TestWrapper />);

    const expandButton = screen.getByText(i18n.t('createRace:addRaceDetails.raceCustom'));
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('createRace:addRaceDetails.minimumLaps'))).toBeInTheDocument();
    });
  });

  it('displays off-track penalty options', async () => {
    render(<TestWrapper />);

    const expandButton = screen.getByText(i18n.t('createRace:addRaceDetails.raceCustom'));
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('createRace:addRaceDetails.offtrackPenalty'))).toBeInTheDocument();
    });
  });

  it('displays max submissions per user field', async () => {
    render(<TestWrapper />);

    const expandButton = screen.getByText(i18n.t('createRace:addRaceDetails.raceCustom'));
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('createRace:addRaceDetails.maxSubmissionsPerUser'))).toBeInTheDocument();
    });
  });

  it('displays collision penalty for object avoidance races', async () => {
    render(
      <TestWrapper
        initialValues={{
          ...defaultFormValues,
          raceType: RaceType.OBJECT_AVOIDANCE,
        }}
      />,
    );

    const expandButton = screen.getByText(i18n.t('createRace:addRaceDetails.raceCustom'));
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('createRace:addRaceDetails.collisionPenalty'))).toBeInTheDocument();
    });
  });

  it('displays number of objects selector for object avoidance races', async () => {
    render(
      <TestWrapper
        initialValues={{
          ...defaultFormValues,
          raceType: RaceType.OBJECT_AVOIDANCE,
        }}
      />,
    );

    const expandButton = screen.getByText(i18n.t('createRace:addRaceDetails.raceCustom'));
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('createRace:addRaceDetails.numObjects'))).toBeInTheDocument();
    });
  });

  it('displays lane placement options for object positions', async () => {
    render(
      <TestWrapper
        initialValues={{
          ...defaultFormValues,
          raceType: RaceType.OBJECT_AVOIDANCE,
          randomizeObstacles: false,
        }}
      />,
    );

    const expandButton = screen.getByText(i18n.t('createRace:addRaceDetails.raceCustom'));
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('createRace:addRaceDetails.insideLane'))).toBeInTheDocument();
    });
    expect(screen.getByText(i18n.t('createRace:addRaceDetails.outsideLane'))).toBeInTheDocument();
  });

  it('should render number of objects dropdown without errors', async () => {
    const onChangeMock = vi.fn();

    const TestComponent = () => {
      const { control } = useForm({ defaultValues: { numberOfObjects: 1 as number } });
      return (
        <SelectField
          control={control}
          name="numberOfObjects"
          label={i18n.t('createRace:addRaceDetails.numObjects')}
          type="number"
          options={[
            { label: '1', value: 1 },
            { label: '5', value: 5 },
          ]}
          onChange={onChangeMock}
        />
      );
    };

    render(<TestComponent />);

    const user = userEvent.setup();
    const dropdown = screen.getByLabelText(i18n.t('createRace:addRaceDetails.numObjects'));
    await user.click(dropdown);

    const fiveOption = screen.getByText('5');
    await user.click(fiveOption);

    expect(onChangeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          selectedOption: expect.objectContaining({
            value: 5,
          }),
        }),
      }),
    );

    const callArgs = onChangeMock.mock.calls[0][0];
    expect(typeof callArgs.detail.selectedOption.value).toBe('number');
    expect(callArgs.detail.selectedOption.value).toBe(5);
  });
});
