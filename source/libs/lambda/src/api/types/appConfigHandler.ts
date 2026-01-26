// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export type DocumentType =
  | string
  | number
  | boolean
  | DocumentType[]
  | {
      [prop: string]: DocumentType;
    }
  | null;
