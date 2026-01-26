// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import PieChart from '@cloudscape-design/components/pie-chart';
import { useTranslation } from 'react-i18next';

import { useGetProfileQuery } from '#services/deepRacer/profileApi';

const HoursPieChart = () => {
  const { t } = useTranslation('racerProfile');
  const { data: profile } = useGetProfileQuery();

  // Get values from profile data
  const usedTrainingMinutes = profile?.computeMinutesUsed || 0;
  const maxTrainingMinutes = profile?.maxTotalComputeMinutes || 0;
  const isUnlimited = maxTrainingMinutes === -1;

  // Convert minutes to hours for consistent display
  const usedTrainingHours = Number((usedTrainingMinutes / 60).toFixed(2));
  const maxTrainingHours = Number((maxTrainingMinutes / 60).toFixed(2));

  // If unlimited, show used hours (or a minimal slice if 0)
  if (isUnlimited) {
    // For unlimited accounts with 0 usage, show a minimal slice to ensure chart renders
    const displayUsedHours = usedTrainingHours === 0 ? 0.0001 : usedTrainingHours;
    return (
      <PieChart
        data={[{ title: t('models.pieChartUsed'), value: displayUsedHours, color: '#006ce0' }]}
        data-testid="pie-chart"
        hideFilter
        hideTitles
        hideLegend
        innerMetricDescription="Hours used"
        innerMetricValue={String(usedTrainingHours)}
        variant="donut"
        detailPopoverContent={(datum) => [{ key: 'Value', value: `${usedTrainingHours} hours` }]}
      />
    );
  }

  // For limited compute hours, show used vs unused
  const unusedTrainingHours = Math.max(0, maxTrainingHours - usedTrainingHours);

  // Handle 0% usage case - ensure there's always a visible segment for used hours
  const displayUsedHours = usedTrainingHours === 0 ? 0.0001 : usedTrainingHours;
  const displayUnusedHours = usedTrainingHours === 0 ? maxTrainingHours - 0.0001 : unusedTrainingHours;

  return (
    <PieChart
      data={[
        { title: t('models.pieChartUsed'), value: displayUsedHours, color: '#006ce0' },
        { title: t('models.pieChartUnused'), value: displayUnusedHours, color: '#75b1f2ff' },
      ]}
      data-testid="pie-chart"
      hideFilter
      hideTitles
      innerMetricDescription="Hours used"
      innerMetricValue={String(usedTrainingHours)}
      variant="donut"
      detailPopoverContent={(datum) => [
        {
          key: 'Value',
          value: `${datum.title === t('models.pieChartUsed') ? usedTrainingHours : unusedTrainingHours} hours`,
        },
      ]}
    />
  );
};

export default HoursPieChart;
