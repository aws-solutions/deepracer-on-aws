// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import CodeView from '@cloudscape-design/code-view/code-view';
import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import CodeEditor, { CodeEditorProps } from '@cloudscape-design/components/code-editor';
import Container from '@cloudscape-design/components/container';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import Header from '@cloudscape-design/components/header';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { RaceType } from '@deepracer-indy/typescript-client';
import { useEffect, useState } from 'react';
import { Control, UseFormSetValue, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import i18n from '#i18n/index.js';
import StopCondition from '#pages/CreateModel/components/StopCondition';
import {
  ADVANCED_REWARD_FUNCTION_PENALIZING_SPEED,
  ADVANCED_REWARD_FUNCTION_PENALIZING_STEERING,
  BASIC_REWARD_FUNCTION,
  OBJECT_AVOIDANCE_REWARD_FUNCTION,
} from '#pages/CreateModel/constants';
import { CreateModelFormValues } from '#pages/CreateModel/types';
import { useTestRewardFunctionMutation } from '#services/deepRacer/modelsApi';

import 'ace-builds/css/ace.css';
import 'ace-builds/css/theme/cloud_editor.css';
import 'ace-builds/css/theme/cloud_editor_dark.css';

const VALIDATE_WAIT_TIME = 10;
let timeoutId: NodeJS.Timeout;

const codeEditori18nStrings = {
  loadingState: i18n.t('createModel:testRewardFunction.codeEditorStrings.loadingState'),
  errorState: i18n.t('createModel:testRewardFunction.codeEditorStrings.errorState'),
  errorStateRecovery: i18n.t('createModel:testRewardFunction.codeEditorStrings.errorStateRecovery'),
  editorGroupAriaLabel: i18n.t('createModel:testRewardFunction.codeEditorStrings.editorGroupAriaLabel'),
  statusBarGroupAriaLabel: i18n.t('createModel:testRewardFunction.codeEditorStrings.statusBarGroupAriaLabel'),
  cursorPosition: (row: number, column: number) =>
    i18n.t('createModel:testRewardFunction.codeEditorStrings.cursorPosition', { row, column }),
  errorsTab: i18n.t('createModel:testRewardFunction.codeEditorStrings.errorsTab'),
  warningsTab: i18n.t('createModel:testRewardFunction.codeEditorStrings.warningsTab'),
  preferencesButtonAriaLabel: i18n.t('createModel:testRewardFunction.codeEditorStrings.preferencesButtonAriaLabel'),
  paneCloseButtonAriaLabel: i18n.t('createModel:testRewardFunction.codeEditorStrings.paneCloseButtonAriaLabel'),
  preferencesModalHeader: i18n.t('createModel:testRewardFunction.codeEditorStrings.preferencesModalHeader'),
  preferencesModalCancel: i18n.t('createModel:testRewardFunction.codeEditorStrings.preferencesModalCancel'),
  preferencesModalConfirm: i18n.t('createModel:testRewardFunction.codeEditorStrings.preferencesModalConfirm'),
  preferencesModalWrapLines: i18n.t('createModel:testRewardFunction.codeEditorStrings.preferencesModalWrapLines'),
  preferencesModalTheme: i18n.t('createModel:testRewardFunction.codeEditorStrings.preferencesModalTheme'),
  preferencesModalLightThemes: i18n.t('createModel:testRewardFunction.codeEditorStrings.preferencesModalLightThemes'),
  preferencesModalDarkThemes: i18n.t('createModel:testRewardFunction.codeEditorStrings.preferencesModalDarkThemes'),
};

interface RewardFunctionProps {
  control: Control<CreateModelFormValues>;
  setValue: UseFormSetValue<CreateModelFormValues>;
}

const RewardFunction = ({ control, setValue }: RewardFunctionProps) => {
  const { t } = useTranslation('createModel', { keyPrefix: 'testRewardFunction' });
  const rewardFunctionCode = useWatch({ control, name: 'metadata.rewardFunction' });
  const raceType = useWatch({ control, name: 'trainingConfig.raceType' });
  const trackConfig = useWatch({ control, name: 'trainingConfig.trackConfig' });

  const [testRewardFunction, { isLoading: isTestRewardFunctionLoading }] = useTestRewardFunctionMutation();

  const [ace, setAce] = useState<CodeEditorProps['ace']>();
  const [isAceLoading, setIsAceLoading] = useState(false);
  const [preferences, setPreferences] = useState({});
  const [isExamplesModalVisible, setIsExamplesModalVisible] = useState(false);
  const [isAlertVisible, setIsAlertVisible] = useState(false);
  const [counter, setCounter] = useState(0);
  const [rewardFunctionErrorMessage, setRewardFunctionErrorMessage] = useState('');

  useEffect(() => {
    async function loadAce() {
      setIsAceLoading(true);
      const aceImport = await import('ace-builds');
      await import('ace-builds/esm-resolver');
      aceImport.config.set('useStrictCSP', true);
      return aceImport;
    }
    loadAce()
      .then((ac) => setAce(ac))
      .catch(() => {
        /** no-op */
      })
      .finally(() => setIsAceLoading(false));
  }, []);

  useEffect(() => {
    if (counter < 1) {
      clearTimeout(timeoutId);
      setCounter(0);
    }
  }, [counter]);

  const handleReset = () => {
    raceType === RaceType.TIME_TRIAL
      ? setValue('metadata.rewardFunction', BASIC_REWARD_FUNCTION)
      : setValue('metadata.rewardFunction', OBJECT_AVOIDANCE_REWARD_FUNCTION);
    setIsAlertVisible(false);
  };

  const handleValidate = () => {
    setIsAlertVisible(false);
    setCounter(VALIDATE_WAIT_TIME);
    timeoutId = setInterval(() => setCounter((oldCounter) => oldCounter - 1), 1000);
    testRewardFunction({
      rewardFunction: rewardFunctionCode,
      trackConfig,
    })
      .unwrap()
      .then((errors) => {
        if (errors.length) {
          setRewardFunctionErrorMessage(errors[0].message);
        } else {
          setRewardFunctionErrorMessage('');
        }
      })
      .catch(() => {
        // no-op
      })
      .finally(() => {
        setIsAlertVisible(true);
        setCounter(0);
        clearTimeout(timeoutId);
      });
  };

  return (
    <>
      <SpaceBetween size="l">
        <Container
          header={
            <Header variant="h2" description={t('rewardFunctionDescription')}>
              {t('rewardFunctionHeader')}
            </Header>
          }
        >
          <SpaceBetween size="l">
            <Header
              variant="h3"
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button onClick={() => setIsExamplesModalVisible(true)}>{t('rewardFunctonExamples')}</Button>
                  <Button onClick={handleReset}>{t('reset')}</Button>
                  <Button onClick={handleValidate} loading={isTestRewardFunctionLoading}>
                    {t('validate', { count: counter, seconds: counter })}
                  </Button>
                </SpaceBetween>
              }
            >
              {t('codeEditor')}
            </Header>

            {isAlertVisible && (
              <Alert
                type={rewardFunctionErrorMessage.length ? 'error' : 'success'}
                onDismiss={() => setIsAlertVisible(false)}
                dismissible={true}
              >
                {rewardFunctionErrorMessage || t('rewardFunctionValidated')}
              </Alert>
            )}

            <hr />

            <CodeEditor
              language={'python'}
              value={rewardFunctionCode}
              ace={ace}
              loading={isAceLoading}
              preferences={preferences}
              i18nStrings={codeEditori18nStrings}
              onPreferencesChange={({ detail }) => setPreferences(detail)}
              onDelayedChange={({ detail }) => {
                setValue('metadata.rewardFunction', detail.value);
              }}
              themes={{ light: ['cloud_editor'], dark: ['cloud_editor_dark'] }}
            />
          </SpaceBetween>
        </Container>
        <StopCondition control={control} />
      </SpaceBetween>
      <Modal
        visible={isExamplesModalVisible}
        header={t('codeExamples')}
        onDismiss={() => setIsExamplesModalVisible(false)}
        size="large"
      >
        <ExpandableSection defaultExpanded headerText={t('timeTrialFollowCenter')}>
          <Box variant="p">{t('timeTrialFollowCenterDescription')}</Box>
          <CodeView
            actions={
              <Button
                onClick={() => {
                  setValue('metadata.rewardFunction', BASIC_REWARD_FUNCTION);
                  setIsExamplesModalVisible(false);
                }}
              >
                {t('useCode')}
              </Button>
            }
            content={BASIC_REWARD_FUNCTION}
            lineNumbers
          />
        </ExpandableSection>
        <ExpandableSection headerText={t('timeTrialStayInBorder')}>
          <Box variant="p">{t('timeTrialStayInBorderDescription')}</Box>
          <CodeView
            actions={
              <Button
                onClick={() => {
                  setValue('metadata.rewardFunction', ADVANCED_REWARD_FUNCTION_PENALIZING_STEERING);
                  setIsExamplesModalVisible(false);
                }}
              >
                {t('useCode')}
              </Button>
            }
            content={ADVANCED_REWARD_FUNCTION_PENALIZING_STEERING}
            lineNumbers
          />
        </ExpandableSection>
        <ExpandableSection headerText={t('timeTrialPreventZigzag')}>
          <Box variant="p">{t('timeTrialPreventZigzagDescription')}</Box>
          <CodeView
            actions={
              <Button
                onClick={() => {
                  setValue('metadata.rewardFunction', ADVANCED_REWARD_FUNCTION_PENALIZING_SPEED);
                  setIsExamplesModalVisible(false);
                }}
              >
                {t('useCode')}
              </Button>
            }
            content={ADVANCED_REWARD_FUNCTION_PENALIZING_SPEED}
            lineNumbers
          />
        </ExpandableSection>
        <ExpandableSection headerText={t('objectAvoidanceExample')}>
          <Box variant="p">{t('objectAvoidanceExampleDescription')}</Box>
          <CodeView
            actions={
              <Button
                onClick={() => {
                  setValue('metadata.rewardFunction', OBJECT_AVOIDANCE_REWARD_FUNCTION);
                  setIsExamplesModalVisible(false);
                }}
              >
                {t('useCode')}
              </Button>
            }
            content={OBJECT_AVOIDANCE_REWARD_FUNCTION}
            lineNumbers
          />
        </ExpandableSection>
      </Modal>
    </>
  );
};

export default RewardFunction;
