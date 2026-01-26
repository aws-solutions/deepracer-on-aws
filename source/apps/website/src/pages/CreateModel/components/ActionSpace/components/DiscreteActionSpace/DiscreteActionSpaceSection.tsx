// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import Grid from '@cloudscape-design/components/grid';
import Header from '@cloudscape-design/components/header';
import Icon from '@cloudscape-design/components/icon';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import Toggle from '@cloudscape-design/components/toggle';
import { DiscreteActionSpaceItem } from '@deepracer-indy/typescript-client';
import { useEffect, useState } from 'react';
import { Control, UseFormResetField, UseFormSetValue, useWatch } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';

import actionSpaceCarBackground from '#assets/images/carGraph.png';
import InputField from '#components/FormFields/InputField/InputField';
import SelectField from '#components/FormFields/SelectField/SelectField';
import { IndexedDiscreteActionSpaceItem } from '#pages/CreateModel/components/ActionSpace/components/DiscreteActionSpace/types';
import { DEFAULT_DISCRETE_ACTION_SPACE } from '#pages/CreateModel/constants';
import { CreateModelFormValues } from '#pages/CreateModel/types';

import DiscreteTableInput from './DiscreteTableInput';
import InteractiveArrow from './InteractiveArrow';
import { computeDiscreteActionSpace } from './utils';
import {
  DiscreteActionValueType,
  GRAPH_PRIMARY,
  MAX_ACTIONS,
  MAX_ACTIONS_PER_PAGE,
  MAX_SPEED_MAX,
  MAX_SPEED_MIN,
  MAX_STEERING_ANGLE_MAX,
  MAX_STEERING_ANGLE_MIN,
  MIN_ACTIONS,
  MIN_STEERING,
} from '../../constants';

interface DiscreteActionSpaceSectionProps {
  control: Control<CreateModelFormValues>;
  resetField: UseFormResetField<CreateModelFormValues>;
  setValue: UseFormSetValue<CreateModelFormValues>;
}

const DiscreteActionSpaceSection = ({ control, setValue }: DiscreteActionSpaceSectionProps) => {
  const { t } = useTranslation('createModel', { keyPrefix: 'actionSpace' });

  const isAdvancedConfigOn = useWatch({ control, name: 'actionSpaceForm.isAdvancedConfigOn' });
  const maxSpeed = useWatch({ control, name: 'actionSpaceForm.maxSpeed' });
  const maxSteeringAngle = useWatch({ control, name: 'actionSpaceForm.maxSteeringAngle' });
  const speedGranularity = useWatch({ control, name: 'actionSpaceForm.speedGranularity' });
  const steeringAngleGranularity = useWatch({ control, name: 'actionSpaceForm.steeringAngleGranularity' });
  const formDiscreteActionSpace = useWatch({ control, name: 'metadata.actionSpace.discrete' });
  const preTrainedModelId = useWatch({ control, name: 'preTrainedModelId' });

  const isClonedModel = !!preTrainedModelId;

  // Table and graph states
  const [isModalAdvancedVisible, setIsModalAdvancedVisible] = useState(false);
  const [isModalDeleteVisible, setIsModalDeleteVisible] = useState(false);
  const [userDidModifyActions, setUserDidModifyActions] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [enabledAction, setEnabledAction] = useState(0);
  const [actionList, setActionList] = useState<IndexedDiscreteActionSpaceItem[]>(
    formDiscreteActionSpace?.length
      ? formDiscreteActionSpace.map((item, i): IndexedDiscreteActionSpaceItem => {
          return {
            steeringAngle: item.steeringAngle,
            speed: item.speed,
            index: i,
          };
        })
      : DEFAULT_DISCRETE_ACTION_SPACE,
  );
  const [actionToDelete, setActionToDelete] = useState(0);
  const [currentTablePageIndex, setCurrentTablePageIndex] = useState(1);
  const [tableActions, setTableActions] = useState<IndexedDiscreteActionSpaceItem[]>(actionList);
  const [focusedInputs, setFocusedInputs] = useState<Set<string>>(new Set());

  useEffect(() => {
    setValue('metadata.actionSpace', {
      discrete: actionList.map((item): DiscreteActionSpaceItem => {
        return { steeringAngle: item.steeringAngle, speed: item.speed };
      }),
    });
  }, [actionList, setValue]);

  useEffect(() => {
    setValue('metadata.actionSpace', {
      discrete: tableActions.map((item): DiscreteActionSpaceItem => {
        return { steeringAngle: item.steeringAngle, speed: item.speed };
      }),
    });
  }, [tableActions, setValue]);

  const updateRowListeners = () => {
    const tbody = document.getElementsByTagName('tbody');
    // Create empty HTMLCollection
    let rows = document
      .createElement('div')
      .getElementsByClassName('nonExistingClassName') as HTMLCollectionOf<HTMLTableRowElement>;

    if (tbody.length === 1) {
      rows = tbody[0].children as HTMLCollectionOf<HTMLTableRowElement>;
    }

    // Add click listeners when table re-renders due to action list state changes
    for (let i = 0; i < rows.length; i++) {
      const actionIndex = (currentTablePageIndex - 1) * MAX_ACTIONS_PER_PAGE + i;
      rows[i].addEventListener('click', (e: Event) => {
        if (
          (e.target as HTMLElement).tagName !== 'BUTTON' &&
          ((e.target as HTMLElement).parentNode as HTMLElement).tagName !== 'BUTTON'
        ) {
          e.stopImmediatePropagation();
          setEnabledAction((currentTablePageIndex - 1) * MAX_ACTIONS_PER_PAGE + i);
        }
      });
      rows[i].onmouseover = () => {
        if ((currentTablePageIndex - 1) * MAX_ACTIONS_PER_PAGE + i !== enabledAction) {
          rows[i].style.backgroundColor = 'rgba(121, 156, 255, 0.15)';
        }
      };
      rows[i].onmouseout = () => {
        if ((currentTablePageIndex - 1) * MAX_ACTIONS_PER_PAGE + i !== enabledAction) {
          rows[i].style.backgroundColor = 'inherit';
        }
      };
      rows[i].style.cursor = 'pointer';
      rows[i].style.backgroundColor = actionIndex === enabledAction ? GRAPH_PRIMARY : 'inherit';
    }
  };

  const updateActionSpaceItem = (graphId: number, valueType: DiscreteActionValueType, value: number) => {
    let actionSpaceDidChange = false;
    if (actionList) {
      if (
        (valueType === DiscreteActionValueType.SPEED && Number(actionList[graphId].speed) !== value) ||
        (valueType === DiscreteActionValueType.STEERING_ANGLE && Number(actionList[graphId].steeringAngle) !== value)
      ) {
        actionSpaceDidChange = true;
      }

      setUserDidModifyActions(actionSpaceDidChange || userDidModifyActions);
      setActionList(
        actionList.map((item) => {
          if (item.index === graphId) {
            if (valueType === DiscreteActionValueType.SPEED) {
              return { ...item, speed: value };
            } else {
              return { ...item, steeringAngle: value };
            }
          }
          return item;
        }),
      );
    }
  };

  const setValuesFromGraph = (graphId: number, speed: number, angle: number) => {
    setUserDidModifyActions(true);
    setActionList(
      actionList.map((item) => {
        if (item.index === graphId) {
          return {
            index: graphId,
            steeringAngle: angle,
            speed,
          };
        }
        return item;
      }),
    );
  };

  const setActiveDrag = (graphId: number, isActive: boolean) => {
    const newTablePageIndex = Math.floor(graphId / MAX_ACTIONS_PER_PAGE) + 1;
    setIsDragActive(isActive);
    setEnabledAction(graphId);
    setCurrentTablePageIndex(newTablePageIndex);
    setTableActions(
      actionList.slice(
        (newTablePageIndex - 1) * MAX_ACTIONS_PER_PAGE,
        MAX_ACTIONS_PER_PAGE + (newTablePageIndex - 1) * MAX_ACTIONS_PER_PAGE,
      ),
    );
  };

  const handleFocusChange = (graphId: number, valueType: DiscreteActionValueType, focused: boolean) => {
    const focusKey = `${graphId}_${valueType}`;
    setFocusedInputs((prev) => {
      const newSet = new Set(prev);
      if (focused) {
        newSet.add(focusKey);
      } else {
        newSet.delete(focusKey);
      }
      return newSet;
    });
  };

  // Modal to delete a table item
  const ModalDeleteAction = () => {
    return (
      <Modal
        onDismiss={() => {
          setIsModalDeleteVisible(false);
        }}
        visible={isModalDeleteVisible}
        size="medium"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => {
                  setIsModalDeleteVisible(false);
                }}
              >
                {t('discreteSection.deleteModal.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (actionList.length > 1) {
                    const updatedTablePageIndex =
                      actionToDelete === actionList.length - 1 && tableActions.length === 1
                        ? currentTablePageIndex - 1
                        : currentTablePageIndex;

                    const newActionList = actionList
                      .filter((a) => a.index !== actionToDelete)
                      .map((a) => {
                        if (a.index > actionToDelete) {
                          return { ...a, index: a.index - 1 };
                        } else {
                          return a;
                        }
                      });
                    setActionList(newActionList);
                    setIsModalDeleteVisible(false);
                    setEnabledAction(enabledAction === newActionList.length ? enabledAction - 1 : enabledAction);
                    setUserDidModifyActions(true);
                    setCurrentTablePageIndex(updatedTablePageIndex);
                    setTableActions(
                      newActionList.slice(
                        (updatedTablePageIndex - 1) * MAX_ACTIONS_PER_PAGE,
                        MAX_ACTIONS_PER_PAGE + (updatedTablePageIndex - 1) * MAX_ACTIONS_PER_PAGE,
                      ),
                    );
                  }
                }}
              >
                {t('discreteSection.deleteModal.delete')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('discreteSection.deleteModal.header')}
      >
        {t('discreteSection.deleteModal.description')}
      </Modal>
    );
  };

  // Modal to toggle showing advanced config
  const ModalAdvancedOff = () => {
    return (
      <Modal
        onDismiss={() => {
          setIsModalAdvancedVisible(false);
        }}
        visible={isModalAdvancedVisible}
        size="medium"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => {
                  setIsModalAdvancedVisible(false);
                }}
              >
                {t('discreteSection.advancedModal.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const defaultActionSpace = computeDiscreteActionSpace(
                    maxSteeringAngle,
                    steeringAngleGranularity,
                    maxSpeed,
                    speedGranularity,
                  );
                  setValue('actionSpaceForm.isAdvancedConfigOn', false);
                  setActionList(defaultActionSpace);
                  setTableActions(defaultActionSpace.slice(0, MAX_ACTIONS_PER_PAGE));
                  setIsModalAdvancedVisible(false);
                  setEnabledAction(0);
                  setUserDidModifyActions(false);
                }}
              >
                {t('discreteSection.advancedModal.disable')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('discreteSection.advancedModal.header')}
      >
        {t('discreteSection.advancedModal.description')}
      </Modal>
    );
  };

  return (
    <Container
      data-testid={t('discreteSection.defineHeader')}
      header={<Header>{t('discreteSection.defineHeader')}</Header>}
    >
      {!isClonedModel && (
        <SpaceBetween direction="vertical" size="m">
          <Box>
            <Box variant="h3">{t('discreteSection.steeringAngle')}</Box>
            <Box variant="p">{t('discreteSection.steeringAngleDescription')}</Box>
          </Box>
          <ColumnLayout columns={3}>
            <SelectField
              control={control}
              type="number"
              name="actionSpaceForm.steeringAngleGranularity"
              label={t('discreteSection.steeringAngleGranularity')}
              onChange={({ detail }) => {
                const newActionList = computeDiscreteActionSpace(
                  maxSteeringAngle,
                  Number(detail.selectedOption.value),
                  maxSpeed,
                  Number(speedGranularity),
                );
                setTableActions(newActionList);
                setActionList(newActionList);
              }}
              options={[
                { label: '3', value: 3 },
                { label: '5', value: 5 },
                { label: '7', value: 7 },
              ]}
            />
            <InputField
              control={control}
              onChange={({ detail }) => {
                if (detail.value <= MAX_STEERING_ANGLE_MAX && detail.value >= MAX_STEERING_ANGLE_MIN) {
                  const newActionList = computeDiscreteActionSpace(
                    detail.value,
                    steeringAngleGranularity,
                    maxSpeed,
                    speedGranularity,
                  );
                  setTableActions(newActionList);
                  setActionList(newActionList);
                }
              }}
              name="actionSpaceForm.maxSteeringAngle"
              label={t('discreteSection.maxSteeringAngle')}
              constraintText={t('discreteSection.maxSteeringAngleConstraintText')}
              type="number"
            />
          </ColumnLayout>
          <Box>
            <Box variant="h3">{t('discreteSection.speed')}</Box>
            <Box variant="p">
              <Trans t={t}>{t('discreteSection.speedDescription')}</Trans>
            </Box>
          </Box>
          <ColumnLayout columns={3}>
            <SelectField
              control={control}
              type="number"
              name="actionSpaceForm.speedGranularity"
              label={t('discreteSection.speedGranularity')}
              onChange={({ detail }) => {
                const newActionList = computeDiscreteActionSpace(
                  maxSteeringAngle,
                  steeringAngleGranularity,
                  maxSpeed,
                  detail.selectedOption.value,
                );
                setTableActions(newActionList);
                setActionList(newActionList);
              }}
              options={[
                { label: '1', value: 1 },
                { label: '2', value: 2 },
                { label: '3', value: 3 },
              ]}
            />
            <InputField
              control={control}
              constraintText={t('discreteSection.maxSpeedConstraintText')}
              name="actionSpaceForm.maxSpeed"
              label={t('discreteSection.maxSpeed')}
              onChange={({ detail }) => {
                if (detail.value <= MAX_SPEED_MAX && detail.value >= MAX_SPEED_MIN) {
                  const newActionList = computeDiscreteActionSpace(
                    maxSteeringAngle,
                    steeringAngleGranularity,
                    detail.value,
                    speedGranularity,
                  );
                  setTableActions(newActionList);
                  setActionList(newActionList);
                }
              }}
              type="number"
              step={0.1}
            />
          </ColumnLayout>
          <Alert statusIconAriaLabel="Info">{t('discreteSection.advancedConfigAlert')}</Alert>
        </SpaceBetween>
      )}
      {isClonedModel && <Alert statusIconAriaLabel="Info">{t('discreteSection.clonedModelAlert')}</Alert>}
      <br />
      <Grid gridDefinition={[{ colspan: { default: 12, xs: 6 } }, { colspan: { default: 8, xs: 6 } }]}>
        <div className="action_space_table_wrapper">
          <ModalAdvancedOff />
          {isAdvancedConfigOn ? (
            <>
              <ModalDeleteAction />
              <Table
                ref={!isDragActive ? updateRowListeners : null}
                wrapLines
                header={
                  <div className="table_header">
                    <Box tagOverride="h3" variant="h2">
                      {t('discreteSection.actionList')}
                    </Box>
                    {!isClonedModel && (
                      <span className="toggle_wrapper">
                        <Toggle
                          onChange={({ detail }) => {
                            if (detail.checked) {
                              setValue('actionSpaceForm.isAdvancedConfigOn', true);
                              setEnabledAction(0);
                            } else if (!isModalAdvancedVisible && userDidModifyActions) {
                              setIsModalAdvancedVisible(true);
                            } else {
                              setValue('actionSpaceForm.isAdvancedConfigOn', false);
                              setActionList(
                                computeDiscreteActionSpace(
                                  maxSteeringAngle,
                                  steeringAngleGranularity,
                                  maxSpeed,
                                  speedGranularity,
                                ),
                              );
                              setIsModalAdvancedVisible(false);
                              setEnabledAction(0);
                              setUserDidModifyActions(false);
                            }
                          }}
                          checked={isAdvancedConfigOn}
                        >
                          {t('discreteSection.advancedConfig')}
                        </Toggle>
                      </span>
                    )}
                  </div>
                }
                trackBy="index"
                columnDefinitions={[
                  {
                    id: 'action_table_index',
                    header: (
                      <div id={'advanced_config_table_header_Action'} className="advanced_config_table_header">
                        {t('discreteSection.action')}
                      </div>
                    ),
                    cell: (item: IndexedDiscreteActionSpaceItem) => {
                      return (
                        <div className={enabledAction === item.index ? 'selectedRowWhiteText' : ''}>{item.index}</div>
                      );
                    },
                  },
                  {
                    id: 'action_table_angle',
                    header: (
                      <>
                        <div id={'advanced_config_table_header_Steering'} className="advanced_config_table_header">
                          {t('discreteSection.steeringAngle')}
                        </div>
                        <div id="steeringAngle_table_hint">{t('discreteSection.steeringAngleChoose')}</div>
                      </>
                    ),
                    cell: (item: IndexedDiscreteActionSpaceItem) => {
                      return (
                        <div className={`input_row${enabledAction === item.index ? ' selectedRowWhiteText' : ''}`}>
                          <span className="table_input_wrapper">
                            <DiscreteTableInput
                              graphId={Number(item.index)}
                              valueType={DiscreteActionValueType.STEERING_ANGLE}
                              max={MAX_STEERING_ANGLE_MAX}
                              min={MIN_STEERING}
                              defaultValue={Number(item.steeringAngle.toFixed(1))}
                              action={actionList[item.index]}
                              updateActionSpaceItem={updateActionSpaceItem}
                              isEnabledAction={item.index === enabledAction}
                              isFocused={focusedInputs.has(`${item.index}_${DiscreteActionValueType.STEERING_ANGLE}`)}
                              onFocusChange={handleFocusChange}
                            />
                          </span>
                          <Box variant="span" padding={{ left: 'xxs' }} color="inherit">
                            {t('discreteSection.degrees')}
                          </Box>
                        </div>
                      );
                    },
                  },
                  {
                    id: 'action_table_speed',
                    header: (
                      <>
                        <div id={'advanced_config_table_header_Speed'} className="advanced_config_table_header">
                          {t('discreteSection.speed')}
                        </div>
                        <div id="speed_table_hint">{t('discreteSection.speedChoose')}</div>
                      </>
                    ),
                    cell: (item: IndexedDiscreteActionSpaceItem) => {
                      return (
                        <div className={`input_row${enabledAction === item.index ? ' selectedRowWhiteText' : ''}`}>
                          <span className="table_input_wrapper">
                            <DiscreteTableInput
                              graphId={item.index}
                              valueType={DiscreteActionValueType.SPEED}
                              max={MAX_SPEED_MAX}
                              min={MAX_SPEED_MIN}
                              defaultValue={Number(item.speed.toFixed(2))}
                              action={actionList[item.index]}
                              updateActionSpaceItem={updateActionSpaceItem}
                              isEnabledAction={item.index === enabledAction}
                              isFocused={focusedInputs.has(`${item.index}_${DiscreteActionValueType.SPEED}`)}
                              onFocusChange={handleFocusChange}
                            />
                          </span>
                          <Box variant="span" color="inherit" padding={{ left: 'xxs' }}>
                            {t('discreteSection.metersPerSecond')}
                          </Box>
                          {!isClonedModel && (
                            <span className="remove_button_container">
                              <Button
                                iconName="close"
                                variant={enabledAction === item.index ? 'primary' : 'normal'}
                                iconAlign="right"
                                onClick={() => {
                                  // Remove action
                                  if (actionList.length > MIN_ACTIONS && !isModalDeleteVisible) {
                                    setActionToDelete(item.index);
                                    setIsModalDeleteVisible(true);
                                  }
                                }}
                              />
                            </span>
                          )}
                        </div>
                      );
                    },
                  },
                ]}
                items={tableActions}
              />
              {!isClonedModel && (
                <div id="add_action_button_wrapper">
                  <Button
                    id="add_button"
                    iconName="add-plus"
                    onClick={() => {
                      if (actionList.length > 0 && actionList.length < MAX_ACTIONS) {
                        const newActionList = [
                          ...actionList,
                          {
                            index: actionList.length,
                            steeringAngle: actionList[actionList.length - 1].steeringAngle,
                            speed: actionList[actionList.length - 1].speed,
                          },
                        ];
                        setActionList(newActionList);
                        setUserDidModifyActions(true);
                        setTableActions(
                          newActionList.slice(
                            (currentTablePageIndex - 1) * MAX_ACTIONS_PER_PAGE,
                            MAX_ACTIONS_PER_PAGE + (currentTablePageIndex - 1) * MAX_ACTIONS_PER_PAGE,
                          ),
                        );
                      }
                    }}
                    disabled={actionList.length >= MAX_ACTIONS}
                  >
                    {t('discreteSection.addAction')}
                  </Button>
                  <div id="add_action_hint">
                    {t('discreteSection.addActionHint', {
                      count: MAX_ACTIONS - actionList.length,
                      remaining: MAX_ACTIONS - actionList.length,
                      maxLimit: MAX_ACTIONS,
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <Table
              header={
                <div className="table_header">
                  <Box tagOverride="h3" variant="h2">
                    {t('discreteSection.actionList')}
                  </Box>
                  <span className="toggle_wrapper">
                    <Toggle
                      onChange={({ detail }) => {
                        if (
                          detail.checked &&
                          maxSpeed <= MAX_SPEED_MAX &&
                          maxSpeed >= MAX_SPEED_MIN &&
                          maxSteeringAngle <= MAX_STEERING_ANGLE_MAX &&
                          maxSteeringAngle >= MAX_STEERING_ANGLE_MIN
                        ) {
                          setValue('actionSpaceForm.isAdvancedConfigOn', true);
                          setEnabledAction(0);
                        } else if (!detail.checked && !isModalAdvancedVisible && userDidModifyActions) {
                          setIsModalAdvancedVisible(true);
                        } else if (!detail.checked) {
                          setValue('actionSpaceForm.isAdvancedConfigOn', false);
                          setActionList(
                            computeDiscreteActionSpace(
                              maxSteeringAngle,
                              steeringAngleGranularity,
                              maxSpeed,
                              speedGranularity,
                            ),
                          );
                          setIsModalAdvancedVisible(false);
                          setEnabledAction(0);
                          setUserDidModifyActions(false);
                        }
                      }}
                      checked={isAdvancedConfigOn}
                    >
                      {t('discreteSection.advancedConfig')}
                    </Toggle>
                  </span>
                </div>
              }
              columnDefinitions={[
                {
                  header: t('discreteSection.action'),
                  cell: (item: IndexedDiscreteActionSpaceItem) => item.index,
                },
                {
                  header: t('discreteSection.steeringLabel'),
                  cell: (item: IndexedDiscreteActionSpaceItem) => {
                    return (
                      <div>
                        {item.steeringAngle.toFixed(1)}
                        <Box variant="span" padding={{ left: 'xxs' }}>
                          {t('discreteSection.degrees')}
                        </Box>
                      </div>
                    );
                  },
                },
                {
                  header: t('discreteSection.speed'),
                  cell: (item: IndexedDiscreteActionSpaceItem) => {
                    return (
                      <div>
                        {item.speed.toFixed(2)}
                        <Box variant="span" padding={{ left: 'xxs' }}>
                          {t('discreteSection.metersPerSecond')}
                        </Box>
                      </div>
                    );
                  },
                },
              ]}
              items={tableActions}
            />
          )}
        </div>
        <div className="discrete_graph_wrapper">
          <Box tagOverride="h3" variant="h4">
            {t('discreteSection.radialPolarGraph')}
          </Box>
          <div id="PLCHLDR_action_space_img" className="interactiveGraphImgContainer">
            <div className="interactiveGraphContainer">
              <img
                alt={t('discreteSection.carImageAlt')}
                src={actionSpaceCarBackground}
                width="100%"
                max-width="420px"
              />
              <svg
                className="action_space_svg"
                viewBox={'0 0 360 60'}
                height="100%"
                width="100%"
                preserveAspectRatio="xMidYMin"
              >
                <g id="action_space_arrows_group" fill="none" fillRule="evenodd" transform-box="fill-box">
                  {actionList.map((item, i) => {
                    if (
                      (i !== actionList.length - 1 && i !== enabledAction) ||
                      enabledAction === actionList.length - 1
                    ) {
                      return (
                        <InteractiveArrow
                          key={`arrow_discrete_${item.index}`}
                          xOrigin={180}
                          yOrigin={148}
                          maxRadius={138}
                          rotateAngle={actionList[item.index].steeringAngle}
                          speedCurrent={actionList[item.index].speed}
                          enabled={item.index === enabledAction && isAdvancedConfigOn}
                          isAdvancedConfigOn={isAdvancedConfigOn}
                          setActionValues={setValuesFromGraph}
                          setGraphDragIsActive={setActiveDrag}
                          graphId={item.index}
                        />
                      );
                    } else if (i === actionList.length - 1 && enabledAction < actionList.length) {
                      // Always render enabled arrow last so that it appears on top of others
                      return (
                        <>
                          <InteractiveArrow
                            key={`arrow_discrete_${item.index}`}
                            xOrigin={180}
                            yOrigin={148}
                            maxRadius={138}
                            rotateAngle={actionList[item.index].steeringAngle}
                            speedCurrent={actionList[item.index].speed}
                            enabled={item.index === enabledAction && isAdvancedConfigOn}
                            isAdvancedConfigOn={isAdvancedConfigOn}
                            setActionValues={setValuesFromGraph}
                            setGraphDragIsActive={setActiveDrag}
                            graphId={item.index}
                          />
                          <InteractiveArrow
                            key={`arrow_discrete_${enabledAction}`}
                            xOrigin={180}
                            yOrigin={148}
                            maxRadius={138}
                            rotateAngle={actionList[enabledAction].steeringAngle}
                            speedCurrent={actionList[enabledAction].speed}
                            isAdvancedConfigOn={isAdvancedConfigOn}
                            enabled={isAdvancedConfigOn}
                            setActionValues={setValuesFromGraph}
                            setGraphDragIsActive={setActiveDrag}
                            graphId={enabledAction}
                          />
                        </>
                      );
                    }
                    return <div key={`empty_${item.index}`}></div>;
                  })}
                </g>
              </svg>
            </div>
            {isAdvancedConfigOn && (
              <div className="discrete_graph_info">
                <div className="discrete_selected_action_label">
                  <svg width="80px" height="20px">
                    <rect x="60" y="0" width="20" height="20" fill={GRAPH_PRIMARY} strokeWidth="0" />
                  </svg>
                  <Box variant="span" padding={{ left: 'xxs' }}>
                    {t('discreteSection.selectedAction')}
                  </Box>
                </div>
                <div className="modify_graph_hint">
                  <Icon name="status-info" size="normal" variant="normal" />
                  <Box variant="small" padding={{ left: 'xxs' }}>
                    {t('discreteSection.selectActionHint')}
                  </Box>
                </div>
              </div>
            )}
          </div>
        </div>
      </Grid>
    </Container>
  );
};

export default DiscreteActionSpaceSection;
