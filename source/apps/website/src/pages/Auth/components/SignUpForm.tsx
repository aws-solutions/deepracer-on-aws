// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Checkbox from '@cloudscape-design/components/checkbox';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { yupResolver } from '@hookform/resolvers/yup';
import { signUp } from 'aws-amplify/auth';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as Yup from 'yup';

import InputField from '#components/FormFields/InputField/InputField';
import { AuthValues } from '#constants/auth';
import { PageId } from '#constants/pages';
import { PASSWORD_REGEX } from '#constants/validation';
import { useAppDispatch } from '#hooks/useAppDispatch';
import i18n from '#i18n/index.js';
import { displayErrorNotification } from '#store/notifications/notificationsSlice';
import { getPath } from '#utils/pageUtils';
import { generateResourceId } from '#utils/resourceUtils';

const authValidationSchema = Yup.object().shape({
  password: Yup.string().required(i18n.t('auth:required')).matches(PASSWORD_REGEX, i18n.t('auth:passwordReq')),
  emailAddress: Yup.string().required(i18n.t('auth:required')).email(i18n.t('auth:validEmailAddress')),
  racerAlias: Yup.string()
    .required(i18n.t('auth:required'))
    .min(3, i18n.t('auth:aliasMinLength'))
    .max(20, i18n.t('auth:aliasMaxLength'))
    .matches(/^[a-zA-Z0-9_-]+$/, i18n.t('auth:aliasInvalidChars')),
});

const initialAuthValues: AuthValues = {
  emailAddress: '',
  password: '',
  racerAlias: '',
};

const SignUpForm = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { control, handleSubmit } = useForm<AuthValues>({
    values: initialAuthValues,
    resolver: yupResolver(authValidationSchema),
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoadingSignUp, setIsLoadingSignUp] = useState(false);

  const onSubmit = async (data: AuthValues) => {
    const newUserId = generateResourceId();
    try {
      setIsLoadingSignUp(true);
      await signUp({
        username: newUserId,
        password: data.password,
        options: {
          userAttributes: {
            email: data.emailAddress,
          },
          clientMetadata: {
            racerAlias: data.racerAlias,
          },
        },
      });
      navigate(getPath(PageId.VERIFY_EMAIL), { state: { username: newUserId } });
    } catch {
      setIsLoadingSignUp(false);
      dispatch(
        displayErrorNotification({
          content: t('signupFailNotif'),
        }),
      );
    }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Container
        header={
          <Header variant="h2" description={t('signupDesc')}>
            {t('signup')}
          </Header>
        }
      >
        <SpaceBetween size="l">
          <InputField type={'text'} name="emailAddress" control={control} label={t('email')} stretch />
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
            name="password"
            control={control}
            constraintText={t('passwordReq')}
            label={t('password')}
            stretch
          />
          <SpaceBetween size="xxs" direction="horizontal">
            <Checkbox checked={showPassword} onChange={({ detail }) => setShowPassword(detail.checked)}>
              {t('showPassword')}
            </Checkbox>
          </SpaceBetween>
          <Button loading={isLoadingSignUp} variant="primary" formAction="submit">
            {t('signup')}
          </Button>
          <SpaceBetween size="xxs" direction="horizontal">
            <span>{t('signinLink')}</span>
            <Button
              variant="inline-link"
              onClick={() => {
                navigate(getPath(PageId.SIGN_IN));
              }}
            >
              {t('signin')}
            </Button>
          </SpaceBetween>
        </SpaceBetween>
      </Container>
    </form>
  );
};

export default SignUpForm;
