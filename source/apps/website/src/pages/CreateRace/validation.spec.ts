// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as Yup from 'yup';

import { validateStartTime, validateStartDate, validateEndDate, validateEndTime } from './validation';
import i18n from '../../i18n/index.js';

// Mock the current date for consistent testing
const mockCurrentDate = '2024-06-15';
const mockCurrentTime = '10:30';
const mockDate = new Date(`${mockCurrentDate}T${mockCurrentTime}:00Z`);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(mockDate);
});

afterEach(() => {
  vi.useRealTimers();
});

const createContext = (values?: Record<string, string | null>) =>
  ({
    parent: { ...values },
    createError: vi.fn((options) => new Error(options.message)),
  }) as unknown as Yup.TestContext;

describe('validateStartTime', () => {
  it('should return true when no start date is provided', () => {
    const context = createContext({ startDate: null });
    const result = validateStartTime.call(context, '14:00', context);
    expect(result).toBe(true);
  });

  it('should return true when start time is in the future', () => {
    const context = createContext({ startDate: '2024-06-15' });
    const result = validateStartTime.call(context, '11:00', context);
    expect(result).toBe(true);
  });

  it('should return error when start time is in the past', () => {
    const context = createContext({ startDate: mockCurrentDate });
    const result = validateStartTime.call(context, '09:00', context);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe(i18n.t('createRace:addRaceDetails.validationErrors.startTimeInPast'));
  });

  it('should return error when start time is exactly now', () => {
    const context = createContext({ startDate: mockCurrentDate });
    const result = validateStartTime.call(context, mockCurrentTime, context);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe(i18n.t('createRace:addRaceDetails.validationErrors.startTimeInPast'));
  });

  it('should return true when start date is in the future', () => {
    const context = createContext({ startDate: '2024-06-16' });
    const result = validateStartTime.call(context, '09:00', context);
    expect(result).toBe(true);
  });
});

describe('validateStartDate', () => {
  it('should return true when start date is today', () => {
    const context = createContext();
    const result = validateStartDate.call(context, mockCurrentDate, context);
    expect(result).toBe(true);
  });

  it('should return true when start date is in the future', () => {
    const context = createContext();
    const result = validateStartDate.call(context, '2024-06-16', context);
    expect(result).toBe(true);
  });

  it('should return error when start date is in the past', () => {
    const context = createContext();
    const result = validateStartDate.call(context, '2024-06-14', context);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe(i18n.t('createRace:addRaceDetails.validationErrors.startDateInPast'));
  });
});

describe('validateEndDate', () => {
  it('should return true when end date is after start date', () => {
    const context = createContext({ startDate: mockCurrentDate });
    const result = validateEndDate.call(context, '2024-06-16', context);
    expect(result).toBe(true);
  });

  it('should return true when end date is same as start date', () => {
    const context = createContext({ startDate: mockCurrentDate });
    const result = validateEndDate.call(context, mockCurrentDate, context);
    expect(result).toBe(true);
  });

  it('should return error when end date is before start date', () => {
    const context = createContext({ startDate: mockCurrentDate });
    const result = validateEndDate.call(context, '2024-06-14', context);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe(i18n.t('createRace:addRaceDetails.validationErrors.endDateBeforeStartDate'));
  });
});

describe('validateEndTime', () => {
  it('should return true when no start date is provided', () => {
    const context = createContext({});
    const result = validateEndTime.call(context, '14:00', context);
    expect(result).toBe(true);
  });

  it('should return true when no start time is provided', () => {
    const context = createContext({ startDate: mockCurrentDate });
    const result = validateEndTime.call(context, '14:00', context);
    expect(result).toBe(true);
  });

  it('should return true when end time is after start time', () => {
    const context = createContext({ startDate: mockCurrentDate, startTime: '10:00', endDate: mockCurrentDate });
    const result = validateEndTime.call(context, '11:00', context);
    expect(result).toBe(true);
  });

  it('should return error when end time is before start time', () => {
    const context = createContext({ startDate: mockCurrentDate, startTime: '10:00', endDate: mockCurrentDate });
    const result = validateEndTime.call(context, '09:00', context);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe(i18n.t('createRace:addRaceDetails.validationErrors.endTimeBeforeStartTime'));
  });

  it('should return error when end time equals start time', () => {
    const context = createContext({ startDate: '2024-06-15', startTime: '10:00', endDate: '2024-06-15' });
    const result = validateEndTime.call(context, '10:00', context);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe(i18n.t('createRace:addRaceDetails.validationErrors.endTimeBeforeStartTime'));
  });
});
