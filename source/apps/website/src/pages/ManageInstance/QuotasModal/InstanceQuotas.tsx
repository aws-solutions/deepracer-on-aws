// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import BaseQuotasModal, { QuotasConfig } from './BaseQuotasModal';

interface InstanceQuotasModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const instanceQuotasConfig: QuotasConfig = {
  modalHeader: 'Instance quotas',
  computeField: {
    name: 'globalComputeMinutesLimit',
    label: 'Global compute usage limit (hours)',
    description: 'The maximum number of training hours to be used by the instance.',
    fieldKey: 'usageQuotas.global.globalComputeMinutesLimit',
  },
  modelCountField: {
    name: 'globalModelCountLimit',
    label: 'Global model count limit',
    description: 'The maximum number of models to be stored on the instance.',
    fieldKey: 'usageQuotas.global.globalModelCountLimit',
  },
  keyToUpdate: 'usageQuotas.global',
};

const InstanceQuotasModal = ({ isOpen, setIsOpen }: InstanceQuotasModalProps) => {
  return <BaseQuotasModal isOpen={isOpen} setIsOpen={setIsOpen} config={instanceQuotasConfig} />;
};

export default InstanceQuotasModal;
