// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import BaseQuotasModal, { QuotasConfig } from './BaseQuotasModal';

interface NewUserQuotasModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const newUserQuotasConfig: QuotasConfig = {
  modalHeader: 'New user quotas',
  computeField: {
    name: 'newUserComputeMinutesLimit',
    label: 'New user compute usage limit (hours)',
    description: 'The maximum number of training hours for new users.',
    fieldKey: 'usageQuotas.newUser.newUserComputeMinutesLimit',
  },
  modelCountField: {
    name: 'newUserModelCountLimit',
    label: 'New user model count limit',
    description: 'The maximum number of models for new users.',
    fieldKey: 'usageQuotas.newUser.newUserModelCountLimit',
  },
  keyToUpdate: 'usageQuotas.newUser',
};

const NewUserQuotasModal = ({ isOpen, setIsOpen }: NewUserQuotasModalProps) => {
  return <BaseQuotasModal isOpen={isOpen} setIsOpen={setIsOpen} config={newUserQuotasConfig} />;
};

export default NewUserQuotasModal;
