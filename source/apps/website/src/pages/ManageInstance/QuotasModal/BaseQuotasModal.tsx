// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Checkbox from '@cloudscape-design/components/checkbox';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Form from '@cloudscape-design/components/form';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import * as Yup from 'yup';

import InputField from '#components/FormFields/InputField';
import { useGetGlobalSettingQuery, useUpdateGlobalSettingMutation } from '#services/deepRacer/settingsApi.js';

import { calculateComputeHours, calculateComputeMinutes, getCheckboxValue } from './helpers';

export interface QuotasConfig {
  modalHeader: string;
  computeField: {
    name: string;
    label: string;
    description: string;
    fieldKey: string;
  };
  modelCountField: {
    name: string;
    label: string;
    description: string;
    fieldKey: string;
  };
  keyToUpdate: string;
}

interface BaseQuotasModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  config: QuotasConfig;
}

interface QuotasFormValues {
  [fieldKey: string]: number;
}

const createValidationSchema = (config: QuotasConfig) => {
  const validationTest = (value: number | undefined) => {
    return value === -1 || (value !== undefined && value >= 0);
  };

  return Yup.object().shape({
    [config.computeField.name]: Yup.number()
      .required(`${config.computeField.label} is required`)
      .test('valid-limit', 'Value must be -1 (unlimited) or greater than or equal to 0', validationTest),
    [config.modelCountField.name]: Yup.number()
      .required(`${config.modelCountField.label} is required`)
      .test('valid-limit', 'Value must be -1 (unlimited) or greater than or equal to 0', validationTest),
  });
};

const BaseQuotasModal = ({ isOpen, setIsOpen, config }: BaseQuotasModalProps) => {
  const { data: computeData } = useGetGlobalSettingQuery({
    key: config.computeField.fieldKey,
  });
  const { data: modelCountData } = useGetGlobalSettingQuery({
    key: config.modelCountField.fieldKey,
  });

  const [updateGlobalSetting] = useUpdateGlobalSettingMutation();

  const initialValues: QuotasFormValues = {
    [config.computeField.name]: 0,
    [config.modelCountField.name]: 0,
  };

  const validationSchema = createValidationSchema(config);

  const {
    control,
    handleSubmit: handleFormSubmit,
    reset,
    trigger: validateForm,
    setValue,
  } = useForm<QuotasFormValues>({
    defaultValues: initialValues,
    resolver: yupResolver(validationSchema),
    mode: 'onBlur',
  });

  const computeValue = useWatch({ control, name: config.computeField.name });
  const modelCountValue = useWatch({ control, name: config.modelCountField.name });

  const isComputeUnlimited = computeValue === -1;
  const isModelCountUnlimited = modelCountValue === -1;

  useEffect(() => {
    if (computeData !== undefined) {
      const computeMinutes = parseInt(computeData, 10);
      const computeHours = calculateComputeHours(computeMinutes);
      setValue(config.computeField.name, computeHours);
    }
    if (modelCountData !== undefined) {
      setValue(config.modelCountField.name, parseInt(modelCountData, 10));
    }
  }, [computeData, modelCountData, setValue, config.computeField.name, config.modelCountField.name]);

  const handleClose = () => {
    if (computeData !== undefined && modelCountData !== undefined) {
      const computeMinutes = parseInt(computeData, 10);
      const computeHours = calculateComputeHours(computeMinutes);
      reset({
        [config.computeField.name]: computeHours,
        [config.modelCountField.name]: parseInt(modelCountData, 10),
      });
    } else {
      reset(initialValues);
    }
    setIsOpen(false);
  };

  const handleSubmit = async (formValues: QuotasFormValues) => {
    const isFormValid = await validateForm();
    if (isFormValid) {
      try {
        const computeMinutes = calculateComputeMinutes(formValues[config.computeField.name]);
        const updatedSettings = {
          [config.computeField.name]: computeMinutes.toString(),
          [config.modelCountField.name]: formValues[config.modelCountField.name].toString(),
        };
        await updateGlobalSetting({
          key: config.keyToUpdate,
          value: updatedSettings,
        }).unwrap();

        setIsOpen(false);
      } catch (error) {
        console.error('Failed to update settings:', error);
      }
    }
  };

  const handleCheckboxChange = (fieldName: string, checked: boolean) => {
    setValue(fieldName, getCheckboxValue(checked));
  };

  return (
    <Modal
      onDismiss={handleClose}
      visible={isOpen}
      closeAriaLabel="Close modal"
      size="medium"
      header={config.modalHeader}
    >
      <form onSubmit={handleFormSubmit(handleSubmit)}>
        <Form
          actions={
            <SpaceBetween size="xs" direction="horizontal">
              <Button formAction="none" onClick={handleClose}>
                Cancel
              </Button>
              <Button formAction="submit" variant="primary">
                Confirm
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <ColumnLayout columns={2}>
              <SpaceBetween size="s">
                <InputField
                  control={control}
                  label={config.computeField.label}
                  description={config.computeField.description}
                  name={config.computeField.name}
                  type="number"
                  placeholder="Enter training hours limit"
                  disabled={isComputeUnlimited}
                />
                <Checkbox
                  checked={isComputeUnlimited}
                  onChange={(event) => handleCheckboxChange(config.computeField.name, event.detail.checked)}
                >
                  Unlimited
                </Checkbox>
              </SpaceBetween>
              <SpaceBetween size="s">
                <InputField
                  control={control}
                  label={config.modelCountField.label}
                  description={config.modelCountField.description}
                  name={config.modelCountField.name}
                  type="number"
                  placeholder="Enter model count limit"
                  disabled={isModelCountUnlimited}
                />
                <Checkbox
                  checked={isModelCountUnlimited}
                  onChange={(event) => handleCheckboxChange(config.modelCountField.name, event.detail.checked)}
                >
                  Unlimited
                </Checkbox>
              </SpaceBetween>
            </ColumnLayout>
          </SpaceBetween>
        </Form>
      </form>
    </Modal>
  );
};

export default BaseQuotasModal;
