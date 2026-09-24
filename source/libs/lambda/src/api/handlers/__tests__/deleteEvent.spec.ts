// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { eventDao, TEST_EVENT_ID, TEST_ITEM_NOT_FOUND_ERROR } from '@deepracer-indy/database';
import { EventStatus, NotAuthorizedError } from '@deepracer-indy/typescript-server-client';
import { mockClient } from 'aws-sdk-client-mock';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { DeleteEventOperation } from '../deleteEvent.js';

vi.mock('../../../utils/clients/sqsClient.js', () => ({
  sqsClient: new SQSClient({}),
}));

const mockSqsClient = mockClient(SQSClient);
const EVENT_DELETE_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789012/event-delete';
vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdmin: (...args: unknown[]) => mockIsUserAdmin(...args) };
});

const mockIsUserAdmin = vi.fn().mockResolvedValue(true);

describe('DeleteEvent operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsUserAdmin.mockResolvedValue(true);
    mockSqsClient.reset();
    mockSqsClient.on(SendMessageCommand).resolves({});
    process.env.EVENT_DELETE_QUEUE_URL = EVENT_DELETE_QUEUE_URL;
  });

  afterEach(() => {
    delete process.env.EVENT_DELETE_QUEUE_URL;
  });

  it('should throw NotAuthorizedError when caller is not an administrator', async () => {
    mockIsUserAdmin.mockResolvedValueOnce(false);

    await expect(DeleteEventOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      NotAuthorizedError,
    );
  });

  it('should transition event to DELETING and return 202 body', async () => {
    const transitionSpy = vi.spyOn(eventDao, 'transitionToDeleting').mockResolvedValue({} as never);

    const output = await DeleteEventOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT);

    expect(transitionSpy).toHaveBeenCalledWith(TEST_EVENT_ID);
    expect(mockSqsClient).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: EVENT_DELETE_QUEUE_URL,
      MessageBody: JSON.stringify({ eventId: TEST_EVENT_ID }),
    });
    expect(output).toEqual({
      eventId: TEST_EVENT_ID,
      status: EventStatus.DELETING,
      message: 'Event deletion initiated. All associated data will be removed asynchronously.',
    });
  });

  it('should return idempotent 202 body without enqueueing when already deleting', async () => {
    const condError = Object.assign(new Error('The conditional request failed'), {
      name: 'ConditionalCheckFailedException',
    });
    vi.spyOn(eventDao, 'transitionToDeleting').mockRejectedValue(condError);

    const output = await DeleteEventOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT);

    expect(mockSqsClient).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: EVENT_DELETE_QUEUE_URL,
      MessageBody: JSON.stringify({ eventId: TEST_EVENT_ID }),
    });
    expect(output).toEqual({
      eventId: TEST_EVENT_ID,
      status: EventStatus.DELETING,
      message: 'Event deletion already in progress.',
    });
  });

  it('should return idempotent 202 body when ConditionalCheckFailedException is wrapped in cause', async () => {
    const wrappedError = Object.assign(new Error('wrapped'), {
      cause: { name: 'ConditionalCheckFailedException' },
    });
    vi.spyOn(eventDao, 'transitionToDeleting').mockRejectedValue(wrappedError);

    const output = await DeleteEventOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT);

    expect(mockSqsClient).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: EVENT_DELETE_QUEUE_URL,
      MessageBody: JSON.stringify({ eventId: TEST_EVENT_ID }),
    });
    expect(output).toEqual({
      eventId: TEST_EVENT_ID,
      status: EventStatus.DELETING,
      message: 'Event deletion already in progress.',
    });
  });

  it('re-enqueues on retry after the initial queue send fails', async () => {
    const conditionalError = Object.assign(new Error('The conditional request failed'), {
      name: 'ConditionalCheckFailedException',
    });
    const queueError = new Error('SQS unavailable');
    vi.spyOn(eventDao, 'transitionToDeleting')
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(conditionalError);
    mockSqsClient.on(SendMessageCommand).rejectsOnce(queueError).resolves({});

    await expect(DeleteEventOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      queueError,
    );

    const output = await DeleteEventOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT);

    expect(output).toEqual({
      eventId: TEST_EVENT_ID,
      status: EventStatus.DELETING,
      message: 'Event deletion already in progress.',
    });
    expect(mockSqsClient.commandCalls(SendMessageCommand)).toHaveLength(2);
    expect(mockSqsClient.commandCalls(SendMessageCommand)[1].args[0].input).toEqual({
      QueueUrl: EVENT_DELETE_QUEUE_URL,
      MessageBody: JSON.stringify({ eventId: TEST_EVENT_ID }),
    });
  });

  it('should propagate non-conditional transition errors without enqueueing', async () => {
    vi.spyOn(eventDao, 'transitionToDeleting').mockRejectedValue(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(DeleteEventOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      TEST_ITEM_NOT_FOUND_ERROR,
    );
    expect(mockSqsClient).not.toHaveReceivedCommand(SendMessageCommand);
  });

  it('should fail if the queue URL is not configured', async () => {
    delete process.env.EVENT_DELETE_QUEUE_URL;
    const transitionSpy = vi.spyOn(eventDao, 'transitionToDeleting').mockResolvedValue({} as never);

    await expect(DeleteEventOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      'EVENT_DELETE_QUEUE_URL environment variable is not configured',
    );
    expect(transitionSpy).not.toHaveBeenCalled();
  });

  it('should propagate queue send failures', async () => {
    const queueError = new Error('SQS unavailable');
    mockSqsClient.on(SendMessageCommand).rejects(queueError);
    vi.spyOn(eventDao, 'transitionToDeleting').mockResolvedValue({} as never);

    await expect(DeleteEventOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      queueError,
    );
  });
});
