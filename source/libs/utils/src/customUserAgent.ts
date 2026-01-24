// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export function getCustomUserAgent() {
  return process.env.CUSTOM_USER_AGENT ?? 'AwsSolution/SO0310/v0.0.0';
}
