// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Form from '@cloudscape-design/components/form';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface EventFormShellProps {
  title: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onSave: () => void;
  submitLabel?: string;
  children: ReactNode;
}

/**
 * The page chrome shared by CreateEvent and EditEvent: an h1 ContentLayout wrapping a
 * Cloudscape Form with Cancel and a primary submit action (labeled "Save" by default, or
 * "Create" when creating a new event). The form sections are supplied as children so each
 * page composes its own EventDetailsSection / RaceConfigurationSection / tracks.
 */
const EventFormShell = ({ title, isSubmitting, onCancel, onSave, submitLabel, children }: EventFormShellProps) => {
  const { t } = useTranslation('events');
  const effectiveSubmitLabel = submitLabel ?? t('form.saveButton');

  return (
    <ContentLayout header={<Header variant="h1">{title}</Header>}>
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onCancel} disabled={isSubmitting}>
              {t('form.cancelButton')}
            </Button>
            <Button variant="primary" onClick={onSave} loading={isSubmitting}>
              {effectiveSubmitLabel}
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="l">{children}</SpaceBetween>
      </Form>
    </ContentLayout>
  );
};

export default EventFormShell;
