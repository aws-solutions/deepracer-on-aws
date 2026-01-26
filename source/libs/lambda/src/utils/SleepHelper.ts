// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

class SleepHelper {
  sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}

export const sleepHelper = new SleepHelper();
