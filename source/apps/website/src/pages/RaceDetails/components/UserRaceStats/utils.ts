// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Submission } from '@deepracer-indy/typescript-client';

export const getBestSubmission = (submissions?: Submission[]) => {
  if (!submissions) {
    return null;
  }

  const bestSubmission = submissions.reduce((acc, current) => {
    if (!current.rankingScore) {
      return acc;
    }
    if (!acc.rankingScore || current.rankingScore < acc.rankingScore) {
      return current;
    }
    return acc;
  }, {} as Submission);

  return bestSubmission.rankingScore ? bestSubmission : null;
};
