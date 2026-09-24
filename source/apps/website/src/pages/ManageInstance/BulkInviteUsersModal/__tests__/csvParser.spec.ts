// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { MAX_BULK_INVITE_ENTRIES, parseBulkInviteCsv } from '../csvParser';

describe('parseBulkInviteCsv', () => {
  it('parses valid entries with email and displayName', () => {
    const result = parseBulkInviteCsv('alice@example.com,Alice Smith\nbob@example.com,Bob Jones');

    expect(result.issues).toEqual([]);
    expect(result.entries).toEqual([
      { emailAddress: 'alice@example.com', displayName: 'Alice Smith' },
      { emailAddress: 'bob@example.com', displayName: 'Bob Jones' },
    ]);
  });

  it('parses entries with email only (displayName omitted)', () => {
    const result = parseBulkInviteCsv('carol@example.com');

    expect(result.issues).toEqual([]);
    expect(result.entries).toEqual([{ emailAddress: 'carol@example.com' }]);
  });

  it('auto-detects and skips a header row', () => {
    const result = parseBulkInviteCsv('email,displayName\nalice@example.com,Alice Smith');

    expect(result.issues).toEqual([]);
    expect(result.entries).toEqual([{ emailAddress: 'alice@example.com', displayName: 'Alice Smith' }]);
  });

  it('auto-detects a header row using "Email Address" casing/spacing variants', () => {
    const result = parseBulkInviteCsv('Email Address,Display Name\nalice@example.com,Alice Smith');

    expect(result.issues).toEqual([]);
    expect(result.entries).toHaveLength(1);
  });

  it('does not treat a data-only first row as a header', () => {
    const result = parseBulkInviteCsv('alice@example.com,Alice Smith');

    expect(result.issues).toEqual([]);
    expect(result.entries).toHaveLength(1);
  });

  it('does not treat a first row as a header just because displayName is "Name" (regression, keys off first column only)', () => {
    const result = parseBulkInviteCsv('alice@example.com,Name');

    expect(result.issues).toEqual([]);
    expect(result.entries).toEqual([{ emailAddress: 'alice@example.com', displayName: 'Name' }]);
  });

  it('supports a double-quoted displayName containing a comma (regression, no longer silently truncated)', () => {
    const result = parseBulkInviteCsv('bob@example.com,"Smith, Bob"');

    expect(result.issues).toEqual([]);
    expect(result.entries).toEqual([{ emailAddress: 'bob@example.com', displayName: 'Smith, Bob' }]);
  });

  it('unescapes a doubled quote inside a quoted displayName', () => {
    const result = parseBulkInviteCsv('bob@example.com,"Bob ""The Rock"" Smith"');

    expect(result.entries).toEqual([{ emailAddress: 'bob@example.com', displayName: 'Bob "The Rock" Smith' }]);
  });

  it('ignores blank lines', () => {
    const result = parseBulkInviteCsv('alice@example.com\n\n\nbob@example.com\n');

    expect(result.issues).toEqual([]);
    expect(result.entries).toHaveLength(2);
  });

  it('trims whitespace around email and displayName', () => {
    const result = parseBulkInviteCsv('  alice@example.com  ,  Alice Smith  ');

    expect(result.entries).toEqual([{ emailAddress: 'alice@example.com', displayName: 'Alice Smith' }]);
  });

  describe('validation issues (fail-fast, all reported at once per design §5.7)', () => {
    it('flags an invalid email format with the exact line number', () => {
      const result = parseBulkInviteCsv('alice@example.com\nnot-an-email\ncarol@example.com');

      expect(result.entries).toEqual([]);
      expect(result.issues).toEqual([{ line: 2, message: 'Invalid email format "not-an-email"' }]);
    });

    it('flags a missing required email field', () => {
      const result = parseBulkInviteCsv('alice@example.com\n,Missing Email');

      expect(result.entries).toEqual([]);
      expect(result.issues).toEqual([{ line: 2, message: 'Missing required field (email)' }]);
    });

    it('flags all occurrences of a duplicate email, referencing the first line seen', () => {
      const result = parseBulkInviteCsv('alice@example.com,Alice\nbob@example.com\nalice@example.com,Alice Again');

      expect(result.entries).toEqual([]);
      expect(result.issues).toEqual([
        { line: 3, message: 'Duplicate email address alice@example.com (also on line 1)' },
      ]);
    });

    it('treats duplicate detection as case-insensitive', () => {
      const result = parseBulkInviteCsv('Alice@Example.com\nalice@example.com');

      expect(result.issues).toEqual([
        { line: 2, message: 'Duplicate email address alice@example.com (also on line 1)' },
      ]);
    });

    it('reports multiple distinct issues together in one pass', () => {
      const result = parseBulkInviteCsv('not-an-email\n,\nalice@example.com\nalice@example.com');

      expect(result.entries).toEqual([]);
      expect(result.issues).toEqual([
        { line: 1, message: 'Invalid email format "not-an-email"' },
        { line: 2, message: 'Missing required field (email)' },
        { line: 4, message: 'Duplicate email address alice@example.com (also on line 3)' },
      ]);
    });

    it('rejects a file exceeding the maximum entry count', () => {
      const rows = Array.from({ length: MAX_BULK_INVITE_ENTRIES + 1 }, (_, i) => `user${i}@example.com`).join('\n');
      const result = parseBulkInviteCsv(rows);

      expect(result.entries).toEqual([]);
      expect(result.issues[0].message).toContain(`exceeds the maximum of ${MAX_BULK_INVITE_ENTRIES}`);
    });

    it('accepts a file at exactly the maximum entry count', () => {
      const rows = Array.from({ length: MAX_BULK_INVITE_ENTRIES }, (_, i) => `user${i}@example.com`).join('\n');
      const result = parseBulkInviteCsv(rows);

      expect(result.issues).toEqual([]);
      expect(result.entries).toHaveLength(MAX_BULK_INVITE_ENTRIES);
    });
  });

  it('returns no entries and no issues for an empty file', () => {
    const result = parseBulkInviteCsv('');

    expect(result.entries).toEqual([]);
    expect(result.issues).toEqual([]);
  });

  it('returns no entries and no issues for a file with only a header row', () => {
    const result = parseBulkInviteCsv('email,displayName');

    expect(result.entries).toEqual([]);
    expect(result.issues).toEqual([]);
  });
});
