// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { checkTarEntry, TarBudget } from '../tarSafety.js';

describe('checkTarEntry', () => {
  it('accepts files and directories inside a bag directory', () => {
    expect(checkTarEntry({ name: './Bag-1/metadata.yaml', type: 'file' })).toEqual({
      ok: true,
      bagDir: 'Bag-1',
      relativePath: 'metadata.yaml',
      isDirectory: false,
    });
    expect(checkTarEntry({ name: 'Bag-1/', type: 'directory' })).toMatchObject({ ok: true, isDirectory: true });
    expect(checkTarEntry({ name: 'Bag-1/sub/data.db3', type: 'file' })).toMatchObject({
      ok: true,
      relativePath: 'sub/data.db3',
    });
  });

  it.each([
    '../evil',
    'Bag-1/../../evil',
    'Bag-1/..',
    '/etc/passwd',
    'Bag-1\\..\\evil',
    'Bag-1/a\0b',
    'Bag-1/%2e%2e/%2e%2e/P2/f',
    'Bag-1/a%2fb',
    'Bag-1/a b',
  ])('rejects unsafe path %j', (name) => {
    expect(checkTarEntry({ name, type: 'file' }).ok).toBe(false);
  });

  it.each(['symlink', 'link', 'character-device', 'block-device', 'fifo', 'contiguous-file', undefined])(
    'rejects entry type %s',
    (type) => {
      expect(checkTarEntry({ name: 'Bag-1/x', type }).ok).toBe(false);
    },
  );

  it('rejects loose files at the archive root and unsupported directory names', () => {
    expect(checkTarEntry({ name: 'file.txt', type: 'file' }).ok).toBe(false);
    expect(checkTarEntry({ name: 'bad name/x', type: 'file' }).ok).toBe(false);
    expect(checkTarEntry({ name: '.', type: 'directory' }).ok).toBe(false);
  });

  it('rejects overlong paths', () => {
    expect(checkTarEntry({ name: `Bag-1/${'a'.repeat(300)}`, type: 'file' }).ok).toBe(false);
  });
});

describe('TarBudget', () => {
  it('limits entries, entry size and total size', () => {
    const limits = { maxEntries: 2, maxEntryBytes: 100, maxTotalBytes: 150 };

    const entries = new TarBudget(limits);
    expect(entries.add(1)).toBeUndefined();
    expect(entries.add(1)).toBeUndefined();
    expect(entries.add(1)).toBe('too many entries');

    expect(new TarBudget(limits).add(101)).toBe('entry too large');

    const total = new TarBudget(limits);
    expect(total.add(100)).toBeUndefined();
    expect(total.add(100)).toBe('archive too large when extracted');
  });
});
