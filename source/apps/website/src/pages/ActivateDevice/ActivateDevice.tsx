// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import CopyToClipboard from '@cloudscape-design/components/copy-to-clipboard';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Wizard from '@cloudscape-design/components/wizard';
import { DeviceStatus, DeviceType } from '@deepracer-indy/typescript-client';
import { yupResolver } from '@hookform/resolvers/yup';
import { useCallback, useState } from 'react';
import { type Resolver, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import CheckboxField from '#components/FormFields/CheckboxField';
import InputField from '#components/FormFields/InputField';
import SelectField from '#components/FormFields/SelectField';
import { PageId } from '#constants/pages';
import { useAppDispatch } from '#hooks/useAppDispatch';
import { useDeviceMqtt } from '#hooks/useDeviceMqtt.js';
import { useActivateDeviceMutation, useListDevicesQuery } from '#services/deepRacer/devicesApi';
import { useListFleetsQuery } from '#services/deepRacer/fleetsApi';
import { displayErrorNotification, displayInfoNotification } from '#store/notifications/notificationsSlice.js';
import { getPath } from '#utils/pageUtils.js';

import { ACTIVATE_DEVICE_DEFAULTS, activateDeviceValidationSchema, type ActivateDeviceFormValues } from './validation';

interface ActivationResult {
  activationId: string;
  activationCode: string;
  region: string;
  expiresAt: Date;
}

/** Escapes a single quote for embedding inside a single-quoted shell argument (close, escape, reopen). */
const SINGLE_QUOTE_SHELL_ESCAPE = String.raw`'\''`;

const ActivateDevice = () => {
  const { t } = useTranslation('devices');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [activationResult, setActivationResult] = useState<ActivationResult | null>(null);
  const [activationError, setActivationError] = useState(false);
  const [activatedName, setActivatedName] = useState<string | null>(null);

  const [activateDevice, { isLoading: isActivating }] = useActivateDeviceMutation();
  const { data: fleets = [] } = useListFleetsQuery({});

  const { data: devices = [], refetch: refetchDevices } = useListDevicesQuery(
    {},
    { pollingInterval: activationResult ? 10000 : 0, skipPollingIfUnfocused: true },
  );
  const handleDeviceEvent = useCallback(() => {
    refetchDevices().catch(() => {
      /** no-op: background refresh, errors surface via the query hook */
    });
  }, [refetchDevices]);
  useDeviceMqtt('+', { onEvent: handleDeviceEvent });

  const registeredDevice = activatedName ? devices.find((d) => d.name === activatedName) : undefined;

  const { control, getValues, trigger } = useForm<ActivateDeviceFormValues>({
    defaultValues: ACTIVATE_DEVICE_DEFAULTS,
    resolver: yupResolver(activateDeviceValidationSchema) as unknown as Resolver<ActivateDeviceFormValues>,
    mode: 'onBlur',
  });

  const deviceTypeOptions = [
    { value: DeviceType.CAR, label: t('deviceType.CAR') },
    { value: DeviceType.TIMER, label: t('deviceType.TIMER') },
  ];

  const fleetOptions = [
    { value: '', label: t('wizard.noFleet') },
    ...fleets.map((fleet) => ({
      value: fleet.fleetId,
      label: fleet.name,
    })),
  ];

  const shellQuote = (v: string): string => `'${v.replaceAll("'", SINGLE_QUOTE_SHELL_ESCAPE)}'`;

  const buildOneLiner = (values: ActivateDeviceFormValues, result: ActivationResult): string => {
    const origin = globalThis.location.origin;
    const isCar = values.deviceType === DeviceType.CAR;
    const scriptName = isCar ? 'car_activation.sh' : 'timer_activation.sh';

    let cmd = `curl -O ${origin}/${scriptName} && chmod +x ./${scriptName} && sudo ./${scriptName} -h ${shellQuote(values.name)} -c ${shellQuote(result.activationCode)} -i ${shellQuote(result.activationId)} -r ${shellQuote(result.region)}`;

    if (isCar) {
      if (values.ssid && values.wifiPassword) {
        cmd += ` -s ${shellQuote(values.ssid)} -w ${shellQuote(values.wifiPassword)}`;
      }
      if (values.consolePassword) {
        cmd += ` -p ${shellQuote(values.consolePassword)}`;
      }
      if (values.communityConsole) {
        cmd += ' -u';
      }
    }

    return cmd;
  };

  const buildSsmOneLiner = (result: ActivationResult): string => {
    return `sudo amazon-ssm-agent -register -code ${shellQuote(result.activationCode)} -id ${shellQuote(result.activationId)} -region ${shellQuote(result.region)} && sudo systemctl restart amazon-ssm-agent`;
  };

  const handleActivate = async () => {
    const values = getValues();
    try {
      const result = await activateDevice({
        name: values.name,
        deviceType: values.deviceType as DeviceType,
        ...(values.fleetId ? { fleetId: values.fleetId } : {}),
      }).unwrap();

      setActivationResult(result);
      setActivationError(false);
      setActivatedName(values.name);
      setActiveStepIndex(3);
      dispatch(displayInfoNotification({ content: t('wizard.activateSuccess') }));
    } catch {
      setActivationError(true);
      dispatch(displayErrorNotification({ content: t('wizard.activateError') }));
    }
  };

  const handleNavigate = async (requestedStepIndex: number) => {
    if (requestedStepIndex > activeStepIndex) {
      // Moving forward — validate relevant steps
      if (activeStepIndex === 0) {
        const valid = await trigger('deviceType');
        if (!valid) return;
      }
      // Step 1 (fleet) has no required validation
      if (activeStepIndex === 2) {
        const valid = await trigger('name');
        if (!valid) return;
      }
      if (activeStepIndex === 2 && requestedStepIndex === 3) {
        await handleActivate();
        return;
      }
    }
    setActiveStepIndex(requestedStepIndex);
  };

  const values = getValues();

  return (
    <Wizard
      i18nStrings={{
        stepNumberLabel: (stepNumber) => `Step ${stepNumber}`,
        navigationAriaLabel: t('wizard.title'),
        cancelButton: t('wizard.cancel'),
        previousButton: t('wizard.previous'),
        nextButton: t('wizard.next'),
        submitButton: t('wizard.finish'),
        optional: '- optional',
      }}
      activeStepIndex={activeStepIndex}
      isLoadingNextStep={isActivating}
      onNavigate={({ detail }) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        handleNavigate(detail.requestedStepIndex);
      }}
      onCancel={() => navigate(getPath(PageId.DEVICES))}
      onSubmit={() => navigate(getPath(PageId.DEVICES))}
      steps={[
        {
          title: t('wizard.steps.type.title'),
          description: t('wizard.steps.type.description'),
          content: (
            <Container header={<Header variant="h2">{t('wizard.steps.type.title')}</Header>}>
              <SelectField
                control={control}
                name="deviceType"
                label={t('wizard.typeLabel')}
                placeholder={t('wizard.steps.type.description')}
                options={deviceTypeOptions}
              />
            </Container>
          ),
        },
        {
          title: t('wizard.steps.fleet.title'),
          isOptional: true,
          content: (
            <Container header={<Header variant="h2">{t('wizard.steps.fleet.title')}</Header>}>
              <SelectField
                control={control}
                name="fleetId"
                label={t('wizard.fleetLabel')}
                placeholder={t('wizard.noFleet')}
                options={fleetOptions}
              />
            </Container>
          ),
        },
        {
          title: t('wizard.steps.configure.title'),
          content: (
            <Container header={<Header variant="h2">{t('wizard.steps.configure.title')}</Header>}>
              <SpaceBetween size="m">
                {activationError && <Alert type="error">{t('wizard.activateError')}</Alert>}
                <InputField
                  control={control}
                  name="name"
                  label={t('wizard.nameLabel')}
                  placeholder={t('wizard.namePlaceholder')}
                />
                <InputField control={control} name="ssid" label={t('wizard.ssidLabel')} />
                <InputField
                  control={control}
                  name="wifiPassword"
                  label={t('wizard.wifiPasswordLabel')}
                  type="password"
                />
                <InputField
                  control={control}
                  name="consolePassword"
                  label={t('wizard.consolePasswordLabel')}
                  type="password"
                />
                <CheckboxField control={control} name="communityConsole">
                  {t('wizard.communityConsoleLabel')}
                </CheckboxField>
                <Alert type="info">{t('wizard.localFlagsNote')}</Alert>
              </SpaceBetween>
            </Container>
          ),
        },
        {
          title: t('wizard.steps.params.title'),
          content: activationResult ? (
            <Container header={<Header variant="h2">{t('wizard.steps.params.title')}</Header>}>
              <SpaceBetween size="l">
                <Box>
                  <Box variant="awsui-key-label">{t('wizard.runCommandLabel')}</Box>
                  <Box variant="code">{buildOneLiner(values, activationResult)}</Box>
                  <CopyToClipboard
                    variant="icon"
                    copyButtonAriaLabel={t('wizard.copyCommand')}
                    textToCopy={buildOneLiner(values, activationResult)}
                    copySuccessText={t('wizard.copied')}
                    copyErrorText={t('wizard.activateError')}
                  />
                </Box>
                <Box>
                  <Box variant="awsui-key-label">{t('wizard.ssmOnlyLabel')}</Box>
                  <Box variant="code">{buildSsmOneLiner(activationResult)}</Box>
                  <CopyToClipboard
                    variant="icon"
                    copyButtonAriaLabel={t('wizard.copyCommand')}
                    textToCopy={buildSsmOneLiner(activationResult)}
                    copySuccessText={t('wizard.copied')}
                    copyErrorText={t('wizard.activateError')}
                  />
                </Box>
              </SpaceBetween>
            </Container>
          ) : null,
        },
        {
          title: t('wizard.steps.wait.title'),
          content: (
            <Container>
              {registeredDevice?.status === DeviceStatus.ONLINE ? (
                <SpaceBetween size="m">
                  <StatusIndicator type="success">
                    {t('wizard.deviceOnline', { name: registeredDevice.name })}
                  </StatusIndicator>
                  {registeredDevice.deviceType === DeviceType.CAR && (
                    <StatusIndicator type={registeredDevice.carType ? 'info' : 'pending'}>
                      {registeredDevice.carType
                        ? t('wizard.detectedCarType', { carType: t(`carType.${registeredDevice.carType}`) })
                        : t('wizard.detectingCarType')}
                    </StatusIndicator>
                  )}
                  <Button
                    variant="primary"
                    onClick={() => navigate(getPath(PageId.DEVICE_DETAIL, { instanceId: registeredDevice.instanceId }))}
                  >
                    {t('wizard.viewDevice')}
                  </Button>
                </SpaceBetween>
              ) : (
                <StatusIndicator type="in-progress">{t('wizard.waitingForDevice')}</StatusIndicator>
              )}
            </Container>
          ),
        },
      ]}
    />
  );
};

export default ActivateDevice;
