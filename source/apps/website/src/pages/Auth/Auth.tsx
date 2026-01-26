// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import ContentLayout from '@cloudscape-design/components/content-layout';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import deepRacerLogo from '#assets/deepracer_logo.svg';
import { AuthState } from '#constants/auth.js';

import ForgotPasswordRequestForm from './components/ForgotPasswordRequestForm';
import ForgotPasswordResetForm from './components/ForgotPasswordResetForm';
import NewPasswordForm from './components/NewPasswordForm';
import SignInForm from './components/SignInForm';
import VerifyEmailForm from './components/VerifyEmailForm';

const Auth = ({ initialAuthState = AuthState.SIGNIN }) => {
  const { t } = useTranslation('common');
  const { state } = useLocation();

  // Use router state for auth state if available, otherwise use prop
  const currentAuthState = state?.authState ?? initialAuthState;

  const getAuthForm = () => {
    switch (currentAuthState) {
      case AuthState.SIGNIN:
        return <SignInForm />;
      case AuthState.FORGOT_PASSWORD_REQUEST:
        return <ForgotPasswordRequestForm />;
      case AuthState.FORGOT_PASSWORD_RESET:
        return <ForgotPasswordResetForm />;
      case AuthState.NEW_PASSWORD_REQUIRED:
        return <NewPasswordForm />;
      case AuthState.VERIFY_EMAIL:
      default:
        return <VerifyEmailForm />;
    }
  };
  return (
    <ContentLayout
      maxContentWidth={550}
      header={
        <Box textAlign="center">
          <img src={deepRacerLogo} alt="DeepRacer on AWS" />

          <h2>{t('serviceName')}</h2>
        </Box>
      }
    >
      {getAuthForm()}
    </ContentLayout>
  );
};

export default Auth;
