// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import BarChart from '@cloudscape-design/components/bar-chart';
import Box from '@cloudscape-design/components/box';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import LineChart from '@cloudscape-design/components/line-chart';
import PieChart from '@cloudscape-design/components/pie-chart';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table from '@cloudscape-design/components/table';
import type { FastestLapEntry } from '@deepracer-indy/typescript-client';

import { useGetRaceStatsQuery } from '#services/deepRacer/raceManagementApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatLapTime = (ms: number): string => {
  if (!ms) return '—';
  return `${(ms / 1000).toFixed(3)}s`;
};

// ── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: string | number;
  description?: string;
}

const KpiCard = ({ title, value, description }: KpiCardProps) => (
  <div>
    <Box variant="awsui-key-label">{title}</Box>
    <Box variant="awsui-value-large">{value}</Box>
    {description && (
      <Box color="text-body-secondary" fontSize="body-s">
        {description}
      </Box>
    )}
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────

// Parse YYYY-MM as local midnight to avoid UTC→local timezone shifts
// (new Date('2026-07-01') is UTC midnight, which renders as June in US timezones)
const toLocalMonth = (month: string): Date => {
  const [y, mo] = month.split('-').map(Number);
  return new Date(y, mo - 1, 1);
};

const lapMedal = (rank: number): string | number => {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return rank;
};

const buildFastestLapsColumnDefs = (items: FastestLapEntry[]) => [
  {
    id: 'rank',
    header: '#',
    cell: (item: FastestLapEntry) => lapMedal(items.indexOf(item) + 1),
    width: 70,
  },
  { id: 'participant', header: 'Racer', cell: (item: FastestLapEntry) => item.participantName },
  {
    id: 'time',
    header: 'Lap time',
    cell: (item: FastestLapEntry) => (
      <Box fontWeight={items.indexOf(item) === 0 ? 'bold' : 'normal'}>{formatLapTime(item.lapTimeMilliseconds)}</Box>
    ),
    width: 140,
  },
  { id: 'event', header: 'Event', cell: (item: FastestLapEntry) => item.eventName || item.eventId },
];

/**
 * Race statistics dashboard — admin-only view of deployment metrics.
 * PRD 4.3.1: Total Events, Total Racers, Total Valid Laps, Countries,
 * % Lap Completion — mirroring the DREM Guidance Statistics page.
 */
const RaceStats = () => {
  const { data: stats, isLoading, isError } = useGetRaceStatsQuery();

  if (isLoading) {
    return (
      <ContentLayout header={<Header variant="h1">Race statistics</Header>}>
        <Box textAlign="center" padding={{ top: 'xxxl' }}>
          <Spinner size="large" />
        </Box>
      </ContentLayout>
    );
  }

  if (isError) {
    return (
      <ContentLayout header={<Header variant="h1">Race statistics</Header>}>
        <Box textAlign="center" padding={{ top: 'xxxl' }}>
          <Alert type="error" header="Failed to load race statistics">
            Please try again. If the problem persists, contact an administrator.
          </Alert>
        </Box>
      </ContentLayout>
    );
  }

  if (!stats) {
    return (
      <ContentLayout header={<Header variant="h1">Race statistics</Header>}>
        <Box textAlign="center" padding={{ top: 'xxxl' }}>
          <StatusIndicator type="info">
            No statistics available yet. Statistics are computed after each race submission.
          </StatusIndicator>
        </Box>
      </ContentLayout>
    );
  }

  const completionRate = stats.totalLaps > 0 ? Math.round((stats.totalValidLaps / stats.totalLaps) * 100) : 0;

  const avgRacesPerEvent = stats.totalEvents > 0 ? (stats.totalRaces / stats.totalEvents).toFixed(1) : '—';

  const avgLapsPerRace = stats.totalRaces > 0 ? (stats.totalValidLaps / stats.totalRaces).toFixed(1) : '—';

  // Events by country bar chart data
  const countryChartData = (stats.eventsByCountry ?? []).slice(0, 10);

  // Activity over time line chart — events per month
  const monthlyData = stats.eventsByMonth ?? [];

  // Event type pie chart
  const pieData = (stats.eventTypeBreakdown ?? []).map((entry, i) => {
    const colors = ['#0073bb', '#ec7211', '#1d8348', '#884ea0', '#7e5109'];
    return {
      title: entry.typeOfEvent.replaceAll('_', ' '),
      value: entry.count,
      color: colors[i % colors.length],
    };
  });

  return (
    <ContentLayout header={<Header variant="h1">Race statistics</Header>}>
      <SpaceBetween direction="vertical" size="l">
        {/* Primary KPIs — mirrors DREM top row */}
        <Container header={<Header variant="h2">Summary</Header>}>
          <ColumnLayout columns={5} variant="text-grid">
            <KpiCard title="Total events" value={stats.totalEvents} />
            <KpiCard title="Total racers" value={stats.totalRacers} />
            <KpiCard
              title="Valid laps"
              value={stats.totalValidLaps.toLocaleString()}
              description={`${stats.totalLaps.toLocaleString()} total`}
            />
            <KpiCard title="Countries" value={stats.totalCountries} />
            <KpiCard title="Completion rate" value={`${completionRate}%`} description="Valid / total laps" />
          </ColumnLayout>
        </Container>

        {/* Performance KPIs */}
        <Container header={<Header variant="h2">Performance</Header>}>
          <ColumnLayout columns={4} variant="text-grid">
            <KpiCard title="Total races" value={stats.totalRaces} description={`${avgRacesPerEvent} avg per event`} />
            <KpiCard
              title="Average lap time"
              value={formatLapTime(stats.averageLapTimeMilliseconds)}
              description="Across all valid laps"
            />
            <KpiCard title="Avg laps per race" value={avgLapsPerRace} description="Valid laps only" />
            <KpiCard
              title="Fastest lap ever"
              value={
                stats.fastestLapsEver.length > 0 ? formatLapTime(stats.fastestLapsEver[0].lapTimeMilliseconds) : '—'
              }
              description={stats.fastestLapsEver.length > 0 ? stats.fastestLapsEver[0].participantName : undefined}
            />
          </ColumnLayout>
        </Container>

        {/* Events by country — bar chart (mirrors DREM) */}
        {countryChartData.length > 0 && (
          <Container header={<Header variant="h2">Events by country</Header>}>
            <BarChart
              series={[
                {
                  title: 'Events',
                  type: 'bar',
                  data: countryChartData.map((c) => ({ x: c.countryCode, y: c.events })),
                  color: '#0073bb',
                },
              ]}
              xDomain={countryChartData.map((c) => c.countryCode)}
              yDomain={[0, Math.max(...countryChartData.map((c) => c.events)) * 1.2]}
              i18nStrings={{
                xTickFormatter: String,
                yTickFormatter: (v) => String(Math.round(Number(v))),
              }}
              ariaLabel="Events by country"
              height={250}
              hideFilter
              hideLegend
              empty={<Box textAlign="center">No data</Box>}
              noMatch={<Box textAlign="center">No match</Box>}
            />
          </Container>
        )}

        {/* Activity over time — line chart (mirrors DREM) */}
        {monthlyData.length > 0 && (
          <Container header={<Header variant="h2">Activity over time</Header>}>
            <LineChart
              series={[
                {
                  title: 'Events',
                  type: 'line',
                  data: monthlyData.map((m) => ({ x: toLocalMonth(m.month), y: m.events })),
                  color: '#0073bb',
                },
                {
                  title: 'Races',
                  type: 'line',
                  data: monthlyData.map((m) => ({ x: toLocalMonth(m.month), y: m.races })),
                  color: '#ec7211',
                },
                {
                  title: 'Laps',
                  type: 'line',
                  data: monthlyData.map((m) => ({ x: toLocalMonth(m.month), y: m.laps })),
                  color: '#1d8348',
                },
              ]}
              xScaleType="time"
              xTitle="Month"
              yTitle="Count"
              i18nStrings={{
                xTickFormatter: (d) =>
                  d instanceof Date ? d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : String(d),
                yTickFormatter: (v) => String(Math.round(Number(v))),
              }}
              ariaLabel="Activity over time"
              height={250}
              hideFilter
              empty={<Box textAlign="center">No data</Box>}
              noMatch={<Box textAlign="center">No match</Box>}
            />
          </Container>
        )}

        {/* Event type breakdown — pie chart (mirrors DREM) */}
        {pieData.length > 0 && (
          <Container header={<Header variant="h2">Event type breakdown</Header>}>
            <PieChart
              data={pieData}
              detailPopoverContent={(datum) => [
                { key: 'Count', value: datum.value.toLocaleString() },
                {
                  key: 'Percentage',
                  value: `${Math.round((datum.value / stats.eventTypeBreakdown.reduce((s, e) => s + e.count, 0)) * 100)}%`,
                },
              ]}
              segmentDescription={(datum, sum) =>
                `${datum.value.toLocaleString()} events (${Math.round((datum.value / sum) * 100)}%)`
              }
              ariaDescription="Event type breakdown"
              ariaLabel="Event type pie chart"
              size="medium"
              hideFilter
              empty={<Box textAlign="center">No data</Box>}
              noMatch={<Box textAlign="center">No match</Box>}
              i18nStrings={{
                detailsValue: 'Value',
                detailsPercentage: 'Percentage',
                chartAriaRoleDescription: 'pie chart',
                segmentAriaRoleDescription: 'segment',
              }}
            />
          </Container>
        )}

        {/* Fastest laps table */}
        <Table<FastestLapEntry>
          header={
            <Header
              variant="h2"
              counter={stats.fastestLapsEver.length > 0 ? `(${stats.fastestLapsEver.length})` : undefined}
            >
              Fastest laps ever
            </Header>
          }
          columnDefinitions={buildFastestLapsColumnDefs(stats.fastestLapsEver)}
          items={stats.fastestLapsEver}
          empty={
            <Box textAlign="center" color="text-body-secondary" padding="m">
              <StatusIndicator type="info">No lap times recorded yet.</StatusIndicator>
            </Box>
          }
          variant="embedded"
          stickyHeader
        />
      </SpaceBetween>
    </ContentLayout>
  );
};

export default RaceStats;
