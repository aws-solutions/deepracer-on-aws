// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { yupResolver } from '@hookform/resolvers/yup';
import { resetPassword } from 'aws-amplify/auth';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as Yup from 'yup';

import InputField from '#components/FormFields/InputField/index.js';
import { PageId } from '#constants/pages.js';
import { useAppDispatch } from '#hooks/useAppDispatch.js';
import i18n from '#i18n/index.js';
import { displayErrorNotification } from '#store/notifications/notificationsSlice.js';
import { getPath } from '#utils/pageUtils.js';

interface ForgotPasswordRequestFormValues {
  emailAddress: string;
}

const initialAuthValues: ForgotPasswordRequestFormValues = {
  emailAddress: '',
};

const authValidationSchema = Yup.object().shape({
  emailAddress: Yup.string().required(i18n.t('auth:required')).email(i18n.t('auth:validEmailAddress')),
});

const ForgotPasswordRequestForm = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { control, handleSubmit, setError } = useForm<ForgotPasswordRequestFormValues>({
    values: initialAuthValues,
    resolver: yupResolver(authValidationSchema),
  });
  const [isResetting, setIsResetting] = useState(false);

  const onSubmit = async (data: ForgotPasswordRequestFormValues) => {
    try {
      setIsResetting(true);
      await resetPassword({
        username: data.emailAddress,
      });
      navigate(getPath(PageId.FORGOT_PASSWORD_RESET), { state: { username: data.emailAddress } });
    } catch {
      setIsResetting(false);
      dispatch(
        displayErrorNotification({
          content: t('incorrectEmailAddress'),
        }),
        setError('emailAddress', { type: 'focus', message: t('incorrectEmailAddress') }, { shouldFocus: true }),
      );
    }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Container
        header={
          <Header variant="h2" description={t('forgotPasswordDesc')}>
            {t('forgotPassword')}
          </Header>
        }
      >
        <SpaceBetween size="l">
          <InputField type={'text'} name="emailAddress" control={control} label={t('email')} stretch />

          <Button loading={isResetting} variant="primary" formAction="submit">
            {t('sendResetEmail')}
          </Button>
        </SpaceBetween>
      </Container>
    </form>
  );
};

export default ForgotPasswordRequestForm;
