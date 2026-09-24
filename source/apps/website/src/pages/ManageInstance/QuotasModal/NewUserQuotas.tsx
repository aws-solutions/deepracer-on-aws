// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import BaseQuotasModal, { QuotasConfig } from './BaseQuotasModal';

interface NewUserQuotasModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const newUserQuotasConfig: QuotasConfig = {
  modalHeaderKey: 'quotasModal.newUser.header',
  computeField: {
    name: 'newUserComputeMinutesLimit',
    labelKey: 'quotasModal.newUser.computeLabel',
    descriptionKey: 'quotasModal.newUser.computeDescription',
    fieldKey: 'usageQuotas.newUser.newUserComputeMinutesLimit',
  },
  modelCountField: {
    name: 'newUserModelCountLimit',
    labelKey: 'quotasModal.newUser.modelCountLabel',
    descriptionKey: 'quotasModal.newUser.modelCountDescription',
    fieldKey: 'usageQuotas.newUser.newUserModelCountLimit',
  },
  keyToUpdate: 'usageQuotas.newUser',
};

const NewUserQuotasModal = ({ isOpen, setIsOpen }: NewUserQuotasModalProps) => {
  return <BaseQuotasModal isOpen={isOpen} setIsOpen={setIsOpen} config={newUserQuotasConfig} />;
};

export default NewUserQuotasModal;
