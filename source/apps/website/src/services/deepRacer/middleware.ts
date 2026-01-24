// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Sha256 } from '@aws-crypto/sha256-browser';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { ServiceInputTypes, ServiceOutputTypes } from '@deepracer-indy/typescript-client';
import { retryMiddlewareOptions } from '@smithy/middleware-retry';
import { HttpRequest } from '@smithy/protocol-http';
import type { FinalizeRequestMiddleware, Pluggable } from '@smithy/types';
import { fetchAuthSession } from 'aws-amplify/auth';

import { environmentConfig } from '../../utils/envUtils.js';

export const httpSigningMiddleware: FinalizeRequestMiddleware<ServiceInputTypes, ServiceOutputTypes> =
  (next, _context) => async (args) => {
    if (!HttpRequest.isInstance(args.request)) {
      return next(args);
    }

    const session = await fetchAuthSession(); // TODO: use Redux and logout/redirect if cannot get tokens
    const request = args.request as HttpRequest;

    if (!session.credentials) {
      throw new Error('No credentials found');
    }

    const signer = new SignatureV4({
      credentials: {
        accessKeyId: session.credentials.accessKeyId,
        secretAccessKey: session.credentials.secretAccessKey,
        sessionToken: session.credentials.sessionToken,
      },
      region: environmentConfig.region,
      service: 'execute-api',
      sha256: Sha256,
    });

    const signedRequest = await signer.sign(request);

    return next({
      ...args,
      request: signedRequest,
    });
  };

export const httpSigningPlugin: Pluggable<ServiceInputTypes, ServiceOutputTypes> = {
  applyToStack: (stack) => {
    stack.addRelativeTo(httpSigningMiddleware, {
      tags: ['HTTP_SIGNING'],
      name: 'httpSigningMiddleware',
      aliases: ['apiKeyMiddleware', 'tokenMiddleware', 'awsAuthMiddleware'],
      override: true,
      relation: 'after',
      toMiddleware: retryMiddlewareOptions.name as string,
    });
  },
};
