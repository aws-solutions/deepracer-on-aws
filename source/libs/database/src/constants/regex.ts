// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ResourceType } from './resourceTypes';

export const RESOURCE_ID_REGEX_STR = '[A-Za-z0-9-]{15}';
export const RESOURCE_ID_REGEX = new RegExp(`^${RESOURCE_ID_REGEX_STR}$`);
export const getDbKeyRegex = (resourceType: ResourceType) => new RegExp(`^${resourceType}_${RESOURCE_ID_REGEX_STR}$`);
