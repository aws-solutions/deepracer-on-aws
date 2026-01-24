// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const calculateComputeHours = (computeMinutes: number) => {
  return computeMinutes === -1 ? -1 : Math.round(computeMinutes / 60);
};

export const calculateComputeMinutes = (computeHours: number) => {
  return computeHours === -1 ? -1 : computeHours * 60;
};

export const getCheckboxValue = (checked: boolean) => {
  return checked ? -1 : 0;
};
