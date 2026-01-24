// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Checkbox from '@cloudscape-design/components/checkbox';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { yupResolver } from '@hookform/resolvers/yup';
import { signIn } from 'aws-amplify/auth';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Yup from 'yup';

import InputField from '#components/FormFields/InputField/InputField.js';
import { AuthState, SignInValues } from '#constants/auth.js';
import { PageId } from '#constants/pages.js';
import { useAppDispatch } from '#hooks/useAppDispatch.js';
import i18n from '#i18n/index.js';
import { useGetProfileQuery } from '#services/deepRacer/profileApi';
import { displayErrorNotification } from '#store/notifications/notificationsSlice.js';
import { getPath } from '#utils/pageUtils.js';

const authValidationSchema = Yup.object().shape({
  password: Yup.string().required(i18n.t('auth:required')),
  emailAddress: Yup.string().required(i18n.t('auth:required')).email(i18n.t('auth:validEmailAddress')),
});

const initialAuthValues: SignInValues = {
  emailAddress: '',
  password: '',
};
const SignInForm = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { state } = useLocation();
  const { refetch } = useGetProfileQuery();
  const { control, handleSubmit } = useForm<SignInValues>({
    values: initialAuthValues,
    resolver: yupResolver(authValidationSchema),
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoadingSignIn, setIsLoadingSignIn] = useState(false);
  const onSubmit = async (data: SignInValues) => {
    try {
      setIsLoadingSignIn(true);
      const signInResult = await signIn({
        username: data.emailAddress,
        password: data.password,
      });

      if (signInResult.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        navigate(getPath(PageId.SIGN_IN), { state: { authState: AuthState.NEW_PASSWORD_REQUIRED } });
        return;
      }

      navigate(state?.redirectUrl ?? getPath(PageId.HOME));
      await refetch();
    } catch (err) {
      setIsLoadingSignIn(false);
      dispatch(
        displayErrorNotification({
          content: t('incorrectSignin'),
          id: t('incorrectSignin'),
        }),
      );
    }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Container header={<Header variant="h2">{t('signin')}</Header>}>
        <SpaceBetween size="l">
          <InputField type={'text'} name="emailAddress" control={control} label={t('email')} stretch />
          <InputField
            type={showPassword ? 'text' : 'password'}
            name="password"
            control={control}
            label={t('password')}
            stretch
          />
          <SpaceBetween size="xxs" direction="horizontal">
            <Checkbox checked={showPassword} onChange={({ detail }) => setShowPassword(detail.checked)}>
              {t('showPassword')}
            </Checkbox>
            <span> </span>
            <Button
              variant="inline-link"
              onClick={() => {
                navigate(getPath(PageId.FORGOT_PASSWORD_REQUEST));
              }}
              formAction="none"
            >
              {t('forgotPassword')}
            </Button>
          </SpaceBetween>
          <Button loading={isLoadingSignIn} variant="primary" formAction="submit">
            {t('signin')}
          </Button>
        </SpaceBetween>
      </Container>
    </form>
  );
};

export default SignInForm;
