// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import Select, { SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { Event, EventStatus, UserGroups } from '@deepracer-indy/typescript-client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { PageId } from '#constants/pages';
import { useAppDispatch } from '#hooks/useAppDispatch';
import { useDeleteEventMutation, useListEventsQuery } from '#services/deepRacer/eventsApi';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { getPath } from '#utils/pageUtils.js';

import DeleteEventModal from './components/DeleteEventModal';
import { EventsTablePreferences } from './components/EventsTableConfig';
import { useEventsTableConfig } from './components/useEventsTableConfig';

const ALL_STATUSES_VALUE = 'ALL';

const EventList = () => {
  const { t } = useTranslation('events');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPermissionLoading, setIsPermissionLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<EventStatus | typeof ALL_STATUSES_VALUE>(ALL_STATUSES_VALUE);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);

  const { data: allEvents = [], isLoading, isFetching, refetch } = useListEventsQuery({}, { skip: !isAuthorized });
  const [deleteEvent, { isLoading: isDeleting }] = useDeleteEventMutation();

  useEffect(() => {
    const loadPermissions = async () => {
      const [authorized, admin] = await Promise.all([
        checkUserGroupMembership([UserGroups.ADMIN, UserGroups.RACE_FACILITATORS, UserGroups.RACERS]),
        checkUserGroupMembership([UserGroups.ADMIN]),
      ]);
      setIsAuthorized(authorized);
      setIsAdmin(admin);
    };

    loadPermissions()
      .catch((err: unknown) => {
        console.error('Failed to load permissions', err);
      })
      .finally(() => setIsPermissionLoading(false));
  }, []);

  const filteredEvents =
    statusFilter === ALL_STATUSES_VALUE ? allEvents : allEvents.filter((e) => e.eventStatus === statusFilter);

  const {
    collectionProps,
    columnDefinitions,
    columnDisplay,
    items,
    preferencesProps,
    paginationProps,
    selectedItems,
    filterProps,
    filteredItemsCount,
    emptyState,
  } = useEventsTableConfig(filteredEvents);

  const statusOptions: SelectProps.Option[] = [
    { value: ALL_STATUSES_VALUE, label: t('list.filters.allStatuses') },
    ...Object.values(EventStatus).map((status) => ({
      value: status,
      label: t(`status.${status}`),
    })),
  ];

  const handleDelete = useCallback(async () => {
    if (!eventToDelete) return;
    try {
      await deleteEvent({ eventId: eventToDelete.eventId }).unwrap();
      dispatch(
        displaySuccessNotification({
          content: t('list.deleteSuccessMessage', { name: eventToDelete.name }),
          persistForPageChanges: 1,
        }),
      );
      setEventToDelete(null);
    } catch (err: unknown) {
      console.error('Failed to delete event', err);
      dispatch(displayErrorNotification({ content: t('list.deleteErrorMessage', { name: eventToDelete.name }) }));
    }
  }, [deleteEvent, dispatch, eventToDelete, t]);

  const selectedEvent = selectedItems?.[0];

  // filteredItemsCount is set by useCollection when a text filter is active;
  // fall back to filteredEvents.length when no text filter is applied.
  const visibleCount = filteredItemsCount ?? filteredEvents.length;

  if (!isAuthorized && !isPermissionLoading) {
    return (
      <ContentLayout header={<Header variant="h1">{t('unauthorized.header')}</Header>}>
        <p>{t('unauthorized.message')}</p>
      </ContentLayout>
    );
  }

  return (
    <>
      <Table
        {...collectionProps}
        variant="full-page"
        items={items}
        columnDefinitions={columnDefinitions}
        columnDisplay={columnDisplay}
        selectionType="single"
        loading={isLoading || isPermissionLoading}
        loadingText={t('list.loadingText')}
        trackBy="eventId"
        empty={emptyState}
        header={
          <Header
            counter={selectedItems?.length ? `(${selectedItems.length}/${visibleCount})` : `(${visibleCount})`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  ariaLabel={t('list.refreshButtonLabel')}
                  loading={isFetching}
                  onClick={() => refetch()}
                />
                {isAdmin && (
                  <>
                    <Button
                      disabled={!selectedEvent}
                      onClick={() => navigate(getPath(PageId.EDIT_EVENT, { eventId: selectedEvent?.eventId ?? '' }))}
                    >
                      {t('list.editEventButton')}
                    </Button>
                    <Button disabled={!selectedEvent} onClick={() => setEventToDelete(selectedEvent ?? null)}>
                      {t('list.deleteEventButton')}
                    </Button>
                  </>
                )}
                <Button
                  disabled={!selectedEvent}
                  onClick={() => navigate(getPath(PageId.EVENT_DETAIL, { eventId: selectedEvent?.eventId ?? '' }))}
                >
                  {t('list.viewDetailsButton')}
                </Button>
                {isAdmin && (
                  <Button variant="primary" onClick={() => navigate(getPath(PageId.CREATE_EVENT))}>
                    {t('list.createEventButton')}
                  </Button>
                )}
              </SpaceBetween>
            }
          >
            {t('list.header')}
          </Header>
        }
        pagination={
          <Pagination
            {...paginationProps}
            ariaLabels={{
              nextPageLabel: t('list.pagination.nextPageLabel'),
              previousPageLabel: t('list.pagination.previousPageLabel'),
              pageLabel: (pageNumber) => t('list.pagination.pageLabel', { pageNumber }),
            }}
          />
        }
        preferences={<EventsTablePreferences {...preferencesProps} />}
        filter={
          <SpaceBetween direction="horizontal" size="xs">
            <TextFilter
              {...filterProps}
              filteringAriaLabel={t('list.filters.filteringAriaLabel')}
              filteringPlaceholder={t('list.filters.searchFilterPlaceholder')}
              countText={
                filterProps.filteringText ? t('list.filters.matchCount', { count: filteredItemsCount ?? 0 }) : undefined
              }
            />
            <Select
              selectedOption={statusOptions.find((o) => o.value === statusFilter) ?? statusOptions[0]}
              onChange={({ detail }) => {
                setStatusFilter(
                  (detail.selectedOption.value as EventStatus | typeof ALL_STATUSES_VALUE) ?? ALL_STATUSES_VALUE,
                );
              }}
              options={statusOptions}
              ariaLabel={t('list.filters.statusFilterLabel')}
            />
          </SpaceBetween>
        }
      />
      {eventToDelete && (
        <DeleteEventModal
          event={eventToDelete}
          isDeleting={isDeleting}
          onDelete={handleDelete}
          onDismiss={() => setEventToDelete(null)}
        />
      )}
    </>
  );
};

export default EventList;
