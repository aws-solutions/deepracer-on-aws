// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const VALID_EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,64}$/i;
export const VALID_PASSWORD_PATTERN =
  /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[!@#$%&*^()_\-+={[}\]|:;"'<,>.?/\\~`]).{8,}$/;
export const VALID_DELETE_ACCOUNT_PATTERN = /^Delete$/;
export const VALID_NICKNAME_PATTERN = /^[a-zA-Z0-9#-]+$/i;
export const VALID_NAME_PATTERN = /^[^\s\n]{1,30}$/;

export const ALIAS_MIN_LENGTH = 2;
export const ALIAS_MAX_LENGTH = 64;
export const ALIAS_REGEX = /^[\w-]+$/;

export const RESOURCE_NAME_REGEX = /^[a-zA-Z0-9-]+$/;
export const RESOURCE_NAME_MIN_LENGTH = 1;
export const RESOURCE_NAME_MAX_LENGTH = 64;

export const RESOURCE_DESCRIPTION_REGEX = /^[a-zA-Z0-9- ]+$/;
export const RESOURCE_DESCRIPTION_MAX_LENGTH = 255;

export const PASSWORD_REGEX = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/;
export const EMAIL_REGEX = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/g;
