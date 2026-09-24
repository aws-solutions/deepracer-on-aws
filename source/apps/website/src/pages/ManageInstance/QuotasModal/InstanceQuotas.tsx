// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import BaseQuotasModal, { QuotasConfig } from './BaseQuotasModal';

interface InstanceQuotasModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const instanceQuotasConfig: QuotasConfig = {
  modalHeaderKey: 'quotasModal.instance.header',
  computeField: {
    name: 'globalComputeMinutesLimit',
    labelKey: 'quotasModal.instance.computeLabel',
    descriptionKey: 'quotasModal.instance.computeDescription',
    fieldKey: 'usageQuotas.global.globalComputeMinutesLimit',
  },
  modelCountField: {
    name: 'globalModelCountLimit',
    labelKey: 'quotasModal.instance.modelCountLabel',
    descriptionKey: 'quotasModal.instance.modelCountDescription',
    fieldKey: 'usageQuotas.global.globalModelCountLimit',
  },
  keyToUpdate: 'usageQuotas.global',
};

const InstanceQuotasModal = ({ isOpen, setIsOpen }: InstanceQuotasModalProps) => {
  return <BaseQuotasModal isOpen={isOpen} setIsOpen={setIsOpen} config={instanceQuotasConfig} />;
};

export default InstanceQuotasModal;
