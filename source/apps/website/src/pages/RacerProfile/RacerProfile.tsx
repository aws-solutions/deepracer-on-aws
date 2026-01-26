// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import CopyToClipboard from '@cloudscape-design/components/copy-to-clipboard';
import Grid from '@cloudscape-design/components/grid';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { AvatarOptionType } from '@deepracer-indy/config';
import { AvatarConfig } from '@deepracer-indy/typescript-client';
import { yupResolver } from '@hookform/resolvers/yup';
import i18n from 'i18next';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as Yup from 'yup';

import AvatarDisplay from '#components/Avatar/AvatarDisplay';
import HoursPieChart from '#components/HoursPieChart/HoursPieChart';
import { AVATAR_OPTIONS, DEFAULT_AVATAR_CONFIG, UpdatedProfileData } from '#constants/avatar';
import { ALIAS_MAX_LENGTH, ALIAS_MIN_LENGTH, ALIAS_REGEX } from '#constants/validation';
import EditAvatarModal from '#pages/RacerProfile/components/EditAvatarModal';
import UploadAvatarModal from '#pages/RacerProfile/components/UploadAvatarModal';
import { useGetProfileQuery, useUpdateProfileMutation } from '#services/deepRacer/profileApi';
import { setTopDefaults, setFacialHairDefaults, setClothingDefaults } from '#utils/avatarUtils';
import { validateAvatarPieces } from '#utils/racerProfile';

import '#pages/RacerProfile/styles.css';

const schema = Yup.object().shape({
  alias: Yup.string()
    .required(i18n.t('racerProfile:profileModal.nameRequiredError'))
    .max(ALIAS_MAX_LENGTH, i18n.t('racerProfile:profileModal.nameLengthError'))
    .min(ALIAS_MIN_LENGTH, i18n.t('racerProfile:profileModal.nameLengthError'))
    .matches(ALIAS_REGEX, i18n.t('racerProfile:profileModal.nameCharacterError')),
  avatar: Yup.object().shape({
    accessories: Yup.string(),
    clothing: Yup.string(),
    clothingColor: Yup.string(),
    eyes: Yup.string(),
    eyebrows: Yup.string(),
    facialHair: Yup.string(),
    facialHairColor: Yup.string(),
    hairColor: Yup.string(),
    mouth: Yup.string(),
    skincolor: Yup.string(),
    top: Yup.string(),
    tshirtGraphic: Yup.string(),
  }),
});

class AvatarError extends Error {}

// TODO: add skins for models
const RacerProfile = () => {
  const { t } = useTranslation('racerProfile');

  const { data: profileData } = useGetProfileQuery();

  const [isEditAvatarOpen, setIsEditAvatarOpen] = useState(false);
  const [isUploadAvatarOpen, setIsUploadAvatarOpen] = useState(false);
  const [avatarConfigToUpload, setAvatarConfigToUpload] = useState('');
  const [avatarErrorMessage, setAvatarErrorMessage] = useState('');

  const initialValues = {
    alias: profileData?.alias ?? '',
    avatar: { ...DEFAULT_AVATAR_CONFIG, ...profileData?.avatar },
  };
  const [updateProfile] = useUpdateProfileMutation();

  const modelCount = profileData?.modelCount ?? 0;
  const maxModelCount = profileData?.maxModelCount ?? 0;
  const isUnlimitedModels = profileData?.maxModelCount === -1;

  const handleCloseEditAvatar = () => {
    setValue('avatar', { ...DEFAULT_AVATAR_CONFIG, ...profileData?.avatar });
    setIsEditAvatarOpen(false);
    setValue('alias', profileData?.alias ?? '');
  };

  const handleUploadAvatar = () => {
    try {
      const uploadedAvatar = JSON.parse(avatarConfigToUpload);
      const avatarTypes = Object.values(AvatarOptionType);
      Object.keys(uploadedAvatar).forEach((avatarType) => {
        let pieceFound = false;
        if (!avatarTypes.includes(avatarType as AvatarOptionType)) {
          throw new AvatarError(t('uploadProfileModal.errors.invalidType'));
        }

        if (uploadedAvatar[avatarType]) {
          for (const subType of AVATAR_OPTIONS[avatarType as AvatarOptionType]) {
            if (subType.options.includes(uploadedAvatar[avatarType])) {
              pieceFound = true;
              break;
            }
          }
          if (!pieceFound) {
            throw new AvatarError(t('uploadProfileModal.errors.invalidPiece'));
          }
        }
      });
      if (!validateAvatarPieces(uploadedAvatar)) {
        throw new AvatarError(t('uploadProfileModal.errors.invalidConfiguration'));
      }
      setAvatarErrorMessage('');
      setValue('avatar', { ...DEFAULT_AVATAR_CONFIG, ...uploadedAvatar });
      setIsUploadAvatarOpen(false);
      setIsEditAvatarOpen(true);
    } catch (e: unknown) {
      if (e instanceof AvatarError) {
        setAvatarErrorMessage(String(e));
      } else {
        setAvatarErrorMessage(t('uploadProfileModal.errors.invalidFormat'));
      }
    }
  };

  const handleCloseUploadAvatar = () => {
    setIsUploadAvatarOpen(false);
  };

  const handleSettingDefaultPieces = (
    avatarOption: string,
    avatarConfig: AvatarConfig,
    selectedAvatarPiece: string,
    oldAvatarPiece: string,
  ) => {
    if (avatarOption === AvatarOptionType.TOP) {
      setValue('avatar', setTopDefaults(avatarConfig, selectedAvatarPiece, oldAvatarPiece));
    }
    if (avatarOption === AvatarOptionType.FACIAL_HAIR) {
      setValue('avatar', setFacialHairDefaults(avatarConfig, selectedAvatarPiece, oldAvatarPiece));
    }
    if (avatarOption === AvatarOptionType.CLOTHING) {
      setValue('avatar', setClothingDefaults(avatarConfig, selectedAvatarPiece, oldAvatarPiece));
    }
  };

  const onSubmit = async (updatedProfiledata: UpdatedProfileData) => {
    setIsEditAvatarOpen(false);
    await updateProfile(updatedProfiledata);
  };

  const { control, getValues, handleSubmit, setValue } = useForm<UpdatedProfileData>({
    values: initialValues,
    resolver: yupResolver(schema),
  });

  const getAvatarValues = getValues('avatar');

  return (
    <ContentLayout
      header={
        <Header
          actions={
            <Grid>
              <Button
                onClick={() => {
                  setIsUploadAvatarOpen(true);
                }}
              >
                {t('uploadButton')}
              </Button>
              <CopyToClipboard
                copyButtonText={t('copyButton.label')}
                copyErrorText={t('copyButton.failed')}
                copySuccessText={t('copyButton.copied')}
                textToCopy={t('copyButton.clipboard', {
                  accessories: getAvatarValues.accessories,
                  clothing: getAvatarValues.clothing,
                  clothingColor: getAvatarValues.clothingColor,
                  eyebrows: getAvatarValues.eyebrows,
                  eyes: getAvatarValues.eyes,
                  facialHair: getAvatarValues.facialHair,
                  facialHairColor: getAvatarValues.facialHairColor,
                  hairColor: getAvatarValues.hairColor,
                  mouth: getAvatarValues.mouth,
                  skinColor: getAvatarValues.skinColor,
                  top: getAvatarValues.top,
                  tshirtGraphic: getAvatarValues.tshirtGraphic,
                  alias: getValues('alias'),
                })}
              />
            </Grid>
          }
          variant="h1"
        >
          {t('header')}
        </Header>
      }
    >
      <Grid
        gridDefinition={[
          { colspan: { default: 6, s: 4 } },
          { colspan: { default: 6, s: 4 } },
          { colspan: { default: 12, s: 8 } },
        ]}
      >
        <Container
          fitHeight
          header={
            <Header
              actions={
                <Button
                  onClick={() => {
                    setIsEditAvatarOpen(true);
                  }}
                >
                  {t('profile.button')}
                </Button>
              }
              variant="h3"
            >
              {t('profile.header')}
            </Header>
          }
        >
          <EditAvatarModal
            control={control}
            getValues={getValues}
            handleCloseEditAvatar={handleCloseEditAvatar}
            handleSettingDefaultPieces={handleSettingDefaultPieces}
            handleSubmit={handleSubmit}
            isEditAvatarOpen={isEditAvatarOpen}
            onSubmit={onSubmit}
          />
          <Box padding={{ top: 'l' }}>
            <Grid gridDefinition={[{ colspan: { default: 5, s: 4 } }, { colspan: { default: 7, s: 8 } }]}>
              <AvatarDisplay avatarConfig={profileData?.avatar} />
              <SpaceBetween size="xs">
                <Box fontSize="heading-s" fontWeight="bold" padding={{ top: 'm' }}>
                  {t('profile.racerName')}
                </Box>
                <Box fontSize="heading-l">{profileData?.alias ?? t('profile.placerholderName')}</Box>
              </SpaceBetween>
            </Grid>
          </Box>
        </Container>
        <Container>
          <div className="pieChart">
            <HoursPieChart />
          </div>
          <SpaceBetween size="xxxs">
            <Box color="text-status-inactive" textAlign="center">
              {t('models.modelCountHeader')}
            </Box>
            <Box textAlign="center">
              {isUnlimitedModels
                ? t('models.modelCountUnlimited', { trainedCount: modelCount })
                : t('models.modelCount', { trainedCount: modelCount, allowedCount: maxModelCount })}
            </Box>
          </SpaceBetween>
        </Container>
      </Grid>
      <UploadAvatarModal
        avatarConfigString={avatarConfigToUpload}
        avatarErrorMessage={avatarErrorMessage}
        isUploadAvatarOpen={isUploadAvatarOpen}
        handleCloseUploadAvatar={handleCloseUploadAvatar}
        handleUploadAvatar={handleUploadAvatar}
        setAvatarConfigString={setAvatarConfigToUpload}
      />
    </ContentLayout>
  );
};

export default RacerProfile;
