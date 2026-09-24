// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { eventDao, TEST_EVENT_ID, TEST_EVENT_ITEM, TEST_ITEM_NOT_FOUND_ERROR } from '@deepracer-indy/database';
import {
  ConflictError,
  EventStatus,
  EventTransitionAction,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { TransitionEventStatusOperation } from '../transitionEventStatus.js';

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdmin: (...args: unknown[]) => mockIsUserAdmin(...args) };
});

const mockIsUserAdmin = vi.fn().mockResolvedValue(true);

// Minimal ElectroDB patch result shape the handler cares about
const PATCH_SUCCESS = { data: { ...TEST_EVENT_ITEM } };

// ConditionalCheckFailedException as thrown by the DynamoDB SDK (wrapped by ElectroDB)
const CONDITIONAL_CHECK_FAILED = Object.assign(new Error('ConditionalCheckFailedException'), {
  cause: { name: 'ConditionalCheckFailedException' },
});

describe('TransitionEventStatus operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsUserAdmin.mockResolvedValue(true);
  });

  it('should throw NotAuthorizedError when caller is not an administrator', async () => {
    mockIsUserAdmin.mockResolvedValueOnce(false);

    await expect(
      TransitionEventStatusOperation(
        { eventId: TEST_EVENT_ID, action: EventTransitionAction.OPEN },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toThrow(NotAuthorizedError);
  });

  it('should transition DRAFT → OPEN', async () => {
    vi.spyOn(eventDao, 'transitionStatus').mockResolvedValue(PATCH_SUCCESS);

    const output = await TransitionEventStatusOperation(
      { eventId: TEST_EVENT_ID, action: EventTransitionAction.OPEN },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.status).toEqual(EventStatus.OPEN);
    expect(eventDao.transitionStatus).toHaveBeenCalledWith(TEST_EVENT_ID, EventStatus.DRAFT, EventStatus.OPEN);
  });

  it('should transition OPEN → IN_PROGRESS', async () => {
    vi.spyOn(eventDao, 'transitionStatus').mockResolvedValue(PATCH_SUCCESS);

    const output = await TransitionEventStatusOperation(
      { eventId: TEST_EVENT_ID, action: EventTransitionAction.START },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.status).toEqual(EventStatus.IN_PROGRESS);
    expect(eventDao.transitionStatus).toHaveBeenCalledWith(TEST_EVENT_ID, EventStatus.OPEN, EventStatus.IN_PROGRESS);
  });

  it('should transition IN_PROGRESS → COMPLETED', async () => {
    vi.spyOn(eventDao, 'transitionStatus').mockResolvedValue(PATCH_SUCCESS);

    const output = await TransitionEventStatusOperation(
      { eventId: TEST_EVENT_ID, action: EventTransitionAction.COMPLETE },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.status).toEqual(EventStatus.COMPLETED);
    expect(eventDao.transitionStatus).toHaveBeenCalledWith(
      TEST_EVENT_ID,
      EventStatus.IN_PROGRESS,
      EventStatus.COMPLETED,
    );
  });

  it('should transition COMPLETED → ARCHIVED', async () => {
    vi.spyOn(eventDao, 'transitionStatus').mockResolvedValue(PATCH_SUCCESS);

    const output = await TransitionEventStatusOperation(
      { eventId: TEST_EVENT_ID, action: EventTransitionAction.ARCHIVE },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.status).toEqual(EventStatus.ARCHIVED);
    expect(eventDao.transitionStatus).toHaveBeenCalledWith(TEST_EVENT_ID, EventStatus.COMPLETED, EventStatus.ARCHIVED);
  });

  it('should throw ConflictError when ConditionalCheckFailedException is returned', async () => {
    vi.spyOn(eventDao, 'transitionStatus').mockRejectedValueOnce(CONDITIONAL_CHECK_FAILED);
    vi.spyOn(eventDao, 'load').mockResolvedValueOnce({ ...TEST_EVENT_ITEM, eventStatus: EventStatus.IN_PROGRESS });

    await expect(
      TransitionEventStatusOperation(
        { eventId: TEST_EVENT_ID, action: EventTransitionAction.OPEN },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('should propagate non-conditional errors', async () => {
    vi.spyOn(eventDao, 'transitionStatus').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(
      TransitionEventStatusOperation(
        { eventId: TEST_EVENT_ID, action: EventTransitionAction.OPEN },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });

  it('should throw NotFoundError when the event does not exist (conditional check + load throws)', async () => {
    vi.spyOn(eventDao, 'transitionStatus').mockRejectedValueOnce(CONDITIONAL_CHECK_FAILED);
    vi.spyOn(eventDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(
      TransitionEventStatusOperation(
        { eventId: TEST_EVENT_ID, action: EventTransitionAction.OPEN },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });
});
