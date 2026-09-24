// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import { useTranslation } from 'react-i18next';

export const TrackTabEmptyState = ({ onAddTrack, canAdd }: { onAddTrack: () => void; canAdd: boolean }) => {
  const { t } = useTranslation('events');

  return (
    <Container>
      <Box textAlign="center" padding="xl">
        <Box variant="strong">{t('detail.tracks.emptyTitle')}</Box>
        <Box variant="p" color="text-body-secondary" padding={{ bottom: 's' }}>
          {t('detail.tracks.emptySubtitle')}
        </Box>
        {canAdd && <Button onClick={onAddTrack}>{t('detail.tracks.addTrackButton')}</Button>}
      </Box>
    </Container>
  );
};
