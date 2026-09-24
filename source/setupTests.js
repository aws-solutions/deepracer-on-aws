// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as awsSdkClientMockMatchers from 'aws-sdk-client-mock-vitest';
import jsdomUtils from 'jsdom/lib/jsdom/living/generated/utils.js';
import { expect } from 'vitest';

const { implForWrapper } = jsdomUtils;

expect.extend({ ...awsSdkClientMockMatchers });

// jsdom's Blob/File implementation doesn't implement text()/arrayBuffer() (see
// https://github.com/jsdom/jsdom/issues/2555), unlike real browsers and Node's own
// node:buffer Blob/File. Its test-only wrapper utility exposes the underlying bytes, allowing
// production code to use the standard Blob#text() API without relying on FileReader.
if (typeof Blob !== 'undefined' && !Blob.prototype.text) {
  Blob.prototype.text = function text() {
    return Promise.resolve(implForWrapper(this)._buffer.toString());
  };
}
