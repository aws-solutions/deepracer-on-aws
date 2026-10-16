// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Checkbox from '@cloudscape-design/components/checkbox';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { yupResolver } from '@hookform/resolvers/yup';
import { confirmSignIn } from 'aws-amplify/auth';
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

import { navigatePostSignIn, resolveNextSignInStep } from '../utils/postSignInRouting';

interface NewPasswordValues {
  newPassword: string;
  confirmPassword: string;
  racerAlias: string;
}

const newPasswordValidationSchema = Yup.object().shape({
  newPassword: Yup.string()
    .required(i18n.t('auth:required'))
    .min(8, i18n.t('auth:passwordMinLength'))
    .matches(/[a-z]/, i18n.t('auth:passwordLowercase'))
    .matches(/[A-Z]/, i18n.t('auth:passwordUppercase'))
    .matches(/[0-9]/, i18n.t('auth:passwordNumber'))
    .matches(/[^a-zA-Z0-9]/, i18n.t('auth:passwordSpecial')),
  confirmPassword: Yup.string()
    .required(i18n.t('auth:required'))
    .oneOf([Yup.ref('newPassword')], i18n.t('auth:passwordMatch')),
  racerAlias: Yup.string()
    .required(i18n.t('auth:required'))
    .min(3, i18n.t('auth:aliasMinLength'))
    .max(20, i18n.t('auth:aliasMaxLength'))
    .matches(/^[a-zA-Z0-9_-]+$/, i18n.t('auth:aliasInvalidChars')),
});

const NewPasswordForm = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { state } = useLocation();
  const { refetch } = useGetProfileQuery();
  const [updateProfile] = useUpdateProfileMutation();
  // Seeded from state.racerAlias when this screen is re-entered mid challenge-chain (see
  // onSubmit below) so a racer alias the user already typed isn't silently lost. Lazy-initialized
  // once per mount (not recomputed every render) so its reference stays stable for useForm's
  // `values` option below — a fresh object literal every render would fight the user's typing.
  const [initialValues] = useState<NewPasswordValues>(() => ({
    newPassword: '',
    confirmPassword: '',
    racerAlias: state?.racerAlias ?? '',
  }));
  const { control, handleSubmit } = useForm<NewPasswordValues>({
    values: initialValues,
    resolver: yupResolver(newPasswordValidationSchema),
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (data: NewPasswordValues) => {
    try {
      setIsLoading(true);
      const result = await confirmSignIn({
        challengeResponse: data.newPassword,
      });

      // Setting a new password can chain straight into another challenge — the user isn't fully
      // authenticated yet in that case, so calling updateProfile/navigating home here would fail
      // against a session that isn't established, leaving them looking "logged out". Defer the
      // alias update until the full challenge chain completes.
      const nextStepRedirect = resolveNextSignInStep(result.nextStep);
      if (nextStepRedirect) {
        navigate(getPath(PageId.SIGN_IN), {
          state: { ...nextStepRedirect, email: state?.email, racerAlias: data.racerAlias, redirectUrl: state?.redirectUrl },
        });
        return;
      }

      // Update the user's profile with their chosen racer alias
      await updateProfile({
        alias: data.racerAlias,
      });

      const profileResult = await refetch();
      navigatePostSignIn(navigate, profileResult.data, state?.redirectUrl);
    } catch (err) {
      setIsLoading(false);
      dispatch(
        displayErrorNotification({
          content: t('passwordUpdateError'),
          id: 'password-update-error',
        }),
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Container header={<Header variant="h2">{t('newPasswordRequired')}</Header>}>
        <SpaceBetween size="l">
          <InputField
            type={'text'}
            name="racerAlias"
            control={control}
            label={t('racerAlias')}
            constraintText={t('racerAliasConstraint')}
            stretch
          />
          <InputField
            type={showPassword ? 'text' : 'password'}
            name="newPassword"
            control={control}
            label={t('newPassword')}
            stretch
          />
          <InputField
            type={showPassword ? 'text' : 'password'}
            name="confirmPassword"
            control={control}
            label={t('confirmPassword')}
            stretch
          />
          <Checkbox checked={showPassword} onChange={({ detail }) => setShowPassword(detail.checked)}>
            {t('showPassword')}
          </Checkbox>
          <Button loading={isLoading} variant="primary" formAction="submit">
            {t('updatePassword')}
          </Button>
        </SpaceBetween>
      </Container>
    </form>
  );
};

export default NewPasswordForm;
