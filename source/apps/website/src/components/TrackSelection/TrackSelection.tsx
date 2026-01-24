// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Cards from '@cloudscape-design/components/cards';
import Pagination from '@cloudscape-design/components/pagination';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import TextFilter from '@cloudscape-design/components/text-filter';
import { TrackConfig, TrackDirection } from '@deepracer-indy/typescript-client';
import { useEffect, useState } from 'react';
import { Control, FieldValues, Path, UseFormSetValue, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import RadioGroupField from '#components/FormFields/RadioGroupField';

import { TrackSortValue } from './constants';
import { useTrackSelectionConfig } from './TrackSelectionConfig';

interface TrackSelectionProps<FormValues extends FieldValues> {
  control: Control<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  trackConfigFieldName: Path<FormValues>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TrackSelection = ({ control, setValue, trackConfigFieldName }: TrackSelectionProps<any>) => {
  const { t } = useTranslation('trackSelection');
  const [trackSort, setTrackSort] = useState<TrackSortValue>(TrackSortValue.DIFFICULTY_ASC);

  const selectedTrack = useWatch({
    name: trackConfigFieldName,
    control,
  }) as TrackConfig;

  const {
    collectionProps,
    cardDefinitions,
    visibleContent,
    items,
    paginationProps,
    TrackSelectionPreferences,
    filteredItemsCount,
    filterProps,
    setSorting,
  } = useTrackSelectionConfig({ track: selectedTrack.trackId });

  useEffect(() => {
    if (collectionProps.selectedItems?.[0]) {
      if (collectionProps.selectedItems[0]?.enabledDirections?.length === 2) {
        setValue(trackConfigFieldName, {
          trackId: collectionProps?.selectedItems?.[0]?.trackId,
          trackDirection: selectedTrack.trackDirection,
        });
      } else {
        setValue(trackConfigFieldName, {
          trackId: collectionProps?.selectedItems?.[0]?.trackId,
          trackDirection: collectionProps?.selectedItems?.[0]?.enabledDirections[0],
        });
      }
    }
  }, [collectionProps.selectedItems, setValue, selectedTrack.trackDirection, trackConfigFieldName]);

  // Check if track has only single direction option
  const trackHasSingleDirection = !!(collectionProps.selectedItems?.[0]?.enabledDirections?.length === 1);

  // Sort tracks based on chosen option
  const sortTracks = (sortOption: TrackSortValue) => {
    setTrackSort(sortOption);
    switch (sortOption) {
      case TrackSortValue.DIFFICULTY_ASC:
        setSorting({
          sortingColumn: {
            sortingField: 'difficulty',
          },
          isDescending: true,
        });
        break;
      case TrackSortValue.DIFFICULTY_DESC:
        setSorting({
          sortingColumn: {
            sortingField: 'difficulty',
          },
          isDescending: false,
        });
        break;
      case TrackSortValue.LENGTH_ASC:
        setSorting({
          sortingColumn: {
            sortingField: 'length',
          },
          isDescending: false,
        });
        break;
      case TrackSortValue.LENGTH_DESC:
      default:
        setSorting({
          sortingColumn: {
            sortingField: 'length',
          },
          isDescending: true,
        });
    }
  };

  return (
    <>
      <Cards
        {...collectionProps}
        variant="full-page"
        selectedItems={collectionProps.selectedItems}
        cardDefinition={cardDefinitions}
        cardsPerRow={[{ cards: 1 }, { minWidth: 500, cards: 2 }, { minWidth: 800, cards: 3 }]}
        entireCardClickable={true}
        items={items}
        selectionType="single"
        trackBy="trackId"
        visibleSections={visibleContent}
        filter={
          <TextFilter
            {...filterProps}
            filteringAriaLabel={t('filters.filteringAriaLabel')}
            filteringPlaceholder={t('filters.searchFilterPlaceholder')}
            countText={filterProps.filteringText && t('filters.matchCount', { count: filteredItemsCount ?? 0 })}
          />
        }
        pagination={
          <Pagination
            {...paginationProps}
            ariaLabels={{
              nextPageLabel: t('pagination.nextPageLabel'),
              previousPageLabel: t('pagination.previousPageLabel'),
              pageLabel: (pageNumber: number) => t('pagination.pageLabel', { pageNumber }),
            }}
          />
        }
        preferences={TrackSelectionPreferences}
        header={
          <Box variant="strong">
            <SpaceBetween direction="horizontal" size={'s'}>
              <Box margin={{ top: 'xxs' }}>{t('sortBy')}</Box>
              <Select
                selectedOption={{
                  label: t(`${trackSort}`),
                  value: trackSort,
                }}
                options={[
                  { label: `${t('difficultyAsc')}`, value: TrackSortValue.DIFFICULTY_ASC },
                  { label: `${t('difficultyDesc')}`, value: TrackSortValue.DIFFICULTY_DESC },
                  { label: `${t('lengthAsc')}`, value: TrackSortValue.LENGTH_ASC },
                  { label: `${t('lengthDesc')}`, value: TrackSortValue.LENGTH_DESC },
                ]}
                onChange={({ detail }) =>
                  sortTracks((detail.selectedOption.value as TrackSortValue) || TrackSortValue.DIFFICULTY_ASC)
                }
              />
            </SpaceBetween>
          </Box>
        }
      />
      <RadioGroupField
        name={`${trackConfigFieldName}.trackDirection`}
        control={control}
        label={t('trackDir')}
        description={t('trackDirDesc')}
        items={[
          {
            value: TrackDirection.CLOCKWISE,
            label: t('CLOCKWISE'),
            disabled:
              trackHasSingleDirection &&
              collectionProps?.selectedItems?.[0]?.enabledDirections?.includes(TrackDirection.COUNTER_CLOCKWISE),
          },
          {
            value: TrackDirection.COUNTER_CLOCKWISE,
            label: t('COUNTER_CLOCKWISE'),
            disabled:
              trackHasSingleDirection &&
              collectionProps?.selectedItems?.[0]?.enabledDirections?.includes(TrackDirection.CLOCKWISE),
          },
        ]}
      />
    </>
  );
};

export default TrackSelection;
