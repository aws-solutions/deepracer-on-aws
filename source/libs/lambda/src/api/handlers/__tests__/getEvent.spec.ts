// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { eventDao, TEST_EVENT_ID, TEST_EVENT_ITEM, TEST_ITEM_NOT_FOUND_ERROR } from '@deepracer-indy/database';
import { NotAuthorizedError } from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { GetEventOperation } from '../getEvent.js';

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserMemberOf: (...args: unknown[]) => mockIsUserMemberOf(...args) };
});

const mockIsUserMemberOf = vi.fn().mockResolvedValue(true);

describe('GetEvent operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsUserMemberOf.mockResolvedValue(true);
  });

  it('should throw NotAuthorizedError when caller is not a member of any allowed group', async () => {
    mockIsUserMemberOf.mockResolvedValueOnce(false);

    await expect(GetEventOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      NotAuthorizedError,
    );
  });

  it('should return the event', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(TEST_EVENT_ITEM);

    const output = await GetEventOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT);

    expect(output.event.eventId).toEqual(TEST_EVENT_ID);
    expect(output.event.name).toEqual(TEST_EVENT_ITEM.name);
  });

  it('should throw NotFoundError if event does not exist', async () => {
    vi.spyOn(eventDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(GetEventOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      TEST_ITEM_NOT_FOUND_ERROR,
    );
  });
});
