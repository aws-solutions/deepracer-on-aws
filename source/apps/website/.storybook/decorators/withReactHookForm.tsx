// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { DevTool } from '@hookform/devtools';
import { yupResolver } from '@hookform/resolvers/yup';
import { action } from '@storybook/addon-actions';
import { Decorator } from '@storybook/react';
import { FieldValues, useForm, FormProvider } from 'react-hook-form';
import { ObjectSchema } from 'yup';

interface ReactHookFormParameter<FormValues extends FieldValues> {
  defaultValues?: Required<Parameters<typeof useForm<FormValues>>>[0]['defaultValues'];
  mode?: Required<Parameters<typeof useForm>>[0]['mode'];
  schema?: ObjectSchema<FormValues>;
  onError?: () => void;
  onSubmit?: () => void;
}

declare module '@storybook/react' {
  interface Parameters {
    reactHookForm?: ReactHookFormParameter<any>;
  }
}

export const withReactHookForm: Decorator = (Story, context) => {
  const { reactHookForm } = context.parameters;
  if (!reactHookForm?.schema)
    throw new Error('withReactHookForm decorator requires a reactHookForm parameter with a valid schema');

  const { defaultValues, mode, onError, onSubmit, schema } = reactHookForm;

  const formMethods = useForm({
    defaultValues,
    mode,
    resolver: yupResolver(schema),
  });

  const handleSubmit = onSubmit ?? action('[React Hook Form] Submit');
  const handleError = onError ?? action('[React Hook Form] Error');

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={formMethods.handleSubmit(handleSubmit, handleError)}>
        <SpaceBetween direction="vertical" size="l">
          <Story />
          <Button formAction="submit">Submit</Button>
        </SpaceBetween>
      </form>
      <DevTool control={formMethods.control} />
    </FormProvider>
  );
};
