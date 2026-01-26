// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Form from '@cloudscape-design/components/form';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { yupResolver } from '@hookform/resolvers/yup';
import { deleteUser } from 'aws-amplify/auth';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as Yup from 'yup';

import InputField from '#components/FormFields/InputField';
import { PageId } from '#constants/pages.js';
import { VALID_DELETE_ACCOUNT_PATTERN } from '#constants/validation';
import { getPath } from '#utils/pageUtils.js';

interface DeleteAccountModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

/**
 * TODO: Add banners for notifications
 */
const DeleteAccountModal = ({ isOpen, setIsOpen }: DeleteAccountModalProps) => {
  const { t } = useTranslation('account');
  const initialValues = { Text: '' };
  const navigate = useNavigate();

  const validationSchema = Yup.object().shape({
    Text: Yup.string()
      .required(t('required'))
      .matches(VALID_DELETE_ACCOUNT_PATTERN, t('deleteAccountModal.deleteField')),
  });

  const {
    control,
    handleSubmit: handleFormSubmit,
    reset,
    trigger: validateForm,
  } = useForm<{ Text: string }>({
    values: initialValues,
    resolver: yupResolver(validationSchema),
    mode: 'onBlur',
  });

  const handleClose = () => {
    reset(initialValues);
    setIsOpen(false);
  };

  const handleSubmit = async () => {
    const isFormValid = await validateForm();
    if (isFormValid) {
      try {
        await deleteUser();
        setIsOpen(false);
        navigate(getPath(PageId.SIGN_IN));
        navigate(0); // To refresh the page so that TopNav gets re-rendered
      } catch (e) {
        handleClose();
      }
    }
  };

  return (
    <Modal
      onDismiss={() => handleClose()}
      visible={isOpen}
      closeAriaLabel={t('deleteAccountModal.closeModal')}
      size="medium"
      header={t('deleteAccountModal.deleteAccountHeader')}
    >
      <Box margin={{ bottom: 'l' }}>{t('deleteAccountModal.deleteAccountDesc')}</Box>
      <form onSubmit={handleFormSubmit(handleSubmit)}>
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button formAction="none" variant="link" onClick={() => handleClose()}>
                {t('deleteAccountModal.cancel')}
              </Button>
              <Button formAction="submit" variant="primary">
                {t('deleteAccountModal.delete')}
              </Button>
            </SpaceBetween>
          }
        >
          <Box>
            <InputField
              control={control}
              label={t('deleteAccountModal.deleteAccountInputHeader')}
              placeholder={t('deleteAccountModal.delete')}
              name="Text"
              type="text"
            />
          </Box>
        </Form>
      </form>
    </Modal>
  );
};

export default DeleteAccountModal;
