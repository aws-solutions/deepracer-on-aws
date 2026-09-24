// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { EventType } from '@deepracer-indy/typescript-client';
import { useMemo } from 'react';
import { Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import DatePickerField from '#components/FormFields/DatePickerField/DatePickerField';
import InputField from '#components/FormFields/InputField';
import SelectField from '#components/FormFields/SelectField';

import { CreateEventFormValues } from '../../validation';
import CountrySelector from '../CountrySelector';

export interface EventDetailsSectionProps {
  control: Control<CreateEventFormValues>;
  countryCode: string;
  /** Locked once the event advances past DRAFT (OPEN and beyond). */
  isConfigLocked: boolean;
  /** Locked once the event is IN_PROGRESS and beyond (sponsor stays editable while OPEN). */
  isAllLocked: boolean;
}

/**
 * The "Event details" form section (name, type, date, country, sponsor) shared by the
 * Create and Edit event pages. Field lock behavior is driven entirely by the caller via
 * isConfigLocked / isAllLocked, so create mode (both false) and edit mode reuse it as-is.
 */
const EventDetailsSection = ({ control, countryCode, isConfigLocked, isAllLocked }: EventDetailsSectionProps) => {
  const { t } = useTranslation('events');

  const eventTypeOptions = useMemo(
    () => Object.values(EventType).map((value) => ({ value, label: t(`eventType.${value}`) })),
    [t],
  );

  return (
    <Container header={<Header variant="h2">{t('form.sections.eventDetails')}</Header>}>
      <SpaceBetween size="m">
        <InputField
          control={control}
          name="name"
          label={t('form.fields.name.label')}
          placeholder={t('form.fields.name.placeholder')}
          description={t('form.fields.name.description')}
          disabled={isConfigLocked}
        />
        <SelectField
          control={control}
          name="eventType"
          label={t('form.fields.eventType.label')}
          placeholder={t('form.fields.eventType.placeholder')}
          options={eventTypeOptions}
          disabled={isConfigLocked}
          data-testid="select-event-type"
        />
        <DatePickerField
          control={control}
          name="eventDate"
          label={t('form.fields.eventDate.label')}
          placeholder={t('form.fields.eventDate.placeholder')}
          description={t('form.fields.eventDate.description')}
          disabled={isConfigLocked}
        />
        <CountrySelector
          control={control}
          name="countryCode"
          label={t('form.fields.countryCode.label')}
          placeholder={t('form.fields.countryCode.placeholder')}
          description={t('form.fields.countryCode.description')}
          countryCode={countryCode}
          disabled={isConfigLocked}
          data-testid="select-country-code"
        />
        <InputField
          control={control}
          name="sponsor"
          label={t('form.fields.sponsor.label')}
          placeholder={t('form.fields.sponsor.placeholder')}
          description={t('form.fields.sponsor.description')}
          disabled={isAllLocked}
        />
      </SpaceBetween>
    </Container>
  );
};

export default EventDetailsSection;
