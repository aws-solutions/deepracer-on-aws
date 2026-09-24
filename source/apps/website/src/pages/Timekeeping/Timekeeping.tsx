// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ColumnLayout, ContentLayout, Header, SpaceBetween } from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';

import { TimekeepingSessionProvider } from '#contexts/TimekeepingSessionContext.js';

import { EventAndTrackInfo } from './components/EventAndTrackInfo';
import { RaceControls } from './components/RaceControls';
import { RecordedLaps } from './components/RecordedLaps';
import { RunsTable } from './components/RunsTable';

const TimekeepingContent = () => {
  const { t } = useTranslation('timekeeping');

  return (
    <ContentLayout
      header={
        <Header description={t('description')} variant="h1">
          <SpaceBetween alignItems="center" direction="horizontal" size="xs">
            {t('header')}
          </SpaceBetween>
        </Header>
      }
    >
      <SpaceBetween size="s">
        <RunsTable />
        <ColumnLayout columns={2} variant="default">
          <SpaceBetween size="s">
            <RaceControls />
          </SpaceBetween>
          <SpaceBetween size="s">
            <EventAndTrackInfo />
            <RecordedLaps />
          </SpaceBetween>
        </ColumnLayout>
      </SpaceBetween>
    </ContentLayout>
  );
};

export const Timekeeping = () => (
  <TimekeepingSessionProvider>
    <TimekeepingContent />
  </TimekeepingSessionProvider>
);
