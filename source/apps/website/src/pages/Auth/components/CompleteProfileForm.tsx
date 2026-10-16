// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Yup from 'yup';

import InputField from '#components/FormFields/InputField/InputField.js';
import { PageId } from '#constants/pages.js';
import { useAppDispatch } from '#hooks/useAppDispatch.js';
import i18n from '#i18n/index.js';
import { useGetProfileQuery, useUpdateProfileMutation } from '#services/deepRacer/profileApi';
import { displayErrorNotification } from '#store/notifications/notificationsSlice.js';
import { getPath } from '#utils/pageUtils.js';

interface CompleteProfileValues {
  racerAlias: string;
}

const completeProfileValidationSchema = Yup.object().shape({
  racerAlias: Yup.string()
    .required(i18n.t('auth:required'))
    .min(3, i18n.t('auth:aliasMinLength'))
    .max(20, i18n.t('auth:aliasMaxLength'))
    .matches(/^[a-zA-Z0-9_-]+$/, i18n.t('auth:aliasInvalidChars')),
});

const initialValues: CompleteProfileValues = {
  racerAlias: '',
};

/**
 * Collects a racer alias for a fully-authenticated user whose profile doesn't have one yet
 * (e.g. a brand-new SSO/federated login that was JIT-provisioned with a blank alias by
 * getProfile). Unlike NewPasswordForm, there's no Cognito challenge to answer here — the user is
 * already signed in — so this only updates the profile and routes home.
 */
const CompleteProfileForm = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { state } = useLocation();
  const { refetch } = useGetProfileQuery();
  const [updateProfile] = useUpdateProfileMutation();
  const { control, handleSubmit } = useForm<CompleteProfileValues>({
    values: initialValues,
    resolver: yupResolver(completeProfileValidationSchema),
  });

  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (data: CompleteProfileValues) => {
    try {
      setIsLoading(true);
      await updateProfile({
        alias: data.racerAlias,
      });

      await refetch();
      navigate(state?.redirectUrl ?? getPath(PageId.HOME));
    } catch (err) {
      setIsLoading(false);
      dispatch(
        displayErrorNotification({
          content: t('completeProfileError'),
          id: 'complete-profile-error',
        }),
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Container header={<Header variant="h2">{t('completeProfileHeader')}</Header>}>
        <SpaceBetween size="l">
          <p>{t('completeProfileDescription')}</p>
          <InputField
            type={'text'}
            name="racerAlias"
            control={control}
            label={t('racerAlias')}
            constraintText={t('racerAliasConstraint')}
            stretch
          />
          <Button loading={isLoading} variant="primary" formAction="submit">
            {t('completeProfileSubmit')}
          </Button>
        </SpaceBetween>
      </Container>
    </form>
  );
};

export default CompleteProfileForm;
