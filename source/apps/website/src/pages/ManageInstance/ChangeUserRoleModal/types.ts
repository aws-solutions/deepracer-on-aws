// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Profile } from '@deepracer-indy/typescript-client';

export interface ChangeUserRoleModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  selectedUser: Profile | null;
  onClearSelection?: (() => void) | null;
}
