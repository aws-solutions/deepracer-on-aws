// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CollectionPreferencesProps } from '@cloudscape-design/components/collection-preferences';
import { TableProps } from '@cloudscape-design/components/table';
import { Event } from '@deepracer-indy/typescript-client';
import { describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { fireEvent, render, screen } from '#utils/testUtils';

import { EventsTablePreferences } from './EventsTableConfig';

const mockPreferences: CollectionPreferencesProps.Preferences = {
  pageSize: 10,
  contentDisplay: [],
};

const mockColumnDefinitions: TableProps.ColumnDefinition<Event>[] = [
  { id: 'Name', header: 'Event Name', cell: (item) => item.name, isRowHeader: true },
  { id: 'Status', header: 'Status', cell: (item) => item.eventStatus },
  // Non-string header — exercises the col.id fallback branch in contentDisplayPreference
  { id: 'EventType', header: <span>Type</span>, cell: (item) => item.eventType },
];

const openPanel = () => {
  // CollectionPreferences renders a trigger button; click it to open the panel
  const triggerButton = screen.getByRole('button', {
    name: i18n.t('events:list.preferences.title'),
  });
  fireEvent.click(triggerButton);
};

describe('<EventsTablePreferences />', () => {
  it('renders the trigger button', () => {
    render(
      <EventsTablePreferences
        preferences={mockPreferences}
        onConfirm={vi.fn()}
        columnDefinitions={mockColumnDefinitions}
      />,
    );

    expect(screen.getByRole('button', { name: i18n.t('events:list.preferences.title') })).toBeInTheDocument();
  });

  it('renders panel content after opening', () => {
    render(
      <EventsTablePreferences
        preferences={mockPreferences}
        onConfirm={vi.fn()}
        columnDefinitions={mockColumnDefinitions}
      />,
    );

    openPanel();

    expect(screen.getByText(i18n.t('events:list.preferences.contentDisplayTitle'))).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();

    render(
      <EventsTablePreferences
        preferences={mockPreferences}
        onConfirm={onConfirm}
        columnDefinitions={mockColumnDefinitions}
      />,
    );

    openPanel();
    fireEvent.click(screen.getByText(i18n.t('events:list.preferences.confirmLabel')));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('uses col.id as label fallback when header is not a string', () => {
    render(
      <EventsTablePreferences
        preferences={mockPreferences}
        onConfirm={vi.fn()}
        columnDefinitions={mockColumnDefinitions}
      />,
    );

    openPanel();

    // The JSX-header column (EventType) falls back to its id in the content display options
    expect(screen.getByText('EventType')).toBeInTheDocument();
  });

  it('falls back to an empty string id and label when col.id is undefined', () => {
    const columnsWithUndefinedId: TableProps.ColumnDefinition<Event>[] = [
      { id: 'Name', header: 'Event Name', cell: (item) => item.name, isRowHeader: true },
      { header: <span>No Id Column</span>, cell: (item) => item.eventType },
    ];

    render(
      <EventsTablePreferences
        preferences={mockPreferences}
        onConfirm={vi.fn()}
        columnDefinitions={columnsWithUndefinedId}
      />,
    );

    expect(() => openPanel()).not.toThrow();
  });
});
