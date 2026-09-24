// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { rankingDao } from '@deepracer-indy/database';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-vitest';

import {
  publishEmptyLeaderboardPlaceholder,
  publishLeaderboardToS3,
  sanitizeDisplayField,
} from '../publicLeaderboardS3.js';

vi.mock('@deepracer-indy/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deepracer-indy/database')>();
  return {
    ...actual,
    rankingDao: { listByRank: vi.fn() },
  };
});

const mockRankingDao = vi.mocked(rankingDao);
const mockS3Client = mockClient(S3Client);
const TEST_BUCKET = 'test-public-leaderboard-bucket';

describe('sanitizeDisplayField', () => {
  it('HTML-encodes unsafe characters', () => {
    expect(sanitizeDisplayField('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('returns an empty string for null/undefined', () => {
    expect(sanitizeDisplayField(null)).toBe('');
    expect(sanitizeDisplayField(undefined)).toBe('');
  });
});

describe('publishLeaderboardToS3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockS3Client.reset();
    mockS3Client.on(PutObjectCommand).resolves({});
    mockRankingDao.listByRank.mockResolvedValue({ data: [], cursor: null } as never);
  });

  it('writes rankings JSON to the correct S3 key for the given bucket', async () => {
    await publishLeaderboardToS3(TEST_BUCKET, 'lb-1' as never);

    const calls = mockS3Client.commandCalls(PutObjectCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.Bucket).toBe(TEST_BUCKET);
    expect(calls[0].args[0].input.Key).toBe('public/leaderboards/lb-1.json');
  });

  it("surfaces each racer's countryCode as the entry country, and blanks it when the racer has none", async () => {
    mockRankingDao.listByRank.mockResolvedValue({
      data: [
        { rankingScore: 10000, userProfile: { alias: 'Alice', countryCode: 'US' }, modelName: 'SpeedBot' },
        { rankingScore: 11000, userProfile: { alias: 'Bob' }, modelName: 'FastBot' },
      ],
      cursor: null,
    } as never);

    await publishLeaderboardToS3(TEST_BUCKET, 'lb-1' as never);

    const body = JSON.parse(mockS3Client.commandCalls(PutObjectCommand)[0].args[0].input.Body as string);
    expect(body.rankings[0]).toMatchObject({ participantName: 'Alice', country: 'US' });
    expect(body.rankings[1].country).toBe('');
  });
});

describe('publishEmptyLeaderboardPlaceholder', () => {
  beforeEach(() => {
    mockS3Client.reset();
    mockS3Client.on(PutObjectCommand).resolves({});
  });

  it('writes an empty-rankings placeholder using a conditional (IfNoneMatch) write', async () => {
    await publishEmptyLeaderboardPlaceholder(TEST_BUCKET, 'lb-1' as never);

    const calls = mockS3Client.commandCalls(PutObjectCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input).toMatchObject({
      Bucket: TEST_BUCKET,
      Key: 'public/leaderboards/lb-1.json',
      ContentType: 'application/json',
      IfNoneMatch: '*',
    });
    const body = JSON.parse(calls[0].args[0].input.Body as string);
    expect(body).toMatchObject({ leaderboardId: 'lb-1', rankings: [] });
    expect(body.name).toBeUndefined();
    expect(body.footer).toBeUndefined();
  });

  it('includes a sanitized name and footer when provided, so the header/footer are correct before the first real result', async () => {
    await publishEmptyLeaderboardPlaceholder(TEST_BUCKET, 'lb-1' as never, '<b>Track One</b>', 'Sponsored & Presented');

    const calls = mockS3Client.commandCalls(PutObjectCommand);
    const body = JSON.parse(calls[0].args[0].input.Body as string);
    expect(body.name).toBe('&lt;b&gt;Track One&lt;/b&gt;');
    expect(body.footer).toBe('Sponsored &amp; Presented');
  });

  it('propagates a PreconditionFailed-style rejection so callers can treat "already exists" as a no-op', async () => {
    const preconditionFailed = new Error('At least one of the pre-conditions you specified did not hold');
    preconditionFailed.name = 'PreconditionFailed';
    mockS3Client.on(PutObjectCommand).rejects(preconditionFailed);

    await expect(publishEmptyLeaderboardPlaceholder(TEST_BUCKET, 'lb-1' as never)).rejects.toMatchObject({
      name: 'PreconditionFailed',
    });
  });
});
