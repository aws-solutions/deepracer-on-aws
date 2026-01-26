// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { vi } from 'vitest';

import RadioGroupField from '#components/FormFields/RadioGroupField';
import i18n from '#i18n/index.js';
import { CreateModelFormValues } from '#pages/CreateModel/types.js';
import { render, renderHook, screen } from '#utils/testUtils';

import VehicleInfo from '../VehicleInfo';

const { result: mockUseForm } = renderHook(() => useForm<CreateModelFormValues>());

describe('<VehicleInfo />', () => {
  it('renders vehicle info step without crashing', () => {
    const { container: vehicleInfoStep } = render(
      <VehicleInfo control={mockUseForm.current.control} setValue={mockUseForm.current.setValue} />,
    );
    const wrapper = createWrapper(vehicleInfoStep);

    const configureVehicleContainer = wrapper.findContainer(
      `[data-testid="${i18n.t('createModel:vehicleInfo.configureVehicleHeader')}"]`,
    );
    expect(configureVehicleContainer?.findHeader()?.getElement().textContent).toContain(
      i18n.t('createModel:vehicleInfo.configureVehicleHeader'),
    );
    const hyperParametersContainer = wrapper.findContainer(
      `[data-testid="${i18n.t('createModel:vehicleInfo.hyperparametersHeader')}"]`,
    );
    expect(hyperParametersContainer?.findHeader()?.getElement().textContent).toBe(
      i18n.t('createModel:vehicleInfo.hyperparametersHeader'),
    );
  });

  it('should allow selecting batch size from radio buttons', async () => {
    const user = userEvent.setup();
    const onChangeMock = vi.fn();

    const TestComponent = () => {
      const { control } = useForm({ defaultValues: { batchSize: 64 as number } });
      return (
        <RadioGroupField
          control={control}
          name="batchSize"
          label="Batch Size"
          type="number"
          items={[
            { label: '64', value: 64 },
            { label: '128', value: 128 },
          ]}
          onChange={onChangeMock}
        />
      );
    };

    render(<TestComponent />);

    const batchSize128 = screen.getByLabelText('128');
    await user.click(batchSize128);

    expect(onChangeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          value: 128,
        }),
      }),
    );

    const callArgs = onChangeMock.mock.calls[0][0];
    expect(typeof callArgs.detail.value).toBe('number');
    expect(callArgs.detail.value).toBe(128);
  });
});
