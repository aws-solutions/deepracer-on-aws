// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useState } from 'react';

import { useAppDispatch } from '#hooks/useAppDispatch';
import { useRegisterUserMutation } from '#services/deepRacer/profileApi';
import { displaySuccessNotification } from '#store/notifications/notificationsSlice';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const RegisterRacer = () => {
  const dispatch = useAppDispatch();
  const [registerUser, { isLoading }] = useRegisterUserMutation();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [countryError, setCountryError] = useState('');

  const validate = (): boolean => {
    if (!email.trim()) {
      setEmailError('Email address is required');
      return false;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    if (countryCode.trim() && !/^[A-Za-z]{2}$/.test(countryCode.trim())) {
      setCountryError('Country code must be 2 letters (e.g. US, GB)');
      return false;
    }
    setCountryError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await registerUser({
        emailAddress: email.trim(),
        ...(countryCode.trim() ? { countryCode: countryCode.trim().toUpperCase() } : {}),
      }).unwrap();
      dispatch(
        displaySuccessNotification({
          content: `Racer registered successfully. A temporary password has been sent to ${email.trim()}.`,
          id: 'register-success',
        }),
      );
      setEmail('');
      setCountryCode('');
    } catch {
      // Error notification handled by the API base query
    }
  };

  return (
    <ContentLayout header={<Header variant="h1">Register walk-up racer</Header>}>
      <Container>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <Form
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="primary" loading={isLoading} disabled={isLoading}>
                  Register racer
                </Button>
              </SpaceBetween>
            }
          >
            <SpaceBetween direction="vertical" size="l">
              <FormField
                label="Email address"
                description="The racer will receive a temporary password at this address."
                errorText={emailError}
              >
                <Input
                  value={email}
                  onChange={({ detail }) => {
                    setEmail(detail.value);
                    if (emailError) setEmailError('');
                  }}
                  onBlur={validate}
                  type="email"
                  placeholder="racer@example.com"
                  disabled={isLoading}
                  data-testid="email-input"
                />
              </FormField>
              <FormField
                label="Country code (optional)"
                description="2-letter code (e.g. US, GB) shown on leaderboards."
                errorText={countryError}
              >
                <Input
                  value={countryCode}
                  onChange={({ detail }) => {
                    setCountryCode(detail.value);
                    if (countryError) setCountryError('');
                  }}
                  placeholder="US"
                  disabled={isLoading}
                  data-testid="country-input"
                />
              </FormField>
            </SpaceBetween>
          </Form>
        </form>
      </Container>
    </ContentLayout>
  );
};

export default RegisterRacer;
