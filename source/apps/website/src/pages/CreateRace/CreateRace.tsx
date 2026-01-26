// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Alert } from '@cloudscape-design/components';
import Wizard from '@cloudscape-design/components/wizard';
import {
  LeaderboardDefinition,
  ObjectAvoidanceConfig,
  RaceType,
  TimingMethod,
  TrackConfig,
  TrackDirection,
  TrackId,
  UserGroups,
} from '@deepracer-indy/typescript-client';
import { yupResolver } from '@hookform/resolvers/yup';
import { useRef, useState, useEffect } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';

import AddRaceDetails from './components/AddRaceDetails';
import ReviewRaceDetails from './components/ReviewRaceDetails';
import { createRaceValidationSchema } from './validation';
import { PageId } from '../../constants/pages.js';
import { DEFAULT_OBJECT_POSITIONS } from '../../constants/tracks.js';
import { useAppDispatch } from '../../hooks/useAppDispatch.js';
import { useCreateLeaderboardMutation, useEditLeaderboardMutation } from '../../services/deepRacer/leaderboardsApi.js';
import { displaySuccessNotification } from '../../store/notifications/notificationsSlice.js';
import { checkUserGroupMembership } from '../../utils/authUtils.js';
import { getPath } from '../../utils/pageUtils.js';

export interface CreateRaceFormValues {
  raceType: RaceType;
  raceName: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  track: TrackConfig;
  desc?: string;
  ranking: TimingMethod;
  minLap: string;
  offTrackPenalty: string;
  collisionPenalty: string;
  maxSubmissionsPerUser: number;
  objectAvoidanceConfig: ObjectAvoidanceConfig;
  randomizeObstacles: boolean;
}

const initialRaceFormValues: CreateRaceFormValues = {
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
    objectPositions: DEFAULT_OBJECT_POSITIONS,
  },
  randomizeObstacles: false,
};

const CreateRace = ({ initialFormValues = initialRaceFormValues, leaderboardId = '' }) => {
  const dispatch = useAppDispatch();
  const [createLeaderboard, { isLoading: isCreatingLeaderboard }] = useCreateLeaderboardMutation();
  const [editLeaderboard, { isLoading: isEdittingLeaderboard }] = useEditLeaderboardMutation();
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentLeaderboardValues, setCurrentLeaderboardValues] = useState<LeaderboardDefinition>({
    name: '',
    openTime: new Date(),
    closeTime: new Date(),
    trackConfig: {
      trackId: TrackId.A_TO_Z_SPEEDWAY,
      trackDirection: TrackDirection.CLOCKWISE,
    },
    raceType: RaceType.TIME_TRIAL,
    maxSubmissionsPerUser: 99,
    resettingBehaviorConfig: {
      continuousLap: true,
      offTrackPenaltySeconds: 1,
      collisionPenaltySeconds: 1,
    },
    submissionTerminationConditions: {
      minimumLaps: 1,
      maximumLaps: 5,
    },
    timingMethod: TimingMethod.TOTAL_TIME,
  });
  const { t } = useTranslation('createRace');
  const navigate = useNavigate();

  useEffect(() => {
    const checkRaceManagementPermissions = async () => {
      setIsAuthorized(await checkUserGroupMembership([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]));
      setIsLoading(false);
    };

    void checkRaceManagementPermissions();
  }, []);

  const nameRef = useRef<null | HTMLDivElement>(null);
  const { control, setValue, handleSubmit } = useForm<CreateRaceFormValues>({
    values: initialFormValues,
    resolver: yupResolver(createRaceValidationSchema),
    mode: 'onBlur',
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthorized) {
    return (
      <Alert type="error" header="Unauthorized">
        <p>The page you are trying to view is only available to race facilitators or administrators.</p>
        <Link to="/">Return to Home</Link>
      </Alert>
    );
  }

  const onNavigateStep1: SubmitHandler<CreateRaceFormValues> = async (data) => {
    setCurrentLeaderboardValues({
      name: data.raceName,
      openTime: new Date(data.startDate + ' ' + data.startTime),
      closeTime: new Date(data.endDate + ' ' + data.endTime),
      trackConfig: data.track,
      raceType: data.raceType,
      maxSubmissionsPerUser: data.maxSubmissionsPerUser,
      resettingBehaviorConfig: {
        continuousLap: true,
        offTrackPenaltySeconds: Number(data.offTrackPenalty),
        collisionPenaltySeconds: Number(data.collisionPenalty),
      },
      submissionTerminationConditions: {
        minimumLaps: Number(data.minLap),
        maximumLaps: 5,
      },
      timingMethod: data.ranking,
      description: data.desc || undefined,
      objectAvoidanceConfig:
        data.raceType === RaceType.OBJECT_AVOIDANCE
          ? {
              numberOfObjects: data.objectAvoidanceConfig.numberOfObjects,
              objectPositions: data.randomizeObstacles ? undefined : data.objectAvoidanceConfig.objectPositions,
            }
          : undefined,
    });
    setActiveStepIndex(1);
  };
  return (
    <Wizard
      i18nStrings={{
        stepNumberLabel: (stepNumber) => `${t('step')} ${stepNumber}`,
        navigationAriaLabel: t('step'),
        cancelButton: t('cancel'),
        previousButton: t('previous'),
        nextButton: t('next'),
        submitButton: t('submit'),
      }}
      isLoadingNextStep={isCreatingLeaderboard || isEdittingLeaderboard}
      onNavigate={async ({ detail }) => {
        // Validate the form
        if (activeStepIndex === 0) {
          await handleSubmit(onNavigateStep1)();
          return;
        }
        setActiveStepIndex(detail.requestedStepIndex);
      }}
      onSubmit={async () => {
        if (leaderboardId) {
          await editLeaderboard({
            leaderboardDefinition: currentLeaderboardValues,
            leaderboardId: leaderboardId,
          })
            .unwrap()
            .then(() => {
              dispatch(
                displaySuccessNotification({
                  content: t('editRaceSuccessNotification'),
                  persistForPageChanges: 1,
                }),
                navigate(getPath(PageId.MANAGE_RACES)),
              );
            });
          return;
        }
        await createLeaderboard({
          leaderboardDefinition: currentLeaderboardValues,
        })
          .unwrap()
          .then((response) => {
            dispatch(
              displaySuccessNotification({
                content: t('createRaceSuccessNotification'),
                persistForPageChanges: 1,
              }),
              navigate(getPath(PageId.RACE_DETAILS, { leaderboardId: response })),
            );
          });
      }}
      activeStepIndex={activeStepIndex}
      steps={[
        {
          title: t('addRaceDetails.header'),
          description: t('addRaceDetails.description'),
          content: <AddRaceDetails setValue={setValue} nameRef={nameRef} control={control} />,
        },
        {
          title: t('reviewRaceDetails'),
          content: (
            <ReviewRaceDetails leaderboardDef={currentLeaderboardValues} setActiveStepIndex={setActiveStepIndex} />
          ),
        },
      ]}
      onCancel={() => navigate(getPath(PageId.MANAGE_RACES))}
    />
  );
};

export default CreateRace;
