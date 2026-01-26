// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const truncateString = (s = '', maxLength = 50) => (s.length > maxLength ? `${s.slice(0, maxLength)}…` : s);
