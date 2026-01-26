// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import { TrackConfig } from '@deepracer-indy/typescript-client';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { getTrackById } from '#utils/trackUtils.js';

interface RaceTrackColumnProps {
  trackConfig: TrackConfig;
}

const RaceTrackColumn = ({ trackConfig }: RaceTrackColumnProps) => {
  const { trackDirection, trackId } = trackConfig;

  const { t } = useTranslation('raceDetails', { keyPrefix: 'raceTrackColumn' });

  const track = useMemo(() => getTrackById(trackId), [trackId]);

  return (
    <>
      <KeyValuePairs
        items={[
          {
            label: t('competitionTrack'),
            value: (
              <div>
                {track.description}
                <br />
                {t(`trackDirection.${trackDirection}`)}
              </div>
            ),
          },
        ]}
      />
      <Box margin={{ top: 'xxl' }}>
        <img
          src={new URL(`../../../assets/images/tracks/${track.trackId}.png`, import.meta.url).href}
          width="100%"
          alt="Race track"
        />
      </Box>
    </>
  );
};

export default RaceTrackColumn;
