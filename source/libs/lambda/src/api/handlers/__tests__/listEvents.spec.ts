// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { eventDao, TEST_EVENT_ITEM } from '@deepracer-indy/database';
import { EventStatus, NotAuthorizedError } from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { ListEventsOperation } from '../listEvents.js';

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserMemberOf: (...args: unknown[]) => mockIsUserMemberOf(...args) };
});

const mockIsUserMemberOf = vi.fn().mockResolvedValue(true);

describe('ListEvents operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsUserMemberOf.mockResolvedValue(true);
  });

  it('should throw NotAuthorizedError when caller is not a member of any allowed group', async () => {
    mockIsUserMemberOf.mockResolvedValueOnce(false);

    await expect(ListEventsOperation({}, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotAuthorizedError);
  });

  it('should return a list of events', async () => {
    vi.spyOn(eventDao, 'list').mockResolvedValue({ cursor: null, data: [TEST_EVENT_ITEM] });

    const output = await ListEventsOperation({}, TEST_OPERATION_CONTEXT);

    expect(output.events).toHaveLength(1);
    expect(output.events[0].eventId).toEqual(TEST_EVENT_ITEM.eventId);
  });

  it('should forward pagination token', async () => {
    const listSpy = vi.spyOn(eventDao, 'list').mockResolvedValue({ cursor: 'next-token', data: [TEST_EVENT_ITEM] });

    const output = await ListEventsOperation({ token: 'some-token' }, TEST_OPERATION_CONTEXT);

    expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'some-token' }));
    expect(output.token).toEqual('next-token');
  });

  it('should forward status filter', async () => {
    const listSpy = vi.spyOn(eventDao, 'list').mockResolvedValue({ cursor: null, data: [] });

    await ListEventsOperation({ status: EventStatus.OPEN }, TEST_OPERATION_CONTEXT);

    expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ status: EventStatus.OPEN }));
  });

  it('should return undefined token when no next page', async () => {
    vi.spyOn(eventDao, 'list').mockResolvedValue({ cursor: null, data: [] });

    const output = await ListEventsOperation({}, TEST_OPERATION_CONTEXT);

    expect(output.token).toBeUndefined();
  });
});
