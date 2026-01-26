// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Profile } from '@deepracer-indy/typescript-client';
import { screen } from '@testing-library/react';
import { describe, expect, it, Mock, vi } from 'vitest';

import { useGetProfileQuery } from '#services/deepRacer/profileApi.js';
import { render } from '#utils/testUtils';

import HoursPieChart from '../HoursPieChart';

vi.mock('#services/deepRacer/profileApi.js', () => ({
  useGetProfileQuery: vi.fn(),
}));

describe('HoursPieChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render pie chart with test id', () => {
    (useGetProfileQuery as Mock).mockReturnValue({
      data: {
        computeMinutesUsed: 120,
        maxTotalComputeMinutes: 600,
      } as Profile,
    });

    render(<HoursPieChart />);

    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('should display used hours in center for limited compute hours', () => {
    (useGetProfileQuery as Mock).mockReturnValue({
      data: {
        computeMinutesUsed: 120,
        maxTotalComputeMinutes: 600,
      } as Profile,
    });

    render(<HoursPieChart />);

    const pieChart = screen.getByTestId('pie-chart');
    expect(pieChart).toBeInTheDocument();

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should display used hours in center for unlimited compute hours', () => {
    (useGetProfileQuery as Mock).mockReturnValue({
      data: {
        computeMinutesUsed: 180,
        maxTotalComputeMinutes: -1,
      } as Profile,
    });

    render(<HoursPieChart />);

    const pieChart = screen.getByTestId('pie-chart');
    expect(pieChart).toBeInTheDocument();

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should handle zero compute minutes used', () => {
    (useGetProfileQuery as Mock).mockReturnValue({
      data: {
        computeMinutesUsed: 0,
        maxTotalComputeMinutes: 600,
      } as Profile,
    });

    render(<HoursPieChart />);

    const pieChart = screen.getByTestId('pie-chart');
    expect(pieChart).toBeInTheDocument();

    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should handle fractional hours correctly', () => {
    (useGetProfileQuery as Mock).mockReturnValue({
      data: {
        computeMinutesUsed: 90,
        maxTotalComputeMinutes: 600,
      } as Profile,
    });

    render(<HoursPieChart />);

    const pieChart = screen.getByTestId('pie-chart');
    expect(pieChart).toBeInTheDocument();

    expect(screen.getByText('1.5')).toBeInTheDocument();
  });

  it('should handle small fractional hours with proper rounding', () => {
    (useGetProfileQuery as Mock).mockReturnValue({
      data: {
        computeMinutesUsed: 7,
        maxTotalComputeMinutes: 600,
      } as Profile,
    });

    render(<HoursPieChart />);

    const pieChart = screen.getByTestId('pie-chart');
    expect(pieChart).toBeInTheDocument();

    expect(screen.getByText('0.12')).toBeInTheDocument();
  });

  it('should display "Hours used" as inner metric description', () => {
    (useGetProfileQuery as Mock).mockReturnValue({
      data: {
        computeMinutesUsed: 120,
        maxTotalComputeMinutes: 600,
      } as Profile,
    });

    render(<HoursPieChart />);

    expect(screen.getByText('Hours used')).toBeInTheDocument();
  });

  it('should handle edge case where used minutes exceed max minutes', () => {
    (useGetProfileQuery as Mock).mockReturnValue({
      data: {
        computeMinutesUsed: 720,
        maxTotalComputeMinutes: 600,
      } as Profile,
    });

    render(<HoursPieChart />);

    const pieChart = screen.getByTestId('pie-chart');
    expect(pieChart).toBeInTheDocument();

    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('should render donut variant pie chart', () => {
    (useGetProfileQuery as Mock).mockReturnValue({
      data: {
        computeMinutesUsed: 120,
        maxTotalComputeMinutes: 600,
      } as Profile,
    });

    render(<HoursPieChart />);

    const pieChart = screen.getByTestId('pie-chart');
    expect(pieChart).toBeInTheDocument();

    expect(screen.getByText('Hours used')).toBeInTheDocument();
  });

  it('should handle very large numbers correctly', () => {
    (useGetProfileQuery as Mock).mockReturnValue({
      data: {
        computeMinutesUsed: 60000,
        maxTotalComputeMinutes: 120000,
      } as Profile,
    });

    render(<HoursPieChart />);

    const pieChart = screen.getByTestId('pie-chart');
    expect(pieChart).toBeInTheDocument();

    expect(screen.getByText('1000')).toBeInTheDocument();
  });

  it('should convert minutes to hours with 2 decimal precision', () => {
    (useGetProfileQuery as Mock).mockReturnValue({
      data: {
        computeMinutesUsed: 123,
        maxTotalComputeMinutes: 600,
      } as Profile,
    });

    render(<HoursPieChart />);

    const pieChart = screen.getByTestId('pie-chart');
    expect(pieChart).toBeInTheDocument();

    expect(screen.getByText('2.05')).toBeInTheDocument();
  });

  it('should handle unlimited compute hours scenario correctly', () => {
    (useGetProfileQuery as Mock).mockReturnValue({
      data: {
        computeMinutesUsed: 300,
        maxTotalComputeMinutes: -1,
      } as Profile,
    });

    render(<HoursPieChart />);

    const pieChart = screen.getByTestId('pie-chart');
    expect(pieChart).toBeInTheDocument();

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Hours used')).toBeInTheDocument();
  });

  it('should render with hideFilter and hideTitles props', () => {
    (useGetProfileQuery as Mock).mockReturnValue({
      data: {
        computeMinutesUsed: 120,
        maxTotalComputeMinutes: 600,
      } as Profile,
    });

    render(<HoursPieChart />);

    const pieChart = screen.getByTestId('pie-chart');
    expect(pieChart).toBeInTheDocument();
  });
});
