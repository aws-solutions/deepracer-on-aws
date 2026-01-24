// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { yupResolver } from '@hookform/resolvers/yup';
import { confirmSignUp, resendSignUpCode } from 'aws-amplify/auth';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Yup from 'yup';

import InputField from '#components/FormFields/InputField/InputField.js';
import { PageId } from '#constants/pages.js';
import { useAppDispatch } from '#hooks/useAppDispatch.js';
import i18n from '#i18n/index.js';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice.js';
import { getPath } from '#utils/pageUtils.js';

const authValidationSchema = Yup.object().shape({
  code: Yup.string()
    .required(i18n.t('auth:required'))
    .matches(/^[0-9]+$/, i18n.t('auth:digitOnly'))
    .min(6, i18n.t('auth:codeLengthRestraint'))
    .max(6, i18n.t('auth:codeLengthRestraint')),
});

interface VerifyEmailFormValues {
  code: string;
}

const initialFormValues: VerifyEmailFormValues = {
  code: '',
};
const VerifyEmailForm = () => {
  const { t } = useTranslation('auth');
  const { state } = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { control, handleSubmit, setError } = useForm<VerifyEmailFormValues>({
    values: initialFormValues,
    resolver: yupResolver(authValidationSchema),
  });
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);

  useEffect(() => {
    if (!state?.username) {
      navigate(getPath(PageId.SIGN_IN));
    }
  }, [state, navigate]);

  const onSubmit = async (data: VerifyEmailFormValues) => {
    try {
      setIsVerifyingEmail(true);
      await confirmSignUp({
        username: state.username,
        confirmationCode: data.code,
      });
      dispatch(
        displaySuccessNotification({
          content: t('successNotif'),
          persistForPageChanges: 1,
        }),
        navigate(getPath(PageId.SIGN_IN)),
      );
    } catch {
      setIsVerifyingEmail(false);
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
          <Header variant="h2" description={t('verifyEmailDesc')}>
            {t('verifyEmailheader')}
          </Header>
        }
      >
        <SpaceBetween size="l">
          <InputField
            type={'text'}
            name="code"
            control={control}
            label={t('verificationCode')}
            stretch
            placeholder={t('sixDigitCode')}
          />
          <SpaceBetween size="xxs" direction="horizontal">
            <Button
              variant="normal"
              onClick={async () => {
                await resendSignUpCode({
                  username: state.username,
                });
                dispatch(
                  displaySuccessNotification({
                    content: t('resendCodeNotif'),
                  }),
                );
              }}
              disabled={isVerifyingEmail}
              formAction="none"
            >
              {t('resendCode')}
            </Button>
            <Button loading={isVerifyingEmail} variant="primary" formAction="submit">
              {t('verify')}
            </Button>
          </SpaceBetween>
        </SpaceBetween>
      </Container>
    </form>
  );
};

export default VerifyEmailForm;
