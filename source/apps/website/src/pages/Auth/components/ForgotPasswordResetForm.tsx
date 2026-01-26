// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Button, Checkbox } from '@cloudscape-design/components';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { yupResolver } from '@hookform/resolvers/yup';
import { confirmResetPassword } from 'aws-amplify/auth';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Yup from 'yup';

import InputField from '#components/FormFields/InputField/InputField.js';
import { PageId } from '#constants/pages.js';
import { PASSWORD_REGEX } from '#constants/validation.js';
import { useAppDispatch } from '#hooks/useAppDispatch.js';
import i18n from '#i18n/index.js';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice.js';
import { getPath } from '#utils/pageUtils.js';

interface ForgotPasswordResetFormValues {
  code: string;
  password: string;
}

const initialAuthValues: ForgotPasswordResetFormValues = {
  code: '',
  password: '',
};

const authValidationSchema = Yup.object().shape({
  code: Yup.string()
    .required(i18n.t('auth:required'))
    .matches(/^[0-9]+$/, i18n.t('auth:digitOnly'))
    .min(6, i18n.t('auth:codeLengthRestraint'))
    .max(6, i18n.t('auth:codeLengthRestraint')),
  password: Yup.string().required(i18n.t('auth:required')).matches(PASSWORD_REGEX, i18n.t('auth:passwordReq')),
});
const ForgotPasswordResetForm = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const { state } = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const dispatch = useAppDispatch();
  const { control, handleSubmit, setError } = useForm<ForgotPasswordResetFormValues>({
    values: initialAuthValues,
    resolver: yupResolver(authValidationSchema),
  });

  useEffect(() => {
    if (!state?.username) {
      navigate(getPath(PageId.FORGOT_PASSWORD_REQUEST));
    }
  }, [state, navigate]);

  const onSubmit = async (data: ForgotPasswordResetFormValues) => {
    try {
      setIsResetting(true);
      await confirmResetPassword({
        username: state.username,
        confirmationCode: data.code,
        newPassword: data.password,
      });
      dispatch(
        displaySuccessNotification({
          content: t('resetSuccessNotif'),
          persistForPageChanges: 1,
        }),
        navigate(getPath(PageId.SIGN_IN)),
      );
    } catch {
      setIsResetting(false);
      dispatch(
        displayErrorNotification({
          content: t('incorrectCode'),
        }),
        setError('code', { type: 'focus', message: t('incorrectCode') }, { shouldFocus: true }),
      );
    }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Container
        header={
          <Header variant="h2" description={t('resetPasswordDesc')}>
            {t('resetPasswordHeader', { email: state?.username })}
          </Header>
        }
      >
        <SpaceBetween size="l">
          <InputField type={'text'} name="code" control={control} label={t('verificationCode')} stretch />
          <InputField
            type={showPassword ? 'text' : 'password'}
            name="password"
            control={control}
            label={t('newPassword')}
            constraintText={t('passwordReq')}
            stretch
          />
          <Checkbox checked={showPassword} onChange={({ detail }) => setShowPassword(detail.checked)}>
            {t('showPassword')}
          </Checkbox>

          <Button loading={isResetting} variant="primary" formAction="submit">
            {t('resetPassword')}
          </Button>
        </SpaceBetween>
      </Container>
    </form>
  );
};

export default ForgotPasswordResetForm;
