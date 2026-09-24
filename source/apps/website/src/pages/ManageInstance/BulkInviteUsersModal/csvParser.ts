// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { BulkInviteEntry } from '@deepracer-indy/typescript-client';

import { VALID_EMAIL_PATTERN } from '#constants/validation.js';

export const MAX_BULK_INVITE_ENTRIES = 200;

/** Header row column names (case-insensitive) used to auto-detect and skip a header row. */
const HEADER_EMAIL_ALIASES = new Set(['email', 'emailaddress', 'email address']);

export interface CsvValidationIssue {
  /** 1-based line number within the CSV file (matches what a user would see in a text editor). */
  line: number;
  message: string;
}

export interface CsvParseResult {
  entries: BulkInviteEntry[];
  issues: CsvValidationIssue[];
}

/**
 * Splits a single CSV row into columns, honoring double-quoted fields so a quoted comma (for
 * example a display name like `"Smith, Bob"`) is not treated as a column separator. A doubled
 * quote (`""`) inside a quoted field is unescaped to a single literal quote, matching common CSV
 * conventions (RFC 4180).
 */
const splitCsvLine = (line: string): string[] => {
  const columns: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (insideQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      insideQuotes = true;
    } else if (char === ',') {
      columns.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  columns.push(current.trim());

  return columns;
};

const looksLikeHeaderRow = (columns: string[]): boolean => HEADER_EMAIL_ALIASES.has((columns[0] ?? '').toLowerCase());

/**
 * Parses and validates a bulk-invite CSV entirely client-side.
 */
export const parseBulkInviteCsv = (csvContent: string): CsvParseResult => {
  const rawLines = csvContent.split(/\r\n|\r|\n/);

  // Track the original 1-based line number alongside each non-blank row so error messages can
  // reference the exact line the admin would see in a text editor/spreadsheet.
  const rows: { line: number; columns: string[] }[] = [];
  rawLines.forEach((rawLine, index) => {
    if (rawLine.trim().length === 0) return;
    rows.push({ line: index + 1, columns: splitCsvLine(rawLine) });
  });

  if (rows.length > 0 && looksLikeHeaderRow(rows[0].columns)) {
    rows.shift();
  }

  const issues: CsvValidationIssue[] = [];
  const entries: BulkInviteEntry[] = [];
  const firstSeenAtLine = new Map<string, number>();

  if (rows.length > MAX_BULK_INVITE_ENTRIES) {
    issues.push({
      line: rows[0]?.line ?? 1,
      message: `File contains ${rows.length} entries, which exceeds the maximum of ${MAX_BULK_INVITE_ENTRIES}`,
    });
  }

  rows.forEach(({ line, columns }) => {
    const [emailAddress, displayName] = columns;
    const normalizedEmail = (emailAddress ?? '').trim();

    if (normalizedEmail.length === 0) {
      issues.push({ line, message: 'Missing required field (email)' });
      return;
    }

    if (!VALID_EMAIL_PATTERN.test(normalizedEmail)) {
      issues.push({ line, message: `Invalid email format "${normalizedEmail}"` });
      return;
    }

    const emailKey = normalizedEmail.toLowerCase();
    const duplicateOfLine = firstSeenAtLine.get(emailKey);
    if (duplicateOfLine !== undefined) {
      issues.push({
        line,
        message: `Duplicate email address ${normalizedEmail} (also on line ${duplicateOfLine})`,
      });
      return;
    }
    firstSeenAtLine.set(emailKey, line);

    const trimmedDisplayName = displayName?.trim();
    entries.push({
      emailAddress: normalizedEmail,
      ...(trimmedDisplayName ? { displayName: trimmedDisplayName } : {}),
    });
  });

  // Fail-fast: any issue blocks the entire submission.
  return issues.length > 0 ? { entries: [], issues } : { entries, issues: [] };
};
