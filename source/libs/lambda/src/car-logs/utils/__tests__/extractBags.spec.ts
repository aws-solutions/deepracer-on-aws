// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';

import { logger } from '@deepracer-indy/utils';
import { pack as tarPack } from 'tar-stream';

import { extractBags } from '../extractBags.js';
import { CarLogJobError } from '../jobErrors.js';

type Entry = { name: string; type?: 'file' | 'directory' | 'symlink'; content?: string; linkname?: string };

async function buildArchive(entries: Entry[]): Promise<Readable> {
  const pack = tarPack();
  for (const entry of entries) {
    pack.entry(
      { name: entry.name, type: entry.type ?? 'file', linkname: entry.linkname },
      entry.type === 'directory' || entry.type === 'symlink' ? undefined : (entry.content ?? ''),
    );
  }
  pack.finalize();
  const chunks: Buffer[] = [];
  for await (const chunk of pack) {
    chunks.push(chunk as Buffer);
  }
  return Readable.from([gzipSync(Buffer.concat(chunks))]);
}

const collect = async (stream: Readable) => {
  let text = '';
  for await (const chunk of stream) {
    text += chunk.toString();
  }
  return text;
};

describe('extractBags', () => {
  const written: Record<string, string> = {};
  const write = vi.fn(async (_ctx: string, bagDir: string, rel: string, body: Readable) => {
    // The S3 upload client rejects anything that is not a Node Readable.
    expect(body).toBeInstanceOf(Readable);
    written[`${bagDir}/${rel}`] = await collect(body);
  });

  beforeEach(() => {
    Object.keys(written).forEach((key) => delete written[key]);
    write.mockClear();
  });

  it('writes the files of accepted bags and skips the others', async () => {
    const archive = await buildArchive([
      { name: 'good/', type: 'directory' },
      { name: 'good/metadata.yaml', content: 'meta' },
      { name: 'good/good_0.db3', content: 'data' },
      { name: 'other/metadata.yaml', content: 'nope' },
    ]);

    const result = await extractBags(archive, {
      resolve: async (bagDir) =>
        bagDir === 'good' ? { accept: true, context: 'ctx' } : { accept: false, reason: 'unknown' },
      write,
    });

    expect(written).toEqual({ 'good/metadata.yaml': 'meta', 'good/good_0.db3': 'data' });
    expect(result.accepted).toEqual([{ bagDir: 'good', context: 'ctx', files: ['metadata.yaml', 'good_0.db3'] }]);
    expect(result.skipped).toEqual([{ bagDir: 'other', reason: 'unknown' }]);
  });

  it('resolves each bag directory once', async () => {
    const archive = await buildArchive([
      { name: 'good/a', content: '1' },
      { name: 'good/b', content: '2' },
    ]);
    const resolve = vi.fn(async () => ({ accept: true as const, context: 'ctx' }));

    await extractBags(archive, { resolve, write });

    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['path traversal', [{ name: 'good/../../evil', content: 'x' }]],
    ['a symlink', [{ name: 'good/link', type: 'symlink' as const, linkname: '/etc/passwd' }]],
    ['a loose file at the root', [{ name: 'loose.txt', content: 'x' }]],
  ])('aborts on %s before writing anything for it', async (_label, entries) => {
    const archive = await buildArchive(entries);

    await expect(
      extractBags(archive, { resolve: async () => ({ accept: true, context: 'ctx' }), write }),
    ).rejects.toThrow(CarLogJobError);
    expect(write).not.toHaveBeenCalled();
  });

  it('aborts when the extracted size exceeds the limit', async () => {
    const archive = await buildArchive([{ name: 'good/big', content: 'x'.repeat(100) }]);

    await expect(
      extractBags(archive, {
        resolve: async () => ({ accept: true, context: 'ctx' }),
        write,
        limits: { maxEntries: 10, maxEntryBytes: 1000, maxTotalBytes: 50 },
      }),
    ).rejects.toThrow(/exceeds the allowed size/);
  });

  it('reports archives that are not gzip as unreadable', async () => {
    await expect(
      extractBags(Readable.from([Buffer.from('not a tar')]), {
        resolve: async () => ({ accept: true, context: 'ctx' }),
        write,
      }),
    ).rejects.toThrow('The archive could not be read.');
  });

  it('stops when writing a file fails', async () => {
    const archive = await buildArchive([{ name: 'good/a', content: '1' }]);
    const failing = vi.fn().mockRejectedValue(new Error('s3 down'));

    const logError = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    await expect(
      extractBags(archive, { resolve: async () => ({ accept: true, context: 'ctx' }), write: failing }),
    ).rejects.toThrow(CarLogJobError);

    expect(logError).toHaveBeenCalledWith(
      'The archive could not be read',
      expect.objectContaining({ error: expect.objectContaining({ message: 's3 down' }) }),
    );
    logError.mockRestore();
  });
});
