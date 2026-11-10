// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Checkbox from '@cloudscape-design/components/checkbox';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Form from '@cloudscape-design/components/form';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { Profile } from '@deepracer-indy/typescript-client';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as Yup from 'yup';

import InputField from '#components/FormFields/InputField';
import { useAppDispatch } from '#hooks/useAppDispatch';
import { useBatchUpdateProfileQuotasMutation } from '#services/deepRacer/profileApi.js';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice';

import { calculateComputeHours, calculateComputeMinutes, getCheckboxValue } from './helpers';

interface UserQuotasModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  selectedUsers: Profile[];
  onClearSelection?: (() => void) | null;
}

interface UserQuotasFormValues {
  // `''` = intentionally-empty (multi-user has no single value to pre-fill); required-blocked.
  maxTotalComputeMinutes: number | '';
  maxModelCount: number | '';
}

const INITIAL_VALUES: UserQuotasFormValues = {
  maxTotalComputeMinutes: '',
  maxModelCount: '',
};

const MAX_FAILED_ALIASES_SHOWN = 5;

const UserQuotasModal = ({ isOpen, setIsOpen, selectedUsers, onClearSelection }: UserQuotasModalProps) => {
  const { t } = useTranslation('manageInstance');
  const dispatch = useAppDispatch();
  const [batchUpdateProfileQuotas] = useBatchUpdateProfileQuotasMutation();

  const [isConfirmationOpen, setIsConfirmationOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [usersToUpdate, setUsersToUpdate] = useState<Profile[]>(selectedUsers);

  const isSingleUser = selectedUsers.length === 1;
  const singleSelectedUser = isSingleUser ? selectedUsers[0] : null;

  const validationSchema = Yup.object().shape({
    maxTotalComputeMinutes: Yup.number()
      .transform((value, originalValue) => (originalValue === '' ? undefined : value))
      .required(t('quotasModal.validation.required', { label: t('quotasModal.user.computeLabel') }))
      .integer(t('quotasModal.validation.invalidLimit'))
      .test('valid-limit', t('quotasModal.validation.invalidLimit'), (value) => {
        return value === -1 || (value !== undefined && value >= 0);
      }),
    maxModelCount: Yup.number()
      .transform((value, originalValue) => (originalValue === '' ? undefined : value))
      .required(t('quotasModal.validation.required', { label: t('quotasModal.user.modelCountLabel') }))
      .integer(t('quotasModal.validation.invalidLimit'))
      .test('valid-limit', t('quotasModal.validation.invalidLimit'), (value) => {
        return value === -1 || (value !== undefined && value >= 0);
      }),
  });

  const {
    control,
    handleSubmit: handleFormSubmit,
    reset,
    setValue,
    getValues,
  } = useForm<UserQuotasFormValues>({
    defaultValues: INITIAL_VALUES,
    // Yup coerces the fields to `number`, but the form values are `number | ''` (empty = unset), so the
    // resolver's inferred output type doesn't match UserQuotasFormValues; cast to reconcile.
    resolver: yupResolver(validationSchema) as Resolver<UserQuotasFormValues>,
    mode: 'onBlur',
  });

  const computeValue = useWatch({ control, name: 'maxTotalComputeMinutes' });
  const modelCountValue = useWatch({ control, name: 'maxModelCount' });

  const isComputeUnlimited = computeValue === -1;
  const isModelCountUnlimited = modelCountValue === -1;

  useEffect(() => {
    if (isOpen) {
      setUsersToUpdate(selectedUsers);
    }
  }, [selectedUsers, isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (singleSelectedUser) {
        const computeMinutes = singleSelectedUser.maxTotalComputeMinutes ?? 0;
        const computeHours = calculateComputeHours(computeMinutes);
        const modelCount = singleSelectedUser.maxModelCount ?? 0;

        setValue('maxTotalComputeMinutes', computeHours);
        setValue('maxModelCount', modelCount);
      } else {
        setValue('maxTotalComputeMinutes', INITIAL_VALUES.maxTotalComputeMinutes);
        setValue('maxModelCount', INITIAL_VALUES.maxModelCount);
      }
    }
  }, [singleSelectedUser, isOpen, setValue]);

  const resetFormToClosedState = () => {
    if (singleSelectedUser) {
      const computeMinutes = singleSelectedUser.maxTotalComputeMinutes ?? 0;
      const computeHours = calculateComputeHours(computeMinutes);
      const modelCount = singleSelectedUser.maxModelCount ?? 0;

      reset({
        maxTotalComputeMinutes: computeHours,
        maxModelCount: modelCount,
      });
    } else {
      reset(INITIAL_VALUES);
    }
  };

  const handleClose = () => {
    resetFormToClosedState();
    setIsConfirmationOpen(false);
    setIsOpen(false);
  };

  const handleConfirmForm = () => {
    setIsConfirmationOpen(true);
  };

  const handleCancelConfirmation = () => {
    if (isSubmitting) {
      return;
    }
    setIsConfirmationOpen(false);
  };

  const handleSubmit = async () => {
    if (usersToUpdate.length === 0) {
      return;
    }

    const formValues = getValues();
    // Safety net: empty (→0 via Number()) or NaN shouldn't reach the API; validation blocks it upstream.
    if (
      formValues.maxTotalComputeMinutes === '' ||
      formValues.maxModelCount === '' ||
      Number.isNaN(Number(formValues.maxTotalComputeMinutes)) ||
      Number.isNaN(Number(formValues.maxModelCount))
    ) {
      setIsConfirmationOpen(false);
      dispatch(
        displayErrorNotification({
          content: t('quotasModal.user.errorInvalidValues'),
        }),
      );
      return;
    }

    // Form values are typed `number | ''`; send plain numbers to the API.
    const maxTotalComputeMinutes = calculateComputeMinutes(Number(formValues.maxTotalComputeMinutes));
    const maxModelCount = Number(formValues.maxModelCount);

    setIsSubmitting(true);

    // A request that fails outright marks every user as failed.
    let failedProfileIds: Set<string>;
    try {
      const { errors } = await batchUpdateProfileQuotas({
        profileIds: usersToUpdate.map((user) => user.profileId),
        maxTotalComputeMinutes,
        maxModelCount,
      }).unwrap();
      failedProfileIds = new Set(errors.map(({ profileId }) => profileId));
    } catch {
      failedProfileIds = new Set(usersToUpdate.map(({ profileId }) => profileId));
    }

    setIsSubmitting(false);
    setIsConfirmationOpen(false);

    const failedUsers = usersToUpdate.filter((user) => failedProfileIds.has(user.profileId));
    const succeededCount = usersToUpdate.length - failedUsers.length;

    if (failedUsers.length === 0) {
      dispatch(
        displaySuccessNotification({
          content:
            succeededCount === 1
              ? t('quotasModal.user.success', { count: 1, alias: usersToUpdate[0].alias })
              : t('quotasModal.user.success', { count: succeededCount }),
        }),
      );
      onClearSelection?.();
      resetFormToClosedState();
      setIsOpen(false);
      return;
    }

    // Narrow to only the failed users so a retry doesn't re-submit ones that already succeeded.
    setUsersToUpdate(failedUsers);

    if (succeededCount > 0) {
      dispatch(
        displaySuccessNotification({
          content: t('quotasModal.user.successPartial', { succeeded: succeededCount, total: usersToUpdate.length }),
        }),
      );
    }

    const failedAliases = failedUsers.map((user) => user.alias);
    dispatch(
      displayErrorNotification({
        content:
          failedAliases.length > MAX_FAILED_ALIASES_SHOWN
            ? t('quotasModal.user.errorFailedMany', {
                total: failedAliases.length,
                aliases: failedAliases.slice(0, MAX_FAILED_ALIASES_SHOWN).join(', '),
                remaining: failedAliases.length - MAX_FAILED_ALIASES_SHOWN,
              })
            : t('quotasModal.user.errorFailed', { aliases: failedAliases.join(', ') }),
      }),
    );
  };

  const handleCheckboxChange = (fieldName: keyof UserQuotasFormValues, checked: boolean) => {
    setValue(fieldName, getCheckboxValue(checked));
  };

  const formatQuotaDisplay = (value: number | '', unitLabel: string) =>
    value === -1 ? t('quotasModal.unlimited') : `${value} ${unitLabel}`;

  const confirmationFormValues = getValues();
  // Drive the header from the original selection (isSingleUser), not usersToUpdate: a partial-failure
  // retry narrows usersToUpdate to the failed users, but the form mode (single-user pre-fill vs. empty
  // multi-user) stays keyed on selectedUsers, so the header must match that to stay consistent.
  const modalHeader = isSingleUser
    ? t('quotasModal.user.header')
    : t('quotasModal.user.headerMultiple', { count: usersToUpdate.length });

  return (
    <>
      <Modal
        onDismiss={handleClose}
        visible={isOpen && !isConfirmationOpen}
        closeAriaLabel="Close modal"
        size="medium"
        header={modalHeader}
      >
        <form onSubmit={handleFormSubmit(handleConfirmForm)}>
          <Form
            actions={
              <SpaceBetween size="xs" direction="horizontal">
                <Button formAction="none" onClick={handleClose} disabled={isSubmitting}>
                  {t('quotasModal.buttons.cancel')}
                </Button>
                <Button formAction="submit" variant="primary" disabled={isSubmitting}>
                  {t('quotasModal.buttons.confirm')}
                </Button>
              </SpaceBetween>
            }
          >
            <SpaceBetween size="l">
              <ColumnLayout columns={2}>
                <SpaceBetween size="s">
                  <InputField
                    control={control}
                    label={t('quotasModal.user.computeLabel')}
                    description={t('quotasModal.user.computeDescription')}
                    name="maxTotalComputeMinutes"
                    type="number"
                    placeholder={t('quotasModal.computePlaceholder')}
                    disabled={isComputeUnlimited}
                  />
                  <Checkbox
                    checked={isComputeUnlimited}
                    onChange={(event) => handleCheckboxChange('maxTotalComputeMinutes', event.detail.checked)}
                  >
                    {t('quotasModal.unlimited')}
                  </Checkbox>
                </SpaceBetween>
                <SpaceBetween size="s">
                  <InputField
                    control={control}
                    label={t('quotasModal.user.modelCountLabel')}
                    description={t('quotasModal.user.modelCountDescription')}
                    name="maxModelCount"
                    type="number"
                    placeholder={t('quotasModal.modelCountPlaceholder')}
                    disabled={isModelCountUnlimited}
                  />
                  <Checkbox
                    checked={isModelCountUnlimited}
                    onChange={(event) => handleCheckboxChange('maxModelCount', event.detail.checked)}
                  >
                    {t('quotasModal.unlimited')}
                  </Checkbox>
                </SpaceBetween>
              </ColumnLayout>
            </SpaceBetween>
          </Form>
        </form>
      </Modal>
      <Modal
        onDismiss={handleCancelConfirmation}
        visible={isConfirmationOpen}
        closeAriaLabel="Close confirmation"
        size="medium"
        header={t('quotasModal.user.confirmHeader')}
        footer={
          <Box float="right">
            <SpaceBetween size="xs" direction="horizontal">
              <Button formAction="none" onClick={handleCancelConfirmation} disabled={isSubmitting}>
                {t('quotasModal.buttons.back')}
              </Button>
              <Button variant="primary" onClick={handleSubmit} loading={isSubmitting}>
                {t('quotasModal.buttons.confirm')}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="s">
          <div>{t('quotasModal.user.confirmBody', { count: usersToUpdate.length })}</div>
          <ul>
            <li>
              {t('quotasModal.user.usageLimitSummary', {
                value: formatQuotaDisplay(confirmationFormValues.maxTotalComputeMinutes, t('quotasModal.units.hours')),
              })}
            </li>
            <li>
              {t('quotasModal.user.modelCountSummary', {
                value: formatQuotaDisplay(confirmationFormValues.maxModelCount, t('quotasModal.units.models')),
              })}
            </li>
          </ul>
        </SpaceBetween>
      </Modal>
    </>
  );
};

export default UserQuotasModal;
