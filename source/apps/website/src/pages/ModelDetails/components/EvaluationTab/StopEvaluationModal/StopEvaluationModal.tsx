// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useTranslation } from 'react-i18next';

interface StopEvaluationModalProps {
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  isVisible: boolean;
}

const StopEvaluationModal = ({ isVisible, onConfirm, onDismiss }: StopEvaluationModalProps) => {
  const { t } = useTranslation('modelDetails', { keyPrefix: 'evaluationDetails.stopEvaluationModal' });

  return (
    <Modal
      header={<Header>{t('header')}</Header>}
      visible={isVisible}
      onDismiss={onDismiss}
      footer={
        <Box float="right">
          <SpaceBetween size="xs" direction="horizontal">
            <Button variant="link" onClick={onDismiss}>
              {t('cancel')}
            </Button>
            <Button variant="primary" onClick={onConfirm}>
              {t('confirm')}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <Box variant="p" margin={{ bottom: 'l' }}>
        {t('content1')}
      </Box>
      <Box variant="p">{t('content2')}</Box>
    </Modal>
  );
};

export default StopEvaluationModal;
