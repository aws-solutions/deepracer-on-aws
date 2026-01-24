// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
export interface ImportModelFormValues {
  modelName: string;
  modelDescription?: string;
  files: FileList | undefined;
}
