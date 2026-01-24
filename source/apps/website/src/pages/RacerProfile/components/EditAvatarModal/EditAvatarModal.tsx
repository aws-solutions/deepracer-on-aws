// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Form from '@cloudscape-design/components/form';
import Grid from '@cloudscape-design/components/grid';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { AvatarOptionType } from '@deepracer-indy/config';
import { AvatarConfig } from '@deepracer-indy/typescript-client';
import { Control, UseFormGetValues, UseFormHandleSubmit, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import AvatarAllOptions from '#components/Avatar/AvatarAllOptions';
import AvatarDisplay from '#components/Avatar/AvatarDisplay';
import InputField from '#components/FormFields/InputField';
import { UpdatedProfileData } from '#constants/avatar';

interface EditAvatarModalProps {
  control: Control<UpdatedProfileData>;
  getValues: UseFormGetValues<UpdatedProfileData>;
  handleCloseEditAvatar: () => void;
  handleSettingDefaultPieces: (
    avatarOption: AvatarOptionType,
    avatarConfig: AvatarConfig,
    selectedAvatarPiece: string,
    oldAvatarPiece: string,
  ) => void;
  handleSubmit: UseFormHandleSubmit<UpdatedProfileData>;
  isEditAvatarOpen: boolean;
  onSubmit: (updatedProfileData: UpdatedProfileData) => void;
}

const EditAvatarModal = ({
  control,
  getValues,
  handleCloseEditAvatar,
  handleSettingDefaultPieces,
  handleSubmit,
  isEditAvatarOpen,
  onSubmit,
}: EditAvatarModalProps) => {
  const { t } = useTranslation('racerProfile');

  const updatedAvatar = useWatch({ control, name: 'avatar' });

  return (
    <Modal header={t('profileModal.header')} onDismiss={handleCloseEditAvatar} visible={isEditAvatarOpen}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button formAction="none" onClick={handleCloseEditAvatar} variant="link">
                {t('profileModal.cancelButton')}
              </Button>
              <Button formAction="submit" variant="primary">
                {t('profileModal.saveButton')}
              </Button>
            </SpaceBetween>
          }
        >
          <Grid
            gridDefinition={[
              { colspan: { default: 12, s: 12 } },
              { colspan: { default: 4, s: 5 } },
              { colspan: { default: 8, s: 7 } },
            ]}
          >
            <InputField
              control={control}
              description={t('profileModal.nameDescription')}
              label={t('profileModal.nameLabel')}
              name={'alias'}
            />
            <AvatarDisplay avatarConfig={updatedAvatar} />
            <AvatarAllOptions
              control={control}
              handleAvatarDefaults={handleSettingDefaultPieces}
              avatarConfig={getValues('avatar')}
            />
          </Grid>
        </Form>
      </form>
    </Modal>
  );
};

export default EditAvatarModal;
