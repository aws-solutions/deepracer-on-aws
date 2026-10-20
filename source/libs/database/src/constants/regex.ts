// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ResourceType } from './resourceTypes';

// Either a native generateResourceId() id, or the Cognito-assigned username a federated
// (SAML/OIDC) sign-in gets instead — "<ProviderName>_<subject>", where <subject> is whatever
// Cognito derives from the IdP's NameID/sub (see preSignUp.ts). The federated branch only
// constrains that subject to characters safe for an IAM RoleSessionName/session tag and an S3
// key prefix (blocks path traversal, slashes, etc.), not a fixed length.
export const RESOURCE_ID_REGEX_STR = '(?:[A-Za-z0-9-]{15}|[A-Za-z0-9]+_[\\w-]{1,200})';
export const RESOURCE_ID_REGEX = new RegExp(`^${RESOURCE_ID_REGEX_STR}$`);
export const getDbKeyRegex = (resourceType: ResourceType) => new RegExp(`^${resourceType}_${RESOURCE_ID_REGEX_STR}$`);
